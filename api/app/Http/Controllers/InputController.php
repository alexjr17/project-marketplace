<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Inventory\InputService;
use Illuminate\Http\Request;

/** Insumos, sus colores, tallas y variantes. La lógica vive en InputService. */
class InputController extends Controller
{
    use ApiResponse;

    public function __construct(private InputService $inputs) {}

    // ==================== INSUMOS ====================

    public function index(Request $request)
    {
        return $this->success($this->inputs->list($request->query()));
    }

    public function lowStock()
    {
        return $this->success($this->inputs->lowStock());
    }

    public function allVariants()
    {
        return $this->success($this->inputs->allVariants());
    }

    public function show(int $id)
    {
        return $this->success($this->inputs->detail($id));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string',
            'name' => 'required|string',
            'description' => 'nullable|string',
            'inputTypeId' => 'required|integer',
            'unitOfMeasure' => 'required|string',
            'unitCost' => 'required|numeric|min:0',
            'minStock' => 'nullable|numeric',
            'maxStock' => 'nullable|numeric',
            'supplier' => 'nullable|string',
            'supplierCode' => 'nullable|string',
            'notes' => 'nullable|string',
            'colorIds' => 'nullable|array',
            'sizeIds' => 'nullable|array',
        ]);

        return $this->created($this->inputs->create($data), 'Insumo creado');
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'code' => 'nullable|string',
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'inputTypeId' => 'nullable|integer',
            'unitOfMeasure' => 'nullable|string',
            'unitCost' => 'nullable|numeric|min:0',
            'minStock' => 'nullable|numeric',
            'maxStock' => 'nullable|numeric',
            'supplier' => 'nullable|string',
            'supplierCode' => 'nullable|string',
            'notes' => 'nullable|string',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->inputs->update($id, $data), 'Insumo actualizado');
    }

    public function destroy(int $id)
    {
        $this->inputs->deactivate($id);

        return $this->success(null, 'Insumo eliminado');
    }

    public function recalculateStock(int $id)
    {
        return $this->success($this->inputs->recalculateStock($id), 'Stock recalculado');
    }

    // ==================== COLORES Y TALLAS ====================

    public function addColor(Request $request, int $id)
    {
        $data = $request->validate(['colorId' => 'required|integer']);

        return $this->success($this->inputs->addColor($id, (int) $data['colorId']), 'Color agregado');
    }

    public function removeColor(int $id, int $colorId)
    {
        return $this->success($this->inputs->removeColor($id, $colorId), 'Color eliminado');
    }

    public function addSize(Request $request, int $id)
    {
        $data = $request->validate(['sizeId' => 'required|integer']);

        return $this->success($this->inputs->addSize($id, (int) $data['sizeId']), 'Talla agregada');
    }

    public function removeSize(int $id, int $sizeId)
    {
        return $this->success($this->inputs->removeSize($id, $sizeId), 'Talla eliminada');
    }

    public function regenerateVariants(int $id)
    {
        return $this->success($this->inputs->regenerateVariants($id), 'Variantes regeneradas');
    }

    // ==================== VARIANTES DE INSUMO ====================

    public function variants(int $id)
    {
        return $this->success($this->inputs->variants($id));
    }

    public function variantById(int $variantId)
    {
        return $this->success($this->inputs->variant($variantId));
    }

    public function updateVariant(Request $request, int $variantId)
    {
        $data = $request->validate([
            'unitCost' => 'nullable|numeric',
            'minStock' => 'nullable|numeric',
            'maxStock' => 'nullable|numeric',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->inputs->updateVariant($variantId, $data), 'Variante actualizada');
    }

    public function updateVariantStock(Request $request, int $variantId)
    {
        $data = $request->validate([
            'quantity' => 'required|numeric|min:0',
            'operation' => 'required|in:add,subtract',
        ]);

        return $this->success(
            $this->inputs->changeVariantStock($variantId, (float) $data['quantity'], $data['operation'], $request->user()?->id),
            'Stock actualizado'
        );
    }

    public function variantMovements(Request $request, int $variantId)
    {
        return $this->success($this->inputs->variantMovements($variantId, (int) ($request->query('limit') ?: 50)));
    }
}
