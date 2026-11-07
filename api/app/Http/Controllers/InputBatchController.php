<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Inventory\InputBatchService;
use Illuminate\Http\Request;

/** Lotes de insumo y sus movimientos. La lógica vive en InputBatchService. */
class InputBatchController extends Controller
{
    use ApiResponse;

    public function __construct(private InputBatchService $batches) {}

    public function byInput(int $inputId)
    {
        return $this->success($this->batches->byInput($inputId));
    }

    public function show(int $id)
    {
        return $this->success($this->batches->detail($id));
    }

    public function store(Request $request, int $inputId)
    {
        $data = $request->validate([
            'batchNumber' => 'required|string',
            'supplier' => 'nullable|string',
            'invoiceRef' => 'nullable|string',
            'initialQuantity' => 'required|numeric|min:0',
            'unitCost' => 'required|numeric|min:0',
            'purchaseDate' => 'nullable|date',
            'expiryDate' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        return $this->created($this->batches->create($inputId, $data, $request->user()->id), 'Lote creado');
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'batchNumber' => 'nullable|string',
            'supplier' => 'nullable|string',
            'invoiceRef' => 'nullable|string',
            'purchaseDate' => 'nullable|date',
            'expiryDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->batches->update($id, $data), 'Lote actualizado');
    }

    public function adjust(Request $request, int $id)
    {
        $data = $request->validate([
            'newQuantity' => 'required|numeric|min:0',
            'reason' => 'required|string',
        ]);

        return $this->success($this->batches->adjust($id, (float) $data['newQuantity'], $data['reason'], $request->user()->id), 'Cantidad ajustada');
    }

    public function reserve(Request $request, int $id)
    {
        $data = $request->validate(['quantity' => 'required|numeric|min:0', 'orderId' => 'required|integer']);

        return $this->success($this->batches->reserve($id, (float) $data['quantity'], (int) $data['orderId'], $request->user()->id), 'Cantidad reservada');
    }

    public function release(Request $request, int $id)
    {
        $data = $request->validate(['quantity' => 'required|numeric|min:0', 'orderId' => 'required|integer']);

        return $this->success($this->batches->release($id, (float) $data['quantity'], (int) $data['orderId'], $request->user()->id), 'Reserva liberada');
    }

    public function output(Request $request, int $id)
    {
        $data = $request->validate(['quantity' => 'required|numeric|min:0', 'productionId' => 'required|integer']);

        return $this->success($this->batches->output($id, (float) $data['quantity'], (int) $data['productionId'], $request->user()->id), 'Salida registrada');
    }

    public function allMovements(Request $request)
    {
        return $this->success($this->batches->allMovements($request->query()));
    }

    public function movementsStats()
    {
        return $this->success($this->batches->movementsStats());
    }

    public function movementsByInput(Request $request, int $inputId)
    {
        return $this->success($this->batches->movementsByInput($inputId, (int) ($request->query('limit') ?: 100)));
    }

    public function movementsByBatch(Request $request, int $batchId)
    {
        return $this->success($this->batches->movementsByBatch($batchId, (int) ($request->query('limit') ?: 100)));
    }
}
