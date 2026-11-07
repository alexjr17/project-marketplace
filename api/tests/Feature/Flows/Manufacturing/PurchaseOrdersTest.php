<?php

namespace Tests\Feature\Flows\Manufacturing;

use App\Models\MfgCollection;
use App\Models\MfgProductionOrder;
use App\Models\MfgPurchaseOrder;
use App\Models\MfgPurchaseOrderItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Manufacturing\Concerns\MfgFixtures;
use Tests\TestCase;

/**
 * Caracterización del pedido de compra del cliente de Fábrica y de la generación de
 * órdenes de producción a partir de él.
 */
class PurchaseOrdersTest extends TestCase
{
    use ActsAsRoles, MfgFixtures, RefreshDatabase;

    private array $refA;

    private array $refB;

    private MfgCollection $collection;

    protected function setUp(): void
    {
        parent::setUp();
        $this->registerMysqlShims();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
        $this->seedMfgCatalog();
        $this->refA = $this->createReference(['name' => 'Ref A']);
        $this->refB = $this->createReference(['name' => 'Ref B']);
        $this->collection = MfgCollection::create(['name' => '2026-I', 'year' => 2026, 'semester' => 'I']);
    }

    private function payload(array $overrides = []): array
    {
        $c = $this->mfg;

        return array_merge([
            'clientId' => $c['cliente']->id,
            'collectionId' => $this->collection->id,
            'semester' => 'II', // se ignora: manda la colección
            'market' => 'EXPORT',
            'deliveryDate' => '2026-06-30',
            'partialDates' => ['2026-03-01', '', null],
            'notes' => 'Pedido de prueba',
            'references' => [
                ['referenceId' => $this->refA['id'], 'items' => [
                    ['colorId' => $c['blanco']->id, 'sizeId' => $c['s']->id, 'quantity' => 10],
                    ['colorId' => $c['blanco']->id, 'sizeId' => $c['m']->id, 'quantity' => 0],
                    ['colorId' => $c['negro']->id, 'sizeId' => $c['s']->id, 'quantity' => 4],
                ]],
                ['referenceId' => $this->refB['id'], 'items' => [
                    ['colorId' => $c['blanco']->id, 'sizeId' => $c['m']->id, 'quantity' => 3],
                ]],
            ],
        ], $overrides);
    }

    private function createPo(array $overrides = []): array
    {
        return $this->postJson('/api/manufacturing/purchase-orders', $this->payload($overrides))->assertCreated()->json('data');
    }

    public function test_crea_el_pedido_con_consecutivo_semestre_de_la_coleccion_y_solo_celdas_positivas(): void
    {
        $year = now()->year;
        $this->getJson('/api/manufacturing/purchase-orders/generate-number')->assertOk()
            ->assertExactJson(['success' => true, 'data' => ['code' => "PED-{$year}-0001"]]);

        $res = $this->postJson('/api/manufacturing/purchase-orders', $this->payload())->assertCreated()
            ->assertJsonPath('message', 'Pedido creado');
        $po = $res->json('data');

        $this->assertSame("PED-{$year}-0001", $po['code']);
        $this->assertSame('DRAFT', $po['status']);
        $this->assertSame('EXPORT', $po['market']);
        $this->assertSame('I', $po['semester']);
        $this->assertSame(['2026-03-01'], $po['partialDates']);
        $this->assertSame($this->userByEmail('admin@vexa.com')->id, $po['createdBy']);
        $this->assertCount(3, $po['items']); // la celda en 0 no se guarda
        $this->assertSame([], $po['productionOrders']);
        $res->assertJsonStructure(['data' => [
            'client' => ['id', 'name', 'businessName', 'city', 'phone'],
            'collection' => ['id', 'name', 'year', 'semester'],
            'items' => [['id', 'referenceId', 'colorId', 'sizeId', 'quantity', 'productionOrderId',
                'reference' => ['id', 'code', 'name', 'imagePath'], 'color' => ['id', 'name', 'hexCode'], 'size']],
        ]]);

        $this->assertSame("PED-{$year}-0002", $this->createPo(['market' => null, 'collectionId' => null])['code']);
    }

    public function test_sin_coleccion_toma_el_semestre_enviado_y_mercado_nacional(): void
    {
        $po = $this->createPo(['collectionId' => null, 'market' => null, 'partialDates' => []]);

        $this->assertSame('II', $po['semester']);
        $this->assertSame('NATIONAL', $po['market']);
        $this->assertNull($po['partialDates']);
    }

    public function test_validacion_del_pedido(): void
    {
        $this->postJson('/api/manufacturing/purchase-orders', $this->payload(['references' => []]))->assertStatus(422);
        $this->postJson('/api/manufacturing/purchase-orders', $this->payload(['market' => 'LOCAL']))->assertStatus(422);
        $this->postJson('/api/manufacturing/purchase-orders', $this->payload(['partialDates' => ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']]))
            ->assertStatus(422);
        $this->postJson('/api/manufacturing/purchase-orders', $this->payload(['clientId' => 999]))->assertStatus(422)
            ->assertJsonStructure(['errors' => ['clientId']]);
    }

    public function test_editar_reemplaza_el_detalle_y_conserva_el_mercado_si_no_se_envia(): void
    {
        $po = $this->createPo();
        $c = $this->mfg;

        $payload = $this->payload([
            'references' => [['referenceId' => $this->refA['id'], 'items' => [['colorId' => $c['negro']->id, 'sizeId' => $c['m']->id, 'quantity' => 7]]]],
        ]);
        unset($payload['market']);
        $res = $this->putJson("/api/manufacturing/purchase-orders/{$po['id']}", $payload)->assertOk()
            ->assertJsonPath('message', 'Pedido actualizado')
            ->assertJsonPath('data.market', 'EXPORT')
            ->assertJsonPath('data.code', $po['code'])
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.quantity', 7);
        // El estado no se toca en el PUT.
        $res->assertJsonPath('data.status', 'DRAFT');
    }

    public function test_cambio_de_estado(): void
    {
        $po = $this->createPo();
        $this->patchJson("/api/manufacturing/purchase-orders/{$po['id']}/status", ['status' => 'APPROVED'])->assertOk()
            ->assertJsonPath('message', 'Estado actualizado')->assertJsonPath('data.status', 'APPROVED');
        $this->patchJson("/api/manufacturing/purchase-orders/{$po['id']}/status", ['status' => 'OTRO'])->assertStatus(422);
        // Sin máquina de estados: se puede volver de APPROVED a DRAFT.
        $this->patchJson("/api/manufacturing/purchase-orders/{$po['id']}/status", ['status' => 'DRAFT'])->assertOk()
            ->assertJsonPath('data.status', 'DRAFT');
    }

    public function test_generar_produccion_crea_una_orden_por_referencia_y_hereda_el_mercado(): void
    {
        $year = now()->year;
        $po = $this->createPo();

        $res = $this->postJson("/api/manufacturing/purchase-orders/{$po['id']}/generate-production")->assertOk()
            ->assertJsonPath('message', 'Se generaron 2 orden(es) de producción')
            ->assertJsonPath('data.created', 2)
            ->assertJsonPath('data.purchaseOrder.status', 'IN_PRODUCTION')
            ->assertJsonCount(2, 'data.purchaseOrder.productionOrders')
            ->assertJsonStructure(['data' => ['purchaseOrder' => ['productionOrders' => [['id', 'code', 'referenceId', 'purchaseOrderId', 'status', 'reference']]]]]);

        $orders = MfgProductionOrder::with(['items', 'stages'])->orderBy('id')->get();
        $this->assertCount(2, $orders);
        [$opA, $opB] = $orders;

        $this->assertSame(["OP-{$year}-0001", "OP-{$year}-0002"], [$opA->code, $opB->code]);
        $this->assertSame($this->refA['id'], $opA->referenceId);
        foreach ($orders as $op) {
            $this->assertSame('EXPORT', $op->market);
            $this->assertSame($this->collection->id, $op->collectionId);
            $this->assertSame('I', $op->semester);
            $this->assertSame('PROGRAMMED', $op->status);
            $this->assertSame($po['id'], $op->purchaseOrderId);
            $this->assertSame("Generada desde pedido {$po['code']}", $op->notes);
            $this->assertCount(3, $op->stages);
        }
        $this->assertSame(14, (int) $opA->items->sum('quantity'));
        $this->assertSame(3, (int) $opB->items->sum('quantity'));

        // Cada celda del pedido queda marcada con su orden de producción.
        $this->assertSame(0, MfgPurchaseOrderItem::whereNull('productionOrderId')->count());
        $this->assertSame(2, MfgPurchaseOrderItem::where('productionOrderId', $opA->id)->count());

        // Segunda vez: no hay nada pendiente.
        $this->postJson("/api/manufacturing/purchase-orders/{$po['id']}/generate-production")->assertStatus(422)
            ->assertExactJson(['success' => false, 'message' => 'No hay referencias pendientes por producir en este pedido.']);

        // Con producción generada no se edita ni se elimina.
        $this->putJson("/api/manufacturing/purchase-orders/{$po['id']}", $this->payload())->assertStatus(422)
            ->assertJsonPath('message', 'El pedido ya tiene producción generada; no se puede editar.');
        $this->deleteJson("/api/manufacturing/purchase-orders/{$po['id']}")->assertStatus(422)
            ->assertJsonPath('message', 'No se puede eliminar: el pedido tiene producción generada.');
    }

    public function test_generar_produccion_solo_de_algunas_referencias(): void
    {
        $po = $this->createPo(['market' => 'NATIONAL']);

        $this->postJson("/api/manufacturing/purchase-orders/{$po['id']}/generate-production", ['referenceIds' => [(string) $this->refB['id']]])
            ->assertOk()->assertJsonPath('data.created', 1);
        $this->assertSame([$this->refB['id']], MfgProductionOrder::pluck('referenceId')->all());
        $this->assertSame('NATIONAL', MfgProductionOrder::first()->market);

        $this->postJson("/api/manufacturing/purchase-orders/{$po['id']}/generate-production")->assertOk()->assertJsonPath('data.created', 1);
        $this->assertSame(2, MfgProductionOrder::count());
    }

    public function test_generar_produccion_de_un_pedido_cancelado(): void
    {
        $po = $this->createPo();
        $this->patchJson("/api/manufacturing/purchase-orders/{$po['id']}/status", ['status' => 'CANCELLED'])->assertOk();

        // Corregido (fase 3): un pedido anulado no genera producción ni cambia de estado.
        $this->postJson("/api/manufacturing/purchase-orders/{$po['id']}/generate-production")->assertStatus(422)
            ->assertJsonPath('message', 'El pedido está anulado; no se puede generar producción.');
        $this->assertSame('CANCELLED', MfgPurchaseOrder::find($po['id'])->status);
        $this->assertSame(0, MfgProductionOrder::count());
        // ACTUAL (ambiguo, sin cambiar): un pedido en BORRADOR sí genera producción.
    }

    public function test_un_pedido_entregado_conserva_su_estado_al_generar(): void
    {
        $po = $this->createPo();
        $this->patchJson("/api/manufacturing/purchase-orders/{$po['id']}/status", ['status' => 'DELIVERED'])->assertOk();

        $this->postJson("/api/manufacturing/purchase-orders/{$po['id']}/generate-production")->assertOk()
            ->assertJsonPath('data.purchaseOrder.status', 'DELIVERED');
    }

    public function test_listado_filtros_y_eliminacion(): void
    {
        $po = $this->createPo();
        $this->createPo();
        $this->patchJson("/api/manufacturing/purchase-orders/{$po['id']}/status", ['status' => 'APPROVED']);

        $this->getJson('/api/manufacturing/purchase-orders')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'code', 'status', 'items_count', 'client' => ['id', 'name', 'businessName'], 'collection']]]);
        $this->getJson('/api/manufacturing/purchase-orders?status=APPROVED')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.items_count', 3);
        $this->getJson('/api/manufacturing/purchase-orders?search=0002')->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/manufacturing/purchase-orders/{$po['id']}")->assertOk()
            ->assertExactJson(['success' => true, 'message' => 'Pedido eliminado']);
        $this->getJson("/api/manufacturing/purchase-orders/{$po['id']}")->assertNotFound()
            ->assertJsonPath('message', 'Pedido no encontrado');
    }
}
