<?php

namespace Tests\Feature\Flows\Pos;

use App\Models\CashSession;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\POSCustomer;
use App\Models\VariantMovement;

/**
 * Caracterización de POST /api/pos/sale: métodos de pago, totales, descuentos,
 * stock, movimientos, sesión, clientes, numeración y validaciones.
 */
class SaleCreationFlowTest extends PosFlowTestCase
{
    public function test_venta_en_efectivo_totales_stock_movimiento_y_sesion(): void
    {
        [$user, $register, $session] = $this->cajeroConCaja(50000);
        $a = $this->makeVariant('Camiseta POS', 50000, 10);

        $res = $this->sell($register, [[$a, 2]], [
            'paymentMethod' => 'cash', 'cashAmount' => 100000, 'discount' => 5000, 'notes' => 'nota',
        ]);

        $res->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('message', 'Venta creada exitosamente')
            ->assertJsonStructure(['success', 'message', 'data' => $this->orderShape()])
            ->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.paymentMethod', 'cash')
            ->assertJsonPath('data.saleChannel', 'POS')
            ->assertJsonPath('data.sellerId', $user->id)
            ->assertJsonPath('data.cashRegisterId', $register->id)
            ->assertJsonPath('data.customerName', 'Cliente POS')
            ->assertJsonPath('data.customerEmail', 'venta-pos@local.com')
            ->assertJsonPath('data.customerPhone', null)
            ->assertJsonPath('data.posCustomerId', null)
            ->assertJsonPath('data.notes', 'nota')
            ->assertJsonPath('data.statusHistory.0.status', 'PAID')
            ->assertJsonPath('data.statusHistory.0.note', 'Venta POS - cash')
            ->assertJsonPath('data.editHistory.0.action', 'created')
            ->assertJsonPath('data.editHistory.0.userId', $user->id)
            ->assertJsonPath('data.editHistory.0.snapshot.paymentMethod', 'cash');

        $this->assertSame(100000.0, (float) $res->json('data.subtotal'));
        $this->assertSame(5000.0, (float) $res->json('data.discount'));
        $this->assertSame(0.0, (float) $res->json('data.tax'));
        $this->assertSame(95000.0, (float) $res->json('data.total'));
        $this->assertSame(100000.0, (float) $res->json('data.cashAmount'));
        $this->assertNotNull($res->json('data.paidAt'));
        // Sin referencia de tarjeta: paymentRef = "POS-<milisegundos>".
        $this->assertMatchesRegularExpression('/^POS-\d{13}$/', $res->json('data.paymentRef'));

        // La respuesta es el Order::create sin recargar: no trae ítems.
        $this->assertArrayNotHasKey('items', $res->json('data'));

        $order = Order::findOrFail($res->json('data.id'));
        $item = OrderItem::where('orderId', $order->id)->sole();
        $this->assertSame('Camiseta POS', $item->productName);
        $this->assertSame('N/A', $item->size);
        $this->assertSame('N/A', $item->color);
        $this->assertSame('', $item->productImage);
        $this->assertSame(2, (int) $item->quantity);
        $this->assertSame(50000.0, (float) $item->unitPrice);

        $this->assertSame(8, $this->stockOf($a));
        $mov = VariantMovement::where('variantId', $a->id)->sole();
        $this->assertSame('SALE', $mov->movementType);
        $this->assertSame(-2, (int) $mov->quantity);
        $this->assertSame(10, (int) $mov->previousStock);
        $this->assertSame(8, (int) $mov->newStock);
        $this->assertSame('sale', $mov->referenceType);
        $this->assertSame($order->id, (int) $mov->referenceId);
        $this->assertSame('Venta POS', $mov->reason);

        $session->refresh();
        $this->assertSame(1, (int) $session->salesCount);
        $this->assertSame(95000.0, (float) $session->totalSales);
    }

    public function test_venta_con_tarjeta_y_transferencia(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);

        $card = $this->sell($register, [[$a, 1]], [
            'paymentMethod' => 'card', 'cardAmount' => 50000, 'cardReference' => 'VOUCHER-9',
            'cardType' => 'credit', 'cardLastFour' => '4242',
        ])->assertCreated();
        $card->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.paymentRef', 'VOUCHER-9')
            ->assertJsonPath('data.cardReference', 'VOUCHER-9')
            ->assertJsonPath('data.cardType', 'credit')
            ->assertJsonPath('data.cardLastFour', '4242')
            ->assertJsonPath('data.cashAmount', null)
            ->assertJsonPath('data.statusHistory.0.note', 'Venta POS - card - Ref: VOUCHER-9');

        // Transferencia sin montos: también PAID (no se valida el monto).
        $tr = $this->sell($register, [[$a, 1]], ['paymentMethod' => 'transfer'])->assertCreated();
        $tr->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.paymentMethod', 'transfer')
            ->assertJsonPath('data.cardAmount', null);

        $this->assertSame(8, $this->stockOf($a));
    }

    public function test_venta_mixta_exige_que_efectivo_mas_tarjeta_sumen_el_total(): void
    {
        [, $register, $session] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);

        $this->sell($register, [[$a, 2]], ['paymentMethod' => 'mixed', 'cashAmount' => 30000, 'cardAmount' => 60000])
            ->assertStatus(400)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'El monto total pagado no coincide con el total de la venta');
        $this->assertSame(10, $this->stockOf($a));
        $this->assertSame(0, Order::count());

        // Tolerancia de 0,01.
        $res = $this->sell($register, [[$a, 2]], ['paymentMethod' => 'mixed', 'cashAmount' => 40000.005, 'cardAmount' => 60000])
            ->assertCreated();
        $res->assertJsonPath('data.status', 'PAID');
        $this->assertSame(8, $this->stockOf($a));
        $this->assertSame(100000.0, (float) $session->fresh()->totalSales);
    }

    public function test_venta_debe_exige_cliente_y_queda_pendiente(): void
    {
        [, $register, $session] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);

        $this->sell($register, [[$a, 1]], ['paymentMethod' => 'debe'])
            ->assertStatus(400)
            ->assertJsonPath('message', 'Para una venta a crédito (Debe) debes seleccionar o registrar un cliente.');
        // La transacción se deshace: ni stock ni orden.
        $this->assertSame(10, $this->stockOf($a));
        $this->assertSame(0, Order::count());

        $res = $this->sell($register, [[$a, 1]], [
            'paymentMethod' => 'debe', 'customerName' => 'Juan Fiado', 'customerPhone' => '3001234567', 'cashAmount' => 20000,
        ])->assertCreated();

        $customer = POSCustomer::where('name', 'Juan Fiado')->sole();
        $res->assertJsonPath('data.status', 'PENDING')
            ->assertJsonPath('data.paidAt', null)
            ->assertJsonPath('data.posCustomerId', $customer->id)
            ->assertJsonPath('data.statusHistory.0.note', 'Venta POS a crédito (Debe) - pendiente de cobro');
        // El cliente creado por nombre no lleva contadores.
        $this->assertNull($customer->cedula);
        $this->assertSame(0, (int) $customer->totalPurchases);

        // El stock se descuenta aunque la venta quede pendiente.
        $this->assertSame(9, $this->stockOf($a));
        // ACTUAL: la sesión suma el total del fiado (50.000) aunque solo se abonaron 20.000.
        $this->assertSame(1, (int) $session->fresh()->salesCount);
        $this->assertSame(50000.0, (float) $session->fresh()->totalSales);

        // Un segundo fiado con el mismo nombre (otras mayúsculas) reutiliza el cliente.
        $this->sell($register, [[$a, 1]], ['paymentMethod' => 'debe', 'customerName' => 'JUAN FIADO'])
            ->assertCreated()
            ->assertJsonPath('data.posCustomerId', $customer->id);
    }

    public function test_venta_debe_con_abono_total_queda_pagada(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);

        $this->sell($register, [[$a, 1]], ['paymentMethod' => 'debe', 'customerName' => 'Pago Completo', 'cashAmount' => 50000])
            ->assertCreated()
            ->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.statusHistory.0.note', 'Venta POS - debe');
    }

    public function test_cliente_por_cedula_se_crea_y_luego_acumula(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);

        $first = $this->sell($register, [[$a, 1]], [
            'customerCedula' => ' 1020304050 ', 'customerName' => 'Marta', 'customerEmail' => 'marta@x.com',
        ])->assertCreated();
        $c = POSCustomer::where('cedula', '1020304050')->sole();
        $first->assertJsonPath('data.posCustomerId', $c->id)
            ->assertJsonPath('data.customerEmail', 'marta@x.com');
        $this->assertSame(1, (int) $c->totalPurchases);
        $this->assertSame(50000.0, (float) $c->totalSpent);
        $this->assertSame('marta@x.com', $c->email);

        $this->sell($register, [[$a, 2]], ['customerCedula' => '1020304050', 'customerPhone' => '311'])->assertCreated();
        $c->refresh();
        $this->assertSame(2, (int) $c->totalPurchases);
        $this->assertSame(150000.0, (float) $c->totalSpent);
        $this->assertSame('311', $c->phone);
        $this->assertSame('Marta', $c->name);

        // Por customerId existente: no toca los contadores del cliente.
        $this->sell($register, [[$a, 1]], ['customerId' => $c->id])->assertCreated()->assertJsonPath('data.posCustomerId', $c->id);
        $this->assertSame(2, (int) $c->fresh()->totalPurchases);
    }

    public function test_descuento_por_item_y_descuento_global(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);
        $b = $this->makeVariant('Gorra', 30000, 10);

        $res = $this->postJson('/api/pos/sale', [
            'cashRegisterId' => $register->id,
            'paymentMethod' => 'cash',
            'discount' => 2000,
            'items' => [
                ['variantId' => $a->id, 'quantity' => 2, 'price' => 50000, 'discount' => 4000],
                ['variantId' => $b->id, 'quantity' => 1, 'price' => 30000],
            ],
        ])->assertCreated();

        // subtotal = (100.000 - 4.000) + 30.000; total = subtotal - 2.000.
        $this->assertSame(126000.0, (float) $res->json('data.subtotal'));
        $this->assertSame(2000.0, (float) $res->json('data.discount'));
        $this->assertSame(124000.0, (float) $res->json('data.total'));
        // ACTUAL: el descuento por ítem no se guarda en order_items (solo unitPrice).
        $this->assertSame(50000.0, (float) OrderItem::where('variantId', $a->id)->value('unitPrice'));
    }

    public function test_el_precio_lo_manda_el_cliente_y_el_descuento_global_puede_ser_negativo(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 50000, 10);

        // ACTUAL (posible bug): el precio unitario viene del request y no se compara con el
        // precio del producto: se puede vender a 1 peso un producto de 50.000.
        $cheap = $this->sell($register, [[$a, 1, 1]])->assertCreated();
        $this->assertSame(1.0, (float) $cheap->json('data.total'));

        // ACTUAL (posible bug): en /pos/sale "discount" es nullable|numeric sin min:0
        // (en /pos/calculate sí hay min:0): un descuento negativo SUBE el total.
        $neg = $this->sell($register, [[$a, 1]], ['discount' => -1000])->assertCreated();
        $this->assertSame(-1000.0, (float) $neg->json('data.discount'));
        $this->assertSame(51000.0, (float) $neg->json('data.total'));

        // ACTUAL (posible bug): un descuento mayor que el subtotal deja el total negativo.
        $over = $this->sell($register, [[$a, 1]], ['discount' => 60000])->assertCreated();
        $this->assertSame(-10000.0, (float) $over->json('data.total'));
    }

    public function test_numeracion_de_ventas(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 1000, 10);

        $numbers = [];
        for ($i = 0; $i < 3; $i++) {
            $numbers[] = $this->sellOk($register, [[$a, 1]])->orderNumber;
        }

        foreach ($numbers as $n) {
            // ACTUAL (posible bug): POS-AAMMDD-NNNN con NNNN aleatorio (random_int 0..9999), no
            // consecutivo; usa date() (reloj real, no now()) y puede chocar con el índice único.
            $this->assertMatchesRegularExpression('/^POS-'.date('ymd').'-\d{4}$/', $n);
        }
        $this->assertCount(3, array_unique($numbers));
    }

    public function test_validaciones_de_sesion_caja_stock_y_payload(): void
    {
        $user = $this->actingAsCajero();
        $register = $this->makeRegister();
        $a = $this->makeVariant('Camiseta', 50000, 3);

        // Sin sesión abierta.
        $this->sell($register, [[$a, 1]])
            ->assertStatus(400)
            ->assertJsonPath('message', 'No tienes una sesión de caja abierta');

        // Sesión cerrada = igual que sin sesión.
        $closed = $this->openSessionFor($user, $register);
        $closed->update(['status' => 'CLOSED', 'closedAt' => now()]);
        $this->sell($register, [[$a, 1]])->assertStatus(400)->assertJsonPath('message', 'No tienes una sesión de caja abierta');

        $this->openSessionFor($user, $register);

        // Caja distinta a la de la sesión.
        $other = $this->makeRegister('CAJA-T2');
        $this->sell($other, [[$a, 1]])
            ->assertStatus(400)
            ->assertJsonPath('message', 'La sesión abierta no corresponde a esta caja');

        // Stock insuficiente.
        $this->sell($register, [[$a, 4]])
            ->assertStatus(400)
            ->assertJsonPath('message', 'Stock insuficiente para '.$a->sku.'. Disponible: 3, Solicitado: 4');

        // Variante inexistente (el cálculo falla primero).
        $this->postJson('/api/pos/sale', [
            'cashRegisterId' => $register->id, 'paymentMethod' => 'cash',
            'items' => [['variantId' => 999999, 'quantity' => 1, 'price' => 10]],
        ])->assertStatus(400)->assertJsonPath('message', 'Variante 999999 no encontrada');

        // Validación de payload.
        $this->postJson('/api/pos/sale', [])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Error de validación')
            ->assertJsonValidationErrors(['cashRegisterId', 'items', 'paymentMethod']);
        $this->sell($register, [[$a, 1]], ['paymentMethod' => 'bitcoin'])
            ->assertStatus(422)->assertJsonValidationErrors(['paymentMethod']);
        $this->postJson('/api/pos/sale', [
            'cashRegisterId' => $register->id, 'paymentMethod' => 'cash',
            'items' => [['variantId' => $a->id, 'quantity' => 0, 'price' => -1]],
        ])->assertStatus(422)->assertJsonValidationErrors(['items.0.quantity', 'items.0.price']);

        $this->assertSame(3, $this->stockOf($a));
        $this->assertSame(0, Order::count());
    }

    public function test_dos_lineas_de_la_misma_variante_validan_stock_por_linea(): void
    {
        [, $register] = $this->cajeroConCaja();
        $a = $this->makeVariant('Camiseta', 1000, 3);

        // ACTUAL (posible bug): el stock se valida línea por línea contra el stock total,
        // sin sumar líneas repetidas: 2 + 2 con stock 3 pasa y el stock queda en -1.
        $this->sell($register, [[$a, 2], [$a, 2]])->assertCreated();
        $this->assertSame(-1, $this->stockOf($a));
        $this->assertSame(2, VariantMovement::where('variantId', $a->id)->count());
    }

    public function test_venta_en_caja_con_categorias_no_restringe_productos(): void
    {
        $user = $this->actingAsCajero();
        $register = $this->makeRegister('CAJA-CAT', ['categoryIds' => [999]]);
        $this->openSessionFor($user, $register);
        $a = $this->makeVariant('Camiseta sin categoría', 1000, 3);

        // ACTUAL: la restricción de categorías de la caja solo filtra búsqueda/listado;
        // createSale no la valida.
        $this->sell($register, [[$a, 1]])->assertCreated();
    }

    public function test_el_cajero_y_el_admin_venden_pero_el_cliente_y_el_vendedor_no(): void
    {
        $register = $this->makeRegister();
        $a = $this->makeVariant('Camiseta', 1000, 10);

        $this->actingAsCliente();
        $this->sell($register, [[$a, 1]])->assertForbidden();
        $this->actingAsVendedor();
        $this->sell($register, [[$a, 1]])->assertForbidden();

        $admin = $this->actingAsAdmin();
        $this->openSessionFor($admin, $register);
        $this->sell($register, [[$a, 1]])->assertCreated();
        $this->assertSame(1, CashSession::where('sellerId', $admin->id)->value('salesCount'));
    }
}
