<?php

namespace Tests\Feature\Flows\Purchasing;

use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariantMovement;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnItem;
use App\Models\VariantMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Caracterización: devoluciones de compra (PurchaseReturnController).
 * Se procesan al crearlas: revierten stock y registran movimientos.
 */
class PurchaseReturnFlowTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
    }

    /** @var array<int, array> ítems enviados por OC, para ubicar cada línea por su referencia */
    private array $sentItems = [];

    /** Crea una OC, la confirma y recibe las cantidades indicadas (por índice del ítem enviado). */
    private function receivedOrder(array $items, array $receive): int
    {
        $supplier = $this->makeSupplier('PROV-'.uniqid());
        $id = $this->postJson('/api/purchase-orders', ['supplierId' => $supplier->id, 'items' => $items])->assertStatus(201)->json('data.id');
        $this->sentItems[$id] = $items;
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'SENT'])->assertOk();
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'CONFIRMED'])->assertOk();
        $ids = $this->poItemIds($id);
        $rows = [];
        foreach ($receive as $i => $qty) {
            $rows[] = ['itemId' => $ids[$i], 'quantityReceived' => $qty];
        }
        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => $rows])->assertOk();

        return $id;
    }

    /**
     * Ids de los ítems de la OC en el orden en que se enviaron, buscados por su referencia.
     */
    private function poItemIds(int $orderId): array
    {
        $saved = PurchaseOrderItem::where('purchaseOrderId', $orderId)->orderBy('id')->get();

        return collect($this->sentItems[$orderId])->map(function ($sent) use ($saved) {
            foreach (['variantId', 'inputId', 'inputVariantId'] as $key) {
                if (isset($sent[$key])) {
                    return $saved->first(fn ($i) => (int) $i->{$key} === (int) $sent[$key])->id;
                }
            }

            return null;
        })->all();
    }

    public function test_devolucion_de_los_tres_tipos_de_item_revierte_stock_y_registra_movimientos(): void
    {
        $admin = $this->userByEmail('admin@vexa.com');
        $year = date('Y');
        $input = $this->makeInput(['name' => 'Bolsa']);
        ['input' => $vInput, 'variant' => $iv] = $this->makeVariantInput(0, 5000);
        $product = $this->makeProduct(['name' => 'Gorra']);
        $pv = $this->makeProductVariant($product, 0, ['sku' => 'GOR-1']);

        $orderId = $this->receivedOrder([
            ['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 100],
            ['inputVariantId' => $iv->id, 'quantity' => 6, 'unitCost' => 5000],
            ['variantId' => $pv->id, 'quantity' => 4, 'unitCost' => 9000],
        ], [10, 6, 4]);
        [$itInput, $itIv, $itPv] = $this->poItemIds($orderId);
        $supplierId = PurchaseOrder::find($orderId)->supplierId;

        $res = $this->postJson('/api/purchase-returns', [
            'purchaseOrderId' => $orderId,
            'reason' => 'Defectuoso',
            'notes' => 'n',
            'items' => [
                ['purchaseOrderItemId' => $itInput, 'quantity' => 3],
                ['purchaseOrderItemId' => $itIv, 'quantity' => 2],
                ['purchaseOrderItemId' => $itPv, 'quantity' => 1],
            ],
        ]);

        $res->assertStatus(201)->assertJsonPath('message', 'Devolución registrada y stock revertido')
            ->assertJsonStructure(['data' => [
                'id', 'returnNumber', 'purchaseOrderId', 'supplierId', 'reason', 'notes', 'total',
                'createdById', 'createdByName', 'createdAt',
                'supplier' => ['id', 'name', 'code'],
                'purchaseOrder' => ['id', 'orderNumber', 'status'],
                'items' => [['id', 'purchaseOrderItemId', 'variantId', 'inputId', 'inputVariantId', 'description', 'quantity', 'unitCost', 'subtotal']],
            ]])
            ->assertJsonPath('data.returnNumber', "DEV-{$year}-0001")
            ->assertJsonPath('data.supplierId', $supplierId)
            ->assertJsonPath('data.createdById', $admin->id)
            ->assertJsonPath('data.createdByName', $admin->name)
            // 3×100 + 2×5000 + 1×9000
            ->assertJsonPath('data.total', 19300);
        $returnId = $res->json('data.id');
        $this->assertSame(
            ['Bolsa', "Camiseta base {$iv->sku}", 'Gorra GOR-1'],
            PurchaseReturnItem::orderBy('id')->pluck('description')->all()
        );

        // Insumo simple: stock y lote bajan 3; movimiento DEVOLUCION negativo.
        $this->assertEquals(7, $input->fresh()->currentStock);
        $mi = InputBatchMovement::where('movementType', 'DEVOLUCION')->sole();
        $this->assertEquals(-3, $mi->quantity);
        $this->assertSame('purchase_return', $mi->referenceType);
        $this->assertEquals($returnId, $mi->referenceId);
        $this->assertSame("Devolución DEV-{$year}-0001", $mi->reason);
        $this->assertEquals(7, InputBatch::where('inputId', $input->id)->value('currentQuantity'));

        // Variante de insumo: baja 2 y el total del insumo se recalcula.
        $this->assertEquals(4, $iv->fresh()->currentStock);
        $this->assertEquals(4, $vInput->fresh()->currentStock);
        $mv = InputVariantMovement::where('movementType', 'DEVOLUCION')->sole();
        $this->assertEquals(-2, $mv->quantity);
        $this->assertEquals(6, $mv->previousStock);
        $this->assertEquals(4, $mv->newStock);

        // Variante de producto: baja 1, movimiento ADJUSTMENT negativo.
        $this->assertSame(3, (int) $pv->fresh()->stock);
        $mp = VariantMovement::where('referenceType', 'purchase_return')->sole();
        $this->assertSame('ADJUSTMENT', $mp->movementType);
        $this->assertEquals(-1, $mp->quantity);
        $this->assertEquals(4, $mp->previousStock);
        $this->assertEquals(3, $mp->newStock);

        // ACTUAL: la devolución no cambia el estado de la orden ni quantityReceived.
        $this->assertSame('RECEIVED', PurchaseOrder::find($orderId)->status);
        $this->assertEquals(10, PurchaseOrderItem::find($itInput)->quantityReceived);

        $this->getJson("/api/purchase-returns/{$returnId}")->assertOk()->assertJsonPath('data.id', $returnId);
        $this->getJson('/api/purchase-returns/9999')->assertStatus(404)->assertJsonPath('message', 'Devolución no encontrada');
    }

    public function test_devoluciones_sucesivas_se_limitan_por_lo_ya_devuelto(): void
    {
        $input = $this->makeInput();
        $orderId = $this->receivedOrder([['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 100]], [10]);
        [$it] = $this->poItemIds($orderId);

        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $orderId, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => $it, 'quantity' => 6]]])
            ->assertStatus(201);
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $orderId, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => $it, 'quantity' => 5]]])
            ->assertStatus(400)->assertJsonPath('message', 'No se puede devolver más de 4 del ítem '.$input->name);
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $orderId, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => $it, 'quantity' => 4]]])
            ->assertStatus(201)->assertJsonPath('data.returnNumber', 'DEV-'.date('Y').'-0002');

        $this->assertEquals(0, $input->fresh()->currentStock);
        $this->assertSame(2, PurchaseReturn::count());

        $this->getJson("/api/purchase-returns/returnable/{$orderId}")->assertOk()->assertJsonCount(0, 'data.items');
    }

    public function test_misma_linea_repetida_en_una_peticion_supera_lo_recibido(): void
    {
        $input = $this->makeInput();
        $orderId = $this->receivedOrder([['inputId' => $input->id, 'quantity' => 5, 'unitCost' => 100]], [5]);
        [$it] = $this->poItemIds($orderId);

        // Corregido (fase 3): las filas del mismo ítem se suman antes de validar. Antes 4 + 4
        // pasaba aunque solo se recibieron 5 y el stock se recortaba a 0.
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $orderId, 'reason' => 'r', 'items' => [
            ['purchaseOrderItemId' => $it, 'quantity' => 4],
            ['purchaseOrderItemId' => $it, 'quantity' => 4],
        ]])->assertStatus(400)->assertJsonPath('message', 'No se puede devolver más de 5 del ítem '.$input->name);
        $this->assertSame(0, PurchaseReturn::count());
        $this->assertEquals(5, $input->fresh()->currentStock);

        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $orderId, 'reason' => 'r', 'items' => [
            ['purchaseOrderItemId' => $it, 'quantity' => 2],
            ['purchaseOrderItemId' => $it, 'quantity' => 3],
        ]])->assertStatus(201)->assertJsonPath('data.total', 500);
        $this->assertEquals(0, $input->fresh()->currentStock);
    }

    public function test_no_se_devuelve_mercancia_ya_consumida(): void
    {
        ['variant' => $iv] = $this->makeVariantInput(0);
        $orderId = $this->receivedOrder([['inputVariantId' => $iv->id, 'quantity' => 5, 'unitCost' => 100]], [5]);
        [$it] = $this->poItemIds($orderId);
        $iv->update(['currentStock' => 1]); // se consumieron 4

        // Corregido (fase 3): antes se registraba la devolución de 5 (cobrando 500) pero el stock
        // solo bajaba 1. Ahora se rechaza y no se registra nada.
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $orderId, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => $it, 'quantity' => 5]]])
            ->assertStatus(400)->assertJsonPath('message', "Stock insuficiente para {$iv->sku}. Disponible: 1, Solicitado: 5");
        $this->assertSame(0, PurchaseReturn::count());
        $this->assertEquals(1, $iv->fresh()->currentStock);
        $this->assertSame(0, InputVariantMovement::where('movementType', 'DEVOLUCION')->count());

        // Lo que sí queda se puede devolver.
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $orderId, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => $it, 'quantity' => 1]]])
            ->assertStatus(201)->assertJsonPath('data.total', 100);
        $this->assertEquals(0, $iv->fresh()->currentStock);
    }

    public function test_devolucion_desde_orden_parcial_y_estado_invalido(): void
    {
        $input = $this->makeInput();
        $partial = $this->receivedOrder([['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 100]], [4]);
        [$it] = $this->poItemIds($partial);
        $this->assertSame('PARTIAL', PurchaseOrder::find($partial)->status);

        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $partial, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => $it, 'quantity' => 5]]])
            ->assertStatus(400)->assertJsonPath('message', 'No se puede devolver más de 4 del ítem '.$input->name);
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $partial, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => $it, 'quantity' => 4]]])
            ->assertStatus(201);
        $this->assertSame('PARTIAL', PurchaseOrder::find($partial)->status);

        // OC en borrador → 400.
        $s = $this->makeSupplier('PROV-DRAFT');
        $draft = $this->postJson('/api/purchase-orders', ['supplierId' => $s->id, 'items' => [['inputId' => $input->id, 'quantity' => 1, 'unitCost' => 1]]])->json('data.id');
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $draft, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => 1, 'quantity' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'Solo se puede devolver mercancía de órdenes recibidas');
        $this->getJson("/api/purchase-returns/returnable/{$draft}")->assertStatus(400);

        // Ítem de otra orden → 400.
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $partial, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => 99999, 'quantity' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'El ítem 99999 no pertenece a la orden');
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => 9999, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => 1, 'quantity' => 1]]])
            ->assertStatus(404);
    }

    public function test_validaciones(): void
    {
        $this->postJson('/api/purchase-returns', [])->assertStatus(422)
            ->assertJsonValidationErrors(['purchaseOrderId', 'reason', 'items']);
        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => 1, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => 1, 'quantity' => 0]]])
            ->assertStatus(422)->assertJsonValidationErrors(['items.0.quantity']);
    }

    public function test_items_devolubles_listado_numero_y_estadisticas(): void
    {
        $input = $this->makeInput(['name' => 'Cinta', 'code' => 'CIN']);
        $orderId = $this->receivedOrder([['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 100]], [10]);
        [$it] = $this->poItemIds($orderId);

        $this->getJson('/api/purchase-returns/generate-number')->assertOk()->assertJsonPath('data.returnNumber', 'DEV-'.date('Y').'-0001');
        $this->getJson("/api/purchase-returns/returnable/{$orderId}")->assertOk()
            ->assertJsonStructure(['data' => [
                'purchaseOrder' => ['id', 'orderNumber', 'status', 'supplier'],
                'items' => [['purchaseOrderItemId', 'variantId', 'inputId', 'inputVariantId', 'description', 'groupName',
                    'colorName', 'sizeName', 'unitCost', 'quantityReceived', 'quantityReturned', 'returnable']],
            ]])
            ->assertJsonPath('data.items.0.returnable', 10)
            ->assertJsonPath('data.items.0.groupName', 'Cinta');

        $this->postJson('/api/purchase-returns', ['purchaseOrderId' => $orderId, 'reason' => 'r', 'items' => [['purchaseOrderItemId' => $it, 'quantity' => 2]]])->assertStatus(201);
        $this->getJson("/api/purchase-returns/returnable/{$orderId}")->assertOk()
            ->assertJsonPath('data.items.0.quantityReturned', 2)->assertJsonPath('data.items.0.returnable', 8);

        $this->getJson('/api/purchase-returns')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/purchase-returns?purchaseOrderId={$orderId}")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/purchase-returns?purchaseOrderId=9999')->assertOk()->assertJsonCount(0, 'data');
        $stats = $this->getJson('/api/purchase-returns/stats')->assertOk()->json('data');
        $this->assertSame(1, $stats['total']);
        $this->assertEquals(200, $stats['totalValue']);
        $this->assertNotNull($stats['lastReturn']);
        $this->getJson('/api/purchase-returns/returnable/9999')->assertStatus(404);
    }

    public function test_el_cliente_no_entra_a_devoluciones(): void
    {
        $this->actingAsCliente();
        $this->getJson('/api/purchase-returns')->assertStatus(403);
    }
}
