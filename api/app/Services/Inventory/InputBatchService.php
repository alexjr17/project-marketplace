<?php

namespace App\Services\Inventory;

use App\Exceptions\BusinessRuleException;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InputVariantMovement;
use Illuminate\Support\Facades\DB;

/**
 * Lotes de insumo: entrada, ajuste, reserva, liberación y salida a producción, y sus
 * movimientos (input_batch_movements). El stock del insumo (inputs.currentStock) es siempre
 * la suma de currentQuantity de los lotes activos y se recalcula en cada cambio.
 *
 * Reglas:
 *  - El número de lote es único por insumo (antes chocaba con el índice y daba 500).
 *  - Reservar exige disponible (actual − reservado); liberar y sacar a producción exigen
 *    que haya esa cantidad reservada (antes dejaban el reservado en negativo).
 */
class InputBatchService
{
    public function byInput(int $inputId)
    {
        return InputBatch::with('input:id,code,name,unitOfMeasure')
            ->where('inputId', $inputId)->where('isActive', true)
            ->orderByDesc('createdAt')->get();
    }

    public function detail(int $id): InputBatch
    {
        $batch = InputBatch::with(['input', 'movements' => fn ($q) => $q->orderByDesc('createdAt')->take(50)])->find($id);
        if (! $batch) {
            throw new BusinessRuleException('Lote no encontrado', 404);
        }

        return $batch;
    }

    public function create(int $inputId, array $data, int $userId): InputBatch
    {
        if (InputBatch::where('inputId', $inputId)->where('batchNumber', $data['batchNumber'])->exists()) {
            throw new BusinessRuleException('Ya existe un lote con ese número para este insumo', 422, [
                'batchNumber' => ['Ya existe un lote con ese número para este insumo'],
            ]);
        }

        return DB::transaction(function () use ($inputId, $data, $userId) {
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

            $this->movement($batch, 'ENTRADA', $data['initialQuantity'], [
                'reason' => "Entrada de lote {$data['batchNumber']}",
                'notes' => $data['notes'] ?? null,
                'referenceType' => 'purchase',
                'userId' => $userId,
            ]);
            $this->recalcInputStock($inputId);

            return $batch;
        });
    }

    /** Datos del lote. Si cambia el estado activo, el stock del insumo se recalcula. */
    public function update(int $id, array $data): InputBatch
    {
        $batch = $this->find($id);
        if (! empty($data['batchNumber']) && $data['batchNumber'] !== $batch->batchNumber
            && InputBatch::where('inputId', $batch->inputId)->where('batchNumber', $data['batchNumber'])->exists()) {
            throw new BusinessRuleException('Ya existe un lote con ese número para este insumo', 422, [
                'batchNumber' => ['Ya existe un lote con ese número para este insumo'],
            ]);
        }

        return DB::transaction(function () use ($batch, $data) {
            $batch->fill(array_filter($data, fn ($v) => $v !== null));
            $batch->save();
            $this->recalcInputStock($batch->inputId);

            return $batch;
        });
    }

    public function adjust(int $id, float $newQuantity, string $reason, int $userId): InputBatch
    {
        $batch = $this->find($id);

        return DB::transaction(function () use ($batch, $newQuantity, $reason, $userId) {
            $difference = $newQuantity - (float) $batch->currentQuantity;
            $batch->currentQuantity = $newQuantity;
            $batch->save();

            $this->movement($batch, 'AJUSTE', abs($difference), [
                'reason' => $reason, 'referenceType' => 'adjustment', 'userId' => $userId,
            ]);
            $this->recalcInputStock($batch->inputId);

            return $batch;
        });
    }

    /** Aparta cantidad para una orden: sale de currentQuantity y queda en reservedQuantity. */
    public function reserve(int $id, float $quantity, int $orderId, int $userId): InputBatch
    {
        return DB::transaction(function () use ($id, $quantity, $orderId, $userId) {
            $batch = $this->find($id, lock: true);
            $available = (float) $batch->currentQuantity - (float) $batch->reservedQuantity;
            if ($available < $quantity) {
                throw new BusinessRuleException("Stock insuficiente. Disponible: {$available}, Solicitado: {$quantity}", 400);
            }

            $batch->reservedQuantity = (float) $batch->reservedQuantity + $quantity;
            $batch->currentQuantity = (float) $batch->currentQuantity - $quantity;
            $batch->save();

            $this->movement($batch, 'RESERVA', $quantity, [
                'reason' => "Reserva para orden #{$orderId}", 'referenceType' => 'order', 'referenceId' => $orderId, 'userId' => $userId,
            ]);
            $this->recalcInputStock($batch->inputId);

            return $batch;
        });
    }

    /** Devuelve al stock una cantidad reservada. */
    public function release(int $id, float $quantity, int $orderId, int $userId): InputBatch
    {
        return DB::transaction(function () use ($id, $quantity, $orderId, $userId) {
            $batch = $this->find($id, lock: true);
            $this->assertReserved($batch, $quantity);

            $batch->reservedQuantity = (float) $batch->reservedQuantity - $quantity;
            $batch->currentQuantity = (float) $batch->currentQuantity + $quantity;
            $batch->save();

            $this->movement($batch, 'LIBERACION', $quantity, [
                'reason' => "Liberación de reserva de orden #{$orderId}", 'referenceType' => 'order', 'referenceId' => $orderId, 'userId' => $userId,
            ]);
            $this->recalcInputStock($batch->inputId);

            return $batch;
        });
    }

    /** Consume en producción una cantidad reservada (ya salió del stock al reservar). */
    public function output(int $id, float $quantity, int $productionId, int $userId): InputBatch
    {
        return DB::transaction(function () use ($id, $quantity, $productionId, $userId) {
            $batch = $this->find($id, lock: true);
            $this->assertReserved($batch, $quantity);

            $batch->reservedQuantity = (float) $batch->reservedQuantity - $quantity;
            $batch->save();

            $this->movement($batch, 'SALIDA', $quantity, [
                'reason' => "Uso en producción #{$productionId}", 'referenceType' => 'production', 'referenceId' => $productionId, 'userId' => $userId,
            ]);
            $this->recalcInputStock($batch->inputId);

            return $batch;
        });
    }

    /** Movimientos de lotes y de variantes de insumo juntos, del más reciente al más antiguo. */
    public function allMovements(array $filters)
    {
        $limit = (int) (($filters['limit'] ?? null) ?: 500);
        $perType = (int) ceil($limit / 2);

        $batchQuery = InputBatchMovement::with(['input:id,code,name,unitOfMeasure', 'inputBatch:id,batchNumber']);
        if (! empty($filters['inputId'])) {
            $batchQuery->where('inputId', $filters['inputId']);
        }
        if (! empty($filters['movementType'])) {
            $batchQuery->where('movementType', $filters['movementType']);
        }
        if (! empty($filters['referenceType'])) {
            $batchQuery->where('referenceType', $filters['referenceType']);
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
        if (! empty($filters['movementType'])) {
            $variantQuery->where('movementType', $filters['movementType']);
        }
        if (! empty($filters['referenceType'])) {
            $variantQuery->where('referenceType', $filters['referenceType']);
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

        return $batchMovements->concat($variantMovements)->sortByDesc('createdAt')->take($limit)->values();
    }

    public function movementsStats(): array
    {
        $todayStart = now()->startOfDay();
        $inputs = Input::where('isActive', true)->get(['currentStock', 'minStock']);

        return [
            'totalInputs' => $inputs->count(),
            'totalStock' => (float) $inputs->sum('currentStock'),
            'lowStock' => $inputs->filter(fn ($i) => (float) $i->currentStock <= (float) $i->minStock && (float) $i->currentStock > 0)->count(),
            'todayMovements' => InputBatchMovement::where('createdAt', '>=', $todayStart)->count()
                + InputVariantMovement::where('createdAt', '>=', $todayStart)->count(),
        ];
    }

    public function movementsByInput(int $inputId, int $limit)
    {
        return InputBatchMovement::with('inputBatch:id,batchNumber')
            ->where('inputId', $inputId)->orderByDesc('createdAt')->take($limit)->get();
    }

    public function movementsByBatch(int $batchId, int $limit)
    {
        return InputBatchMovement::where('inputBatchId', $batchId)->orderByDesc('createdAt')->take($limit)->get();
    }

    /** Stock del insumo = suma de currentQuantity de sus lotes activos. */
    public function recalcInputStock(int $inputId): float
    {
        $total = (float) InputBatch::where('inputId', $inputId)->where('isActive', true)->sum('currentQuantity');
        Input::where('id', $inputId)->update(['currentStock' => $total]);

        return $total;
    }

    private function find(int $id, bool $lock = false): InputBatch
    {
        $query = InputBatch::whereKey($id);
        $batch = ($lock ? $query->lockForUpdate() : $query)->first();
        if (! $batch) {
            throw new BusinessRuleException('Lote no encontrado', 404);
        }

        return $batch;
    }

    private function assertReserved(InputBatch $batch, float $quantity): void
    {
        $reserved = (float) $batch->reservedQuantity;
        if ($reserved < $quantity) {
            $fmt = fn (float $n) => floor($n) == $n ? (string) (int) $n : (string) $n;
            throw new BusinessRuleException("La cantidad supera lo reservado. Reservado: {$fmt($reserved)}, Solicitado: {$fmt($quantity)}", 400);
        }
    }

    private function movement(InputBatch $batch, string $type, float $quantity, array $attrs): void
    {
        InputBatchMovement::create([
            'inputId' => $batch->inputId,
            'inputBatchId' => $batch->id,
            'movementType' => $type,
            'quantity' => $quantity,
            'reason' => $attrs['reason'] ?? null,
            'notes' => $attrs['notes'] ?? null,
            'referenceType' => $attrs['referenceType'] ?? null,
            'referenceId' => $attrs['referenceId'] ?? null,
            'userId' => $attrs['userId'] ?? null,
        ]);
    }
}
