<?php

namespace App\Services;

use App\Models\Discount;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * Valida y aplica cupones de descuento. Comparte la lógica entre la tienda
 * online (OrderService) y el punto de venta (POSService).
 */
class DiscountService
{
    /**
     * Valida un cupón contra el contexto de la compra y calcula el monto.
     *
     * @param  array  $context  [
     *     'subtotal' => float,
     *     'items'    => [ ['productId'=>int,'categoryId'=>?int,'price'=>float,'quantity'=>int], ... ],
     *     'userId'   => ?int,
     *     'channel'  => 'online'|'pos',
     * ]
     * @return array{discount: Discount, amount: float}
     *
     * @throws RuntimeException  con un mensaje legible si el cupón no es válido.
     */
    public function validate(string $code, array $context): array
    {
        $code = strtoupper(trim($code));
        $discount = Discount::whereRaw('UPPER(code) = ?', [$code])->first();
        if (! $discount || ! $discount->isActive) {
            throw new RuntimeException('El cupón no existe o no está activo');
        }

        $now = now();
        if ($discount->startsAt && $now->lt($discount->startsAt)) {
            throw new RuntimeException('El cupón aún no está vigente');
        }
        if ($discount->endsAt && $now->gt($discount->endsAt)) {
            throw new RuntimeException('El cupón ya venció');
        }

        // Canal: tienda online o punto de venta.
        $channel = $context['channel'] ?? 'online';
        if ($discount->channel !== 'all' && $discount->channel !== $channel) {
            throw new RuntimeException($discount->channel === 'pos'
                ? 'Este cupón solo es válido en punto de venta'
                : 'Este cupón solo es válido en la tienda online');
        }

        $subtotal = (float) ($context['subtotal'] ?? 0);
        if ($discount->minSubtotal && $subtotal < $discount->minSubtotal) {
            throw new RuntimeException('El pedido no alcanza el mínimo de compra para este cupón');
        }

        // Usos totales.
        if ($discount->maxUses !== null && $discount->usedCount >= $discount->maxUses) {
            throw new RuntimeException('El cupón alcanzó su límite de usos');
        }

        $userId = $context['userId'] ?? null;

        // Restricción por usuario.
        if ($discount->appliesTo === 'user') {
            $targets = array_map('intval', $discount->targetIds ?? []);
            if (! $userId || ! in_array((int) $userId, $targets, true)) {
                throw new RuntimeException('Este cupón no está disponible para tu cuenta');
            }
        }

        // Usos por usuario.
        if ($discount->maxUsesPerUser !== null && $userId) {
            $used = Order::where('discountId', $discount->id)->where('userId', $userId)->count();
            if ($used >= $discount->maxUsesPerUser) {
                throw new RuntimeException('Ya usaste este cupón el máximo de veces permitido');
            }
        }

        // Subtotal elegible (según el alcance del cupón).
        $base = $this->eligibleBase($discount, $context, $subtotal);
        if ($base <= 0) {
            throw new RuntimeException('El cupón no aplica: los productos no califican o ya tienen una oferta (no se acumulan descuentos)');
        }

        $amount = $discount->type === 'percent'
            ? round($base * ($discount->value / 100))
            : min($discount->value, $base);

        return ['discount' => $discount, 'amount' => max(0.0, (float) $amount)];
    }

    /**
     * Calcula el subtotal sobre el que aplica el cupón según su alcance.
     *
     * Los descuentos NO son acumulables: los ítems que ya tienen una oferta
     * propia del producto ('discounted' = true) quedan excluidos de la base
     * del cupón.
     */
    private function eligibleBase(Discount $discount, array $context, float $subtotal): float
    {
        $items = $context['items'] ?? [];

        // Sin ítems no podemos saber qué está en oferta: usamos el subtotal
        // para alcances globales (compatibilidad) y 0 para los segmentados.
        if (empty($items)) {
            return in_array($discount->appliesTo, ['all', 'user'], true) ? $subtotal : 0;
        }

        $targets = array_map('intval', $discount->targetIds ?? []);
        $base = 0;

        foreach ($items as $it) {
            // No acumulable: si el producto ya trae oferta, el cupón no lo toca.
            if (! empty($it['discounted'])) {
                continue;
            }
            $line = (float) ($it['price'] ?? 0) * (int) ($it['quantity'] ?? 0);

            if (in_array($discount->appliesTo, ['all', 'user'], true)) {
                $base += $line;
            } elseif ($discount->appliesTo === 'product' && in_array((int) ($it['productId'] ?? 0), $targets, true)) {
                $base += $line;
            } elseif ($discount->appliesTo === 'category' && in_array((int) ($it['categoryId'] ?? 0), $targets, true)) {
                $base += $line;
            }
        }

        return $base;
    }

    /** Marca el cupón como usado (incrementa el contador de usos). */
    public function redeem(Discount $discount): void
    {
        $discount->usedCount = (int) $discount->usedCount + 1;
        $discount->save();
    }

    // ==================== DESCUENTOS AUTOMÁTICOS (sin código) ====================

    /**
     * Descuentos automáticos vigentes para un canal ('online' | 'pos').
     * Se consultan una sola vez y se reutilizan al formatear muchos productos.
     */
    public function activeAutoDiscounts(string $channel = 'online'): Collection
    {
        $now = now();

        return Discount::where('isAuto', true)
            ->where('isActive', true)
            ->whereIn('channel', ['all', $channel])
            ->whereIn('appliesTo', ['all', 'product', 'category'])
            ->where(fn ($q) => $q->whereNull('startsAt')->orWhere('startsAt', '<=', $now))
            ->where(fn ($q) => $q->whereNull('endsAt')->orWhere('endsAt', '>=', $now))
            ->get();
    }

    /**
     * Mejor descuento automático aplicable a un producto (el de mayor monto).
     *
     * @return array{discount: Discount, amount: float}|null
     */
    public function bestAutoFor(Product $product, Collection $autos): ?array
    {
        $base = (float) $product->basePrice;
        $best = null;
        $bestAmount = 0.0;

        foreach ($autos as $d) {
            if (! $this->autoMatches($d, $product)) {
                continue;
            }
            $amount = $d->type === 'percent'
                ? round($base * ($d->value / 100))
                : min((float) $d->value, $base);
            $amount = max(0.0, (float) $amount);
            if ($amount > $bestAmount) {
                $bestAmount = $amount;
                $best = $d;
            }
        }

        return $best ? ['discount' => $best, 'amount' => $bestAmount] : null;
    }

    /** Precio efectivo de un producto tras aplicar el mejor descuento automático. */
    public function autoPrice(Product $product, Collection $autos): float
    {
        $best = $this->bestAutoFor($product, $autos);

        return $best ? max(0.0, (float) $product->basePrice - $best['amount']) : (float) $product->basePrice;
    }

    /** ¿El descuento automático aplica a este producto (por alcance)? */
    private function autoMatches(Discount $d, Product $product): bool
    {
        if ($d->appliesTo === 'all') {
            return true;
        }
        $targets = array_map('intval', $d->targetIds ?? []);
        if ($d->appliesTo === 'product') {
            return in_array((int) $product->id, $targets, true);
        }
        if ($d->appliesTo === 'category') {
            return in_array((int) $product->categoryId, $targets, true);
        }

        return false;
    }
}
