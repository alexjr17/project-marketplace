<?php

namespace Tests\Feature\Flows\Pos;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\POSCustomer;
use App\Models\VariantMovement;

/**
 * Caracterización de lo que pasa después de la venta: historial, detalle,
 * anular, devolución parcial, editar, fiados (cobro), clientes, estadísticas,
 * evidencia de pago y recibo.
 */
class SaleLifecycleFlowTest extends PosFlowTestCase
{
    public function test_historial_solo_trae_las_ventas_pos_del_vendedor(): void
    {
        [$user, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $paid = $this->sellOk($register, [[$a, 1]]);
        $other = $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'transfer']);
        Order::whereKey($other->id)->update(['paymentEvidence' => 'data:image/png;base64,xxx']);
        // Venta POS de otro vendedor y una orden online.
        Order::create([
            'orderNumber' => 'POS-OTRO', 'subtotal' => 1, 'total' => 1, 'status' => 'PAID', 'paymentMethod' => 'cash',
            'saleChannel' => 'POS', 'sellerId' => $this->userByEmail('admin@vexa.com')->id, 'statusHistory' => [],
        ]);
        Order::create(['orderNumber' => 'ONL-1', 'subtotal' => 1, 'total' => 1, 'paymentMethod' => 'cash', 'statusHistory' => []]);

        $res = $this->getJson('/api/pos/sales')->assertOk();
        $res->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [array_merge($this->orderShape(), [
                'paymentEvidence', 'items' => [['id', 'orderId', 'productId', 'variantId', 'productName', 'quantity', 'unitPrice']],
                'posCustomer', 'seller' => ['id', 'name', 'email'],
            ])]]);
        $byId = collect($res->json('data'))->keyBy('id');
        // La evidencia no se envía, solo un marcador.
        $this->assertSame('exists', $byId[$other->id]['paymentEvidence']);
        $this->assertNull($byId[$paid->id]['paymentEvidence']);

        $this->postJson("/api/pos/sale/{$paid->id}/cancel", ['reason' => 'x'])->assertOk();
        $this->getJson('/api/pos/sales?status=CANCELLED')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $paid->id);
        $this->getJson('/api/pos/sales?cashRegisterId=999999')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_detalle_de_venta(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $order = $this->sellOk($register, [[$a, 1]], ['customerCedula' => '123', 'customerName' => 'Pepe']);

        $this->getJson("/api/pos/sale/{$order->id}")
            ->assertOk()
            ->assertJsonStructure(['data' => array_merge($this->orderShape(), [
                'items' => [['id', 'variantId', 'variant' => ['id', 'product' => ['id', 'name'], 'color', 'size']]],
                'posCustomer' => ['id', 'cedula', 'name', 'email', 'phone', 'totalPurchases', 'totalSpent'],
                'seller' => ['id', 'name', 'email'],
                'cashRegister' => ['id', 'code'],
            ])])
            ->assertJsonPath('data.posCustomer.cedula', '123');

        $online = Order::create(['orderNumber' => 'ONL-2', 'subtotal' => 1, 'total' => 1, 'paymentMethod' => 'cash', 'statusHistory' => []]);
        $this->getJson("/api/pos/sale/{$online->id}")->assertNotFound()->assertJsonPath('message', 'Venta no encontrada');
        $this->getJson('/api/pos/sale/999999')->assertNotFound();
    }

    public function test_anular_venta_devuelve_stock_y_descuenta_de_la_sesion(): void
    {
        [, $register, $session] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $order = $this->sellOk($register, [[$a, 3]], ['notes' => 'Primera nota']);
        $this->assertSame(7, $this->stockOf($a));

        $this->postJson("/api/pos/sale/{$order->id}/cancel", [])
            ->assertStatus(400)->assertJsonPath('message', 'El motivo de cancelación es requerido');

        $res = $this->postJson("/api/pos/sale/{$order->id}/cancel", ['reason' => 'Cliente arrepentido'])->assertOk();
        $res->assertJsonPath('message', 'Venta anulada exitosamente')
            ->assertJsonPath('data.status', 'CANCELLED')
            ->assertJsonPath('data.notes', "Primera nota\nCANCELADO: Cliente arrepentido")
            ->assertJsonStructure(['data' => array_merge($this->orderShape(), ['items'])]);

        $this->assertSame(10, $this->stockOf($a));
        // ACTUAL (posible bug): la anulación no deja movimiento de inventario (solo el SALE
        // original) ni agrega entrada a statusHistory / editHistory.
        $this->assertSame(1, VariantMovement::where('variantId', $a->id)->count());
        $fresh = Order::find($order->id);
        $this->assertCount(1, $fresh->statusHistory);
        $this->assertCount(1, $fresh->editHistory);

        $session->refresh();
        $this->assertSame(0, (int) $session->salesCount);
        $this->assertSame(0.0, (float) $session->totalSales);

        $this->postJson("/api/pos/sale/{$order->id}/cancel", ['reason' => 'otra vez'])
            ->assertStatus(400)->assertJsonPath('message', 'La venta ya está cancelada');
        $this->postJson('/api/pos/sale/999999/cancel', ['reason' => 'x'])
            ->assertStatus(400)->assertJsonPath('message', 'Venta no encontrada');
    }

    public function test_anular_venta_ajena_solo_lo_puede_hacer_el_admin(): void
    {
        $admin = $this->userByEmail('admin@vexa.com');
        $register = $this->makeRegister();
        $this->openSessionFor($admin, $register);
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $this->actingAsAdmin();
        $order = $this->sellOk($register, [[$a, 1]]);

        $this->actingAsCajero();
        $this->postJson("/api/pos/sale/{$order->id}/cancel", ['reason' => 'x'])
            ->assertStatus(400)->assertJsonPath('message', 'Solo puedes anular tus propias ventas');
        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $a->id, 'quantity' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'Solo puedes registrar devoluciones de tus propias ventas');
        $this->putJson("/api/pos/sale/{$order->id}", ['notes' => 'x'])
            ->assertStatus(400)->assertJsonPath('message', 'Solo puedes editar tus propias ventas');

        // El admin sí anula ventas de otro vendedor (la del cajero).
        $cajero = $this->userByEmail('pos@vexa.com');
        $reg2 = $this->makeRegister('CAJA-T2');
        $this->openSessionFor($cajero, $reg2);
        $this->actingAsCajero();
        $mine = $this->sellOk($reg2, [[$a, 1]]);
        $this->actingAsAdmin();
        $this->postJson("/api/pos/sale/{$mine->id}/cancel", ['reason' => 'admin'])->assertOk();

        $online = Order::create(['orderNumber' => 'ONL-3', 'subtotal' => 1, 'total' => 1, 'paymentMethod' => 'cash', 'statusHistory' => []]);
        $this->postJson("/api/pos/sale/{$online->id}/cancel", ['reason' => 'x'])
            ->assertStatus(400)->assertJsonPath('message', 'Solo se pueden anular ventas POS desde este módulo');
    }

    public function test_devolucion_parcial_recalcula_totales_stock_y_caja(): void
    {
        [$user, $register, $session] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $b = $this->makeVariant('Gorra', 30000, 10);
        // 3 x 50.000 + 1 x 30.000 - 10.000 = 170.000.
        $order = $this->sellOk($register, [[$a, 3], [$b, 1]], ['discount' => 10000]);
        $this->assertSame(170000.0, (float) $order->total);

        $res = $this->postJson("/api/pos/sale/{$order->id}/return", [
            'items' => [['variantId' => $a->id, 'quantity' => 1]],
            'reason' => 'talla',
            'refundMethod' => 'transfer',
        ])->assertOk();

        $res->assertJsonPath('message', 'Devolución registrada exitosamente')
            ->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.notes', 'DEVOLUCIÓN: Camiseta x1 (talla)')
            ->assertJsonPath('data.editHistory.1.action', 'return')
            ->assertJsonPath('data.editHistory.1.userId', $user->id)
            ->assertJsonPath('data.editHistory.1.changes.0.from', 'Camiseta x1')
            ->assertJsonPath('data.editHistory.1.changes.0.to', 'Reembolso $50.000 (Transferencia) · talla')
            ->assertJsonPath('data.statusHistory.1.note', 'Devolución - reembolso $50.000')
            ->assertJsonStructure(['data' => array_merge($this->orderShape(), ['items' => [['id', 'variantId', 'quantity']]])]);

        $this->assertSame(130000.0, (float) $res->json('data.subtotal'));
        $this->assertSame(10000.0, (float) $res->json('data.discount'));
        $this->assertSame(120000.0, (float) $res->json('data.total'));
        $this->assertSame(2, (int) OrderItem::where('orderId', $order->id)->where('variantId', $a->id)->value('quantity'));

        $this->assertSame(8, $this->stockOf($a));
        $mov = VariantMovement::where('variantId', $a->id)->where('movementType', 'RETURN')->sole();
        $this->assertSame(1, (int) $mov->quantity);
        $this->assertSame(7, (int) $mov->previousStock);
        $this->assertSame(8, (int) $mov->newStock);
        $this->assertSame('return', $mov->referenceType);
        $this->assertSame('Devolución POS: talla', $mov->reason);

        $session->refresh();
        $this->assertSame(1, (int) $session->salesCount);
        $this->assertSame(120000.0, (float) $session->totalSales);
    }

    public function test_devolucion_total_anula_la_venta(): void
    {
        [, $register, $session] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $order = $this->sellOk($register, [[$a, 2]]);

        $res = $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $a->id, 'quantity' => 2]]])->assertOk();
        $res->assertJsonPath('data.status', 'CANCELLED')
            ->assertJsonPath('data.items', [])
            // Sin refundMethod el reembolso se registra como efectivo.
            ->assertJsonPath('data.editHistory.1.changes.0.to', 'Reembolso $100.000 (Efectivo)');
        $this->assertSame(0.0, (float) $res->json('data.total'));
        $this->assertSame(10, $this->stockOf($a));
        $this->assertSame(0, (int) $session->fresh()->salesCount);
        $this->assertSame(0.0, (float) $session->fresh()->totalSales);

        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $a->id, 'quantity' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'No se puede devolver una venta anulada');
    }

    public function test_validaciones_de_devolucion(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $b = $this->makeVariant('Gorra', 30000, 10);
        $order = $this->sellOk($register, [[$a, 2]]);

        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $a->id, 'quantity' => 3]]])
            ->assertStatus(400)->assertJsonPath('message', 'La cantidad a devolver supera lo vendido');
        // Dos líneas que juntas superan lo vendido.
        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [
            ['variantId' => $a->id, 'quantity' => 1], ['variantId' => $a->id, 'quantity' => 2],
        ]])->assertStatus(400)->assertJsonPath('message', 'La cantidad a devolver supera lo vendido');
        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $b->id, 'quantity' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'Un producto no pertenece a esta venta');
        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => []])->assertStatus(422);
        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $a->id, 'quantity' => 1]], 'refundMethod' => 'card'])
            ->assertStatus(422)->assertJsonValidationErrors(['refundMethod']);
        $this->postJson('/api/pos/sale/999999/return', ['items' => [['variantId' => $a->id, 'quantity' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'Venta no encontrada');

        $this->assertSame(8, $this->stockOf($a));
    }

    public function test_devolucion_de_fiado_recalcula_el_estado(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        // Fiado de 100.000 con abono de 50.000.
        $order = $this->sellOk($register, [[$a, 2]], ['paymentMethod' => 'debe', 'customerName' => 'Rosa', 'cashAmount' => 50000]);
        $this->assertSame('PENDING', $order->status);

        // Al devolver 1, el total baja a 50.000 = lo abonado: queda PAID.
        $this->postJson("/api/pos/sale/{$order->id}/return", ['items' => [['variantId' => $a->id, 'quantity' => 1]]])
            ->assertOk()->assertJsonPath('data.status', 'PAID');
        // ACTUAL (posible bug): paidAt no se llena al saldarse por devolución.
        $this->assertNull(Order::find($order->id)->paidAt);
    }

    public function test_editar_venta_reemplaza_items_ajusta_stock_totales_y_caja(): void
    {
        [$user, $register, $session] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $b = $this->makeVariant('Gorra', 30000, 10);
        $order = $this->sellOk($register, [[$a, 2]], ['discount' => 5000]); // 95.000
        $this->assertSame(8, $this->stockOf($a));

        $res = $this->putJson("/api/pos/sale/{$order->id}", [
            'items' => [
                ['variantId' => $a->id, 'quantity' => 1, 'price' => 50000],
                ['variantId' => $b->id, 'quantity' => 2, 'price' => 30000],
            ],
            'notes' => 'cambio',
        ])->assertOk();

        $res->assertJsonPath('message', 'Venta actualizada exitosamente')
            ->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.notes', 'cambio')
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.statusHistory.1.note', 'Venta editada')
            ->assertJsonPath('data.editHistory.1.action', 'updated')
            ->assertJsonPath('data.editHistory.1.userId', $user->id)
            ->assertJsonStructure(['data' => array_merge($this->orderShape(), ['items'])]);

        // Conserva el descuento de la venta si no se envía uno nuevo.
        $this->assertSame(110000.0, (float) $res->json('data.subtotal'));
        $this->assertSame(5000.0, (float) $res->json('data.discount'));
        $this->assertSame(105000.0, (float) $res->json('data.total'));

        $changes = collect($res->json('data.editHistory.1.changes'))->keyBy('field');
        $this->assertSame(['subtotal', 'total', 'notes', 'itemsCount'], $changes->keys()->all());
        $this->assertSame('$100.000', $changes['subtotal']['from']);
        $this->assertSame('$110.000', $changes['subtotal']['to']);
        $this->assertSame('—', $changes['notes']['from']);
        $this->assertSame(2, $changes['itemsCount']['from']);
        $this->assertSame(3, $changes['itemsCount']['to']);

        $this->assertSame(9, $this->stockOf($a));
        $this->assertSame(8, $this->stockOf($b));
        // ACTUAL (posible bug): la restitución del stock viejo no deja movimiento; solo hay
        // movimientos SALE nuevos ("Edición de venta POS"), con previousStock ya restituido.
        $movA = VariantMovement::where('variantId', $a->id)->orderBy('id')->get();
        $this->assertCount(2, $movA);
        $this->assertSame('Edición de venta POS', $movA[1]->reason);
        $this->assertSame(10, (int) $movA[1]->previousStock);
        $this->assertSame(9, (int) $movA[1]->newStock);

        $session->refresh();
        $this->assertSame(1, (int) $session->salesCount);
        $this->assertSame(105000.0, (float) $session->totalSales);
    }

    public function test_editar_solo_cliente_y_pago_no_toca_stock_ni_caja(): void
    {
        [, $register, $session] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $order = $this->sellOk($register, [[$a, 1]]);

        $res = $this->putJson("/api/pos/sale/{$order->id}", [
            'customerCedula' => '999', 'customerName' => 'Nuevo Cliente',
            'paymentMethod' => 'debe', 'cashAmount' => 10000,
        ])->assertOk();

        $customer = POSCustomer::where('cedula', '999')->sole();
        $res->assertJsonPath('data.posCustomerId', $customer->id)
            ->assertJsonPath('data.customerName', 'Nuevo Cliente')
            ->assertJsonPath('data.paymentMethod', 'debe')
            ->assertJsonPath('data.status', 'PENDING')
            ->assertJsonPath('data.paidAt', null);
        $fields = array_column($res->json('data.editHistory.1.changes'), 'field');
        $this->assertSame(['paymentMethod', 'cashAmount', 'customerName'], $fields);
        $this->assertSame('Fiado', $res->json('data.editHistory.1.changes.0.to'));

        $this->assertSame(9, $this->stockOf($a));
        // ACTUAL (posible bug): pasar a fiado no ajusta la caja (sigue sumando 50.000).
        $this->assertSame(50000.0, (float) $session->fresh()->totalSales);

        // Sin cambios reales: no se agrega entrada a editHistory, pero sí a statusHistory.
        $again = $this->putJson("/api/pos/sale/{$order->id}", [])->assertOk();
        $this->assertCount(2, $again->json('data.editHistory'));
        $this->assertCount(3, $again->json('data.statusHistory'));
    }

    public function test_validaciones_de_edicion(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 3);
        $order = $this->sellOk($register, [[$a, 2]]); // queda stock 1

        // Disponible = stock actual + lo que ya tenía la venta (1 + 2).
        $this->putJson("/api/pos/sale/{$order->id}", ['items' => [['variantId' => $a->id, 'quantity' => 4, 'price' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'Stock insuficiente para '.$a->sku.'. Disponible: 3');
        $this->putJson("/api/pos/sale/{$order->id}", ['items' => [['variantId' => 999999, 'quantity' => 1, 'price' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'Variante 999999 no encontrada');
        $this->putJson("/api/pos/sale/{$order->id}", ['paymentMethod' => 'bitcoin'])->assertStatus(422);

        $this->postJson("/api/pos/sale/{$order->id}/cancel", ['reason' => 'x'])->assertOk();
        $this->putJson("/api/pos/sale/{$order->id}", ['notes' => 'x'])
            ->assertStatus(400)->assertJsonPath('message', 'No se puede editar una venta anulada');
        $this->putJson('/api/pos/sale/999999', ['notes' => 'x'])
            ->assertStatus(400)->assertJsonPath('message', 'Venta no encontrada');
    }

    public function test_cobrar_fiado_en_abonos_hasta_saldarlo(): void
    {
        [$user, $register, $session] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $order = $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'debe', 'customerName' => 'Juan', 'cashAmount' => 20000]);

        $this->getJson('/api/pos/debts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [['id', 'orderNumber', 'posCustomerId', 'customerName', 'customerPhone', 'total', 'paid', 'remaining', 'createdAt']]])
            ->assertJsonPath('data.0.paid', 20000)
            ->assertJsonPath('data.0.remaining', 30000);

        // Abono parcial en efectivo.
        $res = $this->postJson("/api/pos/sale/{$order->id}/collect", ['paymentMethod' => 'cash', 'amount' => 10000])->assertOk();
        $res->assertJsonPath('message', 'Abono registrado exitosamente')
            ->assertJsonPath('data.status', 'PENDING')
            ->assertJsonPath('data.statusHistory.1.note', 'Abono $10,000 - cash (saldo $20,000)')
            ->assertJsonPath('data.editHistory.1.action', 'payment')
            ->assertJsonPath('data.editHistory.1.changes.0.from', '$30.000 pendiente')
            ->assertJsonPath('data.editHistory.1.changes.0.to', '+$10.000 (Efectivo) · queda $20.000');
        $this->assertSame(30000.0, (float) $res->json('data.cashAmount'));

        // Un abono mayor que el saldo se recorta al saldo; la transferencia va a cardAmount.
        $res = $this->postJson("/api/pos/sale/{$order->id}/collect", ['paymentMethod' => 'transfer', 'amount' => 999999])->assertOk();
        $res->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.statusHistory.2.note', 'Abono $20,000 - transfer (saldado)');
        $this->assertSame(20000.0, (float) $res->json('data.cardAmount'));
        $this->assertNotNull($res->json('data.paidAt'));

        $this->getJson('/api/pos/debts')->assertOk()->assertJsonCount(0, 'data');
        // ACTUAL: cobrar un fiado no toca los contadores de la sesión de caja.
        $this->assertSame(50000.0, (float) $session->fresh()->totalSales);

        $this->postJson("/api/pos/sale/{$order->id}/collect", ['paymentMethod' => 'cash'])
            ->assertStatus(400)->assertJsonPath('message', 'Este fiado ya fue cobrado o cancelado');
    }

    public function test_validaciones_de_cobro_de_fiado(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $cash = $this->sellOk($register, [[$a, 1]]);
        $debt = $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'debe', 'customerName' => 'Juan']);

        $this->postJson("/api/pos/sale/{$cash->id}/collect", ['paymentMethod' => 'cash'])
            ->assertStatus(400)->assertJsonPath('message', 'Fiado no encontrado');
        $this->postJson("/api/pos/sale/{$debt->id}/collect", ['paymentMethod' => 'cash', 'amount' => 0])
            ->assertStatus(400)->assertJsonPath('message', 'El monto a cobrar debe ser mayor a 0');
        $this->postJson("/api/pos/sale/{$debt->id}/collect", ['paymentMethod' => 'mixed'])
            ->assertStatus(422)->assertJsonValidationErrors(['paymentMethod']);

        // Sin amount se cobra todo el saldo.
        $this->postJson("/api/pos/sale/{$debt->id}/collect", ['paymentMethod' => 'card'])
            ->assertOk()->assertJsonPath('data.status', 'PAID');
        $this->assertSame(50000.0, (float) Order::find($debt->id)->cardAmount);
    }

    public function test_clientes_con_deuda_y_detalle(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'debe', 'customerCedula' => '555', 'customerName' => 'Carla', 'cashAmount' => 15000]);
        $paid = $this->sellOk($register, [[$a, 2]], ['customerCedula' => '555']);
        $cancelled = $this->sellOk($register, [[$a, 1]], ['customerCedula' => '555']);
        $this->postJson("/api/pos/sale/{$cancelled->id}/cancel", ['reason' => 'x'])->assertOk();
        $c = POSCustomer::where('cedula', '555')->sole();

        $list = $this->getJson('/api/pos/customers')->assertOk();
        $list->assertJsonStructure(['data' => [['id', 'name', 'cedula', 'phone', 'email', 'totalPurchases', 'totalSpent', 'debt']]])
            ->assertJsonPath('data.0.totalPurchases', 2)
            ->assertJsonPath('data.0.debt', 35000);
        $this->assertSame(150000.0, (float) $list->json('data.0.totalSpent'));
        // La columna guardada (upsert) sí cuenta la venta anulada: 3 compras / 200.000.
        $this->assertSame(3, (int) $c->totalPurchases);
        $this->assertSame(200000.0, (float) $c->totalSpent);

        $this->getJson('/api/pos/customers?q=carl')->assertJsonCount(1, 'data');
        $this->getJson('/api/pos/customers?q=nadie')->assertJsonCount(0, 'data');

        $detail = $this->getJson("/api/pos/customers/{$c->id}")->assertOk();
        $detail->assertJsonStructure(['data' => [
            'id', 'name', 'cedula', 'phone', 'email', 'totalPurchases', 'totalSpent', 'debt',
            'orders' => [['id', 'orderNumber', 'total', 'status', 'paymentMethod', 'paid', 'remaining', 'itemsCount', 'createdAt']],
        ]])
            ->assertJsonCount(3, 'data.orders')
            ->assertJsonPath('data.totalPurchases', 2)
            ->assertJsonPath('data.debt', 35000);
        $this->getJson('/api/pos/customers/999999')->assertNotFound()->assertJsonPath('message', 'Cliente no encontrado');

        // Búsqueda (autocompletar) y por cédula exacta.
        $this->getJson('/api/pos/customer/search?q=55')->assertOk()->assertJsonPath('data.0.id', $c->id);
        $this->getJson('/api/pos/customer/search?cedula=555')->assertOk()->assertJsonPath('data.id', $c->id);
        $this->getJson('/api/pos/customer/search')->assertStatus(400)
            ->assertJsonPath('message', 'La cédula o el término de búsqueda es requerido');
        // Cédula inexistente: 200 sin "data".
        $this->getJson('/api/pos/customer/search?cedula=000')->assertOk()->assertJsonMissingPath('data');
        $this->assertNotNull($paid);
    }

    public function test_estadisticas_del_vendedor(): void
    {
        [$user, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 20);
        $b = $this->makeVariant('Gorra', 30000, 20);
        $this->sellOk($register, [[$a, 2]], ['discount' => 5000]);          // 95.000 cash
        $this->sellOk($register, [[$b, 4]], ['paymentMethod' => 'card']); // 120.000 card
        $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'debe', 'customerName' => 'X']); // 50.000 PENDING
        $x = $this->sellOk($register, [[$b, 5]]);
        $this->postJson("/api/pos/sale/{$x->id}/cancel", ['reason' => 'x'])->assertOk();
        // Venta de ayer: no entra en "today" pero sí en 7d.
        $this->travel(-1)->days();
        $this->sellOk($register, [[$a, 1]]);
        $this->travelBack();
        \Illuminate\Support\Carbon::setTestNow(\Illuminate\Support\Carbon::parse(self::NOW));

        $res = $this->getJson('/api/pos/stats')->assertOk();
        $res->assertJsonStructure(['data' => [
            'range', 'from',
            'totals' => ['salesCount', 'totalSold', 'avgTicket', 'itemsSold'],
            'byMethod' => [['method', 'count', 'total']],
            'byHour' => [['hour', 'total', 'count']],
            'topProducts' => [['name', 'qty', 'total']],
        ]])
            ->assertJsonPath('data.range', 'today')
            ->assertJsonPath('data.from', '2026-11-02T00:00:00+00:00')
            // Incluye el fiado PENDING; excluye la anulada.
            ->assertJsonPath('data.totals.salesCount', 3)
            ->assertJsonPath('data.totals.itemsSold', 7)
            ->assertJsonCount(24, 'data.byHour')
            ->assertJsonPath('data.byHour.10.count', 3)
            ->assertJsonPath('data.topProducts.0.name', 'Gorra')
            ->assertJsonPath('data.topProducts.0.qty', 4)
            ->assertJsonPath('data.topProducts.1.name', 'Camiseta');
        $this->assertSame(265000.0, (float) $res->json('data.totals.totalSold'));
        $this->assertEquals(88333, $res->json('data.totals.avgTicket'));
        $methods = collect($res->json('data.byMethod'))->keyBy('method');
        $this->assertSame(['cash', 'card', 'debe'], $methods->keys()->all());
        $this->assertSame(95000.0, (float) $methods['cash']['total']);
        // ACTUAL: el total por producto usa qty * unitPrice (sin descuentos): 3 x 50.000 = 150.000 aunque hubo 5.000 de descuento.
        $this->assertSame(150000.0, (float) $res->json('data.topProducts.1.total'));

        $this->getJson('/api/pos/stats?range=7d')->assertJsonPath('data.totals.salesCount', 4);
        // Rango desconocido cae en "today".
        $this->getJson('/api/pos/stats?range=999')->assertJsonPath('data.range', 'today');

        // Otro vendedor no ve estas ventas.
        $this->actingAsAdmin();
        $this->getJson('/api/pos/stats')->assertJsonPath('data.totals.salesCount', 0)->assertJsonPath('data.byMethod', []);
    }

    public function test_evidencia_de_pago_solo_para_transferencias_propias(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $cash = $this->sellOk($register, [[$a, 1]]);
        $tr = $this->sellOk($register, [[$a, 1]], ['paymentMethod' => 'transfer']);

        $this->postJson("/api/pos/sale/{$tr->id}/payment-evidence", [])
            ->assertStatus(400)->assertJsonPath('message', 'La evidencia de pago es requerida');
        $this->postJson("/api/pos/sale/{$cash->id}/payment-evidence", ['evidence' => 'img'])
            ->assertStatus(400)->assertJsonPath('message', 'Solo se pueden subir evidencias para pagos por transferencia');

        $this->postJson("/api/pos/sale/{$tr->id}/payment-evidence", ['evidence' => 'data:image/png;base64,AAA'])
            ->assertOk()
            ->assertJsonPath('data', ['id' => $tr->id, 'orderNumber' => $tr->orderNumber, 'paymentEvidence' => 'uploaded']);
        $this->getJson("/api/pos/sale/{$tr->id}/payment-evidence")->assertOk()
            ->assertJsonPath('data.evidence', 'data:image/png;base64,AAA');

        $this->actingAsAdmin();
        // Ni el admin sube evidencia a una venta ajena.
        $this->postJson("/api/pos/sale/{$tr->id}/payment-evidence", ['evidence' => 'x'])
            ->assertStatus(400)->assertJsonPath('message', 'No tienes permiso para modificar esta venta');
        // ACTUAL: el GET de evidencia no valida canal ni dueño; con id inexistente da null.
        $this->getJson('/api/pos/sale/999999/payment-evidence')->assertOk()->assertJsonPath('data.evidence', null);
    }

    public function test_recibo_pdf_y_envio_por_correo(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $order = $this->sellOk($register, [[$a, 1]]);

        // ACTUAL (posible bug): sin la setting "printing_settings" (o sin su clave ticketLogo)
        // printConfig() lee $printing['ticketLogo'] sin "??" y el recibo responde 500.
        $this->getJson("/api/pos/sale/{$order->id}/invoice-pdf")->assertStatus(500);
        $this->postJson("/api/pos/sale/{$order->id}/send-invoice", ['email' => 'a@b.com'])->assertStatus(500);

        \App\Models\Setting::updateOrCreate(['key' => 'printing_settings'], ['value' => ['ticketLogo' => '', 'ticketWidth' => 80]]);

        $pdf = $this->get("/api/pos/sale/{$order->id}/invoice-pdf");
        $pdf->assertOk();
        $this->assertStringContainsString('application/pdf', $pdf->headers->get('Content-Type'));

        $this->postJson("/api/pos/sale/{$order->id}/send-invoice", [])
            ->assertStatus(400)->assertJsonPath('message', 'El email es requerido');
        $this->postJson("/api/pos/sale/{$order->id}/send-invoice", ['email' => 'cliente@correo.com'])
            ->assertOk()->assertJsonPath('message', 'Recibo enviado correctamente');
        // El correo por defecto ("venta-pos@local.com") no es vacío: no se reemplaza.
        $this->assertSame('venta-pos@local.com', Order::find($order->id)->customerEmail);

        $online = Order::create(['orderNumber' => 'ONL-4', 'subtotal' => 1, 'total' => 1, 'paymentMethod' => 'cash', 'statusHistory' => []]);
        $this->getJson("/api/pos/sale/{$online->id}/invoice-pdf")
            ->assertStatus(400)->assertJsonPath('message', 'Solo se pueden generar facturas de ventas POS');
    }
}
