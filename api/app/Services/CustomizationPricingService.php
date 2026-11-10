<?php

namespace App\Services;

use App\Models\Product;
use App\Models\TemplateZone;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Precio de un producto personalizado: precio base de la plantilla (con la oferta automática
 * vigente, igual que un producto normal) + el precio de cada zona diseñada.
 *
 * Es la única fuente del precio: el personalizador lo muestra con /customizer/quote y el
 * pedido y el carrito lo recalculan aquí, sin confiar en el precio que mande el cliente.
 */
class CustomizationPricingService
{
    public function __construct(private DiscountService $discounts) {}

    /**
     * Cotiza una plantilla con las zonas diseñadas (ids de template_zones; repetidas cuentan
     * una vez). Cada zona debe ser de la plantilla, estar activa, ser editable y no estar
     * bloqueada; si no, 422.
     *
     * @param  int[]  $templateZoneIds
     * listPrice es el precio base sin la oferta automática (para mostrar el descuento; si no hay oferta,
     * es igual a basePrice). No lleva impuestos: el IVA solo se aplica si está activo en Pagos.
     *
     * @return array{basePrice: float, listPrice: float, zones: array<int, array{id: int, name: string, zoneTypeSlug: ?string, price: float}>, customizationPrice: float, total: float}
     */
    public function quote(Product $template, array $templateZoneIds, ?Collection $autoDiscounts = null): array
    {
        if (! $template->isTemplate) {
            throw ValidationException::withMessages(['templateId' => 'El producto no es una plantilla personalizable.']);
        }

        $ids = collect($templateZoneIds)->map(fn ($id) => (int) $id)->unique()->values();
        if ($ids->contains(fn ($id) => $id <= 0)) {
            throw ValidationException::withMessages(['templateZoneIds' => 'Hay zonas de diseño no válidas.']);
        }

        $zones = $ids->isEmpty()
            ? collect()
            : TemplateZone::with('zoneType:id,slug')
                ->whereIn('id', $ids)
                ->where('templateId', $template->id)
                ->where('isActive', true)
                ->where('isEditable', true)
                ->where('isBlocked', false)
                ->orderBy('sortOrder')
                ->get();

        if ($zones->count() !== $ids->count()) {
            throw ValidationException::withMessages([
                'templateZoneIds' => 'Alguna de las zonas no se puede personalizar en este producto.',
            ]);
        }

        $autoDiscounts ??= $this->discounts->activeAutoDiscounts('online');
        $basePrice = $this->discounts->autoPrice($template, $autoDiscounts);
        $customizationPrice = (float) $zones->sum(fn ($z) => (float) $z->price);

        return [
            'basePrice' => $basePrice,
            'listPrice' => (float) $template->basePrice,
            'zones' => $zones->map(fn ($z) => [
                'id' => $z->id,
                'name' => $z->name,
                'zoneTypeSlug' => $z->zoneType?->slug,
                'price' => (float) $z->price,
            ])->values()->all(),
            'customizationPrice' => $customizationPrice,
            'total' => $basePrice + $customizationPrice,
        ];
    }

    /**
     * Cotización de la personalización guardada en un ítem de carrito o pedido.
     * Devuelve null si es del formato viejo (sin `designs`): esos ítems se cobran al precio
     * base, como siempre.
     */
    public function quoteForCustomization(Product $template, mixed $customization, ?Collection $autoDiscounts = null): ?array
    {
        $zoneIds = $this->zoneIdsFrom($customization);

        return $zoneIds === null ? null : $this->quote($template, $zoneIds, $autoDiscounts);
    }

    /**
     * Precio unitario de un ítem personalizado del carrito (v2): el de la cotización.
     * null si no es v2 o la plantilla ya no existe/está inactiva (se deja el precio guardado).
     */
    public function cartUnitPrice(mixed $customization, ?Collection $autoDiscounts = null): ?float
    {
        return $this->cartQuote($customization, $autoDiscounts)['total'] ?? null;
    }

    /**
     * Cotización vigente de un ítem del carrito (desglose para mostrar: prenda con oferta, precio de
     * lista, personalización y total). null si es del formato viejo o la plantilla ya no está.
     */
    public function cartQuote(mixed $customization, ?Collection $autoDiscounts = null): ?array
    {
        $templateId = is_array($customization) ? (int) ($customization['templateId'] ?? 0) : 0;
        if ($templateId <= 0 || $this->zoneIdsFrom($customization) === null) {
            return null;
        }
        $template = Product::where('isTemplate', true)->where('isActive', true)->find($templateId);
        if (! $template) {
            return null;
        }

        return $this->quoteForCustomization($template, $customization, $autoDiscounts);
    }

    /**
     * Ids de zona de una personalización v2 (`version: 2` con `designs[].templateZoneId`).
     * null si no es v2: los ítems del formato anterior también traen `designs`, pero sin zona.
     *
     * @return int[]|null
     */
    public function zoneIdsFrom(mixed $customization): ?array
    {
        if (! is_array($customization) || (int) ($customization['version'] ?? 0) !== 2
            || ! is_array($customization['designs'] ?? null)) {
            return null;
        }

        $ids = [];
        foreach ($customization['designs'] as $design) {
            $id = is_array($design) ? ($design['templateZoneId'] ?? null) : null;
            if (! is_numeric($id) || (int) $id <= 0) {
                throw ValidationException::withMessages(['customization' => 'Cada diseño debe indicar su zona.']);
            }
            $ids[] = (int) $id;
        }

        return $ids;
    }
}
