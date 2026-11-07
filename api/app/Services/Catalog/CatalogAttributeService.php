<?php

namespace App\Services\Catalog;

use App\Exceptions\BusinessRuleException;
use App\Models\Category;
use App\Models\Color;
use App\Models\Product;
use App\Models\ProductType;
use App\Models\ProductTypeSize;
use App\Models\Size;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Atributos del catálogo (tallas, colores, categorías y tipos de producto): nombres únicos y
 * qué no se puede borrar porque está en uso.
 *
 * Tallas y colores en uso no se borran: sus llaves foráneas borran en cascada los colores y
 * tallas de productos e insumos (el producto perdía el color sin aviso) o, si había
 * variantes, el borrado fallaba con 500.
 */
class CatalogAttributeService
{
    /** Tablas que usan un color o una talla (columna colorId / sizeId). */
    private const COLOR_USAGE = ['product_colors', 'product_variants', 'input_colors', 'input_variants'];

    private const SIZE_USAGE = ['product_sizes', 'product_variants', 'input_sizes', 'input_variants'];

    // ==================== TALLAS ====================

    public function createSize(array $data): Size
    {
        if (Size::where('name', $data['name'])->exists()) {
            throw new BusinessRuleException('Ya existe una talla con ese nombre', 409);
        }

        return Size::create([
            'name' => $data['name'],
            'abbreviation' => $data['abbreviation'],
            'sortOrder' => $data['sortOrder'] ?? 0,
            'isActive' => $data['isActive'] ?? true,
        ]);
    }

    public function updateSize(Size $size, array $data): Size
    {
        if (! empty($data['name']) && $data['name'] !== $size->name
            && Size::where('name', $data['name'])->where('id', '!=', $size->id)->exists()) {
            throw new BusinessRuleException('Ya existe una talla con ese nombre', 409);
        }

        return $this->fill($size, $data);
    }

    public function deleteSize(Size $size): void
    {
        $this->assertNotInUse('sizeId', $size->id, self::SIZE_USAGE, 'esta talla');
        $size->delete();
    }

    // ==================== COLORES ====================

    public function createColor(array $data): Color
    {
        if (Color::where('name', $data['name'])->orWhere('hexCode', $data['hexCode'])->exists()) {
            throw new BusinessRuleException('Ya existe un color con ese nombre o código hex', 409);
        }

        return Color::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'hexCode' => $data['hexCode'],
            'isActive' => $data['isActive'] ?? true,
        ]);
    }

    public function updateColor(Color $color, array $data): Color
    {
        if (! empty($data['name']) || ! empty($data['hexCode'])) {
            $exists = Color::where('id', '!=', $color->id)
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
                throw new BusinessRuleException('Ya existe un color con ese nombre o código hex', 409);
            }
        }

        return $this->fill($color, $data);
    }

    public function deleteColor(Color $color): void
    {
        $this->assertNotInUse('colorId', $color->id, self::COLOR_USAGE, 'este color');
        $color->delete();
    }

    // ==================== CATEGORÍAS ====================

    public function createCategory(array $data): Category
    {
        if (Category::where('name', $data['name'])->exists()) {
            throw new BusinessRuleException('Ya existe una categoría con ese nombre', 409);
        }

        return Category::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'description' => $data['description'] ?? null,
            'isActive' => $data['isActive'] ?? true,
        ]);
    }

    public function updateCategory(Category $category, array $data): Category
    {
        if (! empty($data['name']) && $data['name'] !== $category->name
            && Category::where('name', $data['name'])->where('id', '!=', $category->id)->exists()) {
            throw new BusinessRuleException('Ya existe una categoría con ese nombre', 409);
        }

        return $this->fill($category, $data);
    }

    public function deleteCategory(Category $category): void
    {
        $count = Product::where('categoryId', $category->id)->count();
        if ($count > 0) {
            throw new BusinessRuleException("No se puede eliminar: hay {$count} productos usando esta categoría", 409);
        }
        $category->delete();
    }

    // ==================== TIPOS DE PRODUCTO ====================

    public function createProductType(array $data): ProductType
    {
        if (ProductType::where('name', $data['name'])->exists()) {
            throw new BusinessRuleException('Ya existe un tipo de producto con ese nombre', 409);
        }

        return ProductType::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'description' => $data['description'] ?? null,
            'categoryId' => $data['categoryId'] ?? null,
            'isActive' => $data['isActive'] ?? true,
        ]);
    }

    public function updateProductType(ProductType $type, array $data): ProductType
    {
        if (! empty($data['name']) && $data['name'] !== $type->name
            && ProductType::where('name', $data['name'])->where('id', '!=', $type->id)->exists()) {
            throw new BusinessRuleException('Ya existe un tipo de producto con ese nombre', 409);
        }

        return $this->fill($type, $data);
    }

    public function deleteProductType(ProductType $type): void
    {
        $count = Product::where('typeId', $type->id)->count();
        if ($count > 0) {
            throw new BusinessRuleException("No se puede eliminar: hay {$count} productos usando este tipo", 409);
        }
        $type->delete();
    }

    /** Tallas asignadas a un tipo de producto, por su orden. */
    public function sizesOf(int $productTypeId): Collection
    {
        return Size::whereIn('id', ProductTypeSize::where('productTypeId', $productTypeId)->pluck('sizeId'))
            ->orderBy('sortOrder')
            ->get();
    }

    /** Reemplaza las tallas de un tipo de producto (todo o nada). */
    public function assignSizes(ProductType $type, array $sizeIds): Collection
    {
        DB::transaction(function () use ($type, $sizeIds) {
            ProductTypeSize::where('productTypeId', $type->id)->delete();
            foreach (array_unique($sizeIds) as $sizeId) {
                ProductTypeSize::create(['productTypeId' => $type->id, 'sizeId' => $sizeId]);
            }
        });

        return $this->sizesOf($type->id);
    }

    // ==================== Utilidades ====================

    /** Asigna solo los campos que llegaron con valor. */
    private function fill($model, array $data)
    {
        $model->fill(array_filter($data, fn ($v) => $v !== null));
        $model->save();

        return $model;
    }

    private function assertNotInUse(string $column, int $id, array $tables, string $label): void
    {
        $uses = 0;
        foreach ($tables as $table) {
            $uses += DB::table($table)->where($column, $id)->count();
        }
        if ($uses > 0) {
            throw new BusinessRuleException(
                "No se puede eliminar: {$label} está en uso en productos o insumos. Usa el estado inactivo en su lugar.",
                409
            );
        }
    }
}
