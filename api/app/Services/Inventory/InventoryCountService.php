<?php

namespace App\Services\Inventory;

use App\Exceptions\BusinessRuleException;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InventoryCount;
use App\Models\InventoryCountItem;
use App\Models\User;
use App\Services\NumberSequenceService;
use Illuminate\Support\Facades\DB;

/**
 * Conteos físicos de insumos: borrador → en progreso → pendiente de aprobación → aprobado
 * (o cancelado). Al aprobar, la diferencia de cada ítem se aplica al lote activo más reciente
 * (o a un lote de ajuste nuevo) y el stock del insumo se recalcula con sus lotes.
 */
class InventoryCountService
{
    private const STATUSES = ['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'];

    public function __construct(private NumberSequenceService $numbers, private InputBatchService $batches) {}

    public function list(array $filters)
    {
        $query = InventoryCount::with('items');
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['fromDate'])) {
            $query->where('countDate', '>=', $filters['fromDate']);
        }
        if (! empty($filters['toDate'])) {
            $query->where('countDate', '<=', $filters['toDate']);
        }

        return $query->orderByDesc('createdAt')->get()->map(fn ($c) => $this->format($c));
    }

    public function stats(): array
    {
        $byStatus = [];
        foreach (self::STATUSES as $status) {
            $byStatus[$status] = InventoryCount::where('status', $status)->count();
        }

        return [
            'total' => array_sum($byStatus),
            'byStatus' => $byStatus,
            'lastCount' => InventoryCount::where('status', 'APPROVED')->orderByDesc('approvedAt')->value('approvedAt'),
        ];
    }

    public function detail(int $id): array
    {
        $count = InventoryCount::with(['items' => fn ($q) => $q->orderBy('inputName')])->find($id);
        if (! $count) {
            throw $this->notFound();
        }

        return $this->format($count);
    }

    /** Crea el conteo con una foto del stock de los insumos activos (todos o los elegidos). */
    public function create(array $data, User $user): array
    {
        $inputsQuery = Input::where('isActive', true);
        if ($data['countType'] === 'PARTIAL' && ! empty($data['inputIds'])) {
            $inputsQuery->whereIn('id', $data['inputIds']);
        }
        $inputs = $inputsQuery->get();
        if ($inputs->isEmpty()) {
            throw new BusinessRuleException('No hay insumos para contar', 400);
        }

        $count = DB::transaction(function () use ($data, $inputs, $user) {
            $count = InventoryCount::create([
                'countNumber' => $this->numbers->next(NumberSequenceService::INVENTORY_COUNT),
                'countType' => $data['countType'],
                'status' => 'DRAFT',
                'countDate' => $data['countDate'] ?? now(),
                'countedById' => $user->id,
                'countedByName' => $user->name,
                'notes' => $data['notes'] ?? null,
                'totalItems' => $inputs->count(),
                'itemsWithDiff' => 0,
                'totalDiffValue' => 0,
            ]);

            foreach ($inputs as $input) {
                InventoryCountItem::create([
                    'inventoryCountId' => $count->id,
                    'inputId' => $input->id,
                    'inputCode' => $input->code,
                    'inputName' => $input->name,
                    'unitOfMeasure' => $input->unitOfMeasure,
                    'unitCost' => $input->unitCost,
                    'systemQuantity' => $input->currentStock,
                    'isCounted' => false,
                ]);
            }

            return $count;
        });

        return $this->format($count->load('items'));
    }

    public function start(int $id): array
    {
        $count = $this->find($id);
        if ($count->status !== 'DRAFT') {
            throw new BusinessRuleException('Solo se pueden iniciar conteos en estado borrador', 400);
        }
        $count->status = 'IN_PROGRESS';
        $count->save();

        return $this->format($count->load('items'));
    }

    /** Registra lo contado de un ítem; contar en borrador pasa el conteo a en progreso. */
    public function countItem(int $id, int $itemId, float $countedQuantity, ?string $notes): array
    {
        $count = $this->find($id);
        if (! in_array($count->status, ['DRAFT', 'IN_PROGRESS'], true)) {
            throw new BusinessRuleException('No se pueden modificar conteos que no estén en borrador o en progreso', 400);
        }
        $item = InventoryCountItem::where('id', $itemId)->where('inventoryCountId', $id)->first();
        if (! $item) {
            throw new BusinessRuleException('Item de conteo no encontrado', 404);
        }

        DB::transaction(function () use ($count, $item, $countedQuantity, $notes) {
            $difference = $countedQuantity - (float) $item->systemQuantity;
            $item->countedQuantity = $countedQuantity;
            $item->difference = $difference;
            $item->differenceValue = $difference * (float) $item->unitCost;
            $item->isCounted = true;
            $item->notes = $notes;
            $item->save();

            if ($count->status === 'DRAFT') {
                $count->status = 'IN_PROGRESS';
                $count->save();
            }
        });

        return $this->formatItem($item);
    }

    public function submit(int $id): array
    {
        $count = $this->find($id, withItems: true);
        if ($count->status !== 'IN_PROGRESS') {
            throw new BusinessRuleException('Solo se pueden enviar a aprobación conteos en progreso', 400);
        }
        $uncounted = $count->items->filter(fn ($i) => ! $i->isCounted)->count();
        if ($uncounted > 0) {
            throw new BusinessRuleException("Hay {$uncounted} item(s) sin contar", 400);
        }

        $count->status = 'PENDING_APPROVAL';
        $count->itemsWithDiff = $count->items->filter(fn ($i) => $i->difference !== null && (float) $i->difference !== 0.0)->count();
        $count->totalDiffValue = $count->items->reduce(
            fn ($sum, $i) => $sum + ($i->differenceValue !== null ? abs((float) $i->differenceValue) : 0),
            0
        );
        $count->save();

        return $this->format($count->load('items'));
    }

    /**
     * Aprueba y aplica las diferencias. Se aplica la diferencia contra la foto del conteo
     * (no se fija lo contado): así no se pierde lo que entró o salió mientras se contaba.
     */
    public function approve(int $id, User $user): array
    {
        $count = $this->find($id, withItems: true);
        if ($count->status !== 'PENDING_APPROVAL') {
            throw new BusinessRuleException('Solo se pueden aprobar conteos pendientes de aprobación', 400);
        }

        DB::transaction(function () use ($count, $user) {
            foreach ($count->items as $item) {
                $difference = $item->difference !== null ? (float) $item->difference : 0.0;
                if ($difference === 0.0) {
                    continue;
                }

                $batch = InputBatch::where('inputId', $item->inputId)->where('isActive', true)
                    ->orderByDesc('createdAt')->lockForUpdate()->first();
                if (! $batch) {
                    $counted = $item->countedQuantity !== null ? (float) $item->countedQuantity : 0;
                    $batch = InputBatch::create([
                        'inputId' => $item->inputId,
                        'batchNumber' => "AJUSTE-{$count->countNumber}",
                        'initialQuantity' => $counted,
                        'currentQuantity' => $counted,
                        'reservedQuantity' => 0,
                        'unitCost' => $item->unitCost,
                        'totalCost' => $counted * (float) $item->unitCost,
                        'isActive' => true,
                        'notes' => "Lote creado automáticamente por conteo físico {$count->countNumber}",
                    ]);
                } else {
                    $batch->increment('currentQuantity', $difference);
                }

                InputBatchMovement::create([
                    'inputId' => $item->inputId,
                    'inputBatchId' => $batch->id,
                    'movementType' => 'AJUSTE',
                    'quantity' => $difference,
                    'referenceType' => 'inventory_count',
                    'referenceId' => $count->id,
                    'reason' => "Ajuste por conteo físico {$count->countNumber}",
                    'notes' => $item->notes,
                    'userId' => $user->id,
                ]);
                $this->batches->recalcInputStock($item->inputId);
            }

            $count->status = 'APPROVED';
            $count->approvedById = $user->id;
            $count->approvedByName = $user->name;
            $count->approvedAt = now();
            $count->save();
        });

        return $this->format($count->load('items'));
    }

    public function cancel(int $id): array
    {
        $count = $this->find($id);
        if ($count->status === 'APPROVED') {
            throw new BusinessRuleException('No se pueden cancelar conteos aprobados', 400);
        }
        $count->status = 'CANCELLED';
        $count->save();

        return $this->format($count->load('items'));
    }

    public function delete(int $id): void
    {
        $count = $this->find($id);
        if (! in_array($count->status, ['DRAFT', 'CANCELLED'], true)) {
            throw new BusinessRuleException('Solo se pueden eliminar conteos en borrador o cancelados', 400);
        }
        $count->delete();
    }

    // ==================== Utilidades ====================

    private function find(int $id, bool $withItems = false): InventoryCount
    {
        $count = $withItems ? InventoryCount::with('items')->find($id) : InventoryCount::find($id);
        if (! $count) {
            throw $this->notFound();
        }

        return $count;
    }

    private function notFound(): BusinessRuleException
    {
        return new BusinessRuleException('Conteo de inventario no encontrado', 404);
    }

    private function format(InventoryCount $count): array
    {
        return [
            'id' => $count->id,
            'countNumber' => $count->countNumber,
            'countType' => $count->countType,
            'status' => $count->status,
            'countDate' => $count->countDate,
            'countedById' => $count->countedById,
            'countedByName' => $count->countedByName,
            'approvedById' => $count->approvedById,
            'approvedByName' => $count->approvedByName,
            'approvedAt' => $count->approvedAt,
            'notes' => $count->notes,
            'totalItems' => (int) $count->totalItems,
            'itemsWithDiff' => (int) $count->itemsWithDiff,
            'totalDiffValue' => (float) $count->totalDiffValue,
            'items' => $count->items->map(fn ($item) => $this->formatItem($item))->all(),
            'createdAt' => $count->createdAt,
            'updatedAt' => $count->updatedAt,
        ];
    }

    private function formatItem(InventoryCountItem $item): array
    {
        return [
            'id' => $item->id,
            'inputId' => $item->inputId,
            'inputCode' => $item->inputCode,
            'inputName' => $item->inputName,
            'unitOfMeasure' => $item->unitOfMeasure,
            'unitCost' => (float) $item->unitCost,
            'systemQuantity' => (float) $item->systemQuantity,
            'countedQuantity' => $item->countedQuantity !== null ? (float) $item->countedQuantity : null,
            'difference' => $item->difference !== null ? (float) $item->difference : null,
            'differenceValue' => $item->differenceValue !== null ? (float) $item->differenceValue : null,
            'isCounted' => (bool) $item->isCounted,
            'notes' => $item->notes,
        ];
    }
}
