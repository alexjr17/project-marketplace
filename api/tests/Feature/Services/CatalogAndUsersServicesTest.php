<?php

namespace Tests\Feature\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\Address;
use App\Models\ProductColor;
use App\Models\ProductType;
use App\Models\ProductTypeSize;
use App\Models\ProductVariant;
use App\Models\Role;
use App\Models\User;
use App\Services\Catalog\CatalogAttributeService;
use App\Services\Catalog\ProductAdminService;
use App\Services\StockService;
use App\Services\Users\AddressService;
use App\Services\Users\RoleService;
use App\Services\Users\UserAdminService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Reglas que la fase 3 (ola 2) sacó de los controladores de catálogo y usuarios a servicios.
 */
class CatalogAndUsersServicesTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
    }

    // ==================== Catálogo ====================

    public function test_color_y_talla_en_uso_no_se_borran(): void
    {
        $this->actingAsAdmin();
        $negro = $this->makeColor('Negro', '#000000');
        $libre = $this->makeColor('Libre', '#123456');
        $m = $this->makeSize('M');
        $product = $this->makeProduct();
        ProductColor::create(['productId' => $product->id, 'colorId' => $negro->id]);
        $this->makeProductVariant($product, 1, ['colorId' => $negro->id, 'sizeId' => $m->id]);

        // Antes: el color se borraba y la cascada se llevaba product_colors (o 500 con variantes).
        $this->deleteJson("/api/catalogs/colors/{$negro->id}")->assertStatus(409)
            ->assertJsonPath('message', 'No se puede eliminar: este color está en uso en productos o insumos. Usa el estado inactivo en su lugar.');
        $this->deleteJson("/api/catalogs/sizes/{$m->id}")->assertStatus(409);
        $this->assertSame(1, ProductColor::where('colorId', $negro->id)->count());

        $this->deleteJson("/api/catalogs/colors/{$libre->id}")->assertOk();
        $this->deleteJson('/api/catalogs/colors/99999')->assertNotFound();
    }

    public function test_asignar_tallas_a_un_tipo_reemplaza_el_set(): void
    {
        $service = app(CatalogAttributeService::class);
        $type = ProductType::create(['name' => 'Camisa', 'slug' => 'camisa', 'isActive' => true]);
        $s = $this->makeSize('S', 1);
        $m = $this->makeSize('M', 2);
        $l = $this->makeSize('L', 3);

        $service->assignSizes($type, [$s->id, $m->id, $m->id]);
        $this->assertSame(['S', 'M'], $service->sizesOf($type->id)->pluck('abbreviation')->all());

        $service->assignSizes($type, [$l->id]);
        $this->assertSame([$l->id], ProductTypeSize::where('productTypeId', $type->id)->pluck('sizeId')->all());
    }

    public function test_crear_producto_genera_sus_variantes_en_la_misma_operacion(): void
    {
        $service = app(ProductAdminService::class);
        $negro = $this->makeColor('Negro', '#000000');
        $m = $this->makeSize('M');
        $l = $this->makeSize('L', 2);

        $product = $service->create([
            'name' => 'Polo', 'description' => 'd', 'basePrice' => 1000,
            'colors' => [['id' => $negro->id]], 'sizes' => [['id' => $m->id], ['id' => $l->id]],
        ]);
        $this->assertSame(2, ProductVariant::where('productId', $product->id)->count());

        $simple = $service->create(['name' => 'Gorra', 'description' => 'd', 'basePrice' => 1000, 'stock' => 7]);
        $this->assertSame([7], ProductVariant::where('productId', $simple->id)->pluck('stock')->map(fn ($v) => (int) $v)->all());

        $this->expectException(BusinessRuleException::class);
        $service->updateStock($simple, 8, 'subtract');
    }

    public function test_sync_product_stock_suma_las_variantes_activas(): void
    {
        $product = $this->makeProduct();
        $this->makeProductVariant($product, 4);
        $this->makeProductVariant($product, 3);
        $this->makeProductVariant($product, 50, ['isActive' => false]);

        app(StockService::class)->syncProductStock($product->id);

        $this->assertSame(7, (int) $product->fresh()->stock);
    }

    // ==================== Usuarios, roles y direcciones ====================

    public function test_el_admin_no_superadmin_solo_gestiona_clientes(): void
    {
        $service = app(UserAdminService::class);
        $vendedor = $this->userByEmail('vendedor@vexa.com');
        $admin = $this->userByEmail('admin@vexa.com');

        $listed = $service->paginate($vendedor, []);
        $this->assertTrue(collect($listed['data'])->every(fn ($u) => (int) $u['roleId'] === 2));

        try {
            $service->findManageable($vendedor, $admin->id);
            $this->fail('Debió responder 404');
        } catch (BusinessRuleException $e) {
            $this->assertSame(404, $e->status);
        }

        try {
            $service->create($vendedor, ['email' => 'nuevo@x.com', 'password' => 'secreto1', 'name' => 'Nuevo', 'roleId' => 1]);
            $this->fail('Debió responder 403');
        } catch (BusinessRuleException $e) {
            $this->assertSame(403, $e->status);
        }

        $cliente = $service->create($vendedor, ['email' => '  NUEVO@X.com ', 'password' => 'secreto1', 'name' => 'Nuevo', 'roleId' => 2]);
        $this->assertSame('nuevo@x.com', $cliente->email);
    }

    public function test_no_se_asigna_un_rol_inactivo_ni_se_borra_uno_con_usuarios(): void
    {
        $service = app(RoleService::class);
        $inactive = $service->create(['name' => 'Temporal', 'description' => 'Rol temporal', 'permissions' => ['orders.view'], 'isActive' => false]);
        $cliente = $this->userByEmail('cliente@vexa.com');

        try {
            $service->assign($cliente->id, $inactive->id);
            $this->fail('Debió responder 403');
        } catch (BusinessRuleException $e) {
            $this->assertSame(403, $e->status);
        }

        $inactive->update(['isActive' => true]);
        $service->assign($cliente->id, $inactive->id);
        try {
            $service->delete($inactive->id);
            $this->fail('Debió responder 409');
        } catch (BusinessRuleException $e) {
            $this->assertSame(409, $e->status);
        }
        $this->assertNotNull(Role::find($inactive->id));
    }

    public function test_una_sola_direccion_predeterminada(): void
    {
        $service = app(AddressService::class);
        $user = $this->userByEmail('cliente@vexa.com');
        $base = ['label' => 'Casa', 'address' => 'Calle 1', 'city' => 'Medellín'];

        $a = $service->create($user, $base + ['isDefault' => true]);
        $b = $service->create($user, $base + ['label' => 'Oficina', 'isDefault' => true]);
        $this->assertFalse((bool) $a->fresh()->isDefault);
        $this->assertTrue((bool) $b->fresh()->isDefault);

        $service->setDefault($user, $a->id);
        $this->assertSame([$a->id], Address::where('userId', $user->id)->where('isDefault', true)->pluck('id')->all());

        $otro = User::where('email', 'admin@vexa.com')->first();
        $this->expectException(BusinessRuleException::class);
        $service->find($otro, $a->id);
    }
}
