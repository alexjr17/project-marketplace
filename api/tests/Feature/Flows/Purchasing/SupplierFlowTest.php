<?php

namespace Tests\Feature\Flows\Purchasing;

use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Caracterización: proveedores (SupplierController).
 */
class SupplierFlowTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
    }

    public function test_crud_completo_de_proveedor(): void
    {
        $res = $this->postJson('/api/suppliers', [
            'code' => 'PROV-010', 'name' => 'Textiles Sur', 'taxId' => '900', 'city' => 'Cali', 'email' => 'a@b.co',
        ]);
        $res->assertStatus(201)->assertJsonPath('message', 'Proveedor creado correctamente')
            ->assertJsonPath('data.country', 'Colombia')
            ->assertJsonPath('data.isActive', true)
            ->assertJsonStructure(['data' => ['id', 'code', 'name', 'taxId', 'city', 'email', 'country', 'isActive', 'createdAt', 'updatedAt']]);
        $id = $res->json('data.id');

        $this->getJson("/api/suppliers/{$id}")->assertOk()
            ->assertJsonPath('data._count', ['purchaseOrders' => 0])
            ->assertJsonPath('data.purchaseOrders', [])
            ->assertJsonStructure(['data' => ['id', 'code', 'name', '_count' => ['purchaseOrders'], 'purchaseOrders']]);

        $this->putJson("/api/suppliers/{$id}", ['name' => 'Textiles Sur SAS', 'isActive' => false])
            ->assertOk()->assertJsonPath('message', 'Proveedor actualizado correctamente')
            ->assertJsonPath('data.name', 'Textiles Sur SAS')->assertJsonPath('data.code', 'PROV-010');

        $this->deleteJson("/api/suppliers/{$id}")->assertOk()->assertJsonPath('message', 'Proveedor eliminado correctamente');
        // Borrado físico.
        $this->assertNull(Supplier::find($id));
        $this->getJson("/api/suppliers/{$id}")->assertStatus(404)->assertJsonPath('message', 'Proveedor no encontrado');
    }

    public function test_validaciones_y_codigo_duplicado(): void
    {
        $this->postJson('/api/suppliers', [])->assertStatus(422)->assertJsonValidationErrors(['code', 'name']);
        $this->makeSupplier('PROV-001');
        $other = $this->makeSupplier('PROV-002', 'Otro');

        $this->postJson('/api/suppliers', ['code' => 'PROV-001', 'name' => 'X'])->assertStatus(400)
            ->assertJsonPath('message', 'Ya existe un proveedor con este código');
        $this->putJson("/api/suppliers/{$other->id}", ['code' => 'PROV-001'])->assertStatus(400)
            ->assertJsonPath('message', 'Ya existe un proveedor con este código');
        // Repetir su propio código sí se permite.
        $this->putJson("/api/suppliers/{$other->id}", ['code' => 'PROV-002'])->assertOk();
        $this->putJson('/api/suppliers/9999', ['name' => 'X'])->assertStatus(404);
    }

    public function test_no_se_borra_proveedor_con_ordenes(): void
    {
        $s = $this->makeSupplier();
        PurchaseOrder::create(['orderNumber' => 'OC-X-1', 'supplierId' => $s->id, 'status' => 'DRAFT', 'subtotal' => 0, 'total' => 0]);

        $this->deleteJson("/api/suppliers/{$s->id}")->assertStatus(400)
            ->assertJsonPath('message', 'No se puede eliminar: el proveedor tiene 1 órdenes de compra asociadas');
        $this->assertNotNull(Supplier::find($s->id));
        $this->deleteJson('/api/suppliers/9999')->assertStatus(404);
    }

    public function test_generar_codigo_consecutivo(): void
    {
        $this->getJson('/api/suppliers/generate-code')->assertOk()->assertJsonPath('data.code', 'PROV-001');
        $this->makeSupplier('PROV-009');
        $this->getJson('/api/suppliers/generate-code')->assertOk()->assertJsonPath('data.code', 'PROV-010');
        // Con el formato de 4 dígitos del seeder (PROV-0001) también sigue el consecutivo numérico.
        $this->makeSupplier('PROV-0001', 'Seeder');
        $this->getJson('/api/suppliers/generate-code')->assertOk()->assertJsonPath('data.code', 'PROV-010');
    }

    public function test_listado_filtros_y_estadisticas(): void
    {
        $a = $this->makeSupplier('PROV-001', 'Alfa');
        $b = $this->makeSupplier('PROV-002', 'Beta');
        $b->update(['isActive' => false, 'city' => 'Bogotá']);
        PurchaseOrder::create(['orderNumber' => 'OC-X-1', 'supplierId' => $a->id, 'status' => 'DRAFT', 'subtotal' => 0, 'total' => 0]);

        $this->getJson('/api/suppliers')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Alfa')
            ->assertJsonPath('data.0._count.purchaseOrders', 1)
            ->assertJsonStructure(['data' => [['id', 'code', 'name', '_count' => ['purchaseOrders']]]]);
        $this->getJson('/api/suppliers?search=Bet')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/suppliers?isActive=false')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $b->id);
        $this->getJson('/api/suppliers?city=Bogotá')->assertOk()->assertJsonCount(1, 'data');

        $this->getJson('/api/suppliers/stats')->assertOk()->assertJsonPath('data', ['total' => 2, 'active' => 1, 'withOrders' => 1]);
    }

    public function test_el_cliente_no_entra_a_proveedores(): void
    {
        $this->actingAsCliente();
        $this->getJson('/api/suppliers')->assertStatus(403);
        $this->postJson('/api/suppliers', ['code' => 'X', 'name' => 'X'])->assertStatus(403);
    }
}
