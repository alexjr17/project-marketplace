<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Inventory\InventoryConversionService;
use Illuminate\Http\Request;

/** Conversiones de insumos a producto. La lógica vive en InventoryConversionService. */
class InventoryConversionController extends Controller
{
    use ApiResponse;

    public function __construct(private InventoryConversionService $conversions) {}

    /** GET /api/inventory-conversions */
    public function index(Request $request)
    {
        return $this->success($this->conversions->list($request->query()));
    }

    /** GET /api/inventory-conversions/stats */
    public function stats()
    {
        return $this->success($this->conversions->stats());
    }

    /** GET /api/inventory-conversions/{id} */
    public function show(int $id)
    {
        return $this->success($this->conversions->detail($id));
    }

    /** POST /api/inventory-conversions */
    public function store(Request $request)
    {
        $data = $request->validate([
            'conversionType' => 'nullable|in:MANUAL,TEMPLATE',
            'templateId' => 'nullable|integer',
            'templateVariantId' => 'nullable|integer',
            'conversionDate' => 'nullable|date',
            'description' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        return $this->created($this->conversions->create($data, $request->user()));
    }

    /** POST /api/inventory-conversions/from-template */
    public function fromTemplate(Request $request)
    {
        $data = $request->validate([
            'templateVariantId' => 'required|integer',
            'outputVariantId' => 'required|integer',
            'quantity' => 'required|numeric|min:1',
            'conversionDate' => 'nullable|date',
            'description' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        return $this->created($this->conversions->fromTemplate($data, $request->user()));
    }

    /** POST /api/inventory-conversions/{id}/input-items */
    public function addInputItem(Request $request, int $id)
    {
        $data = $request->validate([
            'inputVariantId' => 'required|integer',
            'quantity' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string',
        ]);

        return $this->created($this->conversions->addInputItem($id, $data));
    }

    /** PATCH /api/inventory-conversions/{id}/input-items/{itemId} */
    public function updateInputItem(Request $request, int $id, int $itemId)
    {
        $data = $request->validate([
            'quantity' => 'nullable|numeric|min:0.01',
            'notes' => 'nullable|string',
        ]);

        return $this->success($this->conversions->updateInputItem($id, $itemId, $data));
    }

    /** DELETE /api/inventory-conversions/{id}/input-items/{itemId} */
    public function removeInputItem(int $id, int $itemId)
    {
        return $this->success($this->conversions->removeInputItem($id, $itemId));
    }

    /** POST /api/inventory-conversions/{id}/output-items */
    public function addOutputItem(Request $request, int $id)
    {
        $data = $request->validate([
            'variantId' => 'required|integer',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        return $this->created($this->conversions->addOutputItem($id, $data));
    }

    /** PATCH /api/inventory-conversions/{id}/output-items/{itemId} */
    public function updateOutputItem(Request $request, int $id, int $itemId)
    {
        $data = $request->validate([
            'quantity' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        return $this->success($this->conversions->updateOutputItem($id, $itemId, $data));
    }

    /** DELETE /api/inventory-conversions/{id}/output-items/{itemId} */
    public function removeOutputItem(int $id, int $itemId)
    {
        return $this->success($this->conversions->removeOutputItem($id, $itemId));
    }

    /** POST /api/inventory-conversions/{id}/submit */
    public function submit(int $id)
    {
        return $this->success($this->conversions->submit($id));
    }

    /** POST /api/inventory-conversions/{id}/approve */
    public function approve(Request $request, int $id)
    {
        return $this->success($this->conversions->approve($id, $request->user()));
    }

    /** POST /api/inventory-conversions/{id}/cancel */
    public function cancel(int $id)
    {
        return $this->success($this->conversions->cancel($id));
    }

    /** DELETE /api/inventory-conversions/{id} */
    public function destroy(int $id)
    {
        $this->conversions->delete($id);

        return $this->success(null, 'Conversión eliminada exitosamente');
    }
}
