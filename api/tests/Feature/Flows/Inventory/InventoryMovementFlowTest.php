<?php

namespace Tests\Feature\Flows\Inventory;

use App\Models\VariantMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Caracterización: movimientos de stock de variantes de producto
 * (InventoryMovementController).
 */
class InventoryMovementFlowTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
    }

    public function test_entradas_y_salidas_mueven_el_stock_de_la_variante(): void
    {
        $product = $this->makeProduct(['stock' => 0]);
        $variant = $this->makeProductVariant($product, 10);

        $res = $this->postJson('/api/inventory/movements', [
            'variantId' => $variant->id, 'movementType' => 'PURCHASE', 'quantity' => 5,
            'reason' => 'Compra', 'unitCost' => 900,
        ]);
        $res->assertStatus(201)->assertJsonPath('message', 'Movimiento registrado correctamente')
            ->assertJsonPath('data.previousStock', 10)
            ->assertJsonPath('data.newStock', 15)
            ->assertJsonStructure(['data' => [
                'id', 'variantId', 'movementType', 'quantity', 'previousStock', 'newStock', 'reason', 'notes',
                'userId', 'referenceType', 'referenceId', 'unitCost', 'createdAt',
                'variant' => ['product', 'color', 'size'],
            ]]);
        $this->assertSame(15, (int) $variant->fresh()->stock);

        foreach (['TRANSFER_IN' => 17, 'RETURN' => 19, 'INITIAL' => 21] as $type => $expected) {
            $this->postJson('/api/inventory/movements', ['variantId' => $variant->id, 'movementType' => $type, 'quantity' => 2])
                ->assertStatus(201);
            $this->assertSame($expected, (int) $variant->fresh()->stock, $type);
        }
        foreach (['SALE' => 19, 'TRANSFER_OUT' => 17, 'DAMAGE' => 15] as $type => $expected) {
            $this->postJson('/api/inventory/movements', ['variantId' => $variant->id, 'movementType' => $type, 'quantity' => 2])
                ->assertStatus(201);
            $this->assertSame($expected, (int) $variant->fresh()->stock, $type);
        }

        // Corregido: products.stock se recalcula con las variantes activas tras cada movimiento.
        $this->assertSame(15, (int) $product->fresh()->stock);
        // La cantidad del movimiento queda con signo (+ entra, - sale), como en POS y pedidos.
        $this->assertSame([5, 2, 2, 2, -2, -2, -2], VariantMovement::orderBy('id')->pluck('quantity')->map(fn ($q) => (int) $q)->all());
    }

    public function test_salida_mayor_al_stock_responde_400_sin_movimiento(): void
    {
        $variant = $this->makeProductVariant($this->makeProduct(), 3);

        $this->postJson('/api/inventory/movements', ['variantId' => $variant->id, 'movementType' => 'SALE', 'quantity' => 4])
            ->assertStatus(400)->assertJsonPath('message', 'Stock insuficiente. Stock actual: 3');
        $this->assertSame(3, (int) $variant->fresh()->stock);
        $this->assertSame(0, VariantMovement::count());
    }

    public function test_ajuste_suma_con_signo_y_guarda_la_cantidad_con_signo(): void
    {
        $variant = $this->makeProductVariant($this->makeProduct(), 10);

        $this->postJson('/api/inventory/movements', ['variantId' => $variant->id, 'movementType' => 'ADJUSTMENT', 'quantity' => -4])
            ->assertStatus(201)->assertJsonPath('data.quantity', -4)->assertJsonPath('data.newStock', 6);
        $this->postJson('/api/inventory/movements', ['variantId' => $variant->id, 'movementType' => 'ADJUSTMENT', 'quantity' => -7])
            ->assertStatus(400)->assertJsonPath('message', 'El ajuste resultaría en stock negativo');

        // Corregido: fuera de ADJUSTMENT la dirección la da el tipo; una cantidad negativa
        // responde 422 (antes una SALE con -2 SUMABA 2).
        $this->postJson('/api/inventory/movements', ['variantId' => $variant->id, 'movementType' => 'SALE', 'quantity' => -2])
            ->assertStatus(422)->assertJsonValidationErrors(['quantity']);
        $this->assertSame(6, (int) $variant->fresh()->stock);
    }

    public function test_validaciones_del_movimiento(): void
    {
        $this->postJson('/api/inventory/movements', [])->assertStatus(422)
            ->assertJsonValidationErrors(['variantId', 'movementType', 'quantity']);
        $this->postJson('/api/inventory/movements', ['variantId' => 1, 'movementType' => 'OTRO', 'quantity' => 1])
            ->assertStatus(422)->assertJsonValidationErrors(['movementType']);
        $this->postJson('/api/inventory/movements', ['variantId' => 9999, 'movementType' => 'SALE', 'quantity' => 1])
            ->assertStatus(400)->assertJsonPath('message', 'Variante no encontrada');
    }

    public function test_ajuste_masivo_reporta_resultado_por_item(): void
    {
        $product = $this->makeProduct();
        $a = $this->makeProductVariant($product, 10);
        $b = $this->makeProductVariant($product, 5);

        $res = $this->postJson('/api/inventory/bulk-adjustment', ['items' => [
            ['variantId' => $a->id, 'newStock' => 12],
            ['variantId' => $b->id, 'newStock' => 5],
            ['variantId' => 9999, 'newStock' => 1],
        ]]);

        $res->assertOk()->assertJsonPath('message', 'Ajuste masivo completado')
            ->assertJsonPath('data.0.success', true)
            ->assertJsonPath('data.0.movement.quantity', 2)
            ->assertJsonPath('data.0.movement.movementType', 'ADJUSTMENT')
            ->assertJsonPath('data.0.movement.reason', 'Ajuste masivo de inventario')
            ->assertJsonPath('data.1', ['variantId' => $b->id, 'message' => 'Sin cambios'])
            ->assertJsonPath('data.2', ['variantId' => 9999, 'error' => 'Variante no encontrada']);
        $this->assertSame(12, (int) $a->fresh()->stock);
        $this->assertSame(1, VariantMovement::count());
    }

    public function test_consultas_movimientos_resumen_y_estadisticas(): void
    {
        $product = $this->makeProduct();
        $v = $this->makeProductVariant($product, 0, ['minStock' => 5]);
        $this->makeProductVariant($product, 0);
        $this->postJson('/api/inventory/movements', ['variantId' => $v->id, 'movementType' => 'PURCHASE', 'quantity' => 3])->assertStatus(201);
        $this->postJson('/api/inventory/movements', ['variantId' => $v->id, 'movementType' => 'SALE', 'quantity' => 1])->assertStatus(201);

        $this->getJson('/api/inventory/movements')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'movementType', 'variant' => ['id', 'sku', 'product', 'color', 'size']]]]);
        $this->getJson('/api/inventory/movements?movementType=SALE')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/inventory/movements/variant/{$v->id}")->assertOk()->assertJsonCount(2, 'data');

        $summary = collect($this->getJson('/api/inventory/summary')->assertOk()->json('data'))->keyBy('movementType');
        $this->assertSame(['movementType' => 'PURCHASE', '_count' => 1, '_sum' => ['quantity' => 3]], $summary['PURCHASE']);
        $this->assertSame(['movementType' => 'SALE', '_count' => 1, '_sum' => ['quantity' => 1]], $summary['SALE']);

        $this->getJson('/api/inventory/stats')->assertOk()->assertJsonPath('data', [
            'totalVariants' => 2, 'lowStock' => 1, 'outOfStock' => 1, 'totalStock' => 2, 'todayMovements' => 2,
        ]);
        // low-stock: stock <= minStock (incluye la variante en 0 con minStock 0).
        $this->getJson('/api/inventory/low-stock')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_el_cliente_no_entra_a_movimientos(): void
    {
        $this->actingAsCliente();
        $this->getJson('/api/inventory/movements')->assertStatus(403);
    }
}
