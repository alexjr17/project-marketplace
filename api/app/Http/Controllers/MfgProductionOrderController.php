<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Manufacturing\MfgProductionOrderService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

/**
 * Órdenes de producción de la app Fábrica. Valida y responde; las etapas, el lote y el
 * consumo de insumos los maneja MfgProductionOrderService.
 */
class MfgProductionOrderController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgProductionOrderService $orders) {}

    public function index(Request $request)
    {
        return $this->success($this->orders->list([
            'status' => $request->filled('status') ? (string) $request->string('status') : null,
            'search' => $request->filled('search') ? (string) $request->string('search') : null,
        ]));
    }

    public function show(int $id)
    {
        return $this->success($this->orders->detail($id));
    }

    public function generateNumber()
    {
        return $this->success(['code' => $this->orders->peekCode()]);
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

        return $this->created($this->orders->create($data, $request->user()?->id), 'Orden de producción creada');
    }

    public function update(Request $request, int $id)
    {
        $this->orders->findOrFail($id);
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

        return $this->success($this->orders->update($id, $data), 'Orden actualizada');
    }

    /** PDF (dompdf) del reporte/solicitud de una etapa (o de un componente). */
    public function stagePdf(Request $request, int $id, int $stageId)
    {
        [$order, $stage] = $this->orders->stageForPdf($id, $stageId);

        $pdf = Pdf::loadView('pdf.manufacturing-stage', [
            'order' => $order,
            'stage' => $stage,
            'includeInputs' => $request->boolean('includeInputs', true),
            'componentId' => $request->filled('componentId') ? (int) $request->input('componentId') : null,
        ]);

        return $pdf->stream('Reporte_'.$order->code.'.pdf');
    }

    /** Avanza una etapa (con su matriz); si es la última, crea o revierte el lote. */
    public function updateStage(Request $request, int $id, int $stageId)
    {
        $this->orders->assertStageExists($id, $stageId);
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

        $order = $this->orders->updateStage($id, $stageId, $data, $request->user()?->name ?? 'Sistema');

        return $this->success($order, 'Etapa actualizada');
    }

    public function changeStatus(Request $request, int $id)
    {
        $this->orders->findOrFail($id);
        $data = $request->validate(['status' => 'required|in:PROGRAMMED,IN_PROCESS,COMPLETED,CANCELLED']);

        return $this->success($this->orders->changeStatus($id, $data['status']), 'Estado actualizado');
    }

    public function destroy(int $id)
    {
        $this->orders->delete($id);

        return $this->success(null, 'Orden eliminada');
    }

    /** Materiales de la orden (BOM de la referencia) con consumo esperado y sustituciones. */
    public function materials(int $id)
    {
        return $this->success($this->orders->materials($id));
    }

    public function saveSubstitution(Request $request, int $id)
    {
        $this->orders->findOrFail($id);
        $data = $request->validate([
            'originalInputId' => 'required|integer|exists:mfg_inputs,id',
            'substituteInputId' => 'required|integer|different:originalInputId|exists:mfg_inputs,id',
            'colorId' => 'nullable|integer|exists:mfg_colors,id',
        ]);

        return $this->created($this->orders->saveSubstitution($id, $data), 'Sustitución guardada');
    }

    public function deleteSubstitution(int $id, int $subId)
    {
        $this->orders->deleteSubstitution($id, $subId);

        return $this->success(null, 'Sustitución eliminada');
    }
}
