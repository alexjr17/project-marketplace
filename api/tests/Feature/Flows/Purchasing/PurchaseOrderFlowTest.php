<?php

namespace Tests\Feature\Flows\Purchasing;

use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariantMovement;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\VariantMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Caracterización: órdenes de compra (PurchaseOrderController).
 * DRAFT → SENT → CONFIRMED → PARTIAL → RECEIVED (o CANCELLED).
 */
class PurchaseOrderFlowTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    private const DETAIL_STRUCTURE = [
        'id', 'orderNumber', 'supplierId', 'status', 'subtotal', 'total', 'expectedDate', 'receivedDate',
        'notes', 'createdById', 'createdAt', 'updatedAt',
        'supplier' => ['id', 'code', 'name'],
        'items' => [[
            'id', 'purchaseOrderId', 'variantId', 'inputId', 'inputVariantId', 'description', 'quantity',
            'quantityReceived', 'unitCost', 'subtotal', 'notes', 'variant', 'input', 'inputVariant',
        ]],
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
    }

    private function createOrder(array $items, ?int $supplierId = null)
    {
        $supplierId ??= $this->makeSupplier('PROV-'.uniqid())->id;

        return $this->postJson('/api/purchase-orders', ['supplierId' => $supplierId, 'items' => $items, 'notes' => 'OC test']);
    }

    private function confirm(int $id): void
    {
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'SENT'])->assertOk();
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'CONFIRMED'])->assertOk();
    }

    private function itemId(int $orderId, int $index = 0): int
    {
        return PurchaseOrderItem::where('purchaseOrderId', $orderId)->orderBy('id')->get()[$index]->id;
    }

    public function test_crear_orden_calcula_totales_numera_y_forma_json(): void
    {
        $admin = $this->userByEmail('admin@vexa.com');
        $year = now()->year;
        $input = $this->makeInput();
        $pv = $this->makeProductVariant($this->makeProduct(), 0);

        $res = $this->createOrder([
            ['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 1500],
            ['variantId' => $pv->id, 'quantity' => 2, 'unitCost' => 20000, 'description' => 'Camiseta'],
        ]);

        $res->assertStatus(201)->assertJsonPath('message', 'Orden de compra creada')
            ->assertJsonStructure(['success', 'message', 'data' => self::DETAIL_STRUCTURE])
            ->assertJsonPath('data.orderNumber', "OC-{$year}-0001")
            ->assertJsonPath('data.status', 'DRAFT')
            ->assertJsonPath('data.createdById', $admin->id)
            ->assertJsonCount(2, 'data.items');
        $order = PurchaseOrder::find($res->json('data.id'));
        $this->assertEquals(55000, $order->subtotal);
        $this->assertEquals(55000, $order->total);
        $this->assertEquals(0, $order->tax);
        $this->assertEquals(15000, PurchaseOrderItem::where('inputId', $input->id)->first()->subtotal);

        $this->createOrder([['inputId' => $input->id, 'quantity' => 1, 'unitCost' => 1]])
            ->assertJsonPath('data.orderNumber', "OC-{$year}-0002");
        $this->getJson('/api/purchase-orders/generate-number')->assertOk()->assertJsonPath('data.orderNumber', "OC-{$year}-0003");
    }

    public function test_orden_de_las_lineas_guardadas_sigue_el_orden_de_las_reglas_de_validacion(): void
    {
        $input = $this->makeInput();
        ['variant' => $iv] = $this->makeVariantInput(0);
        $pv = $this->makeProductVariant($this->makeProduct(), 0);

        $id = $this->createOrder([
            ['inputId' => $input->id, 'quantity' => 1, 'unitCost' => 1],
            ['inputVariantId' => $iv->id, 'quantity' => 2, 'unitCost' => 1],
            ['variantId' => $pv->id, 'quantity' => 3, 'unitCost' => 1],
        ])->assertStatus(201)->json('data.id');

        // ACTUAL (posible bug): $request->validate() arma 'items' en el orden en que aparecen las
        // claves según las reglas (variantId, inputId, inputVariantId), así que las líneas se
        // insertan en otro orden que el enviado (PurchaseOrderController.php:280-322).
        $this->assertSame([3, 1, 2], PurchaseOrderItem::where('purchaseOrderId', $id)->orderBy('id')->pluck('quantity')->map(fn ($q) => (int) $q)->all());
    }

    public function test_crear_orden_valida(): void
    {
        $this->postJson('/api/purchase-orders', [])->assertStatus(422)->assertJsonValidationErrors(['supplierId', 'items']);
        $this->postJson('/api/purchase-orders', ['supplierId' => 1, 'items' => []])->assertStatus(422)->assertJsonValidationErrors(['items']);
        $this->postJson('/api/purchase-orders', ['supplierId' => 1, 'items' => [['quantity' => -1]]])->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.quantity', 'items.0.unitCost']);
        // ACTUAL (posible bug): no se valida que el proveedor exista; la FK revienta con 500
        // (PurchaseOrderController.php:281).
        $this->postJson('/api/purchase-orders', ['supplierId' => 9999, 'items' => [['quantity' => 1, 'unitCost' => 1]]])
            ->assertStatus(500);
    }

    public function test_editar_solo_en_borrador_y_reemplaza_items(): void
    {
        $input = $this->makeInput();
        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 100]])->json('data.id');

        $this->putJson("/api/purchase-orders/{$id}", [
            'supplierInvoice' => 'FV-1',
            'items' => [['inputId' => $input->id, 'quantity' => 3, 'unitCost' => 200], ['description' => 'Flete', 'quantity' => 1, 'unitCost' => 50]],
        ])->assertOk()->assertJsonPath('message', 'Orden actualizada')->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.supplierInvoice', 'FV-1');
        $this->assertEquals(650, PurchaseOrder::find($id)->total);

        // Sin items conserva el subtotal.
        $this->putJson("/api/purchase-orders/{$id}", ['notes' => 'otra'])->assertOk();
        $this->assertEquals(650, PurchaseOrder::find($id)->total);

        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'SENT'])->assertOk();
        $this->putJson("/api/purchase-orders/{$id}", ['notes' => 'x'])->assertStatus(400)
            ->assertJsonPath('message', 'Solo se pueden editar órdenes en estado borrador');
    }

    public function test_transiciones_de_estado(): void
    {
        $input = $this->makeInput();
        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 1, 'unitCost' => 1]])->json('data.id');

        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'CONFIRMED'])->assertStatus(400)
            ->assertJsonPath('message', 'No se puede cambiar de DRAFT a CONFIRMED');
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'OTRO'])->assertStatus(422);
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'SENT'])->assertOk()
            ->assertJsonPath('message', 'Estado actualizado')->assertJsonPath('data.status', 'SENT');
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'DRAFT'])->assertStatus(400);
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'CANCELLED'])->assertOk();
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'SENT'])->assertStatus(400)
            ->assertJsonPath('message', 'No se puede cambiar de CANCELLED a SENT');
    }

    public function test_marcar_recibida_por_estado_no_mueve_stock(): void
    {
        $input = $this->makeInput();
        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 1]])->json('data.id');
        $this->confirm($id);

        // ACTUAL (posible bug): el cambio manual a RECEIVED (o PARTIAL) cierra la orden sin
        // ingresar stock ni registrar movimientos (PurchaseOrderController.php:389-409, transición CONFIRMED→RECEIVED).
        $this->patchJson("/api/purchase-orders/{$id}/status", ['status' => 'RECEIVED'])->assertOk();
        $order = PurchaseOrder::find($id);
        $this->assertSame('RECEIVED', $order->status);
        $this->assertNotNull($order->receivedDate);
        $this->assertEquals(0, $input->fresh()->currentStock);
        $this->assertSame(0, InputBatchMovement::count());
        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => $this->itemId($id), 'quantityReceived' => 1]]])
            ->assertStatus(400);
    }

    public function test_recibir_exige_orden_confirmada(): void
    {
        $input = $this->makeInput();
        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 1]])->json('data.id');
        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => $this->itemId($id), 'quantityReceived' => 1]]])
            ->assertStatus(400)->assertJsonPath('message', 'La orden debe estar confirmada para recibir mercancía');
        $this->postJson("/api/purchase-orders/{$id}/receive", [])->assertStatus(422)->assertJsonValidationErrors(['items']);
        $this->postJson('/api/purchase-orders/9999/receive', ['items' => [['itemId' => 1, 'quantityReceived' => 1]]])->assertStatus(404);
    }

    public function test_recepcion_parcial_y_total_de_insumo_simple(): void
    {
        $admin = $this->userByEmail('admin@vexa.com');
        $year = now()->year;
        $input = $this->makeInput(['unitCost' => 1000, 'currentStock' => 0]);
        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 1500]])->json('data.id');
        $this->confirm($id);
        $itemId = $this->itemId($id);

        // Parcial: 4 de 10.
        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => $itemId, 'quantityReceived' => 4]]])
            ->assertOk()->assertJsonPath('message', 'Items recibidos')
            ->assertJsonPath('data.status', 'PARTIAL')
            ->assertJsonPath('data.receivedDate', null)
            ->assertJsonStructure(['data' => self::DETAIL_STRUCTURE]);
        $this->assertEquals(4, PurchaseOrderItem::find($itemId)->quantityReceived);
        $this->assertEquals(4, $input->fresh()->currentStock);

        // Sin lotes previos se crea un lote "OC-{orderNumber}-{itemId}" con el costo de la OC.
        $batch = InputBatch::where('inputId', $input->id)->sole();
        $this->assertSame("OC-OC-{$year}-0001-{$itemId}", $batch->batchNumber);
        $this->assertEquals(4, $batch->currentQuantity);
        $this->assertEquals(4, $batch->initialQuantity);
        $this->assertEquals(1500, $batch->unitCost);
        $this->assertEquals(6000, $batch->totalCost);

        $mov = InputBatchMovement::sole();
        $this->assertSame('ENTRADA', $mov->movementType);
        $this->assertEquals(4, $mov->quantity);
        $this->assertSame('purchase_order', $mov->referenceType);
        $this->assertEquals($id, $mov->referenceId);
        $this->assertSame("Recepción de OC OC-{$year}-0001", $mov->reason);
        $this->assertEquals($admin->id, $mov->userId);

        // Total: los 6 restantes.
        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => $itemId, 'quantityReceived' => 6]]])
            ->assertOk()->assertJsonPath('data.status', 'RECEIVED');
        $this->assertNotNull(PurchaseOrder::find($id)->receivedDate);
        $this->assertEquals(10, $input->fresh()->currentStock);

        // La segunda recepción suma al lote existente (no crea otro) y no toca su costo.
        $batch->refresh();
        $this->assertSame(1, InputBatch::where('inputId', $input->id)->count());
        $this->assertEquals(10, $batch->currentQuantity);
        $this->assertEquals(4, $batch->initialQuantity);
        $this->assertEquals(6000, $batch->totalCost);
        $this->assertSame(2, InputBatchMovement::count());

        // ACTUAL (posible bug): no hay costo promedio; inputs.unitCost sigue en 1000
        // aunque se compró a 1500 (PurchaseOrderController.php:527-564).
        $this->assertEquals(1000, $input->fresh()->unitCost);
    }

    public function test_recepcion_suma_al_ultimo_lote_activo_existente_aunque_tenga_otro_costo(): void
    {
        $input = $this->makeInput(['currentStock' => 5]);
        $old = $this->makeBatch($input, 5, 800, 'VIEJO');
        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 3, 'unitCost' => 2000]])->json('data.id');
        $this->confirm($id);

        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => $this->itemId($id), 'quantityReceived' => 3]]])->assertOk();
        // ACTUAL (posible bug): la mercancía nueva entra al lote viejo (costo 800) en vez de a un
        // lote propio con costo 2000 (PurchaseOrderController.php:536-552).
        $this->assertSame(1, InputBatch::count());
        $this->assertEquals(8, $old->fresh()->currentQuantity);
        $this->assertEquals(800, $old->fresh()->unitCost);
        $this->assertEquals(8, $input->fresh()->currentStock);
    }

    public function test_recibir_de_mas_responde_400_y_revierte_todo(): void
    {
        $a = $this->makeInput();
        $b = $this->makeInput();
        $id = $this->createOrder([
            ['inputId' => $a->id, 'quantity' => 5, 'unitCost' => 1],
            ['inputId' => $b->id, 'quantity' => 5, 'unitCost' => 1],
        ])->json('data.id');
        $this->confirm($id);
        $itemA = $this->itemId($id, 0);
        $itemB = $this->itemId($id, 1);

        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [
            ['itemId' => $itemA, 'quantityReceived' => 5],
            ['itemId' => $itemB, 'quantityReceived' => 6],
        ]])->assertStatus(400)->assertJsonPath('message', "No se puede recibir más de 5 unidades para el item {$itemB}");

        // La transacción deshace también el ítem A que sí era válido.
        $this->assertEquals(0, PurchaseOrderItem::find($itemA)->quantityReceived);
        $this->assertEquals(0, $a->fresh()->currentStock);
        $this->assertSame(0, InputBatchMovement::count());
        $this->assertSame('CONFIRMED', PurchaseOrder::find($id)->status);
    }

    public function test_item_ajeno_a_la_orden_se_ignora(): void
    {
        $input = $this->makeInput();
        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 5, 'unitCost' => 1]])->json('data.id');
        $this->confirm($id);

        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => 99999, 'quantityReceived' => 5]]])
            ->assertOk()->assertJsonPath('data.status', 'CONFIRMED');
        $this->assertEquals(0, $input->fresh()->currentStock);
    }

    public function test_doble_recepcion_repetida_acumula_y_al_cerrarse_responde_400(): void
    {
        $input = $this->makeInput();
        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 10, 'unitCost' => 1]])->json('data.id');
        $this->confirm($id);
        $payload = ['items' => [['itemId' => $this->itemId($id), 'quantityReceived' => 5]]];

        // La misma petición dos veces (doble clic): ambas se aplican y suman 10.
        $this->postJson("/api/purchase-orders/{$id}/receive", $payload)->assertOk()->assertJsonPath('data.status', 'PARTIAL');
        $this->postJson("/api/purchase-orders/{$id}/receive", $payload)->assertOk()->assertJsonPath('data.status', 'RECEIVED');
        $this->assertEquals(10, $input->fresh()->currentStock);
        $this->assertSame(2, InputBatchMovement::count());

        // Una tercera vez ya no: la orden está RECEIVED.
        $this->postJson("/api/purchase-orders/{$id}/receive", $payload)->assertStatus(400)
            ->assertJsonPath('message', 'La orden debe estar confirmada para recibir mercancía');
        $this->assertEquals(10, $input->fresh()->currentStock);
    }

    public function test_recepcion_de_variante_de_insumo_recalcula_el_total_del_insumo(): void
    {
        ['input' => $input, 'variant' => $iv] = $this->makeVariantInput(2, 5000);
        $id = $this->createOrder([['inputVariantId' => $iv->id, 'quantity' => 8, 'unitCost' => 6000]])->json('data.id');
        $this->confirm($id);

        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => $this->itemId($id), 'quantityReceived' => 8]]])
            ->assertOk()->assertJsonPath('data.status', 'RECEIVED');

        $this->assertEquals(10, $iv->fresh()->currentStock);
        // inputs.currentStock = suma de variantes activas.
        $this->assertEquals(10, $input->fresh()->currentStock);
        $mov = InputVariantMovement::sole();
        $this->assertSame('ENTRADA', $mov->movementType);
        $this->assertEquals(8, $mov->quantity);
        $this->assertEquals(2, $mov->previousStock);
        $this->assertEquals(10, $mov->newStock);
        $this->assertEquals(6000, $mov->unitCost);
        $this->assertSame('purchase_order', $mov->referenceType);
        // Sin lotes ni costo promedio para variantes.
        $this->assertSame(0, InputBatch::count());
        $this->assertEquals(5000, $iv->fresh()->unitCost);
    }

    public function test_recepcion_de_variante_de_producto(): void
    {
        $product = $this->makeProduct(['stock' => 0]);
        $pv = $this->makeProductVariant($product, 1);
        $id = $this->createOrder([['variantId' => $pv->id, 'quantity' => 6, 'unitCost' => 15000]])->json('data.id');
        $this->confirm($id);

        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => $this->itemId($id), 'quantityReceived' => 6]]])->assertOk();

        $this->assertSame(7, (int) $pv->fresh()->stock);
        $mov = VariantMovement::sole();
        $this->assertSame('PURCHASE', $mov->movementType);
        $this->assertEquals(6, $mov->quantity);
        $this->assertEquals(1, $mov->previousStock);
        $this->assertEquals(7, $mov->newStock);
        $this->assertEquals(15000, $mov->unitCost);
        // ACTUAL (posible bug): products.stock no se recalcula al recibir variantes de producto
        // (PurchaseOrderController.php:503-525), a diferencia de la conversión aprobada.
        $this->assertSame(0, (int) $product->fresh()->stock);
    }

    public function test_borrar_orden_y_borrado_forzado_no_revierte_stock(): void
    {
        $input = $this->makeInput();
        $draft = $this->createOrder([['inputId' => $input->id, 'quantity' => 1, 'unitCost' => 1]])->json('data.id');
        $this->deleteJson("/api/purchase-orders/{$draft}")->assertOk()->assertJsonPath('message', 'Orden eliminada correctamente');
        $this->assertNull(PurchaseOrder::find($draft));

        $id = $this->createOrder([['inputId' => $input->id, 'quantity' => 5, 'unitCost' => 1]])->json('data.id');
        $this->confirm($id);
        $this->postJson("/api/purchase-orders/{$id}/receive", ['items' => [['itemId' => $this->itemId($id), 'quantityReceived' => 5]]])->assertOk();

        $this->deleteJson("/api/purchase-orders/{$id}")->assertStatus(400)
            ->assertJsonPath('message', 'Solo se pueden eliminar órdenes en borrador o canceladas');

        $this->deleteJson("/api/purchase-orders/{$id}?force=1")->assertOk();
        $this->assertNull(PurchaseOrder::find($id));
        $this->assertSame(0, PurchaseOrderItem::count());
        $this->assertSame(0, InputBatchMovement::count());
        // ACTUAL (posible bug): el borrado forzado elimina los movimientos pero deja el stock
        // y el lote que entraron con la recepción (PurchaseOrderController.php:476-501).
        $this->assertEquals(5, $input->fresh()->currentStock);
        $this->assertSame(1, InputBatch::count());
    }

    public function test_listado_detalle_y_estadisticas(): void
    {
        $input = $this->makeInput(['code' => 'LST', 'name' => 'Listado']);
        $s = $this->makeSupplier('PROV-100', 'Buscable');
        $id1 = $this->createOrder([['inputId' => $input->id, 'quantity' => 2, 'unitCost' => 100]], $s->id)->json('data.id');
        $id2 = $this->createOrder([['inputId' => $input->id, 'quantity' => 1, 'unitCost' => 50]])->json('data.id');
        $this->confirm($id2);
        $this->postJson("/api/purchase-orders/{$id2}/receive", ['items' => [['itemId' => $this->itemId($id2), 'quantityReceived' => 1]]])->assertOk();

        $this->getJson('/api/purchase-orders')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'orderNumber', 'status', 'total', 'supplier' => ['id', 'code', 'name'], 'items' => [['id', 'input' => ['id', 'code', 'name']]]]]]);
        $this->getJson('/api/purchase-orders?status=RECEIVED')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id2);
        $this->getJson("/api/purchase-orders?supplierId={$s->id}")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/purchase-orders?search=Buscable')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id1);
        $this->getJson("/api/purchase-orders/{$id1}")->assertOk()->assertJsonStructure(['data' => self::DETAIL_STRUCTURE]);
        $this->getJson('/api/purchase-orders/9999')->assertStatus(404)->assertJsonPath('message', 'Orden de compra no encontrada');

        $this->getJson('/api/purchase-orders/stats')->assertOk()->assertJsonPath('data', [
            'total' => 2,
            'byStatus' => ['draft' => 1, 'sent' => 0, 'confirmed' => 0, 'partial' => 0, 'received' => 1, 'cancelled' => 0],
            'pendingCount' => 1,
            'monthlyTotal' => 50,
        ]);
    }

    public function test_el_cliente_no_entra_a_ordenes_de_compra(): void
    {
        $this->actingAsCliente();
        $this->getJson('/api/purchase-orders')->assertStatus(403);
        $this->postJson('/api/purchase-orders', [])->assertStatus(403);
    }
}
