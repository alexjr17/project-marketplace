<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Category;
use App\Models\Color;
use App\Models\ProductType;
use App\Models\Size;
use App\Services\Catalog\CatalogAttributeService;
use App\Services\ProductCatalogService;
use Illuminate\Http\Request;

/**
 * Catálogos de atributos: tallas, colores, categorías y tipos de producto. Las reglas
 * (nombres únicos, qué no se borra por estar en uso) viven en Catalog\CatalogAttributeService.
 */
class CatalogController extends Controller
{
    use ApiResponse;

    public function __construct(private CatalogAttributeService $attributes) {}

    private function includeInactive(Request $request): bool
    {
        return $request->query('includeInactive') === 'true';
    }

    // ==================== TALLAS ====================

    public function listSizes(Request $request)
    {
        $query = Size::query();
        if (! $this->includeInactive($request)) {
            $query->where('isActive', true);
        }

        return $this->success($query->orderBy('sortOrder')->get());
    }

    public function getSize(int $id)
    {
        $size = Size::find($id);

        return $size ? $this->success($size) : $this->error('Talla no encontrada', 404);
    }

    public function createSize(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'abbreviation' => 'required|string',
            'sortOrder' => 'nullable|integer',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->created($this->attributes->createSize($data), 'Talla creada exitosamente');
    }

    public function updateSize(Request $request, int $id)
    {
        $size = Size::find($id);
        if (! $size) {
            return $this->error('Talla no encontrada', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'abbreviation' => 'nullable|string',
            'sortOrder' => 'nullable|integer',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->attributes->updateSize($size, $data), 'Talla actualizada exitosamente');
    }

    public function deleteSize(int $id)
    {
        $size = Size::find($id);
        if (! $size) {
            return $this->error('Talla no encontrada', 404);
        }
        $this->attributes->deleteSize($size);

        return $this->success(null, 'Talla eliminada exitosamente');
    }

    // ==================== COLORES ====================

    public function listColors(Request $request)
    {
        $query = Color::query();
        if (! $this->includeInactive($request)) {
            $query->where('isActive', true);
        }

        return $this->success($query->orderBy('name')->get());
    }

    public function getColor(int $id)
    {
        $color = Color::find($id);

        return $color ? $this->success($color) : $this->error('Color no encontrado', 404);
    }

    public function createColor(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'hexCode' => 'required|string',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->created($this->attributes->createColor($data), 'Color creado exitosamente');
    }

    public function updateColor(Request $request, int $id)
    {
        $color = Color::find($id);
        if (! $color) {
            return $this->error('Color no encontrado', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'hexCode' => 'nullable|string',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->attributes->updateColor($color, $data), 'Color actualizado exitosamente');
    }

    public function deleteColor(int $id)
    {
        $color = Color::find($id);
        if (! $color) {
            return $this->error('Color no encontrado', 404);
        }
        $this->attributes->deleteColor($color);

        return $this->success(null, 'Color eliminado exitosamente');
    }

    // ==================== CATEGORÍAS ====================

    public function listCategories(Request $request)
    {
        $query = Category::query();
        if (! $this->includeInactive($request)) {
            $query->where('isActive', true);
        }

        return $this->success($query->orderBy('name')->get());
    }

    /** Temáticas (etiquetas de producto) con nº de productos e imagen, para la portada. */
    public function tagsWithStats(Request $request, ProductCatalogService $catalog)
    {
        $data = $request->validate(['limit' => 'nullable|integer|min:1|max:30']);

        return $this->success($catalog->tagsWithStats((int) ($data['limit'] ?? 12)));
    }

    /** Categorías activas con nº de productos e imagen, para las tarjetas de la portada. */
    public function categoriesWithStats(ProductCatalogService $catalog)
    {
        return $this->success($catalog->categoriesWithStats());
    }

    public function getCategory(int $id)
    {
        $category = Category::find($id);

        return $category ? $this->success($category) : $this->error('Categoría no encontrada', 404);
    }

    public function createCategory(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->created($this->attributes->createCategory($data), 'Categoría creada exitosamente');
    }

    public function updateCategory(Request $request, int $id)
    {
        $category = Category::find($id);
        if (! $category) {
            return $this->error('Categoría no encontrada', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->attributes->updateCategory($category, $data), 'Categoría actualizada exitosamente');
    }

    public function deleteCategory(int $id)
    {
        $category = Category::find($id);
        if (! $category) {
            return $this->error('Categoría no encontrada', 404);
        }
        $this->attributes->deleteCategory($category);

        return $this->success(null, 'Categoría eliminada exitosamente');
    }

    // ==================== TIPOS DE PRODUCTO ====================

    public function listProductTypes(Request $request)
    {
        $query = ProductType::with('category:id,slug');
        if (! $this->includeInactive($request)) {
            $query->where('isActive', true);
        }

        $types = $query->orderBy('name')->get()->map(fn ($type) => [
            'id' => $type->id,
            'name' => $type->name,
            'slug' => $type->slug,
            'description' => $type->description,
            'categoryId' => $type->categoryId,
            'categorySlug' => $type->category?->slug,
            'isActive' => $type->isActive,
            'createdAt' => $type->createdAt,
            'updatedAt' => $type->updatedAt,
        ]);

        return $this->success($types);
    }

    public function getProductType(int $id)
    {
        $type = ProductType::find($id);

        return $type ? $this->success($type) : $this->error('Tipo de producto no encontrado', 404);
    }

    public function createProductType(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'categoryId' => 'nullable|integer',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->created($this->attributes->createProductType($data), 'Tipo de producto creado exitosamente');
    }

    public function updateProductType(Request $request, int $id)
    {
        $type = ProductType::find($id);
        if (! $type) {
            return $this->error('Tipo de producto no encontrado', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'categoryId' => 'nullable|integer',
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->attributes->updateProductType($type, $data), 'Tipo de producto actualizado exitosamente');
    }

    public function deleteProductType(int $id)
    {
        $type = ProductType::find($id);
        if (! $type) {
            return $this->error('Tipo de producto no encontrado', 404);
        }
        $this->attributes->deleteProductType($type);

        return $this->success(null, 'Tipo de producto eliminado exitosamente');
    }

    // ==================== TALLAS POR TIPO DE PRODUCTO ====================

    public function sizesByProductType(int $productTypeId)
    {
        if (! ProductType::whereKey($productTypeId)->exists()) {
            return $this->error('Tipo de producto no encontrado', 404);
        }

        return $this->success($this->attributes->sizesOf($productTypeId));
    }

    public function assignSizesToProductType(Request $request, int $productTypeId)
    {
        $type = ProductType::find($productTypeId);
        if (! $type) {
            return $this->error('Tipo de producto no encontrado', 404);
        }

        $data = $request->validate([
            'sizeIds' => 'required|array',
            'sizeIds.*' => 'integer',
        ]);

        return $this->success($this->attributes->assignSizes($type, $data['sizeIds']), 'Tallas asignadas exitosamente');
    }
}
