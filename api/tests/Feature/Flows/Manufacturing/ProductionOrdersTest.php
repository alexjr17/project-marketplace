<?php

namespace Tests\Feature\Flows\Manufacturing;

use App\Models\MfgCollection;
use App\Models\MfgInput;
use App\Models\MfgLot;
use App\Models\MfgProcess;
use App\Models\MfgProductionOrder;
use App\Models\MfgProductMovement;
use App\Models\MfgStageConsumption;
use App\Models\MfgWarehouse;
use App\Models\MfgWarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Manufacturing\Concerns\MfgFixtures;
use Tests\TestCase;

/**
 * Caracterización de la orden de producción: etapas (omitir / en proceso / completar),
 * consumo de materiales, sustituciones y la entrada a bodega (lote + stock + kardex).
 */
class ProductionOrdersTest extends TestCase
{
    use ActsAsRoles, MfgFixtures, RefreshDatabase;

    private array $ref;

    protected function setUp(): void
    {
        parent::setUp();
        $this->registerMysqlShims();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
        $this->seedMfgCatalog();
        $this->ref = $this->createReference();
    }

    private function stageUrl(int $orderId, int $stageId): string
    {
        return "/api/manufacturing/production-orders/{$orderId}/stages/{$stageId}";
    }

    /** Consumos de una etapa como [inputCode-colorName => [expected, real, unitValue]]. */
    private function consumptionsOf(int $stageId): array
    {
        return MfgStageConsumption::with(['input', 'color'])->where('stageId', $stageId)->get()
            ->mapWithKeys(fn ($c) => [$c->input->code.'-'.($c->color?->name ?? '∅') => [$c->expectedQty, $c->realQty, $c->unitValue]])
            ->all();
    }

    public function test_crear_orden_genera_etapas_desde_los_procesos_activos(): void
    {
        $year = now()->year;
        MfgProcess::create(['name' => 'Inactivo', 'sequence' => 9, 'isActive' => false]);
        $col = MfgCollection::create(['name' => '2026-II', 'year' => 2026, 'semester' => 'II']);

        $this->getJson('/api/manufacturing/production-orders/generate-number')->assertOk()
            ->assertExactJson(['success' => true, 'data' => ['code' => "OP-{$year}-0001"]]);

        $res = $this->postJson('/api/manufacturing/production-orders', [
            'referenceId' => $this->ref['id'], 'collectionId' => $col->id, 'semester' => 'I', 'internalCode' => 'INT-9',
            'items' => $this->standardMatrix(),
        ])->assertCreated()->assertJsonPath('message', 'Orden de producción creada');
        $op = $res->json('data');

        $this->assertSame("OP-{$year}-0001", $op['code']);
        $this->assertSame('PROGRAMMED', $op['status']);
        $this->assertSame('NATIONAL', $op['market']);
        $this->assertSame('II', $op['semester']); // de la colección, no el enviado
        $this->assertSame('INT-9', $op['internalCode']);
        $this->assertCount(3, $op['items']);
        $this->assertSame(['Corte', 'Confección', 'Empaque'], array_column(array_column($op['stages'], 'process'), 'name'));
        $this->assertSame([1, 2, 3], array_column($op['stages'], 'sequence'));
        $this->assertSame(['PENDING', 'PENDING', 'PENDING'], array_column($op['stages'], 'status'));
        $res->assertJsonStructure(['data' => [
            'reference' => ['id', 'code', 'name', 'garmentType', 'components', 'materials'],
            'items' => [['id', 'colorId', 'sizeId', 'quantity', 'quantityDone', 'color', 'size']],
            'stages' => [['id', 'processId', 'workshopId', 'sequence', 'status', 'quantityDone', 'process', 'cells', 'consumptions', 'stageComponents']],
            'lots', 'substitutions',
        ]]);

        $this->assertSame("OP-{$year}-0002", $this->createProductionOrder($this->ref['id'])['code']);
    }

    public function test_un_proceso_con_secuencia_cero_toma_su_posicion(): void
    {
        MfgProcess::where('code', 'EMP')->update(['sequence' => 0]);

        $op = $this->createProductionOrder($this->ref['id']);
        // Orden por sequence: EMP(0) queda primero y toma la secuencia 1 (su índice + 1),
        // igual que Corte (1).
        // ACTUAL (posible bug): dos etapas con la misma secuencia (1); isLastStage() usa max(sequence).
        $this->assertSame([1, 1, 2], collect($op['stages'])->pluck('sequence')->sort()->values()->all());
    }

    public function test_validacion_de_la_orden(): void
    {
        $this->postJson('/api/manufacturing/production-orders', ['referenceId' => $this->ref['id'], 'items' => []])->assertStatus(422);
        $this->postJson('/api/manufacturing/production-orders', [
            'referenceId' => $this->ref['id'],
            'items' => [['colorId' => $this->mfg['blanco']->id, 'sizeId' => $this->mfg['s']->id, 'quantity' => 0]],
        ])->assertStatus(422);
        $this->postJson('/api/manufacturing/production-orders', $this->payloadWith(['market' => 'X']))->assertStatus(422);
    }

    private function payloadWith(array $o): array
    {
        return array_merge(['referenceId' => $this->ref['id'], 'items' => $this->standardMatrix()], $o);
    }

    public function test_show_adjunta_la_matriz_programada_en_cascada(): void
    {
        $op = $this->createProductionOrder($this->ref['id']);
        $stages = $this->stagesOf($op['id']);
        foreach ($stages as $st) {
            $this->assertTrue($st['canStart']);
            $this->assertSame(19, array_sum(array_column($st['programmed'], 'quantity')));
        }

        // Etapa 1 cierra con 12 → la 2 y la 3 se programan con 12.
        $this->patchJson($this->stageUrl($op['id'], $stages[0]['id']), [
            'status' => 'COMPLETED',
            'cells' => [['colorId' => $this->mfg['blanco']->id, 'sizeId' => $this->mfg['s']->id, 'quantity' => 12]],
        ])->assertOk();
        // Etapa 2 se omite sin matriz → arrastra la programada (12).
        $this->patchJson($this->stageUrl($op['id'], $stages[1]['id']), ['status' => 'SKIPPED'])->assertOk();

        $stages = $this->stagesOf($op['id']);
        $this->assertSame(19, array_sum(array_column($stages[0]['programmed'], 'quantity')));
        $this->assertSame([['colorId' => $this->mfg['blanco']->id, 'sizeId' => $this->mfg['s']->id, 'quantity' => 12]], $stages[1]['programmed']);
        $this->assertSame([['colorId' => $this->mfg['blanco']->id, 'sizeId' => $this->mfg['s']->id, 'quantity' => 12]], $stages[2]['programmed']);
    }

    public function test_avance_de_etapas_y_estado_de_la_orden(): void
    {
        $op = $this->createProductionOrder($this->ref['id']);
        [$corte, $confeccion, $empaque] = $this->stagesOf($op['id']);

        // En proceso: la orden pasa a IN_PROCESS y registra quién inició.
        $res = $this->patchJson($this->stageUrl($op['id'], $corte['id']), ['status' => 'IN_PROCESS', 'assignee' => 'Ana', 'notes' => 'ok'])
            ->assertOk()->assertJsonPath('message', 'Etapa actualizada')->assertJsonPath('data.status', 'IN_PROCESS');
        $this->assertNotNull($res->json('data.startedAt'));
        $st = collect($res->json('data.stages'))->firstWhere('id', $corte['id']);
        $this->assertSame(['IN_PROCESS', 'Ana', 'Administrador', null], [$st['status'], $st['assignee'], $st['startedByName'], $st['finishedAt']]);

        // Omitir no exige matriz ni crea consumo.
        $res = $this->patchJson($this->stageUrl($op['id'], $confeccion['id']), ['status' => 'SKIPPED'])->assertOk();
        $st = collect($res->json('data.stages'))->firstWhere('id', $confeccion['id']);
        $this->assertSame('SKIPPED', $st['status']);
        $this->assertSame('Administrador', $st['finishedByName']);
        $this->assertSame([], $this->consumptionsOf($confeccion['id']));

        // Volver a PENDING limpia el cierre.
        $res = $this->patchJson($this->stageUrl($op['id'], $confeccion['id']), ['status' => 'PENDING'])->assertOk();
        $st = collect($res->json('data.stages'))->firstWhere('id', $confeccion['id']);
        $this->assertSame([null, null], [$st['finishedAt'], $st['finishedByName']]);
        $this->assertNotNull($st['startedAt']); // el inicio se conserva

        // Todas en PENDING → la orden vuelve a PROGRAMMED.
        $this->patchJson($this->stageUrl($op['id'], $corte['id']), ['status' => 'PENDING'])->assertOk()
            ->assertJsonPath('data.status', 'PROGRAMMED');

        $this->patchJson($this->stageUrl($op['id'], $empaque['id']), ['status' => 'DONE'])->assertStatus(422);
        $other = $this->createProductionOrder($this->ref['id']);
        $this->patchJson($this->stageUrl($other['id'], $corte['id']), ['status' => 'IN_PROCESS'])->assertNotFound()
            ->assertJsonPath('message', 'Etapa no encontrada');
        $this->patchJson($this->stageUrl(999, $corte['id']), ['status' => 'IN_PROCESS'])->assertNotFound()
            ->assertJsonPath('message', 'Orden no encontrada');
    }

    public function test_consumo_de_materiales_por_etapa(): void
    {
        $op = $this->createProductionOrder($this->ref['id']);
        [$corte, $confeccion] = $this->stagesOf($op['id']);
        $c = $this->mfg;

        // Corte consume el tipo Telas (por color): 1.5 m × producido de cada color.
        $res = $this->patchJson($this->stageUrl($op['id'], $corte['id']), ['status' => 'COMPLETED', 'cells' => [
            ['colorId' => $c['blanco']->id, 'sizeId' => $c['s']->id, 'quantity' => 10],
            ['colorId' => $c['blanco']->id, 'sizeId' => $c['m']->id, 'quantity' => 5],
            ['colorId' => $c['negro']->id, 'sizeId' => $c['s']->id, 'quantity' => 4],
            ['colorId' => $c['negro']->id, 'sizeId' => $c['m']->id, 'quantity' => 0], // no se guarda
        ]])->assertOk();
        $st = collect($res->json('data.stages'))->firstWhere('id', $corte['id']);
        $this->assertSame(19, $st['quantityDone']);
        $this->assertCount(3, $st['cells']);
        $this->assertSame([
            'TEL-01-Blanco' => ['22.5000', '22.5000', '4000.0000'],
            'TEL-01-Negro' => ['6.0000', '6.0000', '4000.0000'],
        ], $this->consumptionsOf($corte['id']));

        // Confección consume el insumo HIL-01 (sin color): 0.1 × total producido. Real del operario.
        $this->patchJson($this->stageUrl($op['id'], $confeccion['id']), [
            'cells' => [['colorId' => $c['blanco']->id, 'sizeId' => $c['s']->id, 'quantity' => 8]],
        ])->assertOk();
        $this->assertSame(['HIL-01-∅' => ['0.8000', '0.8000', '500.0000']], $this->consumptionsOf($confeccion['id']));

        $this->patchJson($this->stageUrl($op['id'], $confeccion['id']), [
            'consumptions' => [['inputId' => $c['hilo']->id, 'realQty' => 1.23456]],
        ])->assertOk();
        $this->assertSame(['HIL-01-∅' => ['0.8000', '1.2346', '500.0000']], $this->consumptionsOf($confeccion['id']));

        // Cambiar la matriz recalcula el esperado y conserva el real registrado.
        $this->patchJson($this->stageUrl($op['id'], $confeccion['id']), [
            'cells' => [['colorId' => $c['blanco']->id, 'sizeId' => $c['s']->id, 'quantity' => 20]],
        ])->assertOk();
        $this->assertSame(['HIL-01-∅' => ['2.0000', '1.2346', '500.0000']], $this->consumptionsOf($confeccion['id']));
    }

    public function test_materiales_de_la_orden_y_sustituciones(): void
    {
        $op = $this->createProductionOrder($this->ref['id']);
        $c = $this->mfg;
        $tela2 = MfgInput::create(['code' => 'TEL-02', 'name' => 'Tela premium', 'inputTypeId' => $c['telas']->id]);

        $m = $this->getJson("/api/manufacturing/production-orders/{$op['id']}/materials")->assertOk()->json('data');
        $this->assertSame(19, $m['total']);
        $rows = collect($m['materials'])->map(fn ($r) => [$r['input']['code'], $r['color']['name'] ?? null, $r['expected'], $r['substitute']])->all();
        $this->assertSame([
            ['TEL-01', 'Blanco', 22.5, null],
            ['TEL-01', 'Negro', 6, null], // JSON: 6.0 llega como entero
            ['HIL-01', null, 1.9, null],
        ], $rows);

        // Sustitución para el color Negro.
        $sub = $this->postJson("/api/manufacturing/production-orders/{$op['id']}/substitutions", [
            'originalInputId' => $c['tela']->id, 'substituteInputId' => $tela2->id, 'colorId' => $c['negro']->id,
        ])->assertCreated()->assertJsonPath('message', 'Sustitución guardada')
            ->assertJsonPath('data.substituteInput.code', 'TEL-02')->json('data');
        $this->postJson("/api/manufacturing/production-orders/{$op['id']}/substitutions", [
            'originalInputId' => $c['tela']->id, 'substituteInputId' => $c['tela']->id,
        ])->assertStatus(422);

        $m = $this->getJson("/api/manufacturing/production-orders/{$op['id']}/materials")->json('data.materials');
        $this->assertNull($m[0]['substitute']);
        $this->assertSame('TEL-02', $m[1]['substitute']['code']);

        // El consumo de la etapa usa el sustituto en el color Negro.
        $corte = $this->stagesOf($op['id'])[0];
        $this->patchJson($this->stageUrl($op['id'], $corte['id']), ['cells' => $this->standardMatrix()])->assertOk();
        $this->assertSame(['TEL-01-Blanco', 'TEL-02-Negro'], array_keys($this->consumptionsOf($corte['id'])));

        $this->deleteJson("/api/manufacturing/production-orders/{$op['id']}/substitutions/{$sub['id']}")->assertOk()
            ->assertJsonPath('message', 'Sustitución eliminada');
        $this->deleteJson("/api/manufacturing/production-orders/{$op['id']}/substitutions/{$sub['id']}")->assertNotFound();
    }

    public function test_completar_la_ultima_etapa_crea_el_lote_y_entra_a_bodega(): void
    {
        $year = now()->year;
        $op = $this->createProductionOrder($this->ref['id']);

        $data = $this->finishOrder($op['id']);

        $this->assertSame('COMPLETED', $data['status']);
        $this->assertNotNull($data['finishedAt']);
        $this->assertSame($this->mfg['bodega']->id, $data['warehouseId']); // se persiste la bodega elegida
        $this->assertCount(1, $data['lots']);
        $lot = $data['lots'][0];
        $this->assertSame(["L-{$year}-0001", 'AVAILABLE', 'Bodega Principal'], [$lot['code'], $lot['status'], $lot['warehouse']['name']]);
        $this->assertSame([10, 5, 4], array_column($lot['items'], 'quantityProduced'));
        $this->assertSame([10, 5, 4], array_column($lot['items'], 'quantityAvailable'));

        $stock = MfgWarehouseStock::where('referenceId', $this->ref['id'])->orderBy('id')->pluck('quantity')->all();
        $this->assertSame([10, 5, 4], $stock);
        $moves = MfgProductMovement::orderBy('id')->get();
        $this->assertSame(['ENTRADA', 'ENTRADA', 'ENTRADA'], $moves->pluck('type')->all());
        $this->assertSame(['LOT'], $moves->pluck('sourceType')->unique()->values()->all());
        $this->assertSame("Lote L-{$year}-0001", $moves[0]->notes);

        // Inventario de producto terminado.
        $inv = $this->getJson('/api/manufacturing/inventory')->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonStructure(['data' => [['id', 'warehouseId', 'referenceId', 'colorId', 'sizeId', 'quantity',
                'warehouse' => ['id', 'name'], 'reference' => ['id', 'code', 'name'], 'color', 'size']]]);
        $this->assertSame(19, array_sum(array_column($inv->json('data'), 'quantity')));
        $otra = MfgWarehouse::create(['name' => 'Otra']);
        $this->getJson("/api/manufacturing/inventory?warehouseId={$otra->id}")->assertOk()->assertJsonCount(0, 'data');

        // Completar otra vez la última etapa no crea un segundo lote.
        $last = collect($data['stages'])->last();
        $this->patchJson($this->stageUrl($op['id'], $last['id']), ['status' => 'COMPLETED'])->assertOk();
        $this->assertSame(1, MfgLot::count());
    }

    public function test_la_segunda_orden_suma_al_stock_existente(): void
    {
        $year = now()->year;
        $this->finishOrder($this->createProductionOrder($this->ref['id'])['id']);
        $data = $this->finishOrder($this->createProductionOrder($this->ref['id'])['id']);

        $this->assertSame("L-{$year}-0002", $data['lots'][0]['code']);
        $this->assertSame([20, 10, 8], MfgWarehouseStock::orderBy('id')->pluck('quantity')->all());
    }

    public function test_sin_bodega_el_lote_va_a_la_primera_bodega(): void
    {
        $op = $this->createProductionOrder($this->ref['id']);
        $stages = $this->stagesOf($op['id']);
        $last = array_pop($stages);

        $data = $this->patchJson($this->stageUrl($op['id'], $last['id']), ['status' => 'COMPLETED', 'cells' => $this->standardMatrix()])
            ->assertOk()->json('data');

        // Las anteriores quedaron PENDING: el lote se crea igual (la última no depende de ellas)
        // pero la orden queda IN_PROCESS.
        $this->assertSame('IN_PROCESS', $data['status']);
        $this->assertSame($this->mfg['bodega']->id, $data['lots'][0]['warehouseId']);
    }

    public function test_omitir_o_completar_sin_matriz_la_ultima_etapa_no_crea_lote(): void
    {
        $op = $this->createProductionOrder($this->ref['id']);
        $stages = $this->stagesOf($op['id']);
        foreach ($stages as $st) {
            $this->patchJson($this->stageUrl($op['id'], $st['id']), ['status' => 'SKIPPED'])->assertOk();
        }

        // ACTUAL (posible bug): con todas las etapas omitidas la orden queda COMPLETED sin lote
        // ni entrada a bodega.
        $this->assertSame('COMPLETED', MfgProductionOrder::find($op['id'])->status);
        $this->assertSame(0, MfgLot::count());

        $last = end($stages);
        $this->patchJson($this->stageUrl($op['id'], $last['id']), ['status' => 'COMPLETED'])->assertOk();
        $this->assertSame(0, MfgLot::count());
        $this->assertSame(0, MfgWarehouseStock::count());
    }

    public function test_reabrir_la_ultima_etapa_revierte_el_lote_y_el_stock(): void
    {
        $op = $this->createProductionOrder($this->ref['id']);
        $data = $this->finishOrder($op['id']);
        $last = collect($data['stages'])->last();

        $res = $this->patchJson($this->stageUrl($op['id'], $last['id']), ['status' => 'IN_PROCESS'])->assertOk();

        $this->assertSame('IN_PROCESS', $res->json('data.status'));
        $this->assertSame([], $res->json('data.lots'));
        $this->assertSame(0, MfgLot::count());
        $this->assertSame([0, 0, 0], MfgWarehouseStock::orderBy('id')->pluck('quantity')->all()); // filas en 0, no borradas
        $this->assertSame(0, MfgProductMovement::count());
        $this->getJson('/api/manufacturing/inventory')->assertOk()->assertJsonCount(0, 'data');

        // Completar de nuevo vuelve a crear el lote (nuevo consecutivo).
        $res = $this->patchJson($this->stageUrl($op['id'], $last['id']), ['status' => 'COMPLETED'])->assertOk();
        $this->assertCount(1, $res->json('data.lots'));
        $this->assertSame([10, 5, 4], MfgWarehouseStock::orderBy('id')->pluck('quantity')->all());
    }

    public function test_editar_la_orden(): void
    {
        $op = $this->createProductionOrder($this->ref['id'], ['market' => 'EXPORT']);
        $c = $this->mfg;

        $this->putJson("/api/manufacturing/production-orders/{$op['id']}", [
            'market' => null, 'notes' => 'Urgente', 'scheduledAt' => '2026-05-01',
            'items' => [['colorId' => $c['negro']->id, 'sizeId' => $c['m']->id, 'quantity' => 6]],
        ])->assertOk()
            ->assertJsonPath('message', 'Orden actualizada')
            ->assertJsonPath('data.market', 'NATIONAL') // null explícito → Nacional
            ->assertJsonPath('data.notes', 'Urgente')
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.quantity', 6);

        // Cerrada: no se edita la matriz, pero sí las notas.
        $this->patchJson("/api/manufacturing/production-orders/{$op['id']}/status", ['status' => 'COMPLETED'])->assertOk()
            ->assertJsonPath('data.status', 'COMPLETED');
        $this->putJson("/api/manufacturing/production-orders/{$op['id']}", ['items' => $this->standardMatrix()])->assertStatus(422)
            ->assertJsonPath('message', 'No se puede editar la matriz de una orden completed');
        $this->putJson("/api/manufacturing/production-orders/{$op['id']}", ['notes' => 'Cerrada'])->assertOk()
            ->assertJsonPath('data.notes', 'Cerrada');
        // Completar por estado no crea lote.
        $this->assertSame(0, MfgLot::count());
    }

    public function test_una_orden_cancelada_no_cambia_de_estado_por_sus_etapas(): void
    {
        $op = $this->createProductionOrder($this->ref['id']);
        $this->patchJson("/api/manufacturing/production-orders/{$op['id']}/status", ['status' => 'CANCELLED'])->assertOk();
        $corte = $this->stagesOf($op['id'])[0];

        $this->patchJson($this->stageUrl($op['id'], $corte['id']), ['status' => 'IN_PROCESS'])->assertOk()
            ->assertJsonPath('data.status', 'CANCELLED');
        $this->patchJson("/api/manufacturing/production-orders/{$op['id']}/status", ['status' => 'DRAFT'])->assertStatus(422);
    }

    public function test_listado_y_eliminacion(): void
    {
        $a = $this->createProductionOrder($this->ref['id']);
        $this->createProductionOrder($this->ref['id']);
        $this->patchJson("/api/manufacturing/production-orders/{$a['id']}/status", ['status' => 'IN_PROCESS']);

        $this->getJson('/api/manufacturing/production-orders')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'code', 'status', 'items_count', 'reference' => ['id', 'code', 'name'], 'warehouse', 'collection']]]);
        $this->getJson('/api/manufacturing/production-orders?status=IN_PROCESS')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.items_count', 3);
        $this->getJson('/api/manufacturing/production-orders?search=0002')->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/manufacturing/production-orders/{$a['id']}")->assertOk()
            ->assertExactJson(['success' => true, 'message' => 'Orden eliminada']);
        $this->getJson("/api/manufacturing/production-orders/{$a['id']}")->assertNotFound();
    }
}
