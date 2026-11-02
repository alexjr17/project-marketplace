<?php

namespace Tests\Feature\Security;

use App\Models\CashRegister;
use App\Models\CashSession;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/** Permisos, subidas, límites de peticiones, sesiones y caja (fase 0 de seguridad). */
class AccessHardeningTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    // ---------- Permisos del rol Cliente ----------

    public function test_el_rol_cliente_no_tiene_permisos_del_panel(): void
    {
        $this->assertSame([], Role::where('slug', 'cliente')->first()->permissions);
    }

    public function test_la_migracion_quita_los_permisos_heredados_al_cliente(): void
    {
        $role = Role::where('slug', 'cliente')->first();
        $role->permissions = ['products.view', 'orders.view', 'orders.create', 'otro.permiso'];
        $role->save();

        $migration = require database_path('migrations/2026_11_02_000001_remove_admin_permissions_from_cliente_role.php');
        $migration->up();
        $migration->up(); // idempotente

        $this->assertSame(['otro.permiso'], $role->fresh()->permissions);
    }

    public function test_cliente_no_puede_escribir_codigos_de_barras(): void
    {
        $this->actingAsCliente();

        $this->postJson('/api/barcodes/assign-all')->assertForbidden();
        $this->postJson('/api/barcodes/assign/1', ['barcode' => '123'])->assertForbidden();
    }

    public function test_cliente_no_puede_crear_ni_borrar_recetas_de_plantillas(): void
    {
        $this->actingAsCliente();

        $this->postJson('/api/template-recipes', [])->assertForbidden();
        $this->deleteJson('/api/template-recipes/variant/1')->assertForbidden();
        $this->postJson('/api/template-recipes/product/1/associate', [])->assertForbidden();
    }

    public function test_el_stock_publico_de_plantillas_sigue_abierto(): void
    {
        // La tienda y el POS lo leen sin permisos especiales.
        $status = $this->getJson('/api/template-recipes/variant-stock/999')->status();
        $this->assertNotContains($status, [401, 403]);
    }

    // ---------- Subida desde URL (SSRF) ----------

    public function test_subir_desde_url_es_solo_de_admin(): void
    {
        $this->actingAsCliente();
        $this->postJson('/api/uploads/from-url', ['url' => 'https://example.com/a.png'])->assertForbidden();
    }

    public function test_subir_desde_url_rechaza_direcciones_internas(): void
    {
        $this->actingAsAdmin();

        foreach (['http://127.0.0.1/x.png', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/a.png', 'http://192.168.1.1/a.png', 'ftp://example.com/a.png'] as $url) {
            $this->postJson('/api/uploads/from-url', ['url' => $url])->assertStatus(400);
        }
    }

    // ---------- Límites de peticiones ----------

    public function test_el_login_tiene_limite_de_intentos_por_email(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'cliente@vexa.com', 'password' => 'mala'.$i]);
        }

        $this->postJson('/api/auth/login', ['email' => 'cliente@vexa.com', 'password' => 'cliente123'])
            ->assertStatus(429);
    }

    // ---------- Sesiones y contraseñas ----------

    public function test_recuperar_contrasena_envia_correo_y_no_escribe_el_token_en_el_log(): void
    {
        Mail::fake();
        Log::spy();

        $this->postJson('/api/auth/forgot-password', ['email' => 'cliente@vexa.com'])->assertOk();

        Log::shouldNotHaveReceived('info');
        $this->assertNotNull($this->userByEmail('cliente@vexa.com')->resetToken);
    }

    public function test_recuperar_con_email_inexistente_responde_igual(): void
    {
        $this->postJson('/api/auth/forgot-password', ['email' => 'nadie@vexa.test'])
            ->assertOk()
            ->assertJsonPath('message', 'Si el email existe, recibirás instrucciones para recuperar tu contraseña');
    }

    public function test_resetear_la_contrasena_cierra_todas_las_sesiones(): void
    {
        $user = $this->userByEmail('cliente@vexa.com');
        $user->createToken('a');
        $user->createToken('b');
        $token = 'token-de-prueba';
        $user->resetToken = hash('sha256', $token);
        $user->resetTokenExp = now()->addHour();
        $user->save();

        $this->postJson('/api/auth/reset-password', ['token' => $token, 'password' => 'nueva123'])->assertOk();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_cambiar_la_contrasena_cierra_las_otras_sesiones(): void
    {
        $user = $this->userByEmail('cliente@vexa.com');
        $user->createToken('otra-sesion');
        $actual = $user->createToken('actual')->plainTextToken;

        $this->withToken($actual)
            ->postJson('/api/auth/change-password', ['currentPassword' => 'cliente123', 'newPassword' => 'nueva123'])
            ->assertOk();

        $this->assertSame(1, $user->tokens()->count());
        $this->assertSame('actual', $user->tokens()->first()->name);
    }

    public function test_un_usuario_desactivado_no_puede_usar_su_token(): void
    {
        $user = $this->userByEmail('cliente@vexa.com');
        $token = $user->createToken('t')->plainTextToken;
        $this->withToken($token)->getJson('/api/auth/me')->assertOk();

        $user->status = 'INACTIVE';
        $user->save();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_los_tokens_vencen(): void
    {
        $user = $this->userByEmail('cliente@vexa.com');
        $token = $user->createToken('t');
        $token->accessToken->forceFill(['created_at' => now()->subDays(8)])->save();

        $this->withToken($token->plainTextToken)->getJson('/api/auth/me')->assertUnauthorized();
    }

    // ---------- POS ----------

    public function test_sin_pos_cancel_sale_no_se_puede_anular_devolver_ni_editar(): void
    {
        // Solo pos.access ya no basta (antes era la puerta trasera).
        $role = Role::where('slug', 'cajero')->first();
        $role->permissions = array_values(array_diff($role->permissions, ['pos.cancel_sale']));
        $role->save();
        $this->actingAsCajero();

        $this->postJson('/api/pos/sale/1/cancel', ['reason' => 'x'])->assertForbidden();
        $this->postJson('/api/pos/sale/1/return', [])->assertForbidden();
        $this->putJson('/api/pos/sale/1', [])->assertForbidden();
    }

    public function test_un_rol_con_permiso_de_anular_si_pasa_el_control(): void
    {
        $this->actingAsCajero(); // el Cajero tiene pos.cancel_sale

        $this->assertNotSame(403, $this->postJson('/api/pos/sale/999999/cancel', ['reason' => 'x'])->status());
    }

    public function test_un_cajero_no_puede_cerrar_la_caja_de_otro(): void
    {
        $register = CashRegister::create(['name' => 'Caja 1', 'location' => 'Tienda', 'code' => 'C1']);
        $otro = User::create(['email' => 'cajero2@vexa.test', 'name' => 'Cajero 2', 'passwordHash' => bcrypt('x12345'), 'roleId' => 4]);
        $session = CashSession::create(['cashRegisterId' => $register->id, 'sellerId' => $otro->id, 'initialCash' => 0, 'status' => 'OPEN']);
        $this->actingAsCajero();

        $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 0])->assertForbidden();
        $this->assertSame('OPEN', $session->fresh()->status);
    }

    public function test_el_superadmin_cierra_la_caja_de_cualquiera(): void
    {
        $register = CashRegister::create(['name' => 'Caja 1', 'location' => 'Tienda', 'code' => 'C1']);
        $cajero = $this->userByEmail('pos@vexa.com');
        $session = CashSession::create(['cashRegisterId' => $register->id, 'sellerId' => $cajero->id, 'initialCash' => 0, 'status' => 'OPEN']);
        $this->actingAsAdmin();

        $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 0])->assertOk();
    }

    public function test_el_cajero_cierra_su_propia_caja(): void
    {
        $register = CashRegister::create(['name' => 'Caja 1', 'location' => 'Tienda', 'code' => 'C1']);
        $cajero = $this->actingAsCajero();
        $session = CashSession::create(['cashRegisterId' => $register->id, 'sellerId' => $cajero->id, 'initialCash' => 0, 'status' => 'OPEN']);

        $this->postJson("/api/cash-registers/sessions/{$session->id}/close", ['finalCash' => 0])->assertOk();
        $this->assertSame('CLOSED', $session->fresh()->status);
    }

    // ---------- Secretos de canales y Mercado Pago ----------

    public function test_los_secretos_de_los_canales_salen_enmascarados_y_no_se_pisan(): void
    {
        $channel = \App\Models\Channel::create([
            'type' => 'messenger', 'name' => 'Página', 'isActive' => true,
            'config' => ['appSecret' => 'SECRETO-REAL-1234', 'pageId' => '99'],
        ]);
        $this->actingAsAdmin();

        $res = $this->getJson("/api/messaging/channels/{$channel->id}")->assertOk();
        $masked = $res->json('data.config.appSecret');
        $this->assertSame('••••1234', $masked);
        $this->assertStringNotContainsString('SECRETO-REAL', $res->getContent());

        // El front reenvía el config tal cual: el secreto real se conserva.
        $this->patchJson("/api/messaging/channels/{$channel->id}", ['config' => ['appSecret' => $masked, 'pageId' => '100']])->assertOk();
        $config = $channel->fresh()->config;
        $this->assertSame('SECRETO-REAL-1234', $config['appSecret']);
        $this->assertSame('100', $config['pageId']);

        // Un valor nuevo sí lo reemplaza.
        $this->patchJson("/api/messaging/channels/{$channel->id}", ['config' => ['appSecret' => 'NUEVO-5678']])->assertOk();
        $this->assertSame('NUEVO-5678', $channel->fresh()->config['appSecret']);
    }

    public function test_preferencia_de_mercadopago_solo_sobre_pedidos_propios(): void
    {
        $venta = \App\Models\Order::create([
            'orderNumber' => 'POS-1', 'userId' => null, 'subtotal' => 1000, 'total' => 1000,
            'paymentMethod' => 'cash', 'saleChannel' => 'POS', 'statusHistory' => [],
        ]);
        $this->actingAsCliente();

        $this->postJson('/api/payments/mercadopago/preference', ['orderId' => $venta->id])->assertNotFound();
    }
}
