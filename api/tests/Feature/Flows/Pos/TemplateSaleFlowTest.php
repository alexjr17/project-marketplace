<?php

namespace Tests\Feature\Flows\Pos;

use App\Models\InputVariantMovement;
use App\Models\TemplateRecipe;
use App\Models\VariantMovement;

/**
 * Caracterización de la venta de plantillas (isTemplate): el stock sale de la
 * receta (insumos), la venta consume insumos y no toca el stock de la variante.
 */
class TemplateSaleFlowTest extends PosFlowTestCase
{
    public function test_el_stock_de_la_plantilla_sale_de_la_receta(): void
    {
        $this->cajeroConCaja();
        [$tpl] = $this->makeTemplateWithRecipe(70000, 11, 2);

        // floor(11 / 2) = 5 aunque la variante tenga stock 0.
        $this->postJson('/api/pos/scan', ['barcode' => $tpl->barcode])
            ->assertOk()
            ->assertJsonPath('data.variantId', $tpl->id)
            ->assertJsonPath('data.stock', 5)
            ->assertJsonPath('data.available', true);
    }

    public function test_venta_de_plantilla_consume_insumos_y_no_toca_la_variante(): void
    {
        [, $register, $session] = $this->cajeroConCaja();
        [$tpl, $iv] = $this->makeTemplateWithRecipe(70000, 10, 2);

        $order = $this->sellOk($register, [[$tpl, 2]]);

        $this->assertSame(140000.0, (float) $order->total);
        $this->assertSame(6.0, (float) $iv->fresh()->currentStock);
        $this->assertSame(0, $this->stockOf($tpl));
        $this->assertSame(0, VariantMovement::count());

        $mov = InputVariantMovement::where('inputVariantId', $iv->id)->sole();
        $this->assertSame('SALIDA', $mov->movementType);
        $this->assertSame(-4.0, (float) $mov->quantity);
        $this->assertSame(10.0, (float) $mov->previousStock);
        $this->assertSame(6.0, (float) $mov->newStock);
        $this->assertSame('sale', $mov->referenceType);
        $this->assertSame($order->id, (int) $mov->referenceId);
        $this->assertSame('Venta POS - Template Plantilla POS', $mov->reason);

        // ACTUAL: el stock del insumo padre (inputs.currentStock) no se actualiza.
        $this->assertSame(10.0, (float) $iv->input()->value('currentStock'));
        $this->assertSame(140000.0, (float) $session->fresh()->totalSales);
    }

    public function test_plantilla_sin_insumos_suficientes_no_se_vende(): void
    {
        [, $register] = $this->cajeroConCaja();
        [$tpl, $iv] = $this->makeTemplateWithRecipe(70000, 10, 2);

        $this->sell($register, [[$tpl, 6]])
            ->assertStatus(400)
            ->assertJsonPath('message', 'Stock insuficiente para '.$tpl->sku.'. Disponible: 5, Solicitado: 6');
        $this->assertSame(10.0, (float) $iv->fresh()->currentStock);
    }

    public function test_anular_venta_de_plantilla_devuelve_los_insumos_y_no_toca_la_variante(): void
    {
        [, $register] = $this->cajeroConCaja();
        [$tpl, $iv] = $this->makeTemplateWithRecipe(70000, 10, 2);
        $order = $this->sellOk($register, [[$tpl, 2]]);

        $this->postJson("/api/pos/sale/{$order->id}/cancel", ['reason' => 'cliente desiste'])->assertOk();

        // Corregido (fase 3): vuelven los 4 insumos consumidos y la variante (que nunca se
        // descontó) sigue en 0. Antes sumaba 2 a la variante y los insumos no volvían.
        $this->assertSame(0, $this->stockOf($tpl));
        $this->assertSame(10.0, (float) $iv->fresh()->currentStock);
        $back = InputVariantMovement::where('movementType', 'DEVOLUCION')->sole();
        $this->assertSame(4.0, (float) $back->quantity);
        $this->assertSame($order->id, (int) $back->referenceId);
        $this->assertSame(0, VariantMovement::count());
    }

    public function test_devolucion_de_plantilla_devuelve_los_insumos_de_lo_devuelto(): void
    {
        [, $register] = $this->cajeroConCaja();
        [$tpl, $iv] = $this->makeTemplateWithRecipe(70000, 10, 2);
        $order = $this->sellOk($register, [[$tpl, 2]]);

        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $tpl->id, 'quantity' => 1]]])
            ->assertOk();

        // Corregido (fase 3): vuelve el insumo de la unidad devuelta (2) y la variante no cambia.
        $this->assertSame(0, $this->stockOf($tpl));
        $this->assertSame(8.0, (float) $iv->fresh()->currentStock);
        $this->assertSame(0, VariantMovement::count());
    }

    public function test_plantilla_sin_receta_ni_insumo_se_vende_del_stock_de_la_variante(): void
    {
        [, $register] = $this->cajeroConCaja();
        [$tpl] = $this->makeTemplateWithRecipe(70000, 10, 2);
        TemplateRecipe::where('variantId', $tpl->id)->delete();
        $tpl->update(['stock' => 3]);

        // Misma regla que el pedido online: sin receta ni insumo asociado manda la variante.
        $this->postJson('/api/pos/scan', ['barcode' => $tpl->barcode])->assertOk()->assertJsonPath('data.stock', 3);
        $this->sell($register, [[$tpl, 4]])->assertStatus(400);
        $order = $this->sellOk($register, [[$tpl, 2]]);
        $this->assertSame(1, $this->stockOf($tpl));
        $this->assertSame('SALE', VariantMovement::where('variantId', $tpl->id)->value('movementType'));
        $this->assertSame(0, InputVariantMovement::count());

        // Al anular vuelve a la variante.
        $this->postJson("/api/pos/sale/{$order->id}/cancel", ['reason' => 'x'])->assertOk();
        $this->assertSame(3, $this->stockOf($tpl));
    }
}
