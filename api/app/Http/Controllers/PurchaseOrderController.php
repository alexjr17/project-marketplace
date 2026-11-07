<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Http\Requests\ReceivePurchaseOrderRequest;
use App\Services\Purchasing\PurchaseOrderService;
use Illuminate\Http\Request;

/** Órdenes de compra. Las reglas viven en Purchasing\PurchaseOrderService. */
class PurchaseOrderController extends Controller
{
    use ApiResponse;

    public function __construct(private PurchaseOrderService $purchaseOrders) {}

    public function index(Request $request)
    {
        return $this->success($this->purchaseOrders->list(
            $request->only(['search', 'status', 'supplierId', 'fromDate', 'toDate'])
        ));
    }

    public function stats()
    {
        return $this->success($this->purchaseOrders->stats());
    }

    public function generateNumber()
    {
        return $this->success(['orderNumber' => $this->purchaseOrders->peekNumber()]);
    }

    public function show(int $id)
    {
        return $this->success($this->purchaseOrders->find($id));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplierId' => 'required|integer|exists:suppliers,id',
            'expectedDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            ...$this->itemRules('required'),
        ]);

        $order = $this->purchaseOrders->create($data, $request->user()->id);

        return $this->created($this->purchaseOrders->find($order->id), 'Orden de compra creada');
    }

    public function update(Request $request, int $id)
    {
        // Antes de validar, como siempre: inexistente → 404; fuera de borrador → 400.
        $this->purchaseOrders->assertEditable($id);

        $data = $request->validate([
            'supplierId' => 'nullable|integer|exists:suppliers,id',
            'expectedDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'supplierInvoice' => 'nullable|string',
            'items' => 'nullable|array',
            ...$this->itemRules('required_with:items'),
        ]);

        $this->purchaseOrders->update($id, $data);

        return $this->success($this->purchaseOrders->find($id), 'Orden actualizada');
    }

    public function updateStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => 'required|in:DRAFT,SENT,CONFIRMED,PARTIAL,RECEIVED,CANCELLED',
        ]);

        $this->purchaseOrders->changeStatus($id, $data['status']);

        return $this->success($this->purchaseOrders->find($id), 'Estado actualizado');
    }

    public function receive(ReceivePurchaseOrderRequest $request, int $id)
    {
        $this->purchaseOrders->receive($id, $request->validated('items'), $request->user()->id);

        return $this->success($this->purchaseOrders->find($id), 'Items recibidos');
    }

    public function destroy(Request $request, int $id)
    {
        // ?force=1 (solo admin): permite eliminar órdenes en cualquier estado.
        $this->purchaseOrders->delete($id, $request->boolean('force'));

        return $this->success(null, 'Orden eliminada correctamente');
    }

    /** Reglas de los ítems; $qtyRule = 'required' al crear, 'required_with:items' al editar. */
    private function itemRules(string $qtyRule): array
    {
        return [
            'items.*.variantId' => 'nullable|integer',
            'items.*.inputId' => 'nullable|integer',
            'items.*.inputVariantId' => 'nullable|integer',
            'items.*.description' => 'nullable|string',
            'items.*.quantity' => "{$qtyRule}|numeric|min:0",
            'items.*.unitCost' => "{$qtyRule}|numeric|min:0",
            'items.*.notes' => 'nullable|string',
        ];
    }
}
