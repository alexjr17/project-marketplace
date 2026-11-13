<?php

namespace App\Services\Marketing;

use App\Exceptions\BusinessRuleException;
use App\Models\DesignImage;
use App\Models\Discount;
use App\Models\Product;
use App\Services\Customizer\MannequinModelService;
use App\Services\DiscountService;
use App\Support\TemplateImages;
use Illuminate\Support\Facades\Http;

/**
 * Estudio de contenido: lo que se puede promocionar (productos con su oferta vigente, colecciones por
 * temática, promociones y cupones, diseños y plantillas personalizables) con lo necesario para armar
 * la pieza (nombre, precios, fotos). También sirve las fotos externas para dibujarlas en el lienzo.
 */
class MarketingSourceService
{
    public const TYPES = ['producto', 'coleccion', 'promocion', 'diseno', 'plantilla'];

    public function __construct(private DiscountService $discounts) {}

    public function list(string $type, ?string $q): array
    {
        return match ($type) {
            'producto' => $this->products($q),
            'coleccion' => $this->collections($q),
            'promocion' => $this->promotions(),
            'diseno' => $this->designs($q),
            'plantilla' => $this->templates(),
            default => throw new BusinessRuleException('Tipo de fuente no válido', 422),
        };
    }

    private function productRow(Product $p, $autos): array
    {
        $sale = $this->discounts->autoPrice($p, $autos);
        $base = (float) $p->basePrice;
        $images = TemplateImages::normalize($p->images);

        return [
            'id' => $p->id,
            'name' => $p->name,
            'description' => $p->description,
            'category' => $p->category?->name,
            'tags' => $p->tags ?? [],
            'price' => $sale,
            'listPrice' => $base,
            'discountPercent' => $sale < $base && $base > 0 ? (int) round((1 - $sale / $base) * 100) : 0,
            'image' => $images['front'] ?? null,
            'images' => array_values(array_filter([$images['front'] ?? null, $images['back'] ?? null, $images['side'] ?? null])),
        ];
    }

    private function products(?string $q): array
    {
        $autos = $this->discounts->activeAutoDiscounts('online');

        return Product::with('category:id,name')->where('isTemplate', false)->where('isActive', true)
            ->when($q, fn ($w) => $w->where('name', 'like', '%'.$q.'%'))
            ->orderByDesc('featured')->orderByDesc('id')->limit(60)->get()
            ->map(fn ($p) => $this->productRow($p, $autos))->all();
    }

    /** Colecciones = temáticas (etiquetas de los productos), con sus productos. */
    private function collections(?string $q): array
    {
        $autos = $this->discounts->activeAutoDiscounts('online');
        $byTag = [];
        foreach (Product::with('category:id,name')->where('isTemplate', false)->where('isActive', true)->get() as $p) {
            foreach ((array) ($p->tags ?? []) as $tag) {
                $tag = mb_strtolower(trim((string) $tag));
                if ($tag === '' || ($q && ! str_contains($tag, mb_strtolower($q)))) {
                    continue;
                }
                $byTag[$tag][] = $p;
            }
        }
        uasort($byTag, fn ($a, $b) => count($b) <=> count($a));

        return collect($byTag)->take(40)->map(fn ($products, $tag) => [
            'id' => $tag,
            'name' => mb_convert_case($tag, MB_CASE_TITLE),
            'count' => count($products),
            'products' => array_map(fn ($p) => $this->productRow($p, $autos), array_slice($products, 0, 8)),
        ])->values()->all();
    }

    /** Ofertas automáticas y cupones activos y vigentes. */
    private function promotions(): array
    {
        return Discount::where('isActive', true)
            ->where(fn ($w) => $w->whereNull('endsAt')->orWhere('endsAt', '>', now()))
            ->orderByDesc('id')->get()
            ->map(fn (Discount $d) => [
                'id' => $d->id,
                'name' => $d->name,
                'code' => $d->code,
                'isAuto' => (bool) $d->isAuto,
                'type' => $d->type,
                'value' => (float) $d->value,
                'label' => $d->type === 'percent' ? '-'.rtrim(rtrim(number_format((float) $d->value, 2, '.', ''), '0'), '.').'%' : '-$'.number_format((float) $d->value, 0, ',', '.'),
                'appliesTo' => $d->appliesTo,
                'minSubtotal' => $d->minSubtotal ? (float) $d->minSubtotal : null,
                'endsAt' => $d->endsAt?->toIso8601String(),
                'products' => $this->promotionProducts($d),
            ])->all();
    }

    private function promotionProducts(Discount $d): array
    {
        $autos = $this->discounts->activeAutoDiscounts('online');
        $targets = array_map('intval', $d->targetIds ?? []);
        $q = Product::with('category:id,name')->where('isTemplate', false)->where('isActive', true);
        if ($d->appliesTo === 'product') {
            $q->whereIn('id', $targets);
        } elseif ($d->appliesTo === 'category') {
            $q->whereIn('categoryId', $targets);
        }

        return $q->orderByDesc('featured')->limit(6)->get()->map(fn ($p) => $this->productRow($p, $autos))->all();
    }

    private function designs(?string $q): array
    {
        return DesignImage::where('isActive', true)
            ->when($q, fn ($w) => $w->where('name', 'like', '%'.$q.'%'))
            ->orderBy('sortOrder')->limit(80)->get()
            ->map(fn ($d) => ['id' => $d->id, 'name' => $d->name, 'category' => $d->category, 'image' => $d->fullUrl ?: $d->thumbnailUrl])
            ->all();
    }

    /** Plantillas personalizables con maniquí 3D (para el video 360°). */
    private function templates(): array
    {
        $published = collect(app(MannequinModelService::class)->publicList())->keyBy('key');

        return Product::where('isTemplate', true)->where('isActive', true)->orderBy('name')
            ->with(['templateZones' => fn ($q) => $q->where('isActive', true)->where('isBlocked', false)->orderBy('sortOrder')->with('zoneType:id,name,slug')])
            ->get()
            ->map(function ($t) use ($published) {
                $images = TemplateImages::normalize($t->images);
                $gen = $t->model3d ? $published->get($t->model3d) : null;

                return [
                    'id' => $t->id,
                    'name' => $t->name,
                    'price' => (float) $t->basePrice,
                    'listPrice' => (float) $t->basePrice,
                    'discountPercent' => 0,
                    'model3d' => $t->model3d,
                    'image' => $images['front'] ?? ($gen['poster'] ?? null),
                    'colors' => $t->productColors()->with('color:id,name,hexCode')->get()->map(fn ($pc) => $pc->color?->hexCode)->filter()->values()->all(),
                    // Zonas de diseño (en % de la vista) para poner diseños sobre el modelo 3D en los videos.
                    'zones' => $t->templateZones->map(fn ($z) => [
                        'id' => $z->id,
                        'name' => $z->name,
                        'view' => $z->zoneType?->slug,
                        'x' => $z->positionX,
                        'y' => $z->positionY,
                        'w' => $z->maxWidth,
                        'h' => $z->maxHeight,
                        'circle' => $z->shape === 'circle',
                    ])->values()->all(),
                ];
            })->all();
    }

    /**
     * Foto para dibujar en el lienzo del estudio (las de afuera no traen permisos CORS). Solo
     * imágenes por http(s), hasta 8 MB.
     *
     * @return array{0:string,1:string} [bytes, content-type]
     */
    public function image(string $url): array
    {
        if (! preg_match('#^https?://#i', $url)) {
            throw new BusinessRuleException('URL no válida', 422);
        }
        $host = parse_url($url, PHP_URL_HOST) ?: '';
        if (in_array($host, ['localhost', '127.0.0.1', '0.0.0.0'], true) || str_ends_with($host, '.local') || filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false && filter_var($host, FILTER_VALIDATE_IP)) {
            throw new BusinessRuleException('URL no permitida', 422);
        }
        $r = Http::timeout(20)->withOptions(['allow_redirects' => ['max' => 3]])->get($url);
        $type = (string) $r->header('Content-Type');
        if (! $r->successful() || ! str_starts_with($type, 'image/') || strlen($r->body()) > 8 * 1024 * 1024) {
            throw new BusinessRuleException('No se pudo traer la imagen', 422);
        }

        return [$r->body(), $type];
    }
}
