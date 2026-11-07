<?php

namespace Tests\Feature\Flows\Pos;

use App\Models\Discount;
use App\Models\OrderItem;
use App\Models\Product;

/**
 * Precio de las ventas POS (fase 3): lo pone el servidor (base − oferta automática POS) y al
 * editar una venta las líneas que ya estaban conservan el precio con que se vendieron.
 */
class PosPricingFlowTest extends PosFlowTestCase
{
    public function test_la_venta_cobra_la_oferta_automatica_que_muestra_el_pos(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 5);
        Discount::create([
            'isAuto' => true, 'name' => 'POS 10%', 'type' => 'percent', 'value' => 10,
            'appliesTo' => 'all', 'targetIds' => [], 'channel' => 'pos', 'isActive' => true,
        ]);

        $scan = $this->postJson('/api/pos/scan', ['barcode' => $a->barcode])->assertOk();
        $this->assertSame(45000.0, (float) $scan->json('data.price'));

        // El navegador manda el precio sin oferta: se cobra el del servidor (el mismo del escaneo).
        $order = $this->sellOk($register, [[$a, 2, 50000]]);
        $this->assertSame(90000.0, (float) $order->total);
        $this->assertSame(45000.0, (float) $order->items->first()->unitPrice);
    }

    public function test_editar_conserva_el_precio_vendido_y_las_lineas_nuevas_usan_el_actual(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $b = $this->makeVariant('Gorra', 30000, 10);
        $order = $this->sellOk($register, [[$a, 1]]);

        // Después de la venta suben los precios.
        Product::whereKey($a->productId)->update(['basePrice' => 60000]);
        Product::whereKey($b->productId)->update(['basePrice' => 35000]);

        $res = $this->putJson("/api/pos/sale/{$order->id}", [
            'items' => [
                ['variantId' => $a->id, 'quantity' => 2, 'price' => 1],
                ['variantId' => $b->id, 'quantity' => 1, 'price' => 1],
            ],
        ])->assertOk();

        $prices = OrderItem::where('orderId', $order->id)->pluck('unitPrice', 'variantId')->map(fn ($p) => (float) $p);
        $this->assertSame(50000.0, $prices[$a->id]); // ya estaba: precio con que se vendió
        $this->assertSame(35000.0, $prices[$b->id]); // nueva: precio actual del producto
        $this->assertSame(135000.0, (float) $res->json('data.total'));
        $this->assertSame(8, $this->stockOf($a));
        $this->assertSame(9, $this->stockOf($b));
    }

    public function test_el_descuento_global_no_supera_el_subtotal_al_calcular(): void
    {
        $this->actingAsCajero();
        $a = $this->makeVariant('Camiseta', 50000, 0);

        $this->postJson('/api/pos/calculate', ['discount' => 60000, 'items' => [['variantId' => $a->id, 'quantity' => 1, 'price' => 50000]]])
            ->assertStatus(400)->assertJsonPath('message', 'El descuento no puede ser mayor que el subtotal');
        $this->postJson('/api/pos/calculate', ['discount' => 50000, 'items' => [['variantId' => $a->id, 'quantity' => 1, 'price' => 50000]]])
            ->assertOk()->assertJsonPath('data.total', 0);
    }
}
