<?php

namespace Tests\Feature\Flows\Pos;

use App\Models\InputVariantMovement;
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

    public function test_anular_venta_de_plantilla_suma_a_la_variante_y_no_devuelve_insumos(): void
    {
        [, $register] = $this->cajeroConCaja();
        [$tpl, $iv] = $this->makeTemplateWithRecipe(70000, 10, 2);
        $order = $this->sellOk($register, [[$tpl, 2]]);

        $this->postJson("/api/pos/sale/{$order->id}/cancel", ['reason' => 'cliente desiste'])->assertOk();

        // ACTUAL (posible bug): la anulación incrementa product_variants.stock (0 -> 2) de la
        // plantilla, que nunca se descontó, y NO devuelve los 4 insumos consumidos.
        $this->assertSame(2, $this->stockOf($tpl));
        $this->assertSame(6.0, (float) $iv->fresh()->currentStock);
        $this->assertSame(1, InputVariantMovement::count());
    }

    public function test_devolucion_de_plantilla_suma_a_la_variante_y_no_devuelve_insumos(): void
    {
        [, $register] = $this->cajeroConCaja();
        [$tpl, $iv] = $this->makeTemplateWithRecipe(70000, 10, 2);
        $order = $this->sellOk($register, [[$tpl, 2]]);

        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $tpl->id, 'quantity' => 1]]])
            ->assertOk();

        // ACTUAL (posible bug): igual que al anular, la devolución suma a la variante y deja
        // un movimiento RETURN de producto; los insumos no vuelven.
        $this->assertSame(1, $this->stockOf($tpl));
        $this->assertSame(6.0, (float) $iv->fresh()->currentStock);
        $this->assertSame('RETURN', VariantMovement::where('variantId', $tpl->id)->value('movementType'));
    }
}
