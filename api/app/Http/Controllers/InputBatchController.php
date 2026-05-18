<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariantMovement;
use Illuminate\Http\Request;

class InputBatchController extends Controller
{
    use ApiResponse;

    /** Recalcula el stock del insumo sumando la cantidad actual de sus lotes. */
    private function recalcInputStock(int $inputId): void
    {
        $total = InputBatch::where('inputId', $inputId)->where('isActive', true)->sum('currentQuantity');
        Input::where('id', $inputId)->update(['currentStock' => $total]);
    }

    private function createMovement(array $data): void
    {
        InputBatchMovement::create([
            'inputId' => $data['inputId'],
            'inputBatchId' => $data['inputBatchId'],
            'movementType' => $data['movementType'],
            'quantity' => $data['quantity'],
            'reason' => $data['reason'] ?? null,
            'notes' => $data['notes'] ?? null,
            'referenceType' => $data['referenceType'] ?? null,
            'referenceId' => $data['referenceId'] ?? null,
            'userId' => $data['userId'] ?? null,
        ]);
    }

    public function byInput(int $inputId)
    {
        $batches = InputBatch::with('input:id,code,name,unitOfMeasure')
            ->where('inputId', $inputId)->where('isActive', true)
            ->orderByDesc('createdAt')->get();

        return $this->success($batches);
    }

    public function show(int $id)
    {
        $batch = InputBatch::with(['input', 'movements' => fn ($q) => $q->orderByDesc('createdAt')->take(50)])
            ->find($id);

        return $batch ? $this->success($batch) : $this->error('Lote no encontrado', 404);
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

        $batch = InputBatch::create([
            'inputId' => $inputId,
            'batchNumber' => $data['batchNumber'],
            'supplier' => $data['supplier'] ?? null,
            'invoiceRef' => $data['invoiceRef'] ?? null,
            'initialQuantity' => $data['initialQuantity'],
            'currentQuantity' => $data['initialQuantity'],
            'reservedQuantity' => 0,
            'unitCost' => $data['unitCost'],
            'totalCost' => $data['initialQuantity'] * $data['unitCost'],
            'purchaseDate' => $data['purchaseDate'] ?? null,
            'expiryDate' => $data['expiryDate'] ?? null,
            'notes' => $data['notes'] ?? null,
            'isActive' => true,
        ]);

        $this->createMovement([
            'inputId' => $inputId,
            'inputBatchId' => $batch->id,
            'movementType' => 'ENTRADA',
            'quantity' => $data['initialQuantity'],
            'reason' => "Entrada de lote {$data['batchNumber']}",
            'notes' => $data['notes'] ?? null,
            'referenceType' => 'purchase',
            'userId' => $request->user()->id,
        ]);

        $this->recalcInputStock($inputId);

        return $this->created($batch, 'Lote creado');
    }

    public function update(Request $request, int $id)
    {
        $batch = InputBatch::find($id);
        if (! $batch) {
            return $this->error('Lote no encontrado', 404);
        }
        $data = $request->validate([
            'batchNumber' => 'nullable|string',
            'supplier' => 'nullable|string',
            'invoiceRef' => 'nullable|string',
            'purchaseDate' => 'nullable|date',
            'expiryDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'isActive' => 'nullable|boolean',
        ]);
        $batch->fill(array_filter($data, fn ($v) => $v !== null));
        $batch->save();

        return $this->success($batch, 'Lote actualizado');
    }

    public function adjust(Request $request, int $id)
    {
        $data = $request->validate([
            'newQuantity' => 'required|numeric|min:0',
            'reason' => 'required|string',
        ]);
        $batch = InputBatch::find($id);
        if (! $batch) {
            return $this->error('Lote no encontrado', 404);
        }

        $difference = $data['newQuantity'] - (float) $batch->currentQuantity;
        $batch->currentQuantity = $data['newQuantity'];
        $batch->save();

        $this->createMovement([
            'inputId' => $batch->inputId,
            'inputBatchId' => $id,
            'movementType' => 'AJUSTE',
            'quantity' => abs($difference),
            'reason' => $data['reason'],
            'referenceType' => 'adjustment',
            'userId' => $request->user()->id,
        ]);
        $this->recalcInputStock($batch->inputId);

        return $this->success($batch, 'Cantidad ajustada');
    }

    public function reserve(Request $request, int $id)
    {
        $data = $request->validate([
            'quantity' => 'required|numeric|min:0',
            'orderId' => 'required|integer',
        ]);
        $batch = InputBatch::find($id);
        if (! $batch) {
            return $this->error('Lote no encontrado', 404);
        }

        $available = (float) $batch->currentQuantity - (float) $batch->reservedQuantity;
        if ($available < $data['quantity']) {
            return $this->error("Stock insuficiente. Disponible: {$available}, Solicitado: {$data['quantity']}", 400);
        }

        $batch->reservedQuantity = (float) $batch->reservedQuantity + $data['quantity'];
        $batch->currentQuantity = (float) $batch->currentQuantity - $data['quantity'];
        $batch->save();

        $this->createMovement([
            'inputId' => $batch->inputId,
            'inputBatchId' => $id,
            'movementType' => 'RESERVA',
            'quantity' => $data['quantity'],
            'reason' => "Reserva para orden #{$data['orderId']}",
            'referenceType' => 'order',
            'referenceId' => $data['orderId'],
            'userId' => $request->user()->id,
        ]);
        $this->recalcInputStock($batch->inputId);

        return $this->success($batch, 'Cantidad reservada');
    }

    public function release(Request $request, int $id)
    {
        $data = $request->validate([
            'quantity' => 'required|numeric|min:0',
            'orderId' => 'required|integer',
        ]);
        $batch = InputBatch::find($id);
        if (! $batch) {
            return $this->error('Lote no encontrado', 404);
        }

        $batch->reservedQuantity = (float) $batch->reservedQuantity - $data['quantity'];
        $batch->currentQuantity = (float) $batch->currentQuantity + $data['quantity'];
        $batch->save();

        $this->createMovement([
            'inputId' => $batch->inputId,
            'inputBatchId' => $id,
            'movementType' => 'LIBERACION',
            'quantity' => $data['quantity'],
            'reason' => "Liberación de reserva de orden #{$data['orderId']}",
            'referenceType' => 'order',
            'referenceId' => $data['orderId'],
            'userId' => $request->user()->id,
        ]);
        $this->recalcInputStock($batch->inputId);

        return $this->success($batch, 'Reserva liberada');
    }

    public function output(Request $request, int $id)
    {
        $data = $request->validate([
            'quantity' => 'required|numeric|min:0',
            'productionId' => 'required|integer',
        ]);
        $batch = InputBatch::find($id);
        if (! $batch) {
            return $this->error('Lote no encontrado', 404);
        }

        $batch->reservedQuantity = (float) $batch->reservedQuantity - $data['quantity'];
        $batch->save();

        $this->createMovement([
            'inputId' => $batch->inputId,
            'inputBatchId' => $id,
            'movementType' => 'SALIDA',
            'quantity' => $data['quantity'],
            'reason' => "Uso en producción #{$data['productionId']}",
            'referenceType' => 'production',
            'referenceId' => $data['productionId'],
            'userId' => $request->user()->id,
        ]);
        $this->recalcInputStock($batch->inputId);

        return $this->success($batch, 'Salida registrada');
    }

    public function allMovements(Request $request)
    {
        $limit = (int) ($request->query('limit') ?: 500);
        $perType = (int) ceil($limit / 2);

        $batchQuery = InputBatchMovement::with(['input:id,code,name,unitOfMeasure', 'inputBatch:id,batchNumber']);
        if ($request->filled('inputId')) {
            $batchQuery->where('inputId', $request->query('inputId'));
        }
        if ($request->filled('movementType')) {
            $batchQuery->where('movementType', $request->query('movementType'));
        }
        if ($request->filled('referenceType')) {
            $batchQuery->where('referenceType', $request->query('referenceType'));
        }
        $batchMovements = $batchQuery->orderByDesc('createdAt')->take($perType)->get()
            ->map(fn ($m) => [
                'id' => $m->id, 'type' => 'batch', 'inputId' => $m->inputId,
                'movementType' => $m->movementType, 'quantity' => $m->quantity,
                'reason' => $m->reason, 'notes' => $m->notes,
                'referenceType' => $m->referenceType, 'referenceId' => $m->referenceId,
                'userId' => $m->userId, 'createdAt' => $m->createdAt,
                'input' => $m->input, 'inputBatch' => $m->inputBatch, 'inputVariant' => null,
            ]);

        $variantQuery = InputVariantMovement::with(['inputVariant.input:id,code,name,unitOfMeasure',
            'inputVariant.color:id,name,hexCode', 'inputVariant.size:id,name,abbreviation']);
        if ($request->filled('movementType')) {
            $variantQuery->where('movementType', $request->query('movementType'));
        }
        if ($request->filled('referenceType')) {
            $variantQuery->where('referenceType', $request->query('referenceType'));
        }
        $variantMovements = $variantQuery->orderByDesc('createdAt')->take($perType)->get()
            ->map(fn ($m) => [
                'id' => $m->id, 'type' => 'variant', 'inputId' => $m->inputVariant?->input?->id,
                'movementType' => $m->movementType, 'quantity' => $m->quantity,
                'reason' => $m->reason, 'notes' => $m->notes,
                'referenceType' => $m->referenceType, 'referenceId' => $m->referenceId,
                'userId' => $m->userId, 'createdAt' => $m->createdAt,
                'input' => $m->inputVariant?->input, 'inputBatch' => null,
                'inputVariant' => $m->inputVariant ? [
                    'id' => $m->inputVariant->id, 'sku' => $m->inputVariant->sku,
                    'color' => $m->inputVariant->color, 'size' => $m->inputVariant->size,
                ] : null,
            ]);

        $all = $batchMovements->concat($variantMovements)
            ->sortByDesc('createdAt')->take($limit)->values();

        return $this->success($all);
    }

    public function movementsStats()
    {
        $todayStart = now()->startOfDay();
        $inputs = Input::where('isActive', true)->get(['currentStock', 'minStock']);

        $lowStock = $inputs->filter(fn ($i) => (float) $i->currentStock <= (float) $i->minStock
            && (float) $i->currentStock > 0)->count();

        return $this->success([
            'totalInputs' => $inputs->count(),
            'totalStock' => (float) $inputs->sum('currentStock'),
            'lowStock' => $lowStock,
            'todayMovements' => InputBatchMovement::where('createdAt', '>=', $todayStart)->count()
                + InputVariantMovement::where('createdAt', '>=', $todayStart)->count(),
        ]);
    }

    public function movementsByInput(Request $request, int $inputId)
    {
        $limit = (int) ($request->query('limit') ?: 100);
        $movements = InputBatchMovement::with('inputBatch:id,batchNumber')
            ->where('inputId', $inputId)->orderByDesc('createdAt')->take($limit)->get();

        return $this->success($movements);
    }

    public function movementsByBatch(Request $request, int $batchId)
    {
        $limit = (int) ($request->query('limit') ?: 100);
        $movements = InputBatchMovement::where('inputBatchId', $batchId)
            ->orderByDesc('createdAt')->take($limit)->get();

        return $this->success($movements);
    }
}
