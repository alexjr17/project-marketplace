<?php

namespace Tests\Feature\Flows\Store;

use App\Models\Address;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Store\Concerns\StoreFixtures;
use Tests\TestCase;

/**
 * Caracterización de las notificaciones del usuario, su perfil (/auth/me) y sus direcciones.
 */
class NotificationsAndProfileTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase, StoreFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    private function notify(User $user, array $attrs = []): Notification
    {
        return Notification::create(array_merge([
            'userId' => $user->id, 'type' => 'SYSTEM', 'title' => 'Hola', 'message' => 'Mensaje', 'isRead' => false,
        ], $attrs));
    }

    // ---------------- Notificaciones ----------------

    public function test_listado_de_notificaciones_con_no_leidas_y_filtros(): void
    {
        $this->seedStoreCatalog();
        $cliente = $this->actingAsCliente();
        $p = $this->makeProduct('Suéter', 58000, [['negro', 'M', 1]]);
        $this->notify($cliente, ['createdAt' => now()->subHour()]);
        $this->notify($cliente, ['type' => 'PROMO', 'isRead' => true, 'createdAt' => now()->subMinutes(30)]);
        $this->notify($cliente, ['type' => 'REVIEW_AVAILABLE', 'referenceType' => 'product', 'referenceId' => $p->id]);
        $this->notify($this->otroCliente());

        $res = $this->getJson('/api/notifications?limit=2')->assertOk()
            ->assertJsonPath('meta', ['total' => 3, 'page' => 1, 'limit' => 2, 'totalPages' => 2, 'unreadCount' => 2]);
        $first = $res->json('data.0'); // la más reciente
        $this->assertSame([
            'id', 'type', 'title', 'message', 'referenceType', 'referenceId', 'isRead', 'createdAt', 'productName', 'productImage',
        ], array_keys($first));
        $this->assertSame(['Suéter', 'https://img.test/1.jpg'], [$first['productName'], $first['productImage']]);
        $this->assertArrayNotHasKey('productName', $res->json('data.1'));

        $this->getJson('/api/notifications?unreadOnly=true')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/notifications?type=PROMO')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertExactJson(['success' => true, 'data' => ['unreadCount' => 2]]);
    }

    public function test_marcar_leidas_y_eliminar_solo_las_propias(): void
    {
        $cliente = $this->actingAsCliente();
        $a = $this->notify($cliente);
        $b = $this->notify($cliente);
        $c = $this->notify($cliente);
        $ajena = $this->notify($this->otroCliente());

        $this->patchJson("/api/notifications/{$a->id}/read")->assertOk()
            ->assertExactJson(['success' => true, 'message' => 'Notificación marcada como leída']);
        $this->assertTrue($a->fresh()->isRead);

        $this->postJson('/api/notifications/mark-read', ['notificationIds' => [$b->id, $ajena->id]])->assertOk()
            ->assertJsonPath('message', 'Notificaciones marcadas como leídas');
        $this->assertTrue($b->fresh()->isRead);
        $this->assertFalse($ajena->fresh()->isRead); // la ajena no se toca
        $this->postJson('/api/notifications/mark-read', [])->assertStatus(422);

        $this->postJson('/api/notifications/mark-all-read')->assertOk()
            ->assertJsonPath('message', 'Todas las notificaciones marcadas como leídas');
        $this->assertTrue($c->fresh()->isRead);
        $this->assertFalse($ajena->fresh()->isRead);

        $this->getJson("/api/notifications/{$a->id}")->assertOk()->assertJsonPath('data.isRead', true);
        foreach (['getJson' => '', 'patchJson' => '/read', 'deleteJson' => ''] as $method => $suffix) {
            $this->{$method}("/api/notifications/{$ajena->id}{$suffix}")->assertNotFound()
                ->assertJsonPath('message', 'Notificación no encontrada');
        }

        $this->deleteJson("/api/notifications/{$a->id}")->assertOk()->assertJsonPath('message', 'Notificación eliminada');
        $this->assertNull(Notification::find($a->id));
    }

    // ---------------- Perfil ----------------

    public function test_auth_me_devuelve_el_usuario_con_su_rol_y_permisos(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();

        $vendedor = $this->actingAsVendedor();
        $me = $this->getJson('/api/auth/me')->assertOk()->json('data.user');
        $this->assertSame(['id', 'email', 'name', 'phone', 'avatar', 'roleId', 'role', 'permissions', 'status'], array_keys($me));
        $this->assertSame([$vendedor->id, 'vendedor@vexa.com', 3, 'Administrador', 'ACTIVE'], [$me['id'], $me['email'], $me['roleId'], $me['role'], $me['status']]);
        $this->assertContains('orders.view', $me['permissions']);

        $this->actingAsCliente();
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.user.role', 'Cliente')->assertJsonPath('data.user.permissions', []);
    }

    public function test_actualizar_el_perfil_crea_o_actualiza_la_direccion_principal(): void
    {
        $cliente = $this->actingAsCliente();
        Address::where('userId', $cliente->id)->delete();

        $res = $this->putJson('/api/auth/me', [
            'name' => 'Cliente Nuevo', 'phone' => '3001112233', 'cedula' => '1020304050', 'city' => 'Medellín', 'address' => 'Cra 10 # 20-30',
        ])->assertOk()->assertJsonPath('message', 'Perfil actualizado exitosamente');
        $data = $res->json('data');
        $this->assertSame(['Cliente Nuevo', '3001112233'], [$data['name'], $data['phone']]);
        $this->assertSame([
            'cedula' => '1020304050', 'phone' => '3001112233', 'address' => 'Cra 10 # 20-30',
            'city' => 'Medellín', 'postalCode' => '', 'country' => 'Colombia',
        ], $data['profile']);

        $addr = Address::where('userId', $cliente->id)->sole();
        $this->assertSame(['Principal', true], [$addr->label, $addr->isDefault]);

        // Segunda vez: actualiza la dirección por defecto y no pisa lo no enviado (ni el nombre).
        $this->putJson('/api/auth/me', ['city' => 'Envigado'])->assertOk()
            ->assertJsonPath('data.name', 'Cliente Nuevo')
            ->assertJsonPath('data.profile.city', 'Envigado')
            ->assertJsonPath('data.profile.address', 'Cra 10 # 20-30');
        $this->assertSame(1, Address::where('userId', $cliente->id)->count());

        // Sin datos de dirección y sin dirección por defecto: profile con nulos.
        Address::where('userId', $cliente->id)->delete();
        $this->putJson('/api/auth/me', ['name' => 'Otro Nombre'])->assertOk()
            ->assertJsonPath('data.profile.address', null)
            ->assertJsonPath('data.profile.cedula', '1020304050');
    }

    // ---------------- Direcciones ----------------

    public function test_direcciones_del_usuario_y_la_predeterminada(): void
    {
        $cliente = $this->actingAsCliente();
        Address::where('userId', $cliente->id)->delete();

        $a = $this->postJson('/api/users/addresses', ['label' => 'Casa', 'address' => 'Calle 1', 'city' => 'Cali', 'isDefault' => true])
            ->assertCreated()->assertJsonPath('message', 'Dirección creada exitosamente')
            ->assertJsonPath('data.isDefault', true)->json('data');
        $b = $this->postJson('/api/users/addresses', ['label' => 'Oficina', 'address' => 'Calle 2', 'city' => 'Cali', 'department' => 'Valle', 'isDefault' => true])
            ->assertCreated()->json('data');
        $this->assertFalse(Address::find($a['id'])->isDefault); // solo una por defecto

        // La predeterminada primero.
        $this->getJson('/api/users/addresses')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $b['id'])
            ->assertJsonPath('data.0.department', 'Valle');

        $this->patchJson("/api/users/addresses/{$a['id']}/default")->assertOk()
            ->assertJsonPath('message', 'Dirección predeterminada actualizada')->assertJsonPath('data.isDefault', true);
        $this->assertFalse(Address::find($b['id'])->isDefault);

        $this->putJson("/api/users/addresses/{$b['id']}", ['label' => 'Oficina 2', 'address' => 'Calle 3', 'city' => 'Palmira'])->assertOk()
            ->assertJsonPath('message', 'Dirección actualizada exitosamente')->assertJsonPath('data.city', 'Palmira');
        $this->postJson('/api/users/addresses', ['label' => 'X'])->assertStatus(422)->assertJsonStructure(['errors' => ['address', 'city']]);

        $this->deleteJson("/api/users/addresses/{$b['id']}")->assertOk()->assertJsonPath('message', 'Dirección eliminada exitosamente');
        $this->assertNull(Address::find($b['id']));
    }

    public function test_no_se_tocan_direcciones_ajenas(): void
    {
        $otro = $this->otroCliente();
        $ajena = Address::create(['userId' => $otro->id, 'label' => 'Casa', 'address' => 'Calle 9', 'city' => 'Cali', 'country' => 'Colombia', 'isDefault' => true]);
        $this->actingAsCliente();

        $this->putJson("/api/users/addresses/{$ajena->id}", ['label' => 'X', 'address' => 'X', 'city' => 'X'])->assertNotFound()
            ->assertJsonPath('message', 'Dirección no encontrada');
        $this->patchJson("/api/users/addresses/{$ajena->id}/default")->assertNotFound();
        $this->deleteJson("/api/users/addresses/{$ajena->id}")->assertNotFound();
        $this->assertSame('Calle 9', $ajena->fresh()->address);
    }
}
