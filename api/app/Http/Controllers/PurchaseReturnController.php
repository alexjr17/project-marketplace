<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Purchasing\PurchaseReturnService;
use Illuminate\Http\Request;

/**
 * Devoluciones de compra. Cada devolución nace de una orden de compra recibida y revierte
 * el stock que entró por ella (Purchasing\PurchaseReturnService).
 */
class PurchaseReturnController extends Controller
{
    use ApiResponse;

    public function __construct(private PurchaseReturnService $returns) {}

    /** GET /api/purchase-returns */
    public function index(Request $request)
    {
        return $this->success($this->returns->list($request->only(['purchaseOrderId', 'supplierId'])));
    }

    /** GET /api/purchase-returns/stats */
    public function stats()
    {
        return $this->success($this->returns->stats());
    }

    /** GET /api/purchase-returns/generate-number */
    public function generateNumber()
    {
        return $this->success(['returnNumber' => $this->returns->peekNumber()]);
    }

    /** GET /api/purchase-returns/returnable/{purchaseOrderId} — ítems devolubles de una OC. */
    public function returnableItems(int $purchaseOrderId)
    {
        return $this->success($this->returns->returnableItems($purchaseOrderId));
    }

    /** POST /api/purchase-returns */
    public function store(Request $request)
    {
        $data = $request->validate([
            'purchaseOrderId' => 'required|integer',
            'reason' => 'required|string',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.purchaseOrderItemId' => 'required|integer',
            'items.*.quantity' => 'required|numeric|min:0.01',
        ]);

        $return = $this->returns->create($data, $request->user());

        return $this->created($return->load(PurchaseReturnService::RELATIONS), 'Devolución registrada y stock revertido');
    }

    /** GET /api/purchase-returns/{id} */
    public function show(int $id)
    {
        return $this->success($this->returns->find($id));
    }
}
