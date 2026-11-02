<?php

namespace Tests\Feature\Security;

use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/**
 * Pasarelas de pago: las claves secretas no se publican, la firma de Wompi la calcula
 * el servidor con el monto del pedido, y los webhooks sin secreto o con monto distinto
 * no aprueban pedidos.
 */
class PaymentsSecurityTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    private const INTEGRITY = 'test_integrity_123';

    private const EVENTS = 'test_events_456';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    private function savePaymentSettings(bool $withEventsSecret = true): void
    {
        Setting::updateOrCreate(['key' => 'payment_settings'], ['value' => [
            'methods' => [
                [
                    'id' => 'wompi', 'type' => 'wompi', 'name' => 'Wompi', 'isActive' => true,
                    'wompiConfig' => [
                        'publicKey' => 'pub_test_abc', 'privateKey' => 'prv_test_SECRETO',
                        'integrityKey' => self::INTEGRITY, 'eventSecret' => $withEventsSecret ? self::EVENTS : '',
                        'isTestMode' => true,
                    ],
                ],
                [
                    'id' => 'mp', 'type' => 'mercadopago', 'name' => 'Mercado Pago', 'isActive' => true,
                    'mercadoPagoConfig' => ['publicKey' => 'TEST-pub', 'accessToken' => 'TEST-ACCESS-SECRETO', 'isTestMode' => true],
                ],
                [
                    'id' => 'transfer', 'type' => 'transfer', 'name' => 'Transferencia', 'isActive' => true,
                    'bankInfo' => ['bankName' => 'Banco', 'accountNumber' => '123'],
                ],
            ],
        ]]);
    }

    private function order(User $user, float $total = 58000, string $status = 'PENDING'): Order
    {
        return Order::create([
            'orderNumber' => 'ORD-TEST-'.uniqid(),
            'userId' => $user->id,
            'subtotal' => $total,
            'total' => $total,
            'status' => $status,
            'paymentMethod' => 'wompi',
            'statusHistory' => [],
        ]);
    }

    /** Evento de Wompi firmado como lo hace Wompi (properties + timestamp + secreto). */
    private function wompiEvent(Order $order, int $cents, string $secret = self::EVENTS): array
    {
        $tx = ['id' => 'tx-1', 'status' => 'APPROVED', 'reference' => $order->orderNumber, 'amount_in_cents' => $cents, 'currency' => 'COP'];
        $timestamp = 1700000000;
        $props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];

        return [
            'event' => 'transaction.updated',
            'data' => ['transaction' => $tx],
            'timestamp' => $timestamp,
            'signature' => [
                'properties' => $props,
                'checksum' => hash('sha256', $tx['id'].$tx['status'].$tx['amount_in_cents'].$timestamp.$secret),
            ],
        ];
    }

    public function test_settings_publicos_no_exponen_claves_secretas(): void
    {
        $this->savePaymentSettings();

        $res = $this->getJson('/api/settings/public')->assertOk();
        $json = $res->getContent();

        $this->assertStringNotContainsString('prv_test_SECRETO', $json);
        $this->assertStringNotContainsString(self::INTEGRITY, $json);
        $this->assertStringNotContainsString(self::EVENTS, $json);
        $this->assertStringNotContainsString('TEST-ACCESS-SECRETO', $json);
        // Lo público sigue llegando: llave pública, modo y datos de transferencia.
        $res->assertJsonPath('data.payment.methods.0.wompiConfig.publicKey', 'pub_test_abc')
            ->assertJsonPath('data.payment.methods.1.mercadoPagoConfig.publicKey', 'TEST-pub')
            ->assertJsonPath('data.payment.methods.2.bankInfo.accountNumber', '123');
    }

    public function test_el_admin_sigue_viendo_la_configuracion_completa(): void
    {
        $this->savePaymentSettings();
        $this->actingAsAdmin();

        $this->getJson('/api/settings/payments/config')
            ->assertOk()
            ->assertJsonPath('data.methods.0.wompiConfig.integrityKey', self::INTEGRITY);
    }

    public function test_wompi_checkout_firma_en_el_servidor_con_el_monto_del_pedido(): void
    {
        $this->savePaymentSettings();
        $cliente = $this->actingAsCliente();
        $order = $this->order($cliente, 58000);

        $this->postJson("/api/orders/my/{$order->id}/wompi-checkout")
            ->assertOk()
            ->assertJsonPath('data.reference', $order->orderNumber)
            ->assertJsonPath('data.amountInCents', 5800000)
            ->assertJsonPath('data.publicKey', 'pub_test_abc')
            ->assertJsonPath('data.signature', hash('sha256', $order->orderNumber.'5800000COP'.self::INTEGRITY))
            ->assertJsonMissingPath('data.integrityKey');
    }

    public function test_wompi_checkout_de_pedido_ajeno_o_no_pendiente_se_rechaza(): void
    {
        $this->savePaymentSettings();
        $ajeno = $this->order($this->otroCliente());
        $cliente = $this->actingAsCliente();
        $pagado = $this->order($cliente, 10000, 'PAID');

        $this->postJson("/api/orders/my/{$ajeno->id}/wompi-checkout")->assertNotFound();
        $this->postJson("/api/orders/my/{$pagado->id}/wompi-checkout")->assertStatus(409);
    }

    public function test_webhook_wompi_sin_secreto_configurado_se_rechaza(): void
    {
        $this->savePaymentSettings(withEventsSecret: false);
        $order = $this->order($this->userByEmail('cliente@vexa.com'), 58000);

        $this->postJson('/api/webhooks/wompi', $this->wompiEvent($order, 5800000, 'cualquiera'))
            ->assertStatus(401);
        $this->assertSame('PENDING', $order->fresh()->status);
    }

    public function test_webhook_wompi_con_firma_invalida_se_rechaza(): void
    {
        $this->savePaymentSettings();
        $order = $this->order($this->userByEmail('cliente@vexa.com'), 58000);

        $this->postJson('/api/webhooks/wompi', $this->wompiEvent($order, 5800000, 'otro-secreto'))
            ->assertStatus(401);
        $this->assertSame('PENDING', $order->fresh()->status);
    }

    public function test_webhook_wompi_con_monto_menor_no_aprueba_el_pedido(): void
    {
        $this->savePaymentSettings();
        $order = $this->order($this->userByEmail('cliente@vexa.com'), 58000);

        $this->postJson('/api/webhooks/wompi', $this->wompiEvent($order, 100))->assertOk();
        $this->assertSame('PENDING', $order->fresh()->status);
    }

    public function test_webhook_wompi_valido_con_monto_correcto_aprueba_el_pedido(): void
    {
        $this->savePaymentSettings();
        $order = $this->order($this->userByEmail('cliente@vexa.com'), 58000);

        $this->postJson('/api/webhooks/wompi', $this->wompiEvent($order, 5800000))->assertOk();
        $this->assertSame('PAID', $order->fresh()->status);
    }

    public function test_confirmar_mercadopago_con_monto_distinto_no_aprueba(): void
    {
        $this->savePaymentSettings();
        $order = $this->order($this->userByEmail('cliente@vexa.com'), 58000);
        Http::fake(['api.mercadopago.com/*' => Http::response([
            'id' => 99, 'status' => 'approved', 'external_reference' => $order->orderNumber,
            'transaction_amount' => 1000, 'currency_id' => 'COP',
        ])]);

        $this->getJson("/api/webhooks/mercadopago/confirm/{$order->orderNumber}?payment_id=99");
        $this->assertSame('PENDING', $order->fresh()->status);
    }

    public function test_confirmar_mercadopago_con_monto_correcto_aprueba(): void
    {
        $this->savePaymentSettings();
        $order = $this->order($this->userByEmail('cliente@vexa.com'), 58000);
        Http::fake(['api.mercadopago.com/*' => Http::response([
            'id' => 99, 'status' => 'approved', 'external_reference' => $order->orderNumber,
            'transaction_amount' => 58000, 'currency_id' => 'COP',
        ])]);

        $this->getJson("/api/webhooks/mercadopago/confirm/{$order->orderNumber}?payment_id=99");
        $this->assertSame('PAID', $order->fresh()->status);
    }

    public function test_webhooks_de_meta_sin_app_secret_se_rechazan(): void
    {
        $payload = ['object' => 'page', 'entry' => [['messaging' => [['message' => ['text' => 'hola']]]]]];

        $this->postJson('/api/webhooks/messenger', $payload)->assertStatus(401);
        $this->postJson('/api/webhooks/whatsapp', $payload)->assertStatus(401);
    }
}
