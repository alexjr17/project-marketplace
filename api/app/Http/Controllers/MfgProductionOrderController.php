<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgLot;
use App\Models\MfgOrderInputSubstitution;
use App\Models\MfgProcess;
use App\Models\MfgProductionOrder;
use App\Models\MfgProductionOrderStage;
use App\Models\MfgProductMovement;
use App\Models\MfgReferenceMaterial;
use App\Models\MfgWarehouse;
use App\Models\MfgWarehouseStock;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Órdenes de producción manuales de la app Fábrica. Al crear una orden se
 * generan automáticamente sus etapas a partir del catálogo de procesos activos
 * (en su orden). El avance se lleva etapa por etapa.
 */
class MfgProductionOrderController extends Controller
{
    use ApiResponse;

    private const RELATIONS = [
        'reference:id,code,name,imagePath,garmentTypeId',
        'reference.garmentType:id,code,name',
        'reference.components:id,referenceId,position,description',
        'reference.materials:id,referenceId,inputId,colorId,componentId,consumption,unitValue',
        'reference.materials.input:id,code,name,unitOfMeasure,inputTypeId',
        'reference.materials.color:id,name,hexCode',
        'warehouse:id,name',
        'collection:id,name,year,semester',
        'substitutions.originalInput:id,code,name',
        'substitutions.substituteInput:id,code,name',
        'substitutions.color:id,name,hexCode',
        'items.color:id,name,hexCode',
        'items.size:id,name,abbreviation,sortOrder',
        'stages.process:id,name,sequence,type',
        'stages.workshop:id,name,type',
        'stages.cells',
        'stages.consumptions.input:id,code,name,unitOfMeasure',
        'stages.consumptions.color:id,name,hexCode',
        'stages.stageComponents.workshop:id,name,type',
        'stages.stageComponents.component:id,position,description',
        'lots.warehouse:id,name',
        'lots.items.color:id,name,hexCode',
        'lots.items.size:id,name,abbreviation,sortOrder',
    ];

    public function index(Request $request)
    {
        $query = MfgProductionOrder::with(['reference:id,code,name', 'warehouse:id,name', 'collection:id,name,year,semester'])
            ->withCount('items')
            ->orderByDesc('createdAt');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where('code', 'like', $term);
        }

        return $this->success($query->get());
    }

    public function show(int $id)
    {
        $order = MfgProductionOrder::with(self::RELATIONS)->find($id);
        if (! $order) {
            return $this->error('Orden no encontrada', 404);
        }
        $this->attachStageMatrices($order);

        return $this->success($order);
    }

    /**
     * Ordena las etapas y adjunta a cada una:
     *   - programmed: matriz programada (cascada: 1ª = matriz de la orden;
     *     siguientes = completadas de la última etapa cerrada anterior).
     *   - canStart: si se puede iniciar (todas menos la última en paralelo;
     *     la última solo cuando las anteriores están COMPLETED/SKIPPED).
     */
    private function attachStageMatrices(MfgProductionOrder $order): void
    {
        $stages = $order->stages->sortBy('sequence')->values();

        // Matriz base de la orden.
        $orderMatrix = $order->items->map(fn ($it) => [
            'colorId' => $it->colorId, 'sizeId' => $it->sizeId, 'quantity' => $it->quantity,
        ])->values()->all();

        $lastCompleted = null;         // matriz de completadas de la última etapa cerrada

        foreach ($stages as $st) {
            // Cualquier etapa puede iniciarse sin depender de las anteriores (paridad con fabrica-ropa).
            $st->programmed = $lastCompleted ?? $orderMatrix;
            $st->canStart = true;

            if (in_array($st->status, ['COMPLETED', 'SKIPPED'])) {
                // Si cerró con matriz, esa alimenta la siguiente; si no, arrastra la programada.
                $cells = $st->cells->map(fn ($c) => ['colorId' => $c->colorId, 'sizeId' => $c->sizeId, 'quantity' => $c->quantity])->all();
                $lastCompleted = ! empty($cells) ? $cells : $st->programmed;
            }
        }

        $order->setRelation('stages', $stages);
    }

    public function generateNumber()
    {
        return $this->success(['code' => MfgProductionOrder::nextCode()]);
    }

    /** El semestre se toma de la colección (que ya incluye año+semestre). */
    private function semesterFromCollection(?int $collectionId): ?string
    {
        return $collectionId ? \App\Models\MfgCollection::whereKey($collectionId)->value('semester') : null;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'referenceId' => 'required|integer|exists:mfg_references,id',
            'warehouseId' => 'nullable|integer|exists:mfg_warehouses,id',
            'collectionId' => 'nullable|integer|exists:mfg_collections,id',
            'semester' => 'nullable|string|max:2',
            'market' => 'nullable|in:NATIONAL,EXPORT',
            'internalCode' => 'nullable|string|max:50',
            'scheduledAt' => 'nullable|date',
            'estimatedDeliveryAt' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'items.*.sizeId' => 'required|integer|exists:mfg_sizes,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        $semester = $this->semesterFromCollection($data['collectionId'] ?? null) ?? ($data['semester'] ?? null);
        $order = DB::transaction(fn () => MfgProductionOrder::createForReference(
            $data['referenceId'],
            $data['items'],
            [
                'warehouseId' => $data['warehouseId'] ?? null,
                'collectionId' => $data['collectionId'] ?? null,
                'semester' => $semester,
                'market' => $data['market'] ?? 'NATIONAL',
                'internalCode' => $data['internalCode'] ?? null,
                'scheduledAt' => $data['scheduledAt'] ?? null,
                'estimatedDeliveryAt' => $data['estimatedDeliveryAt'] ?? null,
                'notes' => $data['notes'] ?? null,
                'createdBy' => $request->user()?->id,
            ],
        ));

        return $this->created($order->load(self::RELATIONS), 'Orden de producción creada');
    }

    public function update(Request $request, int $id)
    {
        $order = MfgProductionOrder::find($id);
        if (! $order) {
            return $this->error('Orden no encontrada', 404);
        }

        $data = $request->validate([
            'referenceId' => 'nullable|integer|exists:mfg_references,id',
            'warehouseId' => 'nullable|integer|exists:mfg_warehouses,id',
            'collectionId' => 'nullable|integer|exists:mfg_collections,id',
            'semester' => 'nullable|string|max:2',
            'market' => 'nullable|in:NATIONAL,EXPORT',
            'internalCode' => 'nullable|string|max:50',
            'scheduledAt' => 'nullable|date',
            'estimatedDeliveryAt' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'nullable|array|min:1',
            'items.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'items.*.sizeId' => 'required|integer|exists:mfg_sizes,id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        // La matriz/la referencia solo se editan mientras la orden no esté cerrada.
        $hasItemsOrReference = array_key_exists('items', $data) || array_key_exists('referenceId', $data);
        if ($hasItemsOrReference && in_array($order->status, ['COMPLETED', 'CANCELLED'])) {
            return $this->error('No se puede editar la matriz de una orden '.strtolower($order->status), 422);
        }

        DB::transaction(function () use ($order, $data) {
            if (array_key_exists('referenceId', $data) && $data['referenceId'] !== $order->referenceId) {
                $order->referenceId = $data['referenceId'];
            }
            if (array_key_exists('warehouseId', $data)) {
                $order->warehouseId = $data['warehouseId'];
            }
            if (array_key_exists('collectionId', $data)) {
                $order->collectionId = $data['collectionId'];
            }
            // El semestre se deriva de la colección (que ya incluye año+semestre).
            if (array_key_exists('collectionId', $data) || array_key_exists('semester', $data)) {
                $order->semester = $this->semesterFromCollection($order->collectionId) ?? ($data['semester'] ?? $order->semester);
            }
            if (array_key_exists('market', $data)) {
                $order->market = $data['market'];
            }
            if (array_key_exists('internalCode', $data)) {
                $order->internalCode = $data['internalCode'];
            }
            if (array_key_exists('scheduledAt', $data)) {
                $order->scheduledAt = $data['scheduledAt'] ?: null;
            }
            if (array_key_exists('estimatedDeliveryAt', $data)) {
                $order->estimatedDeliveryAt = $data['estimatedDeliveryAt'] ?: null;
            }
            if (array_key_exists('notes', $data)) {
                $order->notes = $data['notes'];
            }
            $order->save();

            if (array_key_exists('items', $data)) {
                $order->items()->delete();
                foreach ($data['items'] as $it) {
                    if ((int) $it['quantity'] > 0) {
                        $order->items()->create([
                            'colorId' => $it['colorId'],
                            'sizeId' => $it['sizeId'],
                            'quantity' => $it['quantity'],
                        ]);
                    }
                }
            }
        });

        return $this->success($order->load(self::RELATIONS), 'Orden actualizada');
    }

    /** PDF real (dompdf) del reporte/solicitud de una etapa (o de un componente). */
    public function stagePdf(Request $request, int $id, int $stageId)
    {
        $order = MfgProductionOrder::with(self::RELATIONS)->find($id);
        if (! $order) {
            return $this->error('Orden no encontrada', 404);
        }
        $this->attachStageMatrices($order);
        $stage = $order->stages->firstWhere('id', $stageId);
        if (! $stage) {
            return $this->error('Etapa no encontrada', 404);
        }

        $pdf = Pdf::loadView('pdf.manufacturing-stage', [
            'order' => $order,
            'stage' => $stage,
            'includeInputs' => $request->boolean('includeInputs', true),
            'componentId' => $request->filled('componentId') ? (int) $request->input('componentId') : null,
        ]);

        return $pdf->stream('Reporte_'.$order->code.'.pdf');
    }

    /** Avanza una etapa (con su matriz), lleva trazabilidad y, si es la última, crea el lote. */
    public function updateStage(Request $request, int $id, int $stageId)
    {
        $order = MfgProductionOrder::find($id);
        if (! $order) {
            return $this->error('Orden no encontrada', 404);
        }
        $stage = MfgProductionOrderStage::where('productionOrderId', $id)->find($stageId);
        if (! $stage) {
            return $this->error('Etapa no encontrada', 404);
        }

        $data = $request->validate([
            'status' => 'nullable|in:PENDING,IN_PROCESS,COMPLETED,SKIPPED',
            'workshopId' => 'nullable|integer|exists:mfg_workshops,id',
            'assignee' => 'nullable|string|max:120',
            'notes' => 'nullable|string',
            'warehouseId' => 'nullable|integer|exists:mfg_warehouses,id',  // bodega destino del lote
            'cells' => 'nullable|array',
            'cells.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'cells.*.sizeId' => 'required|integer|exists:mfg_sizes,id',
            'cells.*.quantity' => 'required|integer|min:0',
            // Consumo REAL por insumo (y color) que registra el operario (merma/ajuste).
            'consumptions' => 'nullable|array',
            'consumptions.*.inputId' => 'required|integer',
            'consumptions.*.colorId' => 'nullable|integer',
            'consumptions.*.realQty' => 'required|numeric|min:0',
            // Taller por componente (etapa externa): cada componente puede ir a otro taller.
            'stageComponents' => 'nullable|array',
            'stageComponents.*.componentId' => 'required|integer|exists:mfg_reference_components,id',
            'stageComponents.*.workshopId' => 'nullable|integer|exists:mfg_workshops,id',
        ]);

        $userName = $request->user()?->name ?? 'Sistema';

        // No permitir reabrir la última etapa si el producto ya tuvo despachos.
        if (in_array($data['status'] ?? '', ['PENDING', 'IN_PROCESS'], true)
            && $this->isLastStage($order, $stage)
            && $order->lots()->exists()
            && $this->lotsHaveDispatches($order)) {
            return $this->error('No se puede reabrir: el producto de esta orden ya tiene despachos. Anula los despachos primero.', 422);
        }

        DB::transaction(function () use ($order, $stage, $data, $userName) {
            if (array_key_exists('workshopId', $data)) {
                $stage->workshopId = $data['workshopId'];
            }
            if (array_key_exists('assignee', $data)) {
                $stage->assignee = $data['assignee'];
            }
            if (array_key_exists('notes', $data)) {
                $stage->notes = $data['notes'];
            }

            // Matriz de completadas (solo celdas > 0). quantityDone = suma.
            if (array_key_exists('cells', $data)) {
                $stage->cells()->delete();
                $sum = 0;
                foreach ($data['cells'] as $c) {
                    if ((int) $c['quantity'] > 0) {
                        $stage->cells()->create(['colorId' => $c['colorId'], 'sizeId' => $c['sizeId'], 'quantity' => $c['quantity']]);
                        $sum += (int) $c['quantity'];
                    }
                }
                $stage->quantityDone = $sum;
                $stage->save();
                // Consumo de insumos de la etapa (esperado = BOM × producido, según config del proceso).
                $this->computeStageConsumption($order, $stage);
            }

            // Consumo REAL registrado por el operario (sobrescribe el real calculado, deja el esperado).
            if (array_key_exists('consumptions', $data)) {
                foreach ($data['consumptions'] as $rc) {
                    $q = $stage->consumptions()->where('inputId', $rc['inputId']);
                    if (($rc['colorId'] ?? null) !== null) {
                        $q->where('colorId', $rc['colorId']);
                    } else {
                        $q->whereNull('colorId');
                    }
                    $q->update(['realQty' => round((float) $rc['realQty'], 4)]);
                }
            }

            // Taller por componente (etapa externa): reemplaza la asignación.
            if (array_key_exists('stageComponents', $data)) {
                $stage->stageComponents()->delete();
                foreach ($data['stageComponents'] as $sc) {
                    if (! empty($sc['workshopId'])) {
                        $stage->stageComponents()->create([
                            'componentId' => $sc['componentId'],
                            'workshopId' => $sc['workshopId'],
                        ]);
                    }
                }
            }

            // Estado + trazabilidad.
            if (! empty($data['status'])) {
                $status = $data['status'];
                $stage->status = $status;
                if (in_array($status, ['IN_PROCESS', 'COMPLETED', 'SKIPPED']) && ! $stage->startedAt) {
                    $stage->startedAt = now();
                    $stage->startedByName = $userName;
                }
                if (in_array($status, ['COMPLETED', 'SKIPPED'])) {
                    $stage->finishedAt = now();
                    $stage->finishedByName = $userName;
                } elseif ($status === 'PENDING' || $status === 'IN_PROCESS') {
                    $stage->finishedAt = null;
                    $stage->finishedByName = null;
                }
            }
            $stage->save();

            $this->recomputeOrderStatus($order);

            // Cierre → lote (si es la última etapa y quedó COMPLETADA).
            if ($stage->status === 'COMPLETED' && $this->isLastStage($order, $stage)) {
                $this->createLot($order, $stage, $data['warehouseId'] ?? null);
            }
            // Reapertura de la última etapa → revierte lote y descuenta el stock que creó.
            if (in_array($stage->status, ['PENDING', 'IN_PROCESS'], true) && $this->isLastStage($order, $stage) && $order->lots()->exists()) {
                $this->revertLots($order);
            }
        });

        $order->load(self::RELATIONS);
        $this->attachStageMatrices($order);

        return $this->success($order, 'Etapa actualizada');
    }

    private function isLastStage(MfgProductionOrder $order, MfgProductionOrderStage $stage): bool
    {
        $maxSeq = $order->stages()->max('sequence');

        return (int) $stage->sequence === (int) $maxSeq;
    }

    /**
     * Crea el lote de producto terminado desde la matriz completada de la última
     * etapa y llena el stock de la bodega destino.
     */
    private function createLot(MfgProductionOrder $order, MfgProductionOrderStage $stage, ?int $warehouseId): void
    {
        if ($order->lots()->exists()) {
            return; // ya tiene lote
        }
        $cells = $stage->cells()->get();
        if ($cells->isEmpty()) {
            return;
        }

        // Bodega destino: la enviada, la de la orden, o la primera disponible.
        $whId = $warehouseId ?? $order->warehouseId ?? optional(MfgWarehouse::orderBy('id')->first())->id;

        $lot = $order->lots()->create([
            'code' => $this->nextLotCode(),
            'warehouseId' => $whId,
            'status' => 'AVAILABLE',
        ]);
        foreach ($cells as $c) {
            $lot->items()->create([
                'colorId' => $c->colorId,
                'sizeId' => $c->sizeId,
                'quantityProduced' => $c->quantity,
                'quantityAvailable' => $c->quantity,
            ]);
            // Llenar stock de la bodega (referencia × color × talla).
            if ($whId) {
                $stock = MfgWarehouseStock::firstOrNew([
                    'warehouseId' => $whId, 'referenceId' => $order->referenceId,
                    'colorId' => $c->colorId, 'sizeId' => $c->sizeId,
                ]);
                $stock->quantity = ($stock->quantity ?? 0) + $c->quantity;
                $stock->updatedAt = now();
                $stock->save();
            }
            // Kardex: entrada de producto terminado.
            MfgProductMovement::create([
                'referenceId' => $order->referenceId, 'colorId' => $c->colorId, 'sizeId' => $c->sizeId,
                'warehouseId' => $whId, 'lotId' => $lot->id,
                'type' => 'ENTRADA', 'quantity' => $c->quantity,
                'sourceType' => 'LOT', 'sourceId' => $lot->id, 'notes' => 'Lote '.$lot->code,
            ]);
        }
        // Persistir la bodega elegida en la orden.
        if ($whId && $order->warehouseId !== $whId) {
            $order->warehouseId = $whId;
            $order->save();
        }
    }

    /** ¿Algún lote de la orden ya tuvo salidas (despachos)? Bloquea reabrir la etapa. */
    private function lotsHaveDispatches(MfgProductionOrder $order): bool
    {
        foreach ($order->lots()->with('items')->get() as $lot) {
            foreach ($lot->items as $it) {
                if ((int) $it->quantityAvailable < (int) $it->quantityProduced) {
                    return true;
                }
            }
        }

        return false;
    }

    /** Revierte los lotes de la orden: descuenta el stock (saldo disponible) y los elimina. */
    private function revertLots(MfgProductionOrder $order): void
    {
        foreach ($order->lots()->with('items')->get() as $lot) {
            if ($lot->warehouseId) {
                foreach ($lot->items as $it) {
                    $stock = MfgWarehouseStock::where([
                        'warehouseId' => $lot->warehouseId, 'referenceId' => $order->referenceId,
                        'colorId' => $it->colorId, 'sizeId' => $it->sizeId,
                    ])->first();
                    if ($stock) {
                        $stock->quantity = max(0, (int) $stock->quantity - (int) $it->quantityAvailable);
                        $stock->save();
                    }
                }
            }
            // Borra el kardex de entrada de este lote.
            MfgProductMovement::where('sourceType', 'LOT')->where('sourceId', $lot->id)->delete();
            $lot->items()->delete();
            $lot->delete();
        }
    }

    /** Calcula y guarda el consumo esperado de insumos de una etapa (BOM × producido). */
    private function computeStageConsumption(MfgProductionOrder $order, MfgProductionOrderStage $stage): void
    {
        $process = MfgProcess::with('consumptions')->find($stage->processId);
        $typeIds = $process ? $process->consumptions->where('kind', 'TYPE')->pluck('inputTypeId')->filter()->all() : [];
        $inputIds = $process ? $process->consumptions->where('kind', 'INPUT')->pluck('inputId')->filter()->all() : [];

        // Preservar el consumo REAL que el operario ya registró (merma), para no
        // pisarlo al recalcular el esperado cuando cambia la matriz (brecha 1.6).
        $prevReal = [];
        foreach ($stage->consumptions()->get() as $pc) {
            $prevReal[$pc->inputId.'-'.($pc->colorId ?? 0)] = $pc->realQty;
        }

        $stage->consumptions()->delete();
        if (empty($typeIds) && empty($inputIds)) {
            return;
        }

        $materials = MfgReferenceMaterial::with(['input:id,inputTypeId', 'input.inputType:id,consumesByColor'])
            ->where('referenceId', $order->referenceId)->get();

        // Sustituciones de insumos de la orden (original+color → sustituto).
        $subMap = [];
        foreach ($order->substitutions()->get() as $s) {
            $subMap[$s->originalInputId.'-'.($s->colorId ?? 0)] = $s->substituteInputId;
        }

        // Producido por color y total (desde la matriz de la etapa).
        $byColor = [];
        $total = 0;
        foreach ($stage->cells()->get() as $c) {
            $byColor[$c->colorId] = ($byColor[$c->colorId] ?? 0) + $c->quantity;
            $total += $c->quantity;
        }

        $register = function ($m, $colorId, $qty) use ($stage, $subMap, $prevReal) {
            if ($qty <= 0) {
                return;
            }
            $inputId = $subMap[$m->inputId.'-'.($colorId ?? 0)] ?? ($subMap[$m->inputId.'-0'] ?? $m->inputId);
            $expected = round((float) $m->consumption * $qty, 4);
            $key = $inputId.'-'.($colorId ?? 0);
            $stage->consumptions()->create([
                'inputId' => $inputId,
                'colorId' => $colorId,
                'expectedQty' => $expected,
                // Si ya había un real registrado para este insumo/color, se conserva.
                'realQty' => array_key_exists($key, $prevReal) ? $prevReal[$key] : $expected,
                'unitValue' => $m->unitValue ?? 0,
            ]);
        };

        foreach ($materials as $m) {
            $matches = in_array($m->input?->inputTypeId, $typeIds, true) || in_array($m->inputId, $inputIds, true);
            if (! $matches) {
                continue;
            }
            // Tela (por color) sin color fijo → una fila de consumo por color producido.
            if (($m->input?->inputType?->consumesByColor) && ! $m->colorId) {
                foreach ($byColor as $cid => $qty) {
                    $register($m, $cid, $qty);
                }
            } else {
                $register($m, $m->colorId, $m->colorId ? ($byColor[$m->colorId] ?? 0) : $total);
            }
        }
    }

    private function nextLotCode(): string
    {
        $year = now()->year;
        $prefix = 'L-'.$year.'-';
        $last = MfgLot::where('code', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING_INDEX(code, "-", -1) AS UNSIGNED) DESC')
            ->first();
        $n = $last ? ((int) substr(strrchr($last->code, '-'), 1)) + 1 : 1;

        return sprintf('%s%04d', $prefix, $n);
    }

    public function changeStatus(Request $request, int $id)
    {
        $order = MfgProductionOrder::find($id);
        if (! $order) {
            return $this->error('Orden no encontrada', 404);
        }
        $data = $request->validate(['status' => 'required|in:PROGRAMMED,IN_PROCESS,COMPLETED,CANCELLED']);
        $order->status = $data['status'];
        if ($data['status'] === 'COMPLETED' && ! $order->finishedAt) {
            $order->finishedAt = now();
        }
        $order->save();

        return $this->success($order->load(self::RELATIONS), 'Estado actualizado');
    }

    public function destroy(int $id)
    {
        $order = MfgProductionOrder::find($id);
        if (! $order) {
            return $this->error('Orden no encontrada', 404);
        }
        $order->delete();

        return $this->success(null, 'Orden eliminada');
    }

    /** Materiales de la orden (BOM de la referencia) con consumo esperado y sustituciones. */
    public function materials(int $id)
    {
        $order = MfgProductionOrder::with(['items', 'substitutions'])->find($id);
        if (! $order) {
            return $this->error('Orden no encontrada', 404);
        }
        $materials = MfgReferenceMaterial::with([
            'input:id,code,name,unitOfMeasure,inputTypeId', 'input.inputType:id,name,classification,consumesByColor',
            'color:id,name,hexCode',
        ])->where('referenceId', $order->referenceId)->get();

        $byColor = [];
        $total = 0;
        $colorObjs = [];
        foreach ($order->items as $it) {
            $byColor[$it->colorId] = ($byColor[$it->colorId] ?? 0) + $it->quantity;
            $total += $it->quantity;
            if ($it->color) {
                $colorObjs[$it->colorId] = $it->color;
            }
        }
        $subMap = [];
        foreach ($order->substitutions as $s) {
            $subMap[$s->originalInputId.'-'.($s->colorId ?? 0)] = $s;
        }
        $row = fn ($m, $color, $cid, $qty) => [
            'materialId' => $m->id,
            'componentId' => $m->componentId,
            'input' => $m->input,
            'color' => $color,
            'consumption' => $m->consumption,
            'unitValue' => $m->unitValue,
            'expected' => round((float) $m->consumption * $qty, 4),
            'substitute' => optional($subMap[$m->inputId.'-'.$cid] ?? null)->substituteInput,
        ];

        $out = collect();
        foreach ($materials as $m) {
            // Telas (tipo "por color") sin color fijo → una fila por color de la orden.
            if (($m->input?->inputType?->consumesByColor) && ! $m->colorId) {
                foreach ($colorObjs as $cid => $color) {
                    if (($byColor[$cid] ?? 0) > 0) {
                        $out->push($row($m, $color, $cid, $byColor[$cid]));
                    }
                }
            } else {
                $qty = $m->colorId ? ($byColor[$m->colorId] ?? 0) : $total;
                $out->push($row($m, $m->color, $m->colorId ?? 0, $qty));
            }
        }

        return $this->success(['total' => $total, 'materials' => $out->values()]);
    }

    public function saveSubstitution(Request $request, int $id)
    {
        $order = MfgProductionOrder::find($id);
        if (! $order) {
            return $this->error('Orden no encontrada', 404);
        }
        $data = $request->validate([
            'originalInputId' => 'required|integer|exists:mfg_inputs,id',
            'substituteInputId' => 'required|integer|different:originalInputId|exists:mfg_inputs,id',
            'colorId' => 'nullable|integer|exists:mfg_colors,id',
        ]);
        $sub = MfgOrderInputSubstitution::updateOrCreate(
            ['productionOrderId' => $id, 'originalInputId' => $data['originalInputId'], 'colorId' => $data['colorId'] ?? null],
            ['substituteInputId' => $data['substituteInputId']]
        );

        return $this->created($sub->load('originalInput:id,code,name', 'substituteInput:id,code,name', 'color:id,name,hexCode'), 'Sustitución guardada');
    }

    public function deleteSubstitution(int $id, int $subId)
    {
        $sub = MfgOrderInputSubstitution::where('productionOrderId', $id)->find($subId);
        if (! $sub) {
            return $this->error('Sustitución no encontrada', 404);
        }
        $sub->delete();

        return $this->success(null, 'Sustitución eliminada');
    }

    /** Recalcula el estado de la orden según sus etapas. */
    private function recomputeOrderStatus(MfgProductionOrder $order): void
    {
        if (in_array($order->status, ['CANCELLED'])) {
            return;
        }
        $stages = $order->stages()->get();
        if ($stages->isEmpty()) {
            return;
        }

        $allDone = $stages->every(fn ($s) => in_array($s->status, ['COMPLETED', 'SKIPPED']));
        $anyStarted = $stages->contains(fn ($s) => in_array($s->status, ['IN_PROCESS', 'COMPLETED', 'SKIPPED']));

        if ($allDone) {
            $order->status = 'COMPLETED';
            $order->finishedAt = $order->finishedAt ?: now();
        } elseif ($anyStarted) {
            $order->status = 'IN_PROCESS';
            $order->startedAt = $order->startedAt ?: now();
        } else {
            $order->status = 'PROGRAMMED';
        }
        $order->save();
    }

}
