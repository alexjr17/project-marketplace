<?php

namespace Tests\Feature\Flows\Inventory;

use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InventoryCount;
use App\Models\InventoryCountItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Caracterización: conteo físico de inventario (InventoryCountController).
 * DRAFT → IN_PROGRESS → PENDING_APPROVAL → APPROVED (o CANCELLED).
 */
class InventoryCountFlowTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    private const COUNT_STRUCTURE = [
        'id', 'countNumber', 'countType', 'status', 'countDate', 'countedById', 'countedByName',
        'approvedById', 'approvedByName', 'approvedAt', 'notes', 'totalItems', 'itemsWithDiff',
        'totalDiffValue', 'items' => [[
            'id', 'inputId', 'inputCode', 'inputName', 'unitOfMeasure', 'unitCost', 'systemQuantity',
            'countedQuantity', 'difference', 'differenceValue', 'isCounted', 'notes',
        ]], 'createdAt', 'updatedAt',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
    }

    private function itemFor(int $countId, int $inputId): InventoryCountItem
    {
        return InventoryCountItem::where('inventoryCountId', $countId)->where('inputId', $inputId)->firstOrFail();
    }

    public function test_flujo_completo_crear_iniciar_contar_enviar_aprobar(): void
    {
        $admin = $this->userByEmail('admin@vexa.com');
        $year = date('Y');

        // Insumo A: tiene lote, el conteo encuentra 2 de menos.
        $a = $this->makeInput(['code' => 'A', 'name' => 'Alfa', 'unitCost' => 100, 'currentStock' => 10]);
        $batchA = $this->makeBatch($a, 10, 100, 'LA');
        // Insumo B: sin lotes, el conteo encuentra 5 de más.
        $b = $this->makeInput(['code' => 'B', 'name' => 'Beta', 'unitCost' => 50, 'currentStock' => 0]);
        // Insumo C: sin diferencia.
        $c = $this->makeInput(['code' => 'C', 'name' => 'Gamma', 'unitCost' => 10, 'currentStock' => 7]);
        $this->makeBatch($c, 7, 10, 'LC');
        // Insumo inactivo: no entra al conteo.
        $this->makeInput(['code' => 'Z', 'isActive' => false]);

        $res = $this->postJson('/api/inventory-counts', ['countType' => 'FULL', 'notes' => 'Cierre']);
        $res->assertStatus(201)->assertJsonPath('message', 'Conteo de inventario creado correctamente')
            ->assertJsonStructure(['success', 'message', 'data' => self::COUNT_STRUCTURE])
            ->assertJsonPath('data.countNumber', "INV-{$year}-0001")
            ->assertJsonPath('data.status', 'DRAFT')
            ->assertJsonPath('data.totalItems', 3)
            ->assertJsonPath('data.countedById', $admin->id)
            ->assertJsonPath('data.countedByName', $admin->name);
        $id = $res->json('data.id');
        $this->assertEquals(10, $this->itemFor($id, $a->id)->systemQuantity);

        $this->patchJson("/api/inventory-counts/{$id}/start")->assertOk()->assertJsonPath('data.status', 'IN_PROGRESS');
        $this->patchJson("/api/inventory-counts/{$id}/start")->assertStatus(400)
            ->assertJsonPath('message', 'Solo se pueden iniciar conteos en estado borrador');

        $itemA = $this->itemFor($id, $a->id);
        $this->patchJson("/api/inventory-counts/{$id}/items/{$itemA->id}", ['countedQuantity' => 8, 'notes' => 'faltan'])
            ->assertOk()->assertJsonPath('message', 'Cantidad actualizada correctamente')
            ->assertJsonPath('data.difference', -2)
            ->assertJsonPath('data.differenceValue', -200)
            ->assertJsonPath('data.isCounted', true);

        // Enviar con ítems sin contar falla.
        $this->patchJson("/api/inventory-counts/{$id}/submit")->assertStatus(400)
            ->assertJsonPath('message', 'Hay 2 item(s) sin contar');

        $this->patchJson("/api/inventory-counts/{$id}/items/{$this->itemFor($id, $b->id)->id}", ['countedQuantity' => 5])->assertOk();
        $this->patchJson("/api/inventory-counts/{$id}/items/{$this->itemFor($id, $c->id)->id}", ['countedQuantity' => 7])->assertOk();

        $this->patchJson("/api/inventory-counts/{$id}/submit")->assertOk()
            ->assertJsonPath('data.status', 'PENDING_APPROVAL')
            ->assertJsonPath('data.itemsWithDiff', 2)
            // Suma de valores absolutos: |−200| + |250| = 450.
            ->assertJsonPath('data.totalDiffValue', 450);

        // Ya no se puede contar estando pendiente de aprobación.
        $this->patchJson("/api/inventory-counts/{$id}/items/{$itemA->id}", ['countedQuantity' => 1])->assertStatus(400);

        $this->patchJson("/api/inventory-counts/{$id}/approve")->assertOk()
            ->assertJsonPath('message', 'Conteo aprobado y ajustes aplicados correctamente')
            ->assertJsonPath('data.status', 'APPROVED')
            ->assertJsonPath('data.approvedById', $admin->id)
            ->assertJsonPath('data.approvedByName', $admin->name);
        $this->assertNotNull(InventoryCount::find($id)->approvedAt);

        // A: stock y lote bajan 2; movimiento AJUSTE con cantidad negativa.
        $this->assertEquals(8, $a->fresh()->currentStock);
        $this->assertEquals(8, $batchA->fresh()->currentQuantity);
        $movA = InputBatchMovement::where('inputId', $a->id)->sole();
        $this->assertSame('AJUSTE', $movA->movementType);
        $this->assertEquals(-2, $movA->quantity);
        $this->assertSame('inventory_count', $movA->referenceType);
        $this->assertEquals($id, $movA->referenceId);
        $this->assertSame("Ajuste por conteo físico INV-{$year}-0001", $movA->reason);
        $this->assertSame('faltan', $movA->notes);

        // B: sin lote → se crea un lote AJUSTE-{countNumber} con la cantidad contada.
        $this->assertEquals(5, $b->fresh()->currentStock);
        $batchB = InputBatch::where('inputId', $b->id)->sole();
        $this->assertSame("AJUSTE-INV-{$year}-0001", $batchB->batchNumber);
        $this->assertEquals(5, $batchB->currentQuantity);
        $this->assertEquals(250, $batchB->totalCost);
        $this->assertEquals(5, InputBatchMovement::where('inputId', $b->id)->sole()->quantity);

        // C: sin diferencia, sin movimiento.
        $this->assertSame(0, InputBatchMovement::where('inputId', $c->id)->count());
        $this->assertEquals(7, $c->fresh()->currentStock);
    }

    public function test_doble_aprobacion_responde_400_y_no_vuelve_a_ajustar(): void
    {
        $a = $this->makeInput(['currentStock' => 10, 'unitCost' => 1]);
        $this->makeBatch($a, 10, 1);
        $id = $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->json('data.id');
        $this->patchJson("/api/inventory-counts/{$id}/items/{$this->itemFor($id, $a->id)->id}", ['countedQuantity' => 4])->assertOk();
        $this->patchJson("/api/inventory-counts/{$id}/submit")->assertOk();

        $this->patchJson("/api/inventory-counts/{$id}/approve")->assertOk();
        $this->patchJson("/api/inventory-counts/{$id}/approve")->assertStatus(400)
            ->assertJsonPath('message', 'Solo se pueden aprobar conteos pendientes de aprobación');

        $this->assertEquals(4, $a->fresh()->currentStock);
        $this->assertSame(1, InputBatchMovement::count());
        // No se puede cancelar ni borrar un conteo aprobado.
        $this->patchJson("/api/inventory-counts/{$id}/cancel")->assertStatus(400)
            ->assertJsonPath('message', 'No se pueden cancelar conteos aprobados');
        $this->deleteJson("/api/inventory-counts/{$id}")->assertStatus(400);
    }

    public function test_aprobar_aplica_la_diferencia_sobre_el_stock_actual_no_fija_lo_contado(): void
    {
        $a = $this->makeInput(['currentStock' => 10, 'unitCost' => 1]);
        $batch = $this->makeBatch($a, 10, 1);
        $id = $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->json('data.id');
        $this->patchJson("/api/inventory-counts/{$id}/items/{$this->itemFor($id, $a->id)->id}", ['countedQuantity' => 8])->assertOk();
        $this->patchJson("/api/inventory-counts/{$id}/submit")->assertOk();

        // Entre la creación del conteo y la aprobación entra stock (p. ej. una recepción).
        $a->update(['currentStock' => 30]);
        $batch->update(['currentQuantity' => 30]);

        $this->patchJson("/api/inventory-counts/{$id}/approve")->assertOk();
        // ACTUAL (posible bug): se suma la diferencia calculada contra la foto inicial (−2)
        // al stock vigente, quedando 28 y no 8 (InventoryCountController.php:281,301).
        $this->assertEquals(28, $a->fresh()->currentStock);
        $this->assertEquals(28, $batch->fresh()->currentQuantity);
    }

    public function test_aprobar_no_toca_las_variantes_de_un_insumo_con_variantes(): void
    {
        ['input' => $input, 'variant' => $variant] = $this->makeVariantInput(10);
        $id = $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->json('data.id');
        $this->patchJson("/api/inventory-counts/{$id}/items/{$this->itemFor($id, $input->id)->id}", ['countedQuantity' => 6])->assertOk();
        $this->patchJson("/api/inventory-counts/{$id}/submit")->assertOk();
        $this->patchJson("/api/inventory-counts/{$id}/approve")->assertOk();

        $this->assertEquals(6, $input->fresh()->currentStock);
        // ACTUAL (posible bug): el conteo es por insumo, no por variante; input_variants
        // queda en 10 y desalineado del total del insumo (InventoryCountController.php:274-315).
        $this->assertEquals(10, $variant->fresh()->currentStock);
    }

    public function test_contar_en_borrador_pasa_a_en_progreso_y_conteo_parcial_por_ids(): void
    {
        $a = $this->makeInput(['code' => 'PA']);
        $b = $this->makeInput(['code' => 'PB']);

        $res = $this->postJson('/api/inventory-counts', ['countType' => 'PARTIAL', 'inputIds' => [$b->id]]);
        $res->assertStatus(201)->assertJsonPath('data.totalItems', 1)->assertJsonPath('data.items.0.inputId', $b->id);
        $id = $res->json('data.id');

        $this->patchJson("/api/inventory-counts/{$id}/items/{$this->itemFor($id, $b->id)->id}", ['countedQuantity' => 0])->assertOk();
        $this->assertSame('IN_PROGRESS', InventoryCount::find($id)->status);

        // PARTIAL sin inputIds toma todos los insumos activos.
        $this->postJson('/api/inventory-counts', ['countType' => 'PARTIAL'])->assertStatus(201)->assertJsonPath('data.totalItems', 2);
        $this->patchJson("/api/inventory-counts/{$id}/items/99999", ['countedQuantity' => 1])->assertStatus(404);
    }

    public function test_validaciones_y_sin_insumos(): void
    {
        $this->postJson('/api/inventory-counts', [])->assertStatus(422)->assertJsonValidationErrors(['countType']);
        $this->postJson('/api/inventory-counts', ['countType' => 'OTRO'])->assertStatus(422);
        $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->assertStatus(400)
            ->assertJsonPath('message', 'No hay insumos para contar');

        $this->makeInput();
        $id = $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->json('data.id');
        $this->patchJson("/api/inventory-counts/{$id}/submit")->assertStatus(400)
            ->assertJsonPath('message', 'Solo se pueden enviar a aprobación conteos en progreso');
        $this->patchJson("/api/inventory-counts/{$id}/approve")->assertStatus(400);
        $this->patchJson("/api/inventory-counts/{$id}/items/1", [])->assertStatus(422);
        $this->getJson('/api/inventory-counts/9999')->assertStatus(404);
    }

    public function test_cancelar_borrar_listado_y_estadisticas(): void
    {
        $this->makeInput();
        $id1 = $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->json('data.id');
        $id2 = $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->json('data.id');
        $this->patchJson("/api/inventory-counts/{$id2}/start")->assertOk();

        // En progreso no se puede borrar; se cancela y luego sí.
        $this->deleteJson("/api/inventory-counts/{$id2}")->assertStatus(400)
            ->assertJsonPath('message', 'Solo se pueden eliminar conteos en borrador o cancelados');
        $this->patchJson("/api/inventory-counts/{$id2}/cancel")->assertOk()->assertJsonPath('data.status', 'CANCELLED');

        $this->getJson('/api/inventory-counts')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [self::COUNT_STRUCTURE]]);
        $this->getJson('/api/inventory-counts?status=CANCELLED')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/inventory-counts/stats')->assertOk()->assertJsonPath('data', [
            'total' => 2,
            'byStatus' => ['DRAFT' => 1, 'IN_PROGRESS' => 0, 'PENDING_APPROVAL' => 0, 'APPROVED' => 0, 'CANCELLED' => 1],
            'lastCount' => null,
        ]);

        $this->deleteJson("/api/inventory-counts/{$id2}")->assertOk();
        $this->deleteJson("/api/inventory-counts/{$id1}")->assertOk();
        $this->assertSame(0, InventoryCount::count());
        $this->assertSame(0, InventoryCountItem::count());
    }

    public function test_numeracion_consecutiva_no_se_repite_al_borrar(): void
    {
        $this->makeInput();
        $year = now()->format('Y');
        $id1 = $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->json('data.id');
        $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])->assertJsonPath('data.countNumber', "INV-{$year}-0002");

        $this->deleteJson("/api/inventory-counts/{$id1}")->assertOk();
        // Corregido: antes salía de COUNT()+1 y tras borrar volvía a dar INV-AAAA-0002 (500 por
        // el índice único). Ahora lo entrega NumberSequenceService y nunca repite.
        $this->postJson('/api/inventory-counts', ['countType' => 'FULL'])
            ->assertCreated()->assertJsonPath('data.countNumber', "INV-{$year}-0003");
    }

    public function test_el_cliente_no_entra_a_conteos(): void
    {
        $this->actingAsCliente();
        $this->getJson('/api/inventory-counts')->assertStatus(403);
    }
}
