<?php

namespace Tests\Feature\Flows\Store;

use App\Models\InputVariantMovement;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Setting;
use App\Models\VariantMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Caracterización del pedido online completo: checkout (totales, stock, número de pedido),
 * transiciones de estado y sus efectos de inventario (plantillas consumen insumos al pagar,
 * cancelar devuelve stock) y notificaciones de reseña al entregar.
 */
class OrderFlowTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->seedStoreCatalog();
    }

    private function placeOrder(array $items, array $extra = []): array
    {
        return $this->postJson('/api/orders', $this->orderPayload($items, $extra))->assertCreated()->json('data');
    }

    private function setStatus(int $orderId, string $status, array $extra = []): \Illuminate\Testing\TestResponse
    {
        $this->actingAsVendedor();
        $res = $this->patchJson("/api/orders/{$orderId}/status", ['status' => $status] + $extra);
        $this->actingAsCliente();

        return $res;
    }

    public function test_checkout_de_producto_regular_descuenta_stock_y_registra_movimiento(): void
    {
        $cliente = $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 5], ['rojo', 'S', 2]]);
        $v = $this->variantOf($p, 'negro', 'M');

        $res = $this->postJson('/api/orders', $this->orderPayload([
            // Color en mayúsculas y talla por nombre ("Medium") también encuentran la variante.
            ['productId' => $p->id, 'color' => strtoupper($this->hex('negro')), 'size' => 'Medium', 'quantity' => 2],
        ], ['notes' => 'Timbre dañado']))->assertCreated()->assertJsonPath('message', 'Pedido creado exitosamente');
        $o = $res->json('data');

        $this->assertSame('ORD-'.now()->format('ymd').'-0001', $o['orderNumber']);
        $this->assertSame([
            'id', 'orderNumber', 'userId', 'userName', 'userEmail', 'items', 'subtotal', 'shippingCost', 'discount', 'couponCode',
            'tax', 'total', 'status', 'statusLabel', 'paymentMethod', 'paymentRef', 'shipping', 'trackingNumber', 'trackingUrl',
            'notes', 'statusHistory', 'paidAt', 'shippedAt', 'deliveredAt', 'createdAt', 'updatedAt',
        ], array_keys($o));
        // 2 × 58000 = 116000 < 150000 → envío fijo de respaldo 12000 (Cali no tiene zona configurada).
        $this->assertSame([116000, 12000, 0, 0, 128000], [$o['subtotal'], $o['shippingCost'], $o['discount'], $o['tax'], $o['total']]);
        $this->assertSame(['PENDING', 'Pendiente', $cliente->id, 'Cliente Demo'], [$o['status'], $o['statusLabel'], $o['userId'], $o['userName']]);
        $this->assertSame('Pedido creado', $o['statusHistory'][0]['note']);
        $this->assertSame('Cali', $o['shipping']['city']);
        $this->assertSame([
            'id', 'productId', 'productName', 'productImage', 'size', 'color', 'quantity', 'unitPrice', 'subtotal', 'customization',
        ], array_keys($o['items'][0]));
        $this->assertSame(['Medium', 2, 58000, 116000], [$o['items'][0]['size'], $o['items'][0]['quantity'], $o['items'][0]['unitPrice'], $o['items'][0]['subtotal']]);
        $this->assertStringStartsWith('https://img.test/', $o['items'][0]['productImage']);

        $this->assertSame(3, $v->fresh()->stock);
        $mv = VariantMovement::where('variantId', $v->id)->sole();
        $this->assertSame(['SALE', -2, 5, 3, 'order', $o['id']], [$mv->movementType, $mv->quantity, $mv->previousStock, $mv->newStock, $mv->referenceType, $mv->referenceId]);
        $this->assertSame("Venta online - Orden {$o['orderNumber']}", $mv->reason);

        // Segundo pedido del día: consecutivo 0002.
        $this->assertSame('ORD-'.now()->format('ymd').'-0002', $this->placeOrder([$this->item($p, 'rojo', 'S', 1)])['orderNumber']);
    }

    public function test_envio_gratis_desde_el_umbral_e_iva_cuando_no_esta_incluido(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 10]]);

        $o = $this->placeOrder([$this->item($p, 'negro', 'M', 3)]);
        $this->assertSame([174000, 0, 174000], [$o['subtotal'], $o['shippingCost'], $o['total']]);

        Setting::create(['key' => 'payment_settings', 'value' => ['taxEnabled' => true, 'taxIncluded' => false, 'taxRate' => 19]]);
        Setting::create(['key' => 'order_settings', 'value' => ['shippingCost' => 9000, 'freeShippingThreshold' => 500000]]);
        $o = $this->placeOrder([$this->item($p, 'negro', 'M', 2)]);
        // IVA = round(116000 × 0.19) = 22040; envío con la tarifa configurada.
        $this->assertSame([116000, 9000, 22040, 147040], [$o['subtotal'], $o['shippingCost'], $o['tax'], $o['total']]);
    }

    public function test_errores_del_checkout(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 5]]);
        $off = $this->makeProduct('Viejo', 1000, [], ['isActive' => false]);

        $this->postJson('/api/orders', $this->orderPayload([$this->item($p, 'negro', 'M', 6)]))->assertStatus(400)
            ->assertExactJson(['success' => false, 'message' => 'Stock insuficiente para "Suéter" (M, '.$this->hex('negro').'). Disponible: 5']);
        $this->postJson('/api/orders', $this->orderPayload([$this->item($off, null, null, 1)]))->assertStatus(400)
            ->assertJsonPath('message', 'El producto "Viejo" no está disponible');
        $this->postJson('/api/orders', $this->orderPayload([['productId' => 99999, 'quantity' => 1]]))->assertNotFound()
            ->assertJsonPath('message', 'Producto 99999 no encontrado');
        $this->postJson('/api/orders', $this->orderPayload([$this->item($p, 'rojo', 'M', 1)]))->assertStatus(400)
            ->assertJsonPath('message', 'No se encontró variante para "Suéter" con color '.$this->hex('rojo').' y talla M');
        $this->postJson('/api/orders', $this->orderPayload([]))->assertStatus(422);
        $this->postJson('/api/orders', ['items' => [$this->item($p, 'negro', 'M', 1)]])->assertStatus(422)
            ->assertJsonStructure(['errors' => ['shipping', 'paymentMethod']]);

        $this->assertSame(5, $this->variantOf($p, 'negro', 'M')->stock);
        $this->assertSame(0, Order::count());
    }

    public function test_producto_simple_sin_color_ni_talla(): void
    {
        $this->actingAsCliente();
        $tote = $this->makeProduct('Tote', 25000, [[null, null, 4]], ['category' => 'accesorios']);

        $o = $this->placeOrder([$this->item($tote, null, null, 1)]);
        $this->assertSame(['', ''], [$o['items'][0]['size'], $o['items'][0]['color']]);
        $this->assertSame(3, $this->variantOf($tote)->stock);
    }

    public function test_cancelar_un_pedido_pendiente_devuelve_el_stock(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 5]]);
        $o = $this->placeOrder([$this->item($p, 'negro', 'M', 2)]);

        $this->postJson("/api/orders/my/{$o['id']}/cancel")->assertOk()
            ->assertJsonPath('message', 'Pedido cancelado exitosamente')
            ->assertJsonPath('data.status', 'CANCELLED')
            ->assertJsonPath('data.statusLabel', 'Cancelado')
            ->assertJsonPath('data.statusHistory.1.note', 'Cancelado por el usuario');

        $v = $this->variantOf($p, 'negro', 'M');
        $this->assertSame(5, $v->stock);
        $ret = VariantMovement::where('variantId', $v->id)->where('movementType', 'RETURN')->sole();
        $this->assertSame([2, 3, 5, 'order_cancel'], [$ret->quantity, $ret->previousStock, $ret->newStock, $ret->referenceType]);

        // Ya cancelado: el cliente no lo puede volver a cancelar.
        $this->postJson("/api/orders/my/{$o['id']}/cancel")->assertStatus(400)
            ->assertJsonPath('message', 'Solo se pueden cancelar pedidos pendientes');
    }

    public function test_transiciones_de_estado_validas_e_invalidas(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 5]]);
        $o = $this->placeOrder([$this->item($p, 'negro', 'M', 1)]);

        $this->setStatus($o['id'], 'SHIPPED')->assertStatus(400)
            ->assertExactJson(['success' => false, 'message' => 'No se puede cambiar de Pendiente a Enviado']);
        $this->setStatus($o['id'], 'OTRO')->assertStatus(422);

        $paid = $this->setStatus($o['id'], 'PAID')->assertOk()->assertJsonPath('message', 'Estado del pedido actualizado')->json('data');
        $this->assertNotNull($paid['paidAt']);
        $this->assertSame('Estado cambiado a Pagado', $paid['statusHistory'][1]['note']);
        // Pagar no vuelve a tocar el stock de un producto regular.
        $this->assertSame(4, $this->variantOf($p, 'negro', 'M')->stock);

        $this->setStatus($o['id'], 'PROCESSING', ['notes' => 'Empacando'])->assertOk()->assertJsonPath('data.statusHistory.2.note', 'Empacando');
        $shipped = $this->setStatus($o['id'], 'SHIPPED', ['trackingNumber' => 'G-1', 'trackingUrl' => 'https://t/1'])->assertOk()->json('data');
        $this->assertSame(['G-1', 'https://t/1'], [$shipped['trackingNumber'], $shipped['trackingUrl']]);
        $this->assertNotNull($shipped['shippedAt']);
        $this->setStatus($o['id'], 'CANCELLED')->assertStatus(400)->assertJsonPath('message', 'No se puede cambiar de Enviado a Cancelado');
        $this->setStatus($o['id'], 'DELIVERED')->assertOk()->assertJsonPath('data.statusLabel', 'Entregado');
        $this->setStatus($o['id'], 'CANCELLED')->assertStatus(400);
        $this->setStatus(99999, 'PAID')->assertNotFound()->assertJsonPath('message', 'Pedido no encontrado');
    }

    public function test_cancelar_un_pedido_pagado_tambien_devuelve_stock_regular(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 5]]);
        $o = $this->placeOrder([$this->item($p, 'negro', 'M', 2)]);
        $this->setStatus($o['id'], 'PAID')->assertOk();

        // El cliente ya no puede cancelar un pagado; el admin sí.
        $this->postJson("/api/orders/my/{$o['id']}/cancel")->assertStatus(400);
        $this->setStatus($o['id'], 'CANCELLED')->assertOk();
        $this->assertSame(5, $this->variantOf($p, 'negro', 'M')->stock);
    }

    public function test_plantilla_valida_stock_por_receta_y_consume_insumos_al_pagar(): void
    {
        $this->actingAsCliente();
        [$tpl, $iv] = $this->makeTemplateWithRecipe(inputStock: 10, recipeQty: 2); // disponible = floor(10/2) = 5

        $this->postJson('/api/orders', $this->orderPayload([$this->item($tpl, 'negro', 'M', 6)]))->assertStatus(400)
            ->assertJsonPath('message', 'Stock insuficiente para "Plantilla Suéter" (M, '.$this->hex('negro').'). Disponible: 5');

        $o = $this->placeOrder([$this->item($tpl, 'negro', 'M', 3)]);
        // Al crear no se descuenta nada (ni la variante de la plantilla ni el insumo).
        $this->assertSame(0, $this->variantOf($tpl, 'negro', 'M')->stock);
        $this->assertEquals(10, $iv->fresh()->currentStock);
        $this->assertSame(0, VariantMovement::count());

        // Pagado: consume 3 × 2 = 6 del insumo.
        $this->setStatus($o['id'], 'PAID')->assertOk();
        $this->assertEquals(4, $iv->fresh()->currentStock);
        $out = InputVariantMovement::where('inputVariantId', $iv->id)->sole();
        $this->assertSame(['SALIDA', 'order', $o['id']], [$out->movementType, $out->referenceType, $out->referenceId]);
        $this->assertEquals([-6, 10, 4], [$out->quantity, $out->previousStock, $out->newStock]);
        $this->assertSame("Venta online - Orden {$o['orderNumber']} - Template Plantilla Suéter", $out->reason);

        // Cancelado tras pagar: devuelve los 6.
        $this->setStatus($o['id'], 'CANCELLED')->assertOk();
        $this->assertEquals(10, $iv->fresh()->currentStock);
        $back = InputVariantMovement::where('inputVariantId', $iv->id)->where('movementType', 'DEVOLUCION')->sole();
        $this->assertSame('order_cancel', $back->referenceType);
        $this->assertEquals(6, $back->quantity);
    }

    public function test_cancelar_una_plantilla_pendiente_no_toca_el_insumo(): void
    {
        $this->actingAsCliente();
        [$tpl, $iv] = $this->makeTemplateWithRecipe();
        $o = $this->placeOrder([$this->item($tpl, 'negro', 'M', 2)]);

        $this->postJson("/api/orders/my/{$o['id']}/cancel")->assertOk();
        $this->assertEquals(10, $iv->fresh()->currentStock);
        $this->assertSame(0, InputVariantMovement::count());
    }

    public function test_entregar_crea_notificaciones_de_resena_una_por_producto(): void
    {
        $cliente = $this->actingAsCliente();
        $a = $this->makeProduct('Suéter', 58000, [['negro', 'M', 5], ['rojo', 'S', 5]]);
        $b = $this->makeProduct('Tote', 25000, [[null, null, 5]], ['category' => 'accesorios']);
        $o = $this->placeOrder([$this->item($a, 'negro', 'M', 1), $this->item($a, 'rojo', 'S', 1), $this->item($b, null, null, 1)]);

        foreach (['PAID', 'SHIPPED'] as $s) {
            $this->setStatus($o['id'], $s)->assertOk();
        }
        $this->assertSame(0, Notification::count());
        $delivered = $this->setStatus($o['id'], 'DELIVERED')->assertOk()->json('data');
        $this->assertNotNull($delivered['deliveredAt']);

        $n = Notification::where('userId', $cliente->id)->orderBy('id')->get();
        $this->assertSame([$a->id, $b->id], $n->pluck('referenceId')->all());
        $this->assertSame(['REVIEW_AVAILABLE'], $n->pluck('type')->unique()->values()->all());
        $this->assertSame('¡Califica tu compra!', $n[0]->title);
        $this->assertSame('Cuéntanos qué te pareció "Suéter". Tu opinión ayuda a otros compradores.', $n[0]->message);

        // Otro pedido entregado del mismo producto no duplica la notificación.
        $o2 = $this->placeOrder([$this->item($a, 'negro', 'M', 1)]);
        foreach (['PAID', 'SHIPPED', 'DELIVERED'] as $s) {
            $this->setStatus($o2['id'], $s)->assertOk();
        }
        $this->assertSame(2, Notification::count());
    }

    public function test_mis_pedidos_listado_y_detalle(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 10]]);
        $o1 = $this->placeOrder([$this->item($p, 'negro', 'M', 1)]);
        $this->placeOrder([$this->item($p, 'negro', 'M', 1)]);

        $res = $this->getJson('/api/orders/my?limit=1')->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta', ['total' => 2, 'page' => 1, 'limit' => 1, 'totalPages' => 2]);
        $this->assertCount(1, $res->json('data'));
        $this->getJson('/api/orders/my?status=CANCELLED')->assertOk()->assertJsonPath('meta.total', 0);

        $this->getJson("/api/orders/my/{$o1['id']}")->assertOk()->assertJsonPath('data.orderNumber', $o1['orderNumber']);
        $this->getJson("/api/orders/my/number/{$o1['orderNumber']}")->assertOk()->assertJsonPath('data.id', $o1['id']);
        $this->getJson('/api/orders/my/99999')->assertNotFound()->assertJsonPath('message', 'Pedido no encontrado');
    }

    public function test_listado_y_estadisticas_del_admin(): void
    {
        $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 10]]);
        $o1 = $this->placeOrder([$this->item($p, 'negro', 'M', 1)]);
        $this->placeOrder([$this->item($p, 'negro', 'M', 2)]);
        $this->setStatus($o1['id'], 'PAID');

        $this->actingAsVendedor();
        $this->getJson('/api/orders?search=Cliente%20Demo')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/orders?status=PAID')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/orders?limit=500')->assertOk()->assertJsonPath('meta.limit', 100); // tope

        $this->getJson('/api/orders/stats')->assertOk()->assertExactJson(['success' => true, 'data' => [
            'total' => 2,
            'byStatus' => ['pending' => 1, 'processing' => 0, 'shipped' => 0, 'delivered' => 0, 'cancelled' => 0],
            'revenue' => 70000, // solo el pagado: 58000 + envío 12000
        ]]);
    }
}
