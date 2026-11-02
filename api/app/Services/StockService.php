<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\InputVariant;
use App\Models\InputVariantMovement;
use App\Models\ProductVariant;
use App\Models\VariantMovement;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

/**
 * Único punto para mover el stock de variantes de producto (product_variants.stock +
 * variant_movements) y de variantes de insumo (input_variants.currentStock +
 * input_variant_movements).
 *
 * Reglas:
 *  - Cada movimiento lee la fila con SELECT … FOR UPDATE dentro de una transacción, así que
 *    dos ventas a la vez sobre la misma variante se serializan y el "stock anterior" que
 *    queda en el movimiento es el real (antes se leía sin bloqueo y se pisaban).
 *  - Las salidas (out) validan que el stock no quede negativo y lanzan
 *    InsufficientStockException (RuntimeException → 400 en los controladores).
 *  - Las entradas (in) y los ajustes a un valor (adjustTo) siempre registran movimiento.
 *  - Llámalo DENTRO de la transacción del documento (venta, pedido, recepción…): si algo
 *    falla después, el stock y el movimiento se deshacen con el resto.
 *
 * Uso:
 *   // 1) Validar el total por variante (suma líneas repetidas) y bloquear antes de escribir:
 *   $stock->assertVariantsAvailable([$variantId => 4, $otraId => 1]);
 *   // 2) Mover:
 *   $stock->variantOut($variantId, 2, 'SALE', ['referenceType' => 'sale', 'referenceId' => $order->id, 'reason' => 'Venta POS']);
 *   $stock->variantIn($variantId, 6, 'PURCHASE', ['referenceType' => 'purchase_order', 'referenceId' => $oc->id, 'userId' => $uid, 'unitCost' => 1200]);
 *   $stock->variantAdjustTo($variantId, 10, 'ADJUSTMENT', ['reason' => 'Conteo']);
 *   $stock->inputVariantOut($inputVariantId, 1.5, 'SALIDA', [...], allowNegative: true); // consumo que no puede fallar
 *
 * $attrs acepta las columnas del movimiento: referenceType, referenceId, reason, notes, userId, unitCost.
 * Tipos válidos: variantes PURCHASE, SALE, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, RETURN, DAMAGE, INITIAL;
 * insumos ENTRADA, SALIDA, AJUSTE, RESERVA, LIBERACION, DEVOLUCION, MERMA.
 *
 * Migrados: venta POS (POSService::createSale), pedido online (OrderService), recepción de
 * orden de compra (PurchaseOrderService::receive). El resto de módulos (anulación/devolución
 * POS, conteos, conversiones, devoluciones de compra, ajustes manuales) se pasa por módulo.
 */
class StockService
{
    private const MOVEMENT_ATTRS = ['referenceType', 'referenceId', 'reason', 'notes', 'userId', 'unitCost'];

    // ==================== Variantes de producto ====================

    /**
     * Bloquea las variantes (por id ascendente, para no cruzar bloqueos entre transacciones)
     * y valida que alcance el stock para el TOTAL pedido de cada una.
     *
     * @param  array<int, int|float>  $qtyByVariant  variantId => cantidad total
     * @return Collection<int, ProductVariant> variantes bloqueadas, por id
     */
    public function assertVariantsAvailable(array $qtyByVariant): Collection
    {
        return DB::transaction(function () use ($qtyByVariant) {
            $ids = array_keys($qtyByVariant);
            sort($ids);
            $variants = ProductVariant::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');

            foreach ($ids as $id) {
                $variant = $variants->get($id);
                if (! $variant) {
                    throw new RuntimeException("Variante {$id} no encontrada");
                }
                if ((float) $variant->stock < (float) $qtyByVariant[$id]) {
                    throw new InsufficientStockException($variant->sku, (float) $variant->stock, (float) $qtyByVariant[$id]);
                }
            }

            return $variants;
        });
    }

    /** Entrada de stock (compra, devolución, transferencia…). */
    public function variantIn(int $variantId, int|float $quantity, string $type, array $attrs = []): VariantMovement
    {
        $this->assertNotNegative($quantity);

        return $this->applyVariant($variantId, fn ($prev) => $prev + $quantity, $type, $attrs, true);
    }

    /** Salida de stock (venta, daño…). Falla si el stock quedaría negativo, salvo $allowNegative. */
    public function variantOut(int $variantId, int|float $quantity, string $type, array $attrs = [], bool $allowNegative = false): VariantMovement
    {
        $this->assertNotNegative($quantity);

        return $this->applyVariant($variantId, fn ($prev) => $prev - $quantity, $type, $attrs, $allowNegative);
    }

    /** Fija el stock a un valor (conteo, ajuste manual). El movimiento guarda la diferencia. */
    public function variantAdjustTo(int $variantId, int|float $newStock, string $type = 'ADJUSTMENT', array $attrs = []): VariantMovement
    {
        if ($newStock < 0) {
            throw new InvalidArgumentException('El stock no puede ser negativo');
        }

        return $this->applyVariant($variantId, fn () => $newStock, $type, $attrs, false);
    }

    private function applyVariant(int $variantId, callable $compute, string $type, array $attrs, bool $allowNegative): VariantMovement
    {
        return DB::transaction(function () use ($variantId, $compute, $type, $attrs, $allowNegative) {
            $variant = ProductVariant::whereKey($variantId)->lockForUpdate()->first();
            if (! $variant) {
                throw new RuntimeException("Variante {$variantId} no encontrada");
            }

            $previous = $variant->stock;
            $new = $compute($previous);
            if ($new < 0 && $new < $previous && ! $allowNegative) {
                throw new InsufficientStockException($variant->sku, (float) $previous, (float) ($previous - $new));
            }

            $variant->stock = $new;
            $variant->save();

            return VariantMovement::create([
                'variantId' => $variant->id,
                'movementType' => $type,
                'quantity' => $new - $previous,
                'previousStock' => $previous,
                'newStock' => $new,
            ] + $this->movementAttrs($attrs));
        });
    }

    // ==================== Variantes de insumo ====================

    /** Entrada de stock de una variante de insumo. */
    public function inputVariantIn(int $inputVariantId, float $quantity, string $type, array $attrs = []): InputVariantMovement
    {
        $this->assertNotNegative($quantity);

        return $this->applyInputVariant($inputVariantId, fn ($prev) => $prev + $quantity, $type, $attrs, true);
    }

    /** Salida de stock de una variante de insumo. Falla si quedaría negativo, salvo $allowNegative. */
    public function inputVariantOut(int $inputVariantId, float $quantity, string $type, array $attrs = [], bool $allowNegative = false): InputVariantMovement
    {
        $this->assertNotNegative($quantity);

        return $this->applyInputVariant($inputVariantId, fn ($prev) => $prev - $quantity, $type, $attrs, $allowNegative);
    }

    private function applyInputVariant(int $inputVariantId, callable $compute, string $type, array $attrs, bool $allowNegative): InputVariantMovement
    {
        return DB::transaction(function () use ($inputVariantId, $compute, $type, $attrs, $allowNegative) {
            $iv = InputVariant::whereKey($inputVariantId)->lockForUpdate()->first();
            if (! $iv) {
                throw new RuntimeException("Variante de insumo {$inputVariantId} no encontrada");
            }

            $previous = (float) $iv->currentStock;
            $new = $compute($previous);
            if ($new < 0 && $new < $previous && ! $allowNegative) {
                throw new InsufficientStockException($iv->sku, $previous, $previous - $new);
            }

            $iv->currentStock = $new;
            $iv->save();

            return InputVariantMovement::create([
                'inputVariantId' => $iv->id,
                'movementType' => $type,
                'quantity' => $new - $previous,
                'previousStock' => $previous,
                'newStock' => $new,
            ] + $this->movementAttrs($attrs));
        });
    }

    // ==================== Utilidades ====================

    /** La dirección la da el método (in/out); la cantidad nunca es negativa. 0 se registra igual. */
    private function assertNotNegative(int|float $quantity): void
    {
        if ($quantity < 0) {
            throw new InvalidArgumentException('La cantidad del movimiento no puede ser negativa');
        }
    }

    private function movementAttrs(array $attrs): array
    {
        return array_intersect_key($attrs, array_flip(self::MOVEMENT_ATTRS));
    }
}
