<?php

namespace Tests\Feature\Security;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\TestCase;

/**
 * Rutas del panel por permiso de módulo (antes eran solo SuperAdmin).
 * Roles sembrados: 1 SuperAdmin, 2 Cliente, 3 Administrador (operación de la tienda), 4 Cajero.
 */
class PermissionsByRoleTest extends TestCase
{
    use ActsAsRoles, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    /** GET de lectura de cada módulo y el permiso que lo abre. */
    private const MODULE_READS = [
        '/api/orders' => 'orders.view',
        '/api/payments/all' => 'payments.view',
        '/api/reviews/admin/all' => 'reviews.view',
        '/api/users' => 'users.view',
        '/api/discounts' => 'discounts.view',
        '/api/announcements' => 'announcements.view',
        '/api/templates' => 'templates.view',
        '/api/inputs' => 'inputs.view',
        '/api/input-types' => 'input_types.view',
    ];

    private function statusOf(string $url): int
    {
        return $this->getJson($url)->status();
    }

    public function test_sin_token_todo_el_panel_responde_401(): void
    {
        foreach (array_keys(self::MODULE_READS) as $url) {
            $this->assertSame(401, $this->statusOf($url), $url);
        }
    }

    public function test_el_cliente_no_entra_a_ningun_modulo_del_panel(): void
    {
        $this->actingAsCliente();
        foreach (array_keys(self::MODULE_READS) as $url) {
            $this->assertSame(403, $this->statusOf($url), $url);
        }
    }

    public function test_el_superadmin_entra_a_todo(): void
    {
        $this->actingAsAdmin();
        foreach (array_keys(self::MODULE_READS) as $url) {
            $this->assertSame(200, $this->statusOf($url), $url);
        }
    }

    public function test_el_administrador_entra_solo_a_la_operacion_de_la_tienda(): void
    {
        $this->actingAsVendedor();
        $perms = Role::where('slug', 'administrador')->first()->permissions;

        foreach (self::MODULE_READS as $url => $perm) {
            $expected = in_array($perm, $perms, true) ? 200 : 403;
            $this->assertSame($expected, $this->statusOf($url), "$url ($perm)");
        }
        // Lo que el negocio pidió que tenga y lo que no.
        $this->assertSame(200, $this->statusOf('/api/orders'));
        $this->assertSame(200, $this->statusOf('/api/discounts'));
        $this->assertSame(403, $this->statusOf('/api/inputs'));
        $this->assertSame(403, $this->statusOf('/api/roles'));
        $this->assertSame(403, $this->statusOf('/api/settings/general/config'));
    }

    public function test_el_cajero_tiene_permiso_de_anular(): void
    {
        $this->assertContains('pos.cancel_sale', Role::where('slug', 'cajero')->first()->permissions);
    }

    public function test_roles_es_solo_del_superadmin_aunque_tenga_el_permiso(): void
    {
        $role = Role::where('slug', 'administrador')->first();
        $role->permissions = array_merge($role->permissions, ['roles.view', 'admins.view']);
        $role->save();
        $this->actingAsVendedor();

        $this->getJson('/api/roles')->assertForbidden();
        $this->postJson('/api/roles', ['name' => 'Hacker', 'permissions' => []])->assertForbidden();
    }

    // ---------- Usuarios: solo clientes sin ser SuperAdmin ----------

    public function test_con_users_view_el_listado_solo_trae_clientes(): void
    {
        $this->actingAsVendedor();

        $roles = collect($this->getJson('/api/users?limit=100')->assertOk()->json('data'))
            ->pluck('roleId')->unique()->values()->all();

        $this->assertSame([2], $roles);
    }

    public function test_sin_ser_superadmin_no_se_puede_crear_staff_ni_cambiar_roles(): void
    {
        $this->actingAsVendedor();
        $cliente = $this->userByEmail('cliente@vexa.com');
        $admin = $this->userByEmail('admin@vexa.com');

        $this->postJson('/api/users', ['email' => 'x@vexa.test', 'password' => 'secret12', 'name' => 'Equis', 'roleId' => 1])
            ->assertForbidden();
        $this->putJson("/api/users/{$cliente->id}", ['roleId' => 1])->assertForbidden();
        $this->assertSame(2, (int) $cliente->fresh()->roleId);

        // Cuentas de staff: no se ven ni se editan.
        $this->getJson("/api/users/{$admin->id}")->assertNotFound();
        $this->putJson("/api/users/{$admin->id}", ['name' => 'Equis'])->assertNotFound();
        $this->deleteJson('/api/users/'.$this->userByEmail('pos@vexa.com')->id)->assertNotFound();
    }

    public function test_con_users_view_si_se_gestionan_clientes(): void
    {
        $this->actingAsVendedor();
        $cliente = $this->userByEmail('cliente@vexa.com');

        $this->postJson('/api/users', ['email' => 'nuevo@vexa.test', 'password' => 'secret12', 'name' => 'Nuevo', 'roleId' => 2])
            ->assertCreated();
        $this->putJson("/api/users/{$cliente->id}", ['status' => 'INACTIVE'])->assertOk();
        $this->assertSame('INACTIVE', $cliente->fresh()->status);
    }

    public function test_el_superadmin_si_gestiona_staff(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/users', ['email' => 'staff@vexa.test', 'password' => 'secret12', 'name' => 'Staff', 'roleId' => 3])
            ->assertCreated();
        $this->assertSame(3, (int) User::where('email', 'staff@vexa.test')->value('roleId'));
    }

    // ---------- Ajustes por tipo ----------

    public function test_ajustes_por_tipo_segun_permiso(): void
    {
        $role = Role::where('slug', 'administrador')->first();
        $role->permissions = array_merge($role->permissions, ['settings.appearance']);
        $role->save();
        $this->actingAsVendedor();

        $this->getJson('/api/settings/appearance/config')->assertOk();
        $this->getJson('/api/settings/payments/config')->assertForbidden();
        $this->getJson('/api/settings')->assertForbidden(); // genérico: solo SuperAdmin
    }

    public function test_los_permisos_viejos_no_se_pueden_asignar(): void
    {
        $this->actingAsAdmin();

        $base = ['description' => 'Rol de prueba del test'];
        $this->postJson('/api/roles', $base + ['name' => 'Con roles', 'permissions' => ['roles.view']])->assertStatus(422);
        $this->postJson('/api/roles', $base + ['name' => 'Marketing', 'permissions' => ['discounts.view', 'announcements.view']])->assertCreated();
    }
}
