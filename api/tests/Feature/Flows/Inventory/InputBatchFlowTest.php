<?php

namespace Tests\Feature\Flows\Inventory;

use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRoles;
use Tests\Feature\Flows\Inventory\Concerns\BuildsInventoryData;
use Tests\TestCase;

/**
 * Caracterización: lotes de insumo (InputBatchController).
 * El stock del insumo (inputs.currentStock) se recalcula siempre como la suma
 * de currentQuantity de los lotes activos.
 */
class InputBatchFlowTest extends TestCase
{
    use ActsAsRoles, BuildsInventoryData, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRolesAndUsers();
        $this->actingAsAdmin();
    }

    private function createBatch(int $inputId, float $qty, float $cost, string $number = 'L-001')
    {
        return $this->postJson("/api/input-batches/input/{$inputId}", [
            'batchNumber' => $number,
            'initialQuantity' => $qty,
            'unitCost' => $cost,
            'supplier' => 'Proveedor X',
            'notes' => 'nota',
        ]);
    }

    public function test_crear_lote_registra_entrada_y_recalcula_stock(): void
    {
        $admin = $this->userByEmail('admin@vexa.com');
        $input = $this->makeInput(['unitCost' => 1000]);

        $res = $this->createBatch($input->id, 20, 1200);
        $res->assertStatus(201)->assertJsonPath('message', 'Lote creado')
            ->assertJsonStructure(['data' => [
                'id', 'inputId', 'batchNumber', 'supplier', 'invoiceRef', 'initialQuantity', 'currentQuantity',
                'reservedQuantity', 'unitCost', 'totalCost', 'purchaseDate', 'expiryDate', 'notes', 'isActive',
            ]]);

        $batch = InputBatch::find($res->json('data.id'));
        $this->assertEquals(20, $batch->currentQuantity);
        $this->assertEquals(0, $batch->reservedQuantity);
        $this->assertEquals(24000, $batch->totalCost);
        $this->assertEquals(20, $input->fresh()->currentStock);

        $mov = InputBatchMovement::sole();
        $this->assertSame('ENTRADA', $mov->movementType);
        $this->assertEquals(20, $mov->quantity);
        $this->assertSame('Entrada de lote L-001', $mov->reason);
        $this->assertSame('purchase', $mov->referenceType);
        $this->assertNull($mov->referenceId);
        $this->assertEquals($admin->id, $mov->userId);
    }

    public function test_dos_lotes_con_distinto_costo_suman_stock_pero_no_promedian_el_costo(): void
    {
        $input = $this->makeInput(['unitCost' => 1000]);
        $this->createBatch($input->id, 10, 1000, 'L-1')->assertStatus(201);
        $this->createBatch($input->id, 10, 2000, 'L-2')->assertStatus(201);

        $this->assertEquals(20, $input->fresh()->currentStock);
        // ACTUAL (posible bug): no hay costo promedio; inputs.unitCost se queda igual
        // aunque entren lotes a otro costo (InputBatchController.php:55-98).
        $this->assertEquals(1000, $input->fresh()->unitCost);
    }

    public function test_crear_lote_valida_campos(): void
    {
        $input = $this->makeInput();
        $this->postJson("/api/input-batches/input/{$input->id}", [])->assertStatus(422)
            ->assertJsonValidationErrors(['batchNumber', 'initialQuantity', 'unitCost']);
        $this->postJson("/api/input-batches/input/{$input->id}", [
            'batchNumber' => 'X', 'initialQuantity' => -1, 'unitCost' => 1,
        ])->assertStatus(422)->assertJsonValidationErrors(['initialQuantity']);
    }

    public function test_numero_de_lote_repetido_en_el_mismo_insumo_revienta_con_500(): void
    {
        $input = $this->makeInput();
        $this->createBatch($input->id, 1, 1, 'REP')->assertStatus(201);
        // ACTUAL (posible bug): no se valida el número de lote; choca con el índice único
        // (inputId, batchNumber) y responde 500 (InputBatchController.php:68).
        $this->createBatch($input->id, 1, 1, 'REP')->assertStatus(500);
        $this->assertSame(1, InputBatch::count());
    }

    public function test_ajustar_lote_registra_ajuste_con_valor_absoluto(): void
    {
        $input = $this->makeInput();
        $batchId = $this->createBatch($input->id, 20, 100)->json('data.id');

        $this->postJson("/api/input-batches/{$batchId}/adjust", ['newQuantity' => 15, 'reason' => 'Merma'])
            ->assertOk()->assertJsonPath('message', 'Cantidad ajustada');
        $this->assertEquals(15, InputBatch::find($batchId)->currentQuantity);
        $this->assertEquals(15, $input->fresh()->currentStock);

        $mov = InputBatchMovement::where('movementType', 'AJUSTE')->sole();
        // La cantidad se guarda en positivo aunque el ajuste haya sido a la baja.
        $this->assertEquals(5, $mov->quantity);
        $this->assertSame('Merma', $mov->reason);
        $this->assertSame('adjustment', $mov->referenceType);

        $this->postJson("/api/input-batches/{$batchId}/adjust", ['newQuantity' => 30, 'reason' => 'Hallazgo'])->assertOk();
        $this->assertEquals(30, $input->fresh()->currentStock);
        $this->assertEquals(15, InputBatchMovement::where('movementType', 'AJUSTE')->latest('id')->first()->quantity);

        // initialQuantity, unitCost y totalCost no cambian con el ajuste.
        $batch = InputBatch::find($batchId);
        $this->assertEquals(20, $batch->initialQuantity);
        $this->assertEquals(2000, $batch->totalCost);

        $this->postJson("/api/input-batches/{$batchId}/adjust", ['newQuantity' => -1, 'reason' => 'x'])->assertStatus(422);
        $this->postJson('/api/input-batches/9999/adjust', ['newQuantity' => 1, 'reason' => 'x'])->assertStatus(404);
    }

    public function test_reservar_descuenta_del_stock_y_liberar_lo_devuelve(): void
    {
        $input = $this->makeInput();
        $batchId = $this->createBatch($input->id, 10, 100)->json('data.id');

        $this->postJson("/api/input-batches/{$batchId}/reserve", ['quantity' => 4, 'orderId' => 77])
            ->assertOk()->assertJsonPath('message', 'Cantidad reservada');
        $batch = InputBatch::find($batchId);
        // La reserva saca la cantidad de currentQuantity (no solo la marca como reservada).
        $this->assertEquals(6, $batch->currentQuantity);
        $this->assertEquals(4, $batch->reservedQuantity);
        $this->assertEquals(6, $input->fresh()->currentStock);

        $mov = InputBatchMovement::where('movementType', 'RESERVA')->sole();
        $this->assertEquals(4, $mov->quantity);
        $this->assertSame('order', $mov->referenceType);
        $this->assertEquals(77, $mov->referenceId);
        $this->assertSame('Reserva para orden #77', $mov->reason);

        // Disponible = currentQuantity - reservedQuantity = 6 - 4 = 2.
        $this->postJson("/api/input-batches/{$batchId}/reserve", ['quantity' => 3, 'orderId' => 78])
            ->assertStatus(400)->assertJsonPath('message', 'Stock insuficiente. Disponible: 2, Solicitado: 3');

        $this->postJson("/api/input-batches/{$batchId}/release", ['quantity' => 4, 'orderId' => 77])
            ->assertOk()->assertJsonPath('message', 'Reserva liberada');
        $batch->refresh();
        $this->assertEquals(10, $batch->currentQuantity);
        $this->assertEquals(0, $batch->reservedQuantity);
        $this->assertEquals(10, $input->fresh()->currentStock);
        $this->assertSame('Liberación de reserva de orden #77', InputBatchMovement::where('movementType', 'LIBERACION')->sole()->reason);
    }

    public function test_liberar_sin_reserva_deja_reservado_negativo_y_aumenta_stock(): void
    {
        $input = $this->makeInput();
        $batchId = $this->createBatch($input->id, 10, 100)->json('data.id');

        // ACTUAL (posible bug): release no valida que exista la reserva
        // (InputBatchController.php:185-213): reservado queda en -5 y el stock sube a 15.
        $this->postJson("/api/input-batches/{$batchId}/release", ['quantity' => 5, 'orderId' => 1])->assertOk();
        $batch = InputBatch::find($batchId);
        $this->assertEquals(-5, $batch->reservedQuantity);
        $this->assertEquals(15, $batch->currentQuantity);
        $this->assertEquals(15, $input->fresh()->currentStock);
    }

    public function test_salida_consume_lo_reservado_sin_tocar_el_stock(): void
    {
        $input = $this->makeInput();
        $batchId = $this->createBatch($input->id, 10, 100)->json('data.id');
        $this->postJson("/api/input-batches/{$batchId}/reserve", ['quantity' => 4, 'orderId' => 1])->assertOk();

        $this->postJson("/api/input-batches/{$batchId}/output", ['quantity' => 4, 'productionId' => 9])
            ->assertOk()->assertJsonPath('message', 'Salida registrada');
        $batch = InputBatch::find($batchId);
        $this->assertEquals(6, $batch->currentQuantity);
        $this->assertEquals(0, $batch->reservedQuantity);
        $this->assertEquals(6, $input->fresh()->currentStock);

        $mov = InputBatchMovement::where('movementType', 'SALIDA')->sole();
        $this->assertEquals(4, $mov->quantity);
        $this->assertSame('production', $mov->referenceType);
        $this->assertEquals(9, $mov->referenceId);
        $this->assertSame('Uso en producción #9', $mov->reason);
    }

    public function test_salida_sin_reserva_no_descuenta_stock_y_deja_reservado_negativo(): void
    {
        $input = $this->makeInput();
        $batchId = $this->createBatch($input->id, 10, 100)->json('data.id');

        // ACTUAL (posible bug): output solo resta de reservedQuantity y no valida nada
        // (InputBatchController.php:215-242): el stock sigue en 10 y reservado queda en -3.
        $this->postJson("/api/input-batches/{$batchId}/output", ['quantity' => 3, 'productionId' => 1])->assertOk();
        $batch = InputBatch::find($batchId);
        $this->assertEquals(10, $batch->currentQuantity);
        $this->assertEquals(-3, $batch->reservedQuantity);
        $this->assertEquals(10, $input->fresh()->currentStock);
    }

    public function test_actualizar_lote_e_inactivarlo_no_recalcula_stock(): void
    {
        $input = $this->makeInput();
        $batchId = $this->createBatch($input->id, 10, 100)->json('data.id');

        $this->putJson("/api/input-batches/{$batchId}", ['invoiceRef' => 'FAC-1', 'isActive' => false])
            ->assertOk()->assertJsonPath('data.invoiceRef', 'FAC-1');
        // ACTUAL (posible bug): inactivar un lote no recalcula inputs.currentStock
        // (InputBatchController.php:100-119); solo lo corrige recalculate-stock.
        $this->assertEquals(10, $input->fresh()->currentStock);
        $this->postJson("/api/inputs/{$input->id}/recalculate-stock")->assertOk();
        $this->assertEquals(0, $input->fresh()->currentStock);
    }

    public function test_consultas_de_lotes_y_movimientos_forma_json(): void
    {
        $input = $this->makeInput(['currentStock' => 0, 'minStock' => 50]);
        $batchId = $this->createBatch($input->id, 10, 100)->json('data.id');
        $this->postJson("/api/input-batches/{$batchId}/adjust", ['newQuantity' => 8, 'reason' => 'r'])->assertOk();

        $this->getJson("/api/input-batches/input/{$input->id}")->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [['id', 'batchNumber', 'currentQuantity', 'input' => ['id', 'code', 'name', 'unitOfMeasure']]]]);
        $this->getJson("/api/input-batches/{$batchId}")->assertOk()
            ->assertJsonStructure(['data' => ['id', 'input', 'movements' => [['id', 'movementType', 'quantity']]]]);
        $this->getJson('/api/input-batches/9999')->assertStatus(404);
        $this->getJson("/api/input-batches/{$batchId}/movements")->assertOk()->assertJsonCount(2, 'data');
        $this->getJson("/api/input-batches/input/{$input->id}/movements")->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonStructure(['data' => [['id', 'movementType', 'inputBatch' => ['id', 'batchNumber']]]]);

        $this->getJson('/api/input-batches/movements/all')->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [[
                'id', 'type', 'inputId', 'movementType', 'quantity', 'reason', 'notes', 'referenceType',
                'referenceId', 'userId', 'createdAt', 'input', 'inputBatch', 'inputVariant',
            ]]])
            ->assertJsonPath('data.0.type', 'batch');
        $this->getJson('/api/input-batches/movements/all?movementType=AJUSTE')->assertOk()->assertJsonCount(1, 'data');

        $this->getJson('/api/input-batches/movements/stats')->assertOk()
            ->assertJsonPath('data', ['totalInputs' => 1, 'totalStock' => 8, 'lowStock' => 1, 'todayMovements' => 2]);
    }
}
