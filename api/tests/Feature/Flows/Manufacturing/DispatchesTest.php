<?php

namespace Tests\Feature\Flows\Manufacturing;

use App\Models\MfgDispatch;
use App\Models\MfgLot;
use App\Models\MfgLotItem;
use App\Models\MfgProductMovement;
use App\Models\MfgPurchaseOrder;
use App\Models\MfgWarehouse;
use App\Models\MfgWarehouseStock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Manufacturing\Concerns\MfgFixtures;
use Tests\TestCase;

/**
 * Caracterización de los despachos de producto terminado: borrador → confirmar (FIFO de
 * lotes + bodega + kardex + estado del pedido) → anular (devuelve el stock).
 */
class DispatchesTest extends TestCase
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

    private function line(string $color, string $size, int $qty): array
    {
        return ['referenceId' => $this->ref['id'], 'colorId' => $this->mfg[$color]->id, 'sizeId' => $this->mfg[$size]->id, 'quantity' => $qty];
    }

    private function createDispatch(array $items, array $extra = []): array
    {
        return $this->postJson('/api/manufacturing/dispatches', array_merge([
            'clientId' => $this->mfg['cliente']->id, 'items' => $items,
        ], $extra))->assertCreated()->json('data');
    }

    private function stockOf(string $color, string $size): int
    {
        return (int) MfgWarehouseStock::where([
            'referenceId' => $this->ref['id'], 'colorId' => $this->mfg[$color]->id, 'sizeId' => $this->mfg[$size]->id,
        ])->sum('quantity');
    }

    /** Dos lotes: L1 (Blanco S 10, Blanco M 5, Negro S 4) y L2 (Blanco S 6). */
    private function twoLots(): array
    {
        $this->finishOrder($this->createProductionOrder($this->ref['id'])['id']);
        $this->finishOrder(
            $this->createProductionOrder($this->ref['id'])['id'],
            [['colorId' => $this->mfg['blanco']->id, 'sizeId' => $this->mfg['s']->id, 'quantity' => 6]]
        );

        return MfgLot::orderBy('id')->get()->all();
    }

    public function test_crear_despacho_en_borrador(): void
    {
        $year = now()->year;
        $this->getJson('/api/manufacturing/dispatches/generate-number')->assertOk()
            ->assertExactJson(['success' => true, 'data' => ['code' => "DES-{$year}-0001"]]);

        $res = $this->postJson('/api/manufacturing/dispatches', [
            'clientId' => $this->mfg['cliente']->id, 'warehouseId' => $this->mfg['bodega']->id,
            'items' => [$this->line('blanco', 's', 3), $this->line('negro', 's', 0)],
        ])->assertCreated()->assertJsonPath('message', 'Despacho creado');
        $d = $res->json('data');

        $this->assertSame(["DES-{$year}-0001", 'DRAFT', 'VENTA'], [$d['code'], $d['status'], $d['type']]);
        // El modelo recién creado no se recarga: las columnas no enviadas no salen en el JSON.
        $this->assertArrayNotHasKey('dispatchedAt', $d);
        $this->assertCount(1, $d['items']); // la línea en 0 no se guarda
        $res->assertJsonStructure(['data' => [
            'client' => ['id', 'name', 'city'], 'purchaseOrder', 'warehouse' => ['id', 'name'],
            'items' => [['id', 'dispatchId', 'referenceId', 'colorId', 'sizeId', 'quantity', 'reference' => ['id', 'code', 'name', 'imagePath'], 'color', 'size']],
        ]]);

        $this->postJson('/api/manufacturing/dispatches', ['items' => [$this->line('blanco', 's', 1)], 'type' => 'REGALO'])->assertStatus(422);
        $this->postJson('/api/manufacturing/dispatches', ['items' => []])->assertStatus(422);
        // El borrador no toca el stock.
        $this->assertSame(0, MfgProductMovement::where('type', 'SALIDA')->count());
    }

    public function test_existencias_disponibles_por_celda(): void
    {
        $this->twoLots();

        $rows = collect($this->getJson('/api/manufacturing/dispatches/available')->assertOk()->json('data'));
        $this->assertCount(3, $rows);
        $blancoS = $rows->first(fn ($r) => $r['colorId'] === $this->mfg['blanco']->id && $r['sizeId'] === $this->mfg['s']->id);
        $this->assertEquals(16, $blancoS['available']); // suma de los dos lotes
        $this->assertSame(
            ['referenceId', 'refCode', 'refName', 'imagePath', 'colorId', 'colorName', 'colorHex', 'sizeId', 'sizeAbbr', 'sizeSort', 'available'],
            array_keys($blancoS)
        );

        $otra = MfgWarehouse::create(['name' => 'Otra']);
        $this->getJson("/api/manufacturing/dispatches/available?warehouseId={$otra->id}")->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_confirmar_descuenta_por_fifo_bodega_y_kardex(): void
    {
        [$l1, $l2] = $this->twoLots();
        $d = $this->createDispatch([$this->line('blanco', 's', 13), $this->line('negro', 's', 4)]);

        $res = $this->postJson("/api/manufacturing/dispatches/{$d['id']}/confirm")->assertOk()
            ->assertJsonPath('message', 'Despacho confirmado')
            ->assertJsonPath('data.status', 'CONFIRMED');
        $this->assertNotNull($res->json('data.dispatchedAt'));

        // FIFO: el lote más antiguo se agota primero.
        $avail = fn ($lot, $color) => (int) MfgLotItem::where('lotId', $lot->id)->where('colorId', $this->mfg[$color]->id)
            ->where('sizeId', $this->mfg['s']->id)->value('quantityAvailable');
        $this->assertSame([0, 3, 0], [$avail($l1, 'blanco'), $avail($l2, 'blanco'), $avail($l1, 'negro')]);
        // ACTUAL: el lote agotado sigue en estado AVAILABLE (no se marca DEPLETED).
        $this->assertSame('AVAILABLE', $l1->fresh()->status);

        $this->assertSame(3, $this->stockOf('blanco', 's'));
        $this->assertSame(0, $this->stockOf('negro', 's'));
        $this->assertSame(5, $this->stockOf('blanco', 'm'));

        $out = MfgProductMovement::where('type', 'SALIDA')->orderBy('id')->get();
        $this->assertSame([10, 3, 4], $out->pluck('quantity')->all());
        $this->assertSame([$l1->id, $l2->id, $l1->id], $out->pluck('lotId')->all());
        $this->assertSame(['DISPATCH'], $out->pluck('sourceType')->unique()->values()->all());
        $this->assertSame("Despacho {$d['code']}", $out[0]->notes);
        $this->assertSame($this->userByEmail('admin@vexa.com')->id, $out[0]->createdBy);

        // Ya confirmado: no se confirma, edita ni elimina.
        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/confirm")->assertStatus(422)
            ->assertJsonPath('message', 'El despacho ya fue confirmado o anulado.');
        $this->putJson("/api/manufacturing/dispatches/{$d['id']}", ['items' => [$this->line('blanco', 's', 1)]])->assertStatus(422)
            ->assertJsonPath('message', 'Solo se puede editar un despacho en borrador.');
        $this->deleteJson("/api/manufacturing/dispatches/{$d['id']}")->assertStatus(422)
            ->assertJsonPath('message', 'No se puede eliminar un despacho confirmado; anúlalo primero.');
    }

    public function test_stock_insuficiente_no_descuenta_nada(): void
    {
        $this->twoLots();
        $d = $this->createDispatch([$this->line('blanco', 's', 5), $this->line('negro', 's', 9)]);

        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/confirm")->assertStatus(422)
            ->assertExactJson(['success' => false, 'message' => 'Stock insuficiente para despachar (faltan 5 und de una referencia/color/talla).']);

        $this->assertSame('DRAFT', MfgDispatch::find($d['id'])->status);
        $this->assertSame(16, $this->stockOf('blanco', 's'));
        $this->assertSame(0, MfgProductMovement::where('type', 'SALIDA')->count());
    }

    public function test_la_bodega_del_despacho_filtra_los_lotes(): void
    {
        $this->twoLots();
        $otra = MfgWarehouse::create(['name' => 'Otra']);
        $d = $this->createDispatch([$this->line('blanco', 's', 1)], ['warehouseId' => $otra->id]);

        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/confirm")->assertStatus(422);
    }

    public function test_despacho_sin_lineas_validas_no_se_confirma(): void
    {
        $d = $this->createDispatch([$this->line('blanco', 's', 0)]);
        $this->assertSame([], $d['items']);

        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/confirm")->assertStatus(422)
            ->assertJsonPath('message', 'El despacho no tiene líneas.');
    }

    public function test_anular_un_confirmado_devuelve_el_stock(): void
    {
        [$l1] = $this->twoLots();
        $d = $this->createDispatch([$this->line('blanco', 's', 13)]);
        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/confirm")->assertOk();

        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/cancel")->assertOk()
            ->assertJsonPath('message', 'Despacho anulado')->assertJsonPath('data.status', 'CANCELLED');

        $this->assertSame(16, $this->stockOf('blanco', 's'));
        $this->assertSame(10, (int) MfgLotItem::where('lotId', $l1->id)->where('colorId', $this->mfg['blanco']->id)
            ->where('sizeId', $this->mfg['s']->id)->value('quantityAvailable'));
        // Contramovimientos de entrada, uno por cada salida.
        $back = MfgProductMovement::where('sourceType', 'DISPATCH')->where('type', 'ENTRADA')->orderBy('id')->get();
        $this->assertSame([10, 3], $back->pluck('quantity')->all());
        $this->assertSame("Anulación despacho {$d['code']}", $back[0]->notes);

        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/cancel")->assertStatus(422)
            ->assertJsonPath('message', 'El despacho ya está anulado.');
        $this->patchJson("/api/manufacturing/dispatches/{$d['id']}/billing", ['invoiceNumber' => 'F-1'])->assertStatus(422)
            ->assertJsonPath('message', 'El despacho está anulado.');
        // Anulado sí se puede eliminar.
        $this->deleteJson("/api/manufacturing/dispatches/{$d['id']}")->assertOk()->assertJsonPath('message', 'Despacho eliminado');
    }

    public function test_facturacion_despues_de_confirmar(): void
    {
        $this->twoLots();
        $d = $this->createDispatch([$this->line('blanco', 's', 1)]);
        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/confirm")->assertOk();

        $this->patchJson("/api/manufacturing/dispatches/{$d['id']}/billing", [
            'shipmentNumber' => 'REM-9', 'invoiceNumber' => 'FV-100', 'invoicedAt' => '2026-04-01',
        ])->assertOk()->assertJsonPath('message', 'Facturación actualizada')
            ->assertJsonPath('data.invoiceNumber', 'FV-100')
            ->assertJsonPath('data.shipmentNumber', 'REM-9')
            ->assertJsonPath('data.status', 'CONFIRMED');
    }

    public function test_ciclo_completo_pedido_produccion_despacho(): void
    {
        $c = $this->mfg;
        $po = $this->postJson('/api/manufacturing/purchase-orders', [
            'clientId' => $c['cliente']->id, 'market' => 'EXPORT',
            'references' => [['referenceId' => $this->ref['id'], 'items' => [
                ['colorId' => $c['blanco']->id, 'sizeId' => $c['s']->id, 'quantity' => 10],
                ['colorId' => $c['negro']->id, 'sizeId' => $c['s']->id, 'quantity' => 4],
            ]]],
        ])->assertCreated()->json('data');
        $this->patchJson("/api/manufacturing/purchase-orders/{$po['id']}/status", ['status' => 'APPROVED'])->assertOk();
        $this->postJson("/api/manufacturing/purchase-orders/{$po['id']}/generate-production")->assertOk();

        $opId = MfgPurchaseOrder::find($po['id'])->productionOrders()->value('id');
        $this->getJson("/api/manufacturing/production-orders/{$opId}")->assertJsonPath('data.market', 'EXPORT');
        $this->finishOrder($opId, [
            ['colorId' => $c['blanco']->id, 'sizeId' => $c['s']->id, 'quantity' => 10],
            ['colorId' => $c['negro']->id, 'sizeId' => $c['s']->id, 'quantity' => 4],
        ]);

        // Despacho parcial: el pedido sigue en producción.
        $d1 = $this->createDispatch([$this->line('blanco', 's', 10)], ['purchaseOrderId' => $po['id']]);
        $this->postJson("/api/manufacturing/dispatches/{$d1['id']}/confirm")->assertOk()
            ->assertJsonPath('data.purchaseOrder.code', $po['code']);
        $this->assertSame('IN_PRODUCTION', MfgPurchaseOrder::find($po['id'])->status);

        $pending = $this->getJson("/api/manufacturing/dispatches/po/{$po['id']}/pending")->assertOk()->json('data');
        $this->assertSame(['id' => $po['id'], 'code' => $po['code'], 'clientId' => $c['cliente']->id], $pending['purchaseOrder']);
        $this->assertSame([[10, 10, 0], [4, 0, 4]], array_map(fn ($i) => [$i['ordered'], $i['dispatched'], $i['pending']], $pending['items']));

        // Despacho del resto: el pedido queda ENTREGADO.
        $d2 = $this->createDispatch([$this->line('negro', 's', 4)], ['purchaseOrderId' => $po['id']]);
        $this->postJson("/api/manufacturing/dispatches/{$d2['id']}/confirm")->assertOk();
        $this->assertSame('DELIVERED', MfgPurchaseOrder::find($po['id'])->status);

        // Con despachos, la última etapa de la orden ya no se puede reabrir.
        $last = collect($this->stagesOf($opId))->last();
        $this->patchJson("/api/manufacturing/production-orders/{$opId}/stages/{$last['id']}", ['status' => 'PENDING'])->assertStatus(422)
            ->assertJsonPath('message', 'No se puede reabrir: el producto de esta orden ya tiene despachos. Anula los despachos primero.');

        // Anular el segundo despacho: el pedido vuelve a producción.
        $this->postJson("/api/manufacturing/dispatches/{$d2['id']}/cancel")->assertOk();
        $this->assertSame('IN_PRODUCTION', MfgPurchaseOrder::find($po['id'])->status);
        $this->assertSame(4, $this->stockOf('negro', 's'));
    }

    public function test_anular_un_borrador_no_cambia_el_estado_del_pedido(): void
    {
        $c = $this->mfg;
        $po = MfgPurchaseOrder::create(['code' => 'PED-X-1', 'clientId' => $c['cliente']->id, 'status' => 'APPROVED']);
        $po->items()->create(['referenceId' => $this->ref['id'], 'colorId' => $c['blanco']->id, 'sizeId' => $c['s']->id, 'quantity' => 5]);
        $d = $this->createDispatch([$this->line('blanco', 's', 1)], ['purchaseOrderId' => $po->id]);

        $this->postJson("/api/manufacturing/dispatches/{$d['id']}/cancel")->assertOk();

        // Corregido (fase 3): el borrador no movió stock ni entregas; el pedido sigue APPROVED.
        $this->assertSame('APPROVED', $po->fresh()->status);
    }

    public function test_editar_listar_y_eliminar_borradores(): void
    {
        $d = $this->createDispatch([$this->line('blanco', 's', 2)], ['type' => 'MUESTRA']);

        $this->putJson("/api/manufacturing/dispatches/{$d['id']}", ['items' => [$this->line('negro', 's', 3), $this->line('blanco', 'm', 1)]])
            ->assertOk()->assertJsonPath('message', 'Despacho actualizado')
            ->assertJsonPath('data.type', 'VENTA') // sin type en el PUT vuelve a VENTA
            ->assertJsonPath('data.clientId', null) // sin clientId en el PUT se borra
            ->assertJsonCount(2, 'data.items');

        $this->createDispatch([$this->line('blanco', 's', 1)]);
        $this->getJson('/api/manufacturing/dispatches')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'code', 'status', 'items_count', 'client', 'purchaseOrder']]]);
        $this->getJson('/api/manufacturing/dispatches?status=CONFIRMED')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/manufacturing/dispatches?search=0002')->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/manufacturing/dispatches/{$d['id']}")->assertOk()
            ->assertExactJson(['success' => true, 'message' => 'Despacho eliminado']);
        $this->getJson("/api/manufacturing/dispatches/{$d['id']}")->assertNotFound()->assertJsonPath('message', 'Despacho no encontrado');
        $this->getJson('/api/manufacturing/dispatches/po/999/pending')->assertNotFound();
    }
}
