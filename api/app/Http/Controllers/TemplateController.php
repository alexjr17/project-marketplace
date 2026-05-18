<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Product;
use App\Models\ProductColor;
use App\Models\ProductSize;
use App\Models\ProductType;
use App\Services\VariantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TemplateController extends Controller
{
    use ApiResponse;

    public function __construct(private VariantService $variants) {}

    private const RELATIONS = [
        'category:id,name,slug',
        'productType:id,name,slug',
        'productColors.color:id,name,slug,hexCode',
        'productSizes.size:id,name,abbreviation',
    ];

    private function format(Product $t): array
    {
        return [
            'id' => $t->id,
            'sku' => $t->sku,
            'slug' => $t->slug,
            'name' => $t->name,
            'description' => $t->description,
            'barcode' => $t->barcode,
            'categoryId' => $t->categoryId,
            'categorySlug' => $t->category?->slug,
            'categoryName' => $t->category?->name,
            'typeId' => $t->typeId,
            'typeSlug' => $t->productType?->slug,
            'typeName' => $t->productType?->name,
            'basePrice' => (float) $t->basePrice,
            'images' => is_array($t->images) ? $t->images : ['front' => ''],
            'zoneTypeImages' => $t->zoneTypeImages,
            'designZones' => $t->designZones,
            'exclusionZones' => $t->exclusionZones,
            'colors' => $t->productColors->map(fn ($pc) => [
                'id' => $pc->color?->id, 'name' => $pc->color?->name,
                'slug' => $pc->color?->slug, 'hexCode' => $pc->color?->hexCode,
            ])->filter(fn ($c) => $c['id'] !== null)->values(),
            'sizes' => $t->productSizes->map(fn ($ps) => [
                'id' => $ps->size?->id, 'name' => $ps->size?->name, 'abbreviation' => $ps->size?->abbreviation,
            ])->filter(fn ($s) => $s['id'] !== null)->values(),
            'tags' => is_array($t->tags) ? $t->tags : [],
            'isActive' => $t->isActive,
            'createdAt' => $t->createdAt,
            'updatedAt' => $t->updatedAt,
        ];
    }

    public function index()
    {
        $templates = Product::with(self::RELATIONS)->where('isTemplate', true)->orderBy('name')->get();

        return $this->success($templates->map(fn ($t) => $this->format($t)));
    }

    public function publicList()
    {
        $templates = Product::with(self::RELATIONS)
            ->where('isTemplate', true)->where('isActive', true)
            ->orderByDesc('createdAt')->get();

        return $this->success($templates->map(fn ($t) => $this->format($t)));
    }

    public function byType(string $typeSlug)
    {
        $typeId = ProductType::where('slug', $typeSlug)->value('id');
        if (! $typeId) {
            return $this->error('Tipo de producto no encontrado', 404);
        }

        $templates = Product::with(self::RELATIONS)
            ->where('isTemplate', true)->where('typeId', $typeId)->where('isActive', true)
            ->orderBy('name')->get();

        return $this->success($templates->map(fn ($t) => $this->format($t)));
    }

    public function show(int $id)
    {
        $template = Product::with(self::RELATIONS)->where('isTemplate', true)->find($id);

        return $template ? $this->success($this->format($template)) : $this->error('Template no encontrado', 404);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'description' => 'required|string',
            'sku' => 'nullable|string',
            'slug' => 'nullable|string',
            'barcode' => 'nullable|string',
            'categoryId' => 'nullable|integer',
            'typeId' => 'nullable|integer',
            'basePrice' => 'required|numeric|min:0',
            'images' => 'required',
            'zoneTypeImages' => 'nullable',
            'designZones' => 'nullable',
            'exclusionZones' => 'nullable',
            'tags' => 'nullable|array',
            'colorIds' => 'nullable|array',
            'sizeIds' => 'nullable|array',
        ]);

        $barcode = $data['barcode'] ?? null;
        if ($barcode && Product::where('barcode', $barcode)->exists()) {
            return $this->error('El código de barras ya existe', 400);
        }
        if (! $barcode) {
            $barcode = $this->variants->generateUniqueBarcode();
        }

        $colorIds = $data['colorIds'] ?? [];
        $sizeIds = $data['sizeIds'] ?? [];

        $template = DB::transaction(function () use ($data, $barcode, $colorIds, $sizeIds) {
            $slug = $data['slug'] ?? Str::slug($data['name']);
            if (Product::where('slug', $slug)->exists()) {
                $slug .= '-'.strtolower(base_convert((string) now()->timestamp, 10, 36));
            }
            $template = Product::create([
                'sku' => $data['sku'] ?? ('TPL-'.strtoupper(base_convert((string) (now()->timestamp * 1000), 10, 36))),
                'slug' => $slug,
                'name' => $data['name'],
                'description' => $data['description'],
                'barcode' => $barcode,
                'categoryId' => $data['categoryId'] ?? null,
                'typeId' => $data['typeId'] ?? null,
                'basePrice' => $data['basePrice'],
                'images' => $data['images'],
                'zoneTypeImages' => $data['zoneTypeImages'] ?? null,
                'designZones' => $data['designZones'] ?? null,
                'exclusionZones' => $data['exclusionZones'] ?? null,
                'tags' => $data['tags'] ?? [],
                'isTemplate' => true,
                'isActive' => true,
                'featured' => false,
                'stock' => 0,
            ]);
            foreach ($colorIds as $colorId) {
                ProductColor::create(['productId' => $template->id, 'colorId' => $colorId]);
            }
            foreach ($sizeIds as $sizeId) {
                ProductSize::create(['productId' => $template->id, 'sizeId' => $sizeId]);
            }

            return $template;
        });

        if ($colorIds || $sizeIds) {
            $this->variants->generateVariantsForProduct($template->id, 0);
        }

        return $this->created($this->format($template->fresh(self::RELATIONS)), 'Template creado exitosamente');
    }

    public function update(Request $request, int $id)
    {
        $template = Product::where('isTemplate', true)->find($id);
        if (! $template) {
            return $this->error('Template no encontrado', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'categoryId' => 'nullable|integer',
            'typeId' => 'nullable|integer',
            'basePrice' => 'nullable|numeric|min:0',
            'images' => 'nullable',
            'zoneTypeImages' => 'nullable',
            'designZones' => 'nullable',
            'exclusionZones' => 'nullable',
            'tags' => 'nullable|array',
            'isActive' => 'nullable|boolean',
            'colorIds' => 'nullable|array',
            'sizeIds' => 'nullable|array',
        ]);

        $variantsNeedUpdate = false;

        DB::transaction(function () use ($template, $data, $request, &$variantsNeedUpdate) {
            if ($request->has('colorIds')) {
                ProductColor::where('productId', $template->id)->delete();
                foreach ($data['colorIds'] ?? [] as $colorId) {
                    ProductColor::create(['productId' => $template->id, 'colorId' => $colorId]);
                }
                $variantsNeedUpdate = true;
            }
            if ($request->has('sizeIds')) {
                ProductSize::where('productId', $template->id)->delete();
                foreach ($data['sizeIds'] ?? [] as $sizeId) {
                    ProductSize::create(['productId' => $template->id, 'sizeId' => $sizeId]);
                }
                $variantsNeedUpdate = true;
            }
            foreach (['name', 'description', 'categoryId', 'typeId', 'basePrice', 'images',
                'zoneTypeImages', 'designZones', 'exclusionZones', 'tags', 'isActive'] as $field) {
                if ($request->has($field)) {
                    $template->{$field} = $data[$field] ?? null;
                }
            }
            $template->save();
        });

        if ($variantsNeedUpdate) {
            $this->variants->generateVariantsForProduct($template->id, 0);
        }

        return $this->success($this->format($template->fresh(self::RELATIONS)), 'Template actualizado exitosamente');
    }

    public function destroy(int $id)
    {
        $template = Product::where('isTemplate', true)->find($id);
        if (! $template) {
            return $this->error('Template no encontrado', 404);
        }
        $template->delete();

        return $this->success(null, 'Template eliminado exitosamente');
    }
}
