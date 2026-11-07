<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Inventory\InventoryCountService;
use Illuminate\Http\Request;

/** Conteos físicos de inventario. La lógica vive en InventoryCountService. */
class InventoryCountController extends Controller
{
    use ApiResponse;

    public function __construct(private InventoryCountService $counts) {}

    /** GET /api/inventory-counts */
    public function index(Request $request)
    {
        return $this->success($this->counts->list($request->query()));
    }

    /** GET /api/inventory-counts/stats */
    public function stats()
    {
        return $this->success($this->counts->stats());
    }

    /** GET /api/inventory-counts/{id} */
    public function show(int $id)
    {
        return $this->success($this->counts->detail($id));
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

        return $this->created($this->counts->create($data, $request->user()), 'Conteo de inventario creado correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/start */
    public function start(int $id)
    {
        return $this->success($this->counts->start($id), 'Conteo iniciado correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/items/{itemId} */
    public function updateItemCount(Request $request, int $id, int $itemId)
    {
        $data = $request->validate([
            'countedQuantity' => 'required|numeric',
            'notes' => 'nullable|string',
        ]);

        return $this->success(
            $this->counts->countItem($id, $itemId, (float) $data['countedQuantity'], $data['notes'] ?? null),
            'Cantidad actualizada correctamente'
        );
    }

    /** PATCH /api/inventory-counts/{id}/submit */
    public function submit(int $id)
    {
        return $this->success($this->counts->submit($id), 'Conteo enviado a aprobación correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/approve */
    public function approve(Request $request, int $id)
    {
        return $this->success($this->counts->approve($id, $request->user()), 'Conteo aprobado y ajustes aplicados correctamente');
    }

    /** PATCH /api/inventory-counts/{id}/cancel */
    public function cancel(int $id)
    {
        return $this->success($this->counts->cancel($id), 'Conteo cancelado correctamente');
    }

    /** DELETE /api/inventory-counts/{id} */
    public function destroy(int $id)
    {
        $this->counts->delete($id);

        return $this->success(null, 'Conteo de inventario eliminado correctamente');
    }
}
