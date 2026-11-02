<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Support\ImageUrls;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Reglas de qué productos ve cada quien en el catálogo y datos agregados de la tienda.
 *
 *  - El público (sin sesión, o con sesión pero sin products.view/products.manage) solo ve
 *    productos activos que no son plantillas, tanto en el listado como en el detalle.
 *  - El equipo con products.view/products.manage (y el SuperAdmin) sigue viendo todo, igual
 *    que antes: el panel de Administración lista inactivos y abre su detalle.
 */
class ProductCatalogService
{
    private const STAFF_PERMISSIONS = ['products.view', 'products.manage'];

    public function __construct(private DiscountService $discounts) {}

    /** ¿El usuario puede ver productos ocultos (inactivos / plantillas)? */
    public function canSeeHidden(?User $user): bool
    {
        if (! $user) {
            return false;
        }
        if ((int) $user->roleId === 1) {
            return true;
        }
        $permissions = is_array($user->role?->permissions) ? $user->role->permissions : [];

        return (bool) array_intersect(self::STAFF_PERMISSIONS, $permissions);
    }

    /** Limita la consulta a lo que el usuario puede ver en el listado. */
    public function applyVisibility(Builder $query, ?User $user): void
    {
        if (! $this->canSeeHidden($user)) {
            $query->where('isActive', true)->where('isTemplate', false);
        }
    }

    /** ¿El usuario puede abrir el detalle de este producto? */
    public function isVisible(Product $product, ?User $user): bool
    {
        return $this->canSeeHidden($user) || ($product->isActive && ! $product->isTemplate);
    }

    /**
     * Ofertas: productos con un descuento automático vigente de la tienda online que les
     * aplique (por producto, por categoría o a todo). No hay columna de precio rebajado: la
     * oferta sale de los descuentos automáticos, igual que el salePrice del JSON.
     */
    public function applyOnSale(Builder $query, ?Collection $autos = null): void
    {
        $autos = ($autos ?? $this->discounts->activeAutoDiscounts('online'))
            ->filter(fn ($d) => (float) $d->value > 0);

        if ($autos->contains(fn ($d) => $d->appliesTo === 'all')) {
            return; // todo el catálogo está en oferta
        }

        $ids = fn (string $scope) => $autos->where('appliesTo', $scope)
            ->flatMap(fn ($d) => array_map('intval', $d->targetIds ?? []))
            ->unique()->values()->all();
        $productIds = $ids('product');
        $categoryIds = $ids('category');

        if ($productIds === [] && $categoryIds === []) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where(function ($q) use ($productIds, $categoryIds) {
            if ($productIds !== []) {
                $q->orWhereIn('id', $productIds);
            }
            if ($categoryIds !== []) {
                $q->orWhereIn('categoryId', $categoryIds);
            }
        });
    }

    /**
     * Categorías activas para las tarjetas de la portada: cuántos productos activos (no
     * plantillas) tiene cada una y la imagen del producto activo más reciente que tenga foto.
     *
     * @return array<int, array{id:int, name:string, slug:string, description:?string, productCount:int, image:?string}>
     */
    public function categoriesWithStats(): array
    {
        $categories = Category::where('isActive', true)->orderBy('name')->get(['id', 'name', 'slug', 'description']);

        $counts = Product::where('isActive', true)->where('isTemplate', false)
            ->whereIn('categoryId', $categories->pluck('id'))
            ->selectRaw('categoryId, COUNT(*) as total')
            ->groupBy('categoryId')
            ->pluck('total', 'categoryId');

        // Productos activos por categoría, del más reciente al más antiguo, para tomar la
        // primera foto disponible.
        $products = Product::where('isActive', true)->where('isTemplate', false)
            ->whereIn('categoryId', $categories->pluck('id'))
            ->orderByDesc('featured')->orderByDesc('createdAt')
            ->get(['id', 'categoryId', 'images', 'updatedAt'])
            ->groupBy('categoryId');

        return $categories->map(function (Category $c) use ($counts, $products) {
            $image = null;
            foreach ($products->get($c->id, collect()) as $p) {
                $front = ImageUrls::forModel($p->images, 'product', $p->id, $p->updatedAt)['front'] ?? '';
                if ($front !== '') {
                    $image = $front;
                    break;
                }
            }

            return [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'description' => $c->description,
                'productCount' => (int) ($counts[$c->id] ?? 0),
                'image' => $image,
            ];
        })->values()->all();
    }
}
