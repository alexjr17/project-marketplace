<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductType;
use App\Services\Catalog\ProductAdminService;
use App\Services\DiscountService;
use App\Services\ProductCatalogService;
use App\Support\ImageUrls;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    use ApiResponse;

    public function __construct(
        private DiscountService $discounts,
        private ProductCatalogService $catalog,
        private ProductAdminService $admin,
    ) {}

    /** Descuentos automáticos vigentes (tienda), cacheados por request. */
    private ?Collection $autoDiscounts = null;

    /** Petición para la que se cargaron (Laravel reutiliza la instancia del controlador). */
    private ?Request $autoDiscountsFor = null;

    private function autoDiscounts(): Collection
    {
        if ($this->autoDiscountsFor !== request()) {
            $this->autoDiscountsFor = request();
            $this->autoDiscounts = null;
        }

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
            'images' => ImageUrls::forModel($product->images, 'product', $product->id, $product->updatedAt),
            'colors' => $product->productColors->map(fn ($pc) => [
                'id' => $pc->color?->id,
                'name' => $pc->color?->name,
                'slug' => $pc->color?->slug,
                'hexCode' => $pc->color?->hexCode,
                'image' => ImageUrls::forColor($pc->image, $pc->id, $product->updatedAt),
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
            'onSale' => 'nullable',
            'color' => 'nullable|string',
            'size' => 'nullable|string',
            'tag' => 'nullable|string|max:60',
            'sortBy' => ['nullable', Rule::in(['name', 'basePrice', 'createdAt', 'rating', 'reviewsCount', 'stock'])],
            'sortOrder' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        $page = (int) ($data['page'] ?? 1);
        $limit = (int) ($data['limit'] ?? 12);

        $query = Product::with(self::PRODUCT_RELATIONS)->where('isTemplate', false);
        // Público: solo activos. El equipo con products.view/manage sigue viendo inactivos.
        $this->catalog->applyVisibility($query, $request->user());

        if (! empty($data['search'])) {
            // Insensible a mayúsculas/minúsculas (en Postgres LIKE sí distingue).
            $s = '%'.mb_strtolower($data['search']).'%';
            $query->where(function ($q) use ($s) {
                $q->whereRaw('LOWER(name) LIKE ?', [$s])
                    ->orWhereRaw('LOWER(description) LIKE ?', [$s])
                    ->orWhereRaw('LOWER(sku) LIKE ?', [$s]);
            });
        }
        if (! empty($data['category'])) {
            // Categoría inexistente → lista vacía (antes filtraba por categoryId NULL).
            $catId = Category::where('slug', $data['category'])->value('id');
            $catId ? $query->where('categoryId', $catId) : $query->whereRaw('1 = 0');
        }
        if (! empty($data['type'])) {
            $typeId = ProductType::where('slug', $data['type'])->value('id');
            $typeId ? $query->where('typeId', $typeId) : $query->whereRaw('1 = 0');
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
        if (isset($data['onSale']) && filter_var($data['onSale'], FILTER_VALIDATE_BOOLEAN)) {
            $this->catalog->applyOnSale($query, $this->autoDiscounts());
        }
        if (! empty($data['color'])) {
            $query->whereHas('productColors.color', fn ($q) => $q->where('slug', $data['color']));
        }
        if (! empty($data['size'])) {
            $query->whereHas('productSizes.size', fn ($q) => $q->where('abbreviation', $data['size']));
        }
        if (! empty($data['tag'])) {
            $this->catalog->applyTag($query, $data['tag']);
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

    public function show(Request $request, int $id)
    {
        $product = Product::with(self::PRODUCT_RELATIONS)->find($id);
        // Público: un producto inactivo o una plantilla no existe para la tienda.
        if ($product && ! $this->catalog->isVisible($product, $request->user())) {
            $product = null;
        }

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
            ->where('isTemplate', false)
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
            ->where('isTemplate', false)
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

        $product = $this->admin->create($data);

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

        $this->admin->update($product, $data);

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
        $this->admin->delete($product);

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

        $this->admin->updateStock($product, (int) $data['quantity'], $data['operation'] ?? 'set');

        return $this->success(
            $this->formatProduct($product->fresh(self::PRODUCT_RELATIONS)),
            'Stock actualizado exitosamente'
        );
    }
}
