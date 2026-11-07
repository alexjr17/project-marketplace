<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Manufacturing\MfgDispatchService;
use Illuminate\Http\Request;

/**
 * Despachos / entregas de producto terminado de Fábrica. Valida y responde; el FIFO de lotes,
 * la bodega, el kardex y el estado del pedido los maneja MfgDispatchService.
 */
class MfgDispatchController extends Controller
{
    use ApiResponse;

    public function __construct(private MfgDispatchService $dispatches) {}

    public function index(Request $request)
    {
        return $this->success($this->dispatches->list([
            'status' => $request->filled('status') ? (string) $request->string('status') : null,
            'search' => $request->filled('search') ? (string) $request->string('search') : null,
        ]));
    }

    public function show(int $id)
    {
        return $this->success($this->dispatches->detail($id));
    }

    public function generateNumber()
    {
        return $this->success(['code' => $this->dispatches->peekCode()]);
    }

    /** Existencias disponibles de producto terminado (suma de lotes con saldo). */
    public function available(Request $request)
    {
        return $this->success($this->dispatches->available($request->filled('warehouseId') ? $request->integer('warehouseId') : null));
    }

    /** Pendiente por despachar de un pedido (pedido − ya despachado confirmado). */
    public function purchaseOrderPending(int $poId)
    {
        return $this->success($this->dispatches->purchaseOrderPending($poId));
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);

        return $this->created($this->dispatches->create($data, $request->user()?->id), 'Despacho creado');
    }

    public function update(Request $request, int $id)
    {
        $this->dispatches->assertDraft($id);
        $data = $this->validateData($request);

        return $this->success($this->dispatches->update($id, $data), 'Despacho actualizado');
    }

    public function confirm(Request $request, int $id)
    {
        return $this->success($this->dispatches->confirm($id, $request->user()?->id), 'Despacho confirmado');
    }

    public function cancel(int $id)
    {
        return $this->success($this->dispatches->cancel($id), 'Despacho anulado');
    }

    /** Registra la remisión / facturación del despacho (puede ser post-confirmación). */
    public function billing(Request $request, int $id)
    {
        $this->dispatches->assertBillable($id);
        $data = $request->validate([
            'shipmentNumber' => 'nullable|string|max:60',
            'invoiceNumber' => 'nullable|string|max:60',
            'invoicedAt' => 'nullable|date',
        ]);

        return $this->success($this->dispatches->billing($id, $data), 'Facturación actualizada');
    }

    public function destroy(int $id)
    {
        $this->dispatches->delete($id);

        return $this->success(null, 'Despacho eliminado');
    }

    private function validateData(Request $request): array
    {
        return $request->validate([
            'clientId' => 'nullable|integer|exists:mfg_clients,id',
            'purchaseOrderId' => 'nullable|integer|exists:mfg_purchase_orders,id',
            'warehouseId' => 'nullable|integer|exists:mfg_warehouses,id',
            'type' => 'nullable|in:VENTA,CONSIGNACION,TRASLADO,MUESTRA',
            'shipmentNumber' => 'nullable|string|max:60',
            'invoiceNumber' => 'nullable|string|max:60',
            'invoicedAt' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.referenceId' => 'required|integer|exists:mfg_references,id',
            'items.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'items.*.sizeId' => 'required|integer|exists:mfg_sizes,id',
            'items.*.quantity' => 'required|integer|min:0',
        ]);
    }
}
