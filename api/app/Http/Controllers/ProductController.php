<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Category;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductColor;
use App\Models\ProductSize;
use App\Models\ProductType;
use App\Models\ProductVariant;
use App\Services\DiscountService;
use App\Services\VariantService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    use ApiResponse;

    public function __construct(
        private VariantService $variants,
        private DiscountService $discounts,
    ) {}

    /** Descuentos automáticos vigentes (tienda), cacheados por request. */
    private ?Collection $autoDiscounts = null;

    private function autoDiscounts(): Collection
    {
        return $this->autoDiscounts ??= $this->discounts->activeAutoDiscounts('online');
    }

    private const PRODUCT_RELATIONS = [
        'category:id,name,slug',
        'productType:id,name,slug',
        'productColors.color:id,name,slug,hexCode',
        'productSizes.size:id,name,abbreviation',
    ];

    /** Forma del producto que espera el frontend (replica formatProductResponse del Node). */
    private function formatProduct(Product $product): array
    {
        // Descuento automático vigente que aplique a este producto (si lo hay).
        $auto = $this->discounts->bestAutoFor($product, $this->autoDiscounts());
        $salePrice = $auto ? max(0.0, (float) $product->basePrice - $auto['amount']) : (float) $product->basePrice;

        return [
            'id' => $product->id,
            'sku' => $product->sku,
            'slug' => $product->slug,
            'name' => $product->name,
            'description' => $product->description,
            'categoryId' => $product->categoryId,
            'categorySlug' => $product->category?->slug,
            'categoryName' => $product->category?->name,
            'typeId' => $product->typeId,
            'typeSlug' => $product->productType?->slug,
            'typeName' => $product->productType?->name,
            'basePrice' => (float) $product->basePrice,
            // Descuento automático (sin cupón) aplicado al precio, si existe.
            'discountType' => $auto ? $auto['discount']->type : 'none',
            'discountValue' => $auto ? (float) $auto['discount']->value : 0.0,
            'salePrice' => $salePrice,
            'hasDiscount' => $salePrice < (float) $product->basePrice,
            // El stock real se maneja por variante; se reporta la suma de las
            // variantes activas (el campo product.stock es solo de respaldo).
            'stock' => (int) $product->variants()->where('isActive', true)->sum('stock'),
            'featured' => $product->featured,
            'isActive' => $product->isActive,
            'images' => \App\Support\ImageUrls::forModel($product->images, 'product', $product->id, $product->updatedAt),
            'colors' => $product->productColors->map(fn ($pc) => [
                'id' => $pc->color?->id,
                'name' => $pc->color?->name,
                'slug' => $pc->color?->slug,
                'hexCode' => $pc->color?->hexCode,
            ])->filter(fn ($c) => $c['id'] !== null)->values(),
            'sizes' => $product->productSizes->map(fn ($ps) => [
                'id' => $ps->size?->id,
                'name' => $ps->size?->name,
                'abbreviation' => $ps->size?->abbreviation,
            ])->filter(fn ($s) => $s['id'] !== null)->values(),
            'tags' => is_array($product->tags) ? $product->tags : [],
            'rating' => $product->rating !== null ? (float) $product->rating : null,
            'reviewsCount' => $product->reviewsCount,
            'createdAt' => $product->createdAt,
            'updatedAt' => $product->updatedAt,
        ];
    }

    // ==================== LECTURA PÚBLICA ====================

    public function index(Request $request)
    {
        $data = $request->validate([
            'page' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string',
            'category' => 'nullable|string',
            'type' => 'nullable|string',
            'minPrice' => 'nullable|numeric',
            'maxPrice' => 'nullable|numeric',
            'featured' => 'nullable',
            'isActive' => 'nullable',
            'color' => 'nullable|string',
            'size' => 'nullable|string',
            'sortBy' => ['nullable', Rule::in(['name', 'basePrice', 'createdAt', 'rating', 'stock'])],
            'sortOrder' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $page = (int) ($data['page'] ?? 1);
        $limit = (int) ($data['limit'] ?? 12);

        $query = Product::with(self::PRODUCT_RELATIONS)->where('isTemplate', false);

        if (! empty($data['search'])) {
            $s = $data['search'];
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")->orWhere('description', 'like', "%{$s}%");
            });
        }
        if (! empty($data['category'])) {
            $catId = Category::where('slug', $data['category'])->value('id');
            $query->where('categoryId', $catId);
        }
        if (! empty($data['type'])) {
            $typeId = ProductType::where('slug', $data['type'])->value('id');
            $query->where('typeId', $typeId);
        }
        if (isset($data['minPrice'])) {
            $query->where('basePrice', '>=', $data['minPrice']);
        }
        if (isset($data['maxPrice'])) {
            $query->where('basePrice', '<=', $data['maxPrice']);
        }
        if (isset($data['featured'])) {
            $query->where('featured', filter_var($data['featured'], FILTER_VALIDATE_BOOLEAN));
        }
        if (isset($data['isActive'])) {
            $query->where('isActive', filter_var($data['isActive'], FILTER_VALIDATE_BOOLEAN));
        }
        if (! empty($data['color'])) {
            $query->whereHas('productColors.color', fn ($q) => $q->where('slug', $data['color']));
        }
        if (! empty($data['size'])) {
            $query->whereHas('productSizes.size', fn ($q) => $q->where('abbreviation', $data['size']));
        }

        $total = $query->count();
        $products = $query->orderBy($data['sortBy'] ?? 'createdAt', $data['sortOrder'] ?? 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $products->map(fn ($p) => $this->formatProduct($p))->all(),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => $limit > 0 ? (int) ceil($total / $limit) : 0,
            ],
        ]);
    }

    public function show(int $id)
    {
        $product = Product::with(self::PRODUCT_RELATIONS)->find($id);

        return $product
            ? $this->success($this->formatProduct($product))
            : $this->error('Producto no encontrado', 404);
    }

    public function featured(Request $request)
    {
        $limit = (int) ($request->query('limit') ?: 8);

        $products = Product::with(self::PRODUCT_RELATIONS)
            ->where('featured', true)
            ->where('isActive', true)
            ->orderByDesc('createdAt')
            ->take($limit)
            ->get();

        return $this->success($products->map(fn ($p) => $this->formatProduct($p))->all());
    }

    public function byCategory(Request $request, string $category)
    {
        $limit = (int) ($request->query('limit') ?: 12);
        $catId = Category::where('slug', $category)->value('id');

        if (! $catId) {
            return $this->success([]);
        }

        $products = Product::with(self::PRODUCT_RELATIONS)
            ->where('categoryId', $catId)
            ->where('isActive', true)
            ->orderByDesc('createdAt')
            ->take($limit)
            ->get();

        return $this->success($products->map(fn ($p) => $this->formatProduct($p))->all());
    }

    public function categories()
    {
        return $this->success(
            Category::where('isActive', true)->orderBy('name')->get(['id', 'name', 'slug'])
        );
    }

    public function types()
    {
        $types = ProductType::with('category:id,slug')
            ->where('isActive', true)
            ->orderBy('name')
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'categoryId' => $t->categoryId,
                'categorySlug' => $t->category?->slug,
            ]);

        return $this->success($types);
    }

    // ==================== ADMIN ====================

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'description' => 'required|string',
            'categoryId' => 'nullable|integer',
            'typeId' => 'nullable|integer',
            'basePrice' => 'required|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'featured' => 'nullable|boolean',
            'isActive' => 'nullable|boolean',
            'isTemplate' => 'nullable|boolean',
            'images' => 'nullable',
            'tags' => 'nullable|array',
            'colors' => 'nullable|array',
            'sizes' => 'nullable|array',
            'sku' => 'nullable|string',
            'slug' => 'nullable|string',
        ]);

        $colorIds = collect($data['colors'] ?? [])->pluck('id')->filter()->all();
        $sizeIds = collect($data['sizes'] ?? [])->pluck('id')->filter()->all();

        $product = DB::transaction(function () use ($data, $colorIds, $sizeIds) {
            $sku = $data['sku'] ?? $this->generateProductSku($data['typeId'] ?? null);
            $slug = $data['slug'] ?? Str::slug($data['name']);
            if (Product::where('slug', $slug)->exists()) {
                $slug .= '-'.strtolower(base_convert((string) now()->timestamp, 10, 36));
            }

            $product = Product::create([
                'sku' => $sku,
                'slug' => $slug,
                'name' => $data['name'],
                'description' => $data['description'],
                'categoryId' => $data['categoryId'] ?? null,
                'typeId' => $data['typeId'] ?? null,
                'basePrice' => $data['basePrice'],
                'stock' => $data['stock'] ?? 0,
                'featured' => $data['featured'] ?? false,
                'isActive' => $data['isActive'] ?? true,
                'isTemplate' => $data['isTemplate'] ?? false,
                'images' => $data['images'] ?? [],
                'tags' => $data['tags'] ?? [],
            ]);

            foreach ($colorIds as $colorId) {
                ProductColor::create(['productId' => $product->id, 'colorId' => $colorId]);
            }
            foreach ($sizeIds as $sizeId) {
                ProductSize::create(['productId' => $product->id, 'sizeId' => $sizeId]);
            }

            return $product;
        });

        // Siempre se generan variantes. Con color/talla se crean las combinaciones
        // (stock inicial 0, se ajusta luego). Sin color/talla se crea UNA variante
        // simple [null, null] con el stock del producto, para que sea vendible.
        $initialStock = ($colorIds || $sizeIds) ? 0 : (int) ($data['stock'] ?? 0);
        $this->variants->generateVariantsForProduct($product->id, $initialStock);

        return $this->created(
            $this->formatProduct($product->fresh(self::PRODUCT_RELATIONS)),
            'Producto creado exitosamente'
        );
    }

    public function update(Request $request, int $id)
    {
        $product = Product::find($id);
        if (! $product) {
            return $this->error('Producto no encontrado', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'categoryId' => 'nullable|integer',
            'typeId' => 'nullable|integer',
            'basePrice' => 'nullable|numeric|min:0',
            'stock' => 'nullable|integer|min:0',
            'featured' => 'nullable|boolean',
            'isActive' => 'nullable|boolean',
            'isTemplate' => 'nullable|boolean',
            'images' => 'nullable',
            'tags' => 'nullable|array',
            'colors' => 'nullable|array',
            'sizes' => 'nullable|array',
        ]);

        $colorIds = collect($data['colors'] ?? [])->pluck('id')->filter()->all();
        $sizeIds = collect($data['sizes'] ?? [])->pluck('id')->filter()->all();
        $variantsNeedUpdate = false;

        DB::transaction(function () use ($product, $data, $colorIds, $sizeIds, &$variantsNeedUpdate) {
            foreach (['name', 'description', 'categoryId', 'typeId', 'basePrice', 'stock',
                'featured', 'isActive', 'isTemplate', 'images', 'tags'] as $field) {
                if (array_key_exists($field, $data) && $data[$field] !== null) {
                    $product->{$field} = $data[$field];
                }
            }
            $product->save();

            // Si se envía la clave 'colors' (aunque sea []), se reemplaza el set
            // completo: una lista vacía deja el producto SIN colores. Si no se
            // envía la clave, no se tocan los colores existentes.
            if (array_key_exists('colors', $data)) {
                ProductColor::where('productId', $product->id)->delete();
                foreach ($colorIds as $colorId) {
                    ProductColor::create(['productId' => $product->id, 'colorId' => $colorId]);
                }
                $variantsNeedUpdate = true;
            }
            if (array_key_exists('sizes', $data)) {
                ProductSize::where('productId', $product->id)->delete();
                foreach ($sizeIds as $sizeId) {
                    ProductSize::create(['productId' => $product->id, 'sizeId' => $sizeId]);
                }
                $variantsNeedUpdate = true;
            }
        });

        if ($variantsNeedUpdate) {
            // Sin color/talla (producto simple) la variante [null,null] toma el
            // stock del producto; con variantes, stock inicial 0 (se ajusta luego).
            $initialStock = ($colorIds || $sizeIds) ? 0 : (int) ($product->stock ?? 0);
            $this->variants->generateVariantsForProduct($product->id, $initialStock);
        }

        return $this->success(
            $this->formatProduct($product->fresh(self::PRODUCT_RELATIONS)),
            'Producto actualizado exitosamente'
        );
    }

    public function destroy(int $id)
    {
        $product = Product::find($id);
        if (! $product) {
            return $this->error('Producto no encontrado', 404);
        }

        if (OrderItem::where('productId', $id)->exists()) {
            return $this->error(
                'No se puede eliminar el producto porque tiene pedidos asociados. Desactívalo en su lugar.',
                400
            );
        }

        $hasRelations = ProductVariant::where('productId', $id)
            ->where(function ($q) {
                $q->whereHas('orderItems')
                    ->orWhereHas('movements')
                    ->orWhereHas('templateRecipes');
            })
            ->exists();

        if ($hasRelations) {
            return $this->error(
                'No se puede eliminar el producto porque tiene variantes con ventas, movimientos de inventario o recetas asociadas. Desactívalo en su lugar.',
                400
            );
        }

        $product->delete();

        return $this->success(null, 'Producto eliminado exitosamente');
    }

    public function updateStock(Request $request, int $id)
    {
        $product = Product::find($id);
        if (! $product) {
            return $this->error('Producto no encontrado', 404);
        }

        $data = $request->validate([
            'quantity' => 'required|integer',
            'operation' => ['nullable', Rule::in(['set', 'add', 'subtract'])],
        ]);

        $operation = $data['operation'] ?? 'set';
        $newStock = match ($operation) {
            'add' => $product->stock + $data['quantity'],
            'subtract' => $product->stock - $data['quantity'],
            default => $data['quantity'],
        };

        if ($newStock < 0) {
            return $this->error('El stock no puede ser negativo', 400);
        }

        $product->stock = $newStock;
        $product->save();

        return $this->success(
            $this->formatProduct($product->fresh(self::PRODUCT_RELATIONS)),
            'Stock actualizado exitosamente'
        );
    }

    /** Genera un SKU de producto: PREFIJO-NNNN-TIMESTAMP. */
    private function generateProductSku(?int $typeId): string
    {
        $prefix = 'PRD';
        if ($typeId) {
            $slug = ProductType::where('id', $typeId)->value('slug');
            if ($slug) {
                $prefix = strtoupper(substr($slug, 0, 3));
            }
        }
        $count = Product::count() + 1;
        $timestamp = strtoupper(base_convert((string) (now()->timestamp * 1000), 10, 36));

        return $prefix.'-'.str_pad((string) $count, 4, '0', STR_PAD_LEFT).'-'.$timestamp;
    }
}
