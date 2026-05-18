<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Input;
use App\Models\InputBatch;
use App\Models\InputBatchMovement;
use App\Models\InventoryCount;
use App\Models\InventoryCountItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryCountController extends Controller
{
    use ApiResponse;

    /** Da formato a un conteo, normalizando los numéricos. */
    private function formatCount(InventoryCount $count): array
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

    /** Genera el siguiente número de conteo (INV-AAAA-NNNN). */
    private function generateCountNumber(): string
    {
        $year = date('Y');
        $count = InventoryCount::where('countNumber', 'like', "INV-{$year}%")->count();

        return sprintf('INV-%s-%04d', $year, $count + 1);
    }

    /** GET /api/inventory-counts */
    public function index(Request $request)
    {
        $query = InventoryCount::with('items');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('fromDate')) {
            $query->where('countDate', '>=', $request->query('fromDate'));
        }
        if ($request->filled('toDate')) {
            $query->where('countDate', '<=', $request->query('toDate'));
        }

        $counts = $query->orderByDesc('createdAt')->get();

        return $this->success($counts->map(fn ($c) => $this->formatCount($c)));
    }

    /** GET /api/inventory-counts/stats */
    public function stats()
    {
        $byStatus = [
            'DRAFT' => InventoryCount::where('status', 'DRAFT')->count(),
            'IN_PROGRESS' => InventoryCount::where('status', 'IN_PROGRESS')->count(),
            'PENDING_APPROVAL' => InventoryCount::where('status', 'PENDING_APPROVAL')->count(),
            'APPROVED' => InventoryCount::where('status', 'APPROVED')->count(),
            'CANCELLED' => InventoryCount::where('status', 'CANCELLED')->count(),
        ];

        $lastCount = InventoryCount::where('status', 'APPROVED')
            ->orderByDesc('approvedAt')->value('approvedAt');

        return $this->success([
            'total' => array_sum($byStatus),
            'byStatus' => $byStatus,
            'lastCount' => $lastCount,
        ]);
    }

    /** GET /api/inventory-counts/{id} */
    public function show(int $id)
    {
        $count = InventoryCount::with(['items' => fn ($q) => $q->orderBy('inputName')])->find($id);
        if (! $count) {
            return $this->error('Conteo de inventario no encontrado', 404);
        }

        return $this->success($this->formatCount($count));
    }

    /** POST /api/inventory-counts */
    public function store(Request $request)
    {
        $data = $request->validate([
            'countType' => 'required|in:FULL,PARTIAL',
            'countDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'inputIds' => 'nullable|array',
            'inputIds.*' => 'integer',
        ]);

        $inputsQuery = Input::where('isActive', true);
        if ($data['countType'] === 'PARTIAL' && ! empty($data['inputIds'])) {
            $inputsQuery->whereIn('id', $data['inputIds']);
        }
        $inputs = $inputsQuery->get();

        if ($inputs->isEmpty()) {
            return $this->error('No hay insumos para contar', 400);
        }

        $user = $request->user();
        $count = DB::transaction(function () use ($data, $inputs, $user) {
            $count = InventoryCount::create([
                'countNumber' => $this->generateCountNumber(),
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

        return $this->created($this->formatCount($count->load('items')), 'Conteo de inventario creado correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/start */
    public function start(int $id)
    {
        $count = InventoryCount::find($id);
        if (! $count) {
            return $this->error('Conteo de inventario no encontrado', 404);
        }
        if ($count->status !== 'DRAFT') {
            return $this->error('Solo se pueden iniciar conteos en estado borrador', 400);
        }

        $count->status = 'IN_PROGRESS';
        $count->save();

        return $this->success($this->formatCount($count->load('items')), 'Conteo iniciado correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/items/{itemId} */
    public function updateItemCount(Request $request, int $id, int $itemId)
    {
        $data = $request->validate([
            'countedQuantity' => 'required|numeric',
            'notes' => 'nullable|string',
        ]);

        $count = InventoryCount::find($id);
        if (! $count) {
            return $this->error('Conteo de inventario no encontrado', 404);
        }
        if (! in_array($count->status, ['DRAFT', 'IN_PROGRESS'], true)) {
            return $this->error('No se pueden modificar conteos que no estén en borrador o en progreso', 400);
        }

        $item = InventoryCountItem::where('id', $itemId)->where('inventoryCountId', $id)->first();
        if (! $item) {
            return $this->error('Item de conteo no encontrado', 404);
        }

        $difference = $data['countedQuantity'] - (float) $item->systemQuantity;
        $item->countedQuantity = $data['countedQuantity'];
        $item->difference = $difference;
        $item->differenceValue = $difference * (float) $item->unitCost;
        $item->isCounted = true;
        $item->notes = $data['notes'] ?? null;
        $item->save();

        if ($count->status === 'DRAFT') {
            $count->status = 'IN_PROGRESS';
            $count->save();
        }

        return $this->success($this->formatItem($item), 'Cantidad actualizada correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/submit */
    public function submit(int $id)
    {
        $count = InventoryCount::with('items')->find($id);
        if (! $count) {
            return $this->error('Conteo de inventario no encontrado', 404);
        }
        if ($count->status !== 'IN_PROGRESS') {
            return $this->error('Solo se pueden enviar a aprobación conteos en progreso', 400);
        }

        $uncounted = $count->items->filter(fn ($i) => ! $i->isCounted)->count();
        if ($uncounted > 0) {
            return $this->error("Hay {$uncounted} item(s) sin contar", 400);
        }

        $itemsWithDiff = $count->items->filter(
            fn ($i) => $i->difference !== null && (float) $i->difference !== 0.0
        )->count();
        $totalDiffValue = $count->items->reduce(
            fn ($sum, $i) => $sum + ($i->differenceValue !== null ? abs((float) $i->differenceValue) : 0),
            0
        );

        $count->status = 'PENDING_APPROVAL';
        $count->itemsWithDiff = $itemsWithDiff;
        $count->totalDiffValue = $totalDiffValue;
        $count->save();

        return $this->success($this->formatCount($count->load('items')), 'Conteo enviado a aprobación correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/approve */
    public function approve(Request $request, int $id)
    {
        $count = InventoryCount::with('items')->find($id);
        if (! $count) {
            return $this->error('Conteo de inventario no encontrado', 404);
        }
        if ($count->status !== 'PENDING_APPROVAL') {
            return $this->error('Solo se pueden aprobar conteos pendientes de aprobación', 400);
        }

        $user = $request->user();
        DB::transaction(function () use ($count, $user) {
            foreach ($count->items as $item) {
                $difference = $item->difference !== null ? (float) $item->difference : 0.0;
                if ($difference === 0.0) {
                    continue;
                }

                Input::where('id', $item->inputId)->increment('currentStock', $difference);

                $batch = InputBatch::where('inputId', $item->inputId)
                    ->where('isActive', true)
                    ->orderByDesc('createdAt')->first();

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
            }

            $count->status = 'APPROVED';
            $count->approvedById = $user->id;
            $count->approvedByName = $user->name;
            $count->approvedAt = now();
            $count->save();
        });

        return $this->success($this->formatCount($count->load('items')), 'Conteo aprobado y ajustes aplicados correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/cancel */
    public function cancel(int $id)
    {
        $count = InventoryCount::find($id);
        if (! $count) {
            return $this->error('Conteo de inventario no encontrado', 404);
        }
        if ($count->status === 'APPROVED') {
            return $this->error('No se pueden cancelar conteos aprobados', 400);
        }

        $count->status = 'CANCELLED';
        $count->save();

        return $this->success($this->formatCount($count->load('items')), 'Conteo cancelado correctamente');
    }

    /** DELETE /api/inventory-counts/{id} */
    public function destroy(int $id)
    {
        $count = InventoryCount::find($id);
        if (! $count) {
            return $this->error('Conteo de inventario no encontrado', 404);
        }
        if (! in_array($count->status, ['DRAFT', 'CANCELLED'], true)) {
            return $this->error('Solo se pueden eliminar conteos en borrador o cancelados', 400);
        }

        $count->delete();

        return $this->success(null, 'Conteo de inventario eliminado correctamente');
    }
}
