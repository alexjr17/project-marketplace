<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Category;
use App\Models\Color;
use App\Models\Product;
use App\Models\ProductType;
use App\Models\ProductTypeSize;
use App\Models\Size;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CatalogController extends Controller
{
    use ApiResponse;

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

        if (Size::where('name', $data['name'])->exists()) {
            return $this->error('Ya existe una talla con ese nombre', 409);
        }

        $size = Size::create([
            'name' => $data['name'],
            'abbreviation' => $data['abbreviation'],
            'sortOrder' => $data['sortOrder'] ?? 0,
            'isActive' => $data['isActive'] ?? true,
        ]);

        return $this->created($size, 'Talla creada exitosamente');
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

        if (! empty($data['name']) && $data['name'] !== $size->name
            && Size::where('name', $data['name'])->where('id', '!=', $id)->exists()) {
            return $this->error('Ya existe una talla con ese nombre', 409);
        }

        $size->fill(array_filter($data, fn ($v) => $v !== null));
        $size->save();

        return $this->success($size, 'Talla actualizada exitosamente');
    }

    public function deleteSize(int $id)
    {
        $size = Size::find($id);
        if (! $size) {
            return $this->error('Talla no encontrada', 404);
        }
        $size->delete();

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

        if (Color::where('name', $data['name'])->orWhere('hexCode', $data['hexCode'])->exists()) {
            return $this->error('Ya existe un color con ese nombre o código hex', 409);
        }

        $color = Color::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'hexCode' => $data['hexCode'],
            'isActive' => $data['isActive'] ?? true,
        ]);

        return $this->created($color, 'Color creado exitosamente');
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

        if (! empty($data['name']) || ! empty($data['hexCode'])) {
            $exists = Color::where('id', '!=', $id)
                ->where(function ($q) use ($data) {
                    if (! empty($data['name'])) {
                        $q->orWhere('name', $data['name']);
                    }
                    if (! empty($data['hexCode'])) {
                        $q->orWhere('hexCode', $data['hexCode']);
                    }
                })
                ->exists();
            if ($exists) {
                return $this->error('Ya existe un color con ese nombre o código hex', 409);
            }
        }

        $color->fill(array_filter($data, fn ($v) => $v !== null));
        $color->save();

        return $this->success($color, 'Color actualizado exitosamente');
    }

    public function deleteColor(int $id)
    {
        $color = Color::find($id);
        if (! $color) {
            return $this->error('Color no encontrado', 404);
        }
        $color->delete();

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

        if (Category::where('name', $data['name'])->exists()) {
            return $this->error('Ya existe una categoría con ese nombre', 409);
        }

        $category = Category::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'description' => $data['description'] ?? null,
            'isActive' => $data['isActive'] ?? true,
        ]);

        return $this->created($category, 'Categoría creada exitosamente');
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

        if (! empty($data['name']) && $data['name'] !== $category->name
            && Category::where('name', $data['name'])->where('id', '!=', $id)->exists()) {
            return $this->error('Ya existe una categoría con ese nombre', 409);
        }

        $category->fill(array_filter($data, fn ($v) => $v !== null));
        $category->save();

        return $this->success($category, 'Categoría actualizada exitosamente');
    }

    public function deleteCategory(int $id)
    {
        $category = Category::find($id);
        if (! $category) {
            return $this->error('Categoría no encontrada', 404);
        }

        $count = Product::where('categoryId', $id)->count();
        if ($count > 0) {
            return $this->error("No se puede eliminar: hay {$count} productos usando esta categoría", 409);
        }

        $category->delete();

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

        if (ProductType::where('name', $data['name'])->exists()) {
            return $this->error('Ya existe un tipo de producto con ese nombre', 409);
        }

        $type = ProductType::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'description' => $data['description'] ?? null,
            'categoryId' => $data['categoryId'] ?? null,
            'isActive' => $data['isActive'] ?? true,
        ]);

        return $this->created($type, 'Tipo de producto creado exitosamente');
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

        if (! empty($data['name']) && $data['name'] !== $type->name
            && ProductType::where('name', $data['name'])->where('id', '!=', $id)->exists()) {
            return $this->error('Ya existe un tipo de producto con ese nombre', 409);
        }

        $type->fill(array_filter($data, fn ($v) => $v !== null));
        $type->save();

        return $this->success($type, 'Tipo de producto actualizado exitosamente');
    }

    public function deleteProductType(int $id)
    {
        $type = ProductType::find($id);
        if (! $type) {
            return $this->error('Tipo de producto no encontrado', 404);
        }

        $count = Product::where('typeId', $id)->count();
        if ($count > 0) {
            return $this->error("No se puede eliminar: hay {$count} productos usando este tipo", 409);
        }

        $type->delete();

        return $this->success(null, 'Tipo de producto eliminado exitosamente');
    }

    // ==================== TALLAS POR TIPO DE PRODUCTO ====================

    public function sizesByProductType(int $productTypeId)
    {
        $type = ProductType::find($productTypeId);
        if (! $type) {
            return $this->error('Tipo de producto no encontrado', 404);
        }

        $sizes = Size::whereIn('id', ProductTypeSize::where('productTypeId', $productTypeId)->pluck('sizeId'))
            ->orderBy('sortOrder')
            ->get();

        return $this->success($sizes);
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

        ProductTypeSize::where('productTypeId', $productTypeId)->delete();

        foreach (array_unique($data['sizeIds']) as $sizeId) {
            ProductTypeSize::create(['productTypeId' => $productTypeId, 'sizeId' => $sizeId]);
        }

        $sizes = Size::whereIn('id', ProductTypeSize::where('productTypeId', $productTypeId)->pluck('sizeId'))
            ->orderBy('sortOrder')
            ->get();

        return $this->success($sizes, 'Tallas asignadas exitosamente');
    }
}
