<?php

namespace Tests\Feature\Security;

use App\Models\Order;
use App\Models\ProductVariant;
use App\Models\Setting;
use App\Services\ShippingQuoteService;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\InventorySeeder;
use Database\Seeders\MinimalSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/**
 * Lo que el checkout muestra es lo que se cobra (envío por zona), Despachos puede enviar
 * pedidos pagados, el Cajero ve productos pero no los gestiona y Wompi solo firma pedidos
 * de Wompi.
 */
class CheckoutConsistencyTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    /** Zona Antioquia con tarifa base 6000 + 1000/kg, envío gratis desde 200.000. */
    private function shippingSettings(): array
    {
        return [
            'zones' => [['id' => 'z-ant', 'name' => 'Antioquia', 'department' => 'Antioquia', 'cities' => [], 'isActive' => true]],
            'carriers' => [[
                'id' => 'c1', 'name' => 'Servientrega', 'isActive' => true,
                'zoneRates' => [['zoneId' => 'z-ant', 'baseCost' => 6000, 'costPerKg' => 1000, 'estimatedDays' => ['min' => 2, 'max' => 4], 'freeShippingThreshold' => 200000]],
            ]],
            'defaultCarrierId' => 'c1',
            'packageDefaults' => ['defaultWeightPerItem' => 0.3],
        ];
    }

    public function test_cotiza_igual_que_el_front(): void
    {
        $quotes = new ShippingQuoteService;
        $s = $this->shippingSettings();

        // Medellín pertenece a Antioquia: 6000 + max(0.3*1, 0.1)*1000 = 6300.
        $this->assertSame(6300, $quotes->quote($s, 'Medellín', $quotes->packageWeight($s, 1), 30000));
        $this->assertSame(6300, $quotes->quote($s, '  MEDELLIN ', 0.3, 30000)); // sin tildes ni mayúsculas
        $this->assertSame(0, $quotes->quote($s, 'Medellín', 0.3, 250000));     // supera el umbral
        $this->assertNull($quotes->quote($s, 'Cali', 0.3, 30000));              // sin zona: respaldo fijo
        $this->assertNull($quotes->quote($s, '', 0.3, 30000));
    }

    public function test_el_pedido_cobra_el_envio_por_zona(): void
    {
        $this->seed([CatalogSeeder::class, InventorySeeder::class, MinimalSeeder::class]);
        Setting::updateOrCreate(['key' => 'shipping_settings'], ['value' => $this->shippingSettings()]);
        $variant = ProductVariant::with(['product', 'color', 'size'])
            ->where('stock', '>', 0)->whereHas('product', fn ($q) => $q->where('isActive', true)->where('isTemplate', false))
            ->firstOrFail();
        $this->actingAsCliente();

        $res = $this->postJson('/api/orders', [
            'items' => [[
                'productId' => $variant->productId,
                'color' => $variant->color?->hexCode ?? '',
                'size' => $variant->size?->name ?? '',
                'quantity' => 1,
            ]],
            'shipping' => ['name' => 'Cliente', 'address' => 'Calle 1', 'city' => 'Medellín', 'country' => 'Colombia'],
            'paymentMethod' => 'transfer',
        ])->assertCreated();

        $subtotal = (float) $res->json('data.subtotal');
        $expected = $subtotal >= 200000 ? 0 : 6300;
        $this->assertSame((float) $expected, (float) $res->json('data.shippingCost'));
    }

    public function test_un_pedido_pagado_se_puede_despachar(): void
    {
        $order = Order::create([
            'orderNumber' => 'ORD-PAGADO-1', 'userId' => $this->userByEmail('cliente@vexa.com')->id,
            'subtotal' => 1000, 'total' => 1000, 'status' => 'PAID', 'paymentMethod' => 'transfer', 'statusHistory' => [],
        ]);
        $this->actingAsVendedor();

        $this->patchJson("/api/orders/{$order->id}/status", ['status' => 'SHIPPED', 'trackingNumber' => 'GUIA-1'])->assertOk();
        $this->assertSame('SHIPPED', $order->fresh()->status);
        $this->assertSame('GUIA-1', $order->fresh()->trackingNumber);
    }

    public function test_el_cajero_ve_productos_pero_no_los_gestiona(): void
    {
        $this->actingAsCajero();

        $this->getJson('/api/products')->assertOk();
        $this->postJson('/api/products', ['name' => 'X'])->assertForbidden();
        $this->putJson('/api/products/1', ['name' => 'X'])->assertForbidden();
        $this->deleteJson('/api/products/1')->assertForbidden();
        $this->patchJson('/api/products/1/stock', ['stock' => 1])->assertForbidden();
    }

    public function test_el_administrador_si_gestiona_productos(): void
    {
        $this->actingAsVendedor();

        $this->assertNotSame(403, $this->postJson('/api/products', [])->status());
    }

    public function test_wompi_solo_firma_pedidos_de_wompi(): void
    {
        $cliente = $this->actingAsCliente();
        $pickup = Order::create([
            'orderNumber' => 'ORD-PICKUP-1', 'userId' => $cliente->id, 'subtotal' => 1000, 'total' => 1000,
            'status' => 'PENDING', 'paymentMethod' => 'pickup', 'statusHistory' => [],
        ]);

        $this->postJson("/api/orders/my/{$pickup->id}/wompi-checkout")->assertStatus(409);
    }

    public function test_quien_ve_productos_puede_leer_plantillas_de_etiquetas_pero_no_editarlas(): void
    {
        $this->actingAsCajero();

        $this->getJson('/api/label-templates')->assertOk();
        $this->postJson('/api/label-templates', ['name' => 'X'])->assertForbidden();
    }

    // ---------- Cancelar un pedido devuelve cupón y pagos ----------

    private function couponOrder(\App\Models\Discount $coupon, string $status = 'PENDING'): Order
    {
        return Order::create([
            'orderNumber' => 'ORD-CUP-'.uniqid(), 'userId' => $this->userByEmail('cliente@vexa.com')->id,
            'subtotal' => 30000, 'total' => 27000, 'discount' => 3000, 'discountId' => $coupon->id,
            'couponCode' => $coupon->code, 'status' => $status, 'paymentMethod' => 'mercadopago', 'statusHistory' => [],
        ]);
    }

    private function coupon(): \App\Models\Discount
    {
        return \App\Models\Discount::create([
            'code' => 'UNAVEZ', 'type' => 'percent', 'value' => 10, 'maxUsesPerUser' => 1, 'usedCount' => 1, 'isActive' => true,
        ]);
    }

    public function test_cancelar_un_pedido_libera_el_cupon_de_un_solo_uso(): void
    {
        $coupon = $this->coupon();
        $order = $this->couponOrder($coupon);
        $this->actingAsCliente();

        $this->postJson("/api/orders/my/{$order->id}/cancel")->assertOk();

        $this->assertSame(0, (int) $coupon->fresh()->usedCount);
        // El cupón se puede volver a usar: el pedido cancelado no cuenta.
        $this->postJson('/api/discounts/validate', ['code' => 'UNAVEZ', 'subtotal' => 30000, 'items' => []])
            ->assertJsonMissing(['message' => 'Ya usaste este cupón el máximo de veces permitido']);
    }

    public function test_cancelar_un_pedido_cancela_sus_pagos_pendientes(): void
    {
        $order = $this->couponOrder($this->coupon());
        $payment = \App\Models\Payment::create(['orderId' => $order->id, 'paymentMethod' => 'mercadopago', 'amount' => 27000, 'status' => 'PENDING']);
        $this->actingAsCliente();

        $this->postJson("/api/orders/my/{$order->id}/cancel")->assertOk();

        $this->assertSame('CANCELLED', $payment->fresh()->status);
    }

    public function test_pago_aprobado_sobre_pedido_cancelado_queda_registrado_para_reembolso(): void
    {
        Setting::updateOrCreate(['key' => 'payment_settings'], ['value' => ['methods' => [[
            'id' => 'w', 'type' => 'wompi', 'isActive' => true,
            'wompiConfig' => ['publicKey' => 'pub_test_x', 'integrityKey' => 'i', 'eventSecret' => 'sec', 'isTestMode' => true],
        ]]]]);
        $order = Order::create([
            'orderNumber' => 'ORD-CANC-1', 'userId' => $this->userByEmail('cliente@vexa.com')->id,
            'subtotal' => 10000, 'total' => 10000, 'status' => 'CANCELLED', 'paymentMethod' => 'wompi', 'statusHistory' => [],
        ]);
        $tx = ['id' => 'tx-late', 'status' => 'APPROVED', 'reference' => 'ORD-CANC-1', 'amount_in_cents' => 1000000, 'currency' => 'COP'];
        $event = [
            'event' => 'transaction.updated', 'data' => ['transaction' => $tx], 'timestamp' => 1,
            'signature' => ['properties' => ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
                'checksum' => hash('sha256', 'tx-lateAPPROVED1000000'.'1'.'sec')],
        ];

        $this->postJson('/api/webhooks/wompi', $event)->assertOk();

        $this->assertSame('CANCELLED', $order->fresh()->status);
        $payment = \App\Models\Payment::where('transactionId', 'tx-late')->firstOrFail();
        $this->assertSame('APPROVED', $payment->status);
        $this->assertStringContainsString('reembolso', $payment->notes);
    }
}
