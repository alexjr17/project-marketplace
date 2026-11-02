<?php

namespace App\Services;

use App\Models\InventoryConversion;
use App\Models\InventoryCount;
use App\Models\MfgDispatch;
use App\Models\MfgLot;
use App\Models\MfgProductionOrder;
use App\Models\MfgPurchaseOrder;
use App\Models\MfgReference;
use App\Models\NumberSequence;
use App\Models\Order;
use App\Models\PurchaseOrder;
use App\Models\PurchaseReturn;
use App\Models\Supplier;
use Closure;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Consecutivos de documentos, atómicos y sin repetir.
 *
 * Antes cada módulo tenía su generador (COUNT()+1, "último + 1" o un aleatorio en el POS):
 * dos peticiones a la vez sacaban el mismo número y, tras borrar un documento, COUNT()+1
 * volvía a dar uno ya emitido → violación del índice único → 500.
 *
 * Cómo funciona:
 *  - Cada serie es una fila de `number_sequences` con clave "tipo:prefijo-con-periodo"
 *    (p. ej. "pos_sale:POS-261102-", "purchase_order:OC-2026-"). El periodo va en el
 *    prefijo, así que la serie se reinicia sola cada día / año como antes.
 *  - next() bloquea la fila (SELECT … FOR UPDATE dentro de una transacción), calcula
 *    max(último entregado, mayor número ya existente en la tabla del documento) + 1 y lo
 *    guarda. Tomar también el máximo existente hace que la serie arranque desde lo que ya
 *    hay en la base (no repite números viejos) y que tampoco choque con códigos escritos a
 *    mano o insertados por fuera del servicio.
 *  - Los números borrados NO se reutilizan (la serie nunca baja).
 *  - Si next() se llama dentro de la transacción del documento (lo recomendado), el bloqueo
 *    dura hasta el commit: dos ventas simultáneas se serializan en ese punto y, si la
 *    transacción se deshace, el número también vuelve atrás.
 *  - peek() muestra el próximo número sin consumirlo (endpoints "generate-number").
 *
 * Uso:
 *   $numbers->next(NumberSequenceService::POS_SALE);                 // POS-261102-0001
 *   $numbers->next(NumberSequenceService::MFG_REFERENCE, ['code' => 'CAM']); // CAM-0001
 *   $numbers->peek(NumberSequenceService::PURCHASE_ORDER);           // OC-2026-0007 (sin consumir)
 *   $numbers->nextValue('mi_serie', fn () => 41);                    // 42 (serie libre)
 *
 * Para una serie nueva: agrega su constante y su entrada en DEFINITIONS
 * (modelo, columna, prefijo con {ymd} / {Y} / {code} y relleno de ceros).
 */
class NumberSequenceService
{
    /** Pedido de la tienda: ORD-aammdd-NNNN. */
    public const ORDER = 'order';

    /** Venta del POS: POS-aammdd-NNNN (antes NNNN era aleatorio). */
    public const POS_SALE = 'pos_sale';

    /** Orden de compra: OC-AAAA-NNNN. */
    public const PURCHASE_ORDER = 'purchase_order';

    /** Devolución de compra: DEV-AAAA-NNNN. */
    public const PURCHASE_RETURN = 'purchase_return';

    /** Conteo de inventario: INV-AAAA-NNNN. */
    public const INVENTORY_COUNT = 'inventory_count';

    /** Conversión de inventario: CONV-AAAA-NNNN. */
    public const INVENTORY_CONVERSION = 'inventory_conversion';

    /** Código sugerido de proveedor: PROV-NNN. */
    public const SUPPLIER = 'supplier';

    /** Fábrica — orden de pedido: PED-AAAA-NNNN. */
    public const MFG_PURCHASE_ORDER = 'mfg_purchase_order';

    /** Fábrica — orden de producción: OP-AAAA-NNNN. */
    public const MFG_PRODUCTION_ORDER = 'mfg_production_order';

    /** Fábrica — lote de producto terminado: L-AAAA-NNNN. */
    public const MFG_LOT = 'mfg_lot';

    /** Fábrica — despacho: DES-AAAA-NNNN. */
    public const MFG_DISPATCH = 'mfg_dispatch';

    /** Fábrica — referencia: {TIPO DE PRENDA}-NNNN (CAM-0001, HOO-0001…). Requiere ['code' => …]. */
    public const MFG_REFERENCE = 'mfg_reference';

    /** Consecutivo global del SKU de producto (PREFIJO-NNNN-TIMESTAMP lo arma ProductService). */
    public const PRODUCT_SKU = 'product_sku';

    private const DEFINITIONS = [
        self::ORDER => [Order::class, 'orderNumber', 'ORD-{ymd}-', 4],
        self::POS_SALE => [Order::class, 'orderNumber', 'POS-{ymd}-', 4],
        self::PURCHASE_ORDER => [PurchaseOrder::class, 'orderNumber', 'OC-{Y}-', 4],
        self::PURCHASE_RETURN => [PurchaseReturn::class, 'returnNumber', 'DEV-{Y}-', 4],
        self::INVENTORY_COUNT => [InventoryCount::class, 'countNumber', 'INV-{Y}-', 4],
        self::INVENTORY_CONVERSION => [InventoryConversion::class, 'conversionNumber', 'CONV-{Y}-', 4],
        self::SUPPLIER => [Supplier::class, 'code', 'PROV-', 3],
        self::MFG_PURCHASE_ORDER => [MfgPurchaseOrder::class, 'code', 'PED-{Y}-', 4],
        self::MFG_PRODUCTION_ORDER => [MfgProductionOrder::class, 'code', 'OP-{Y}-', 4],
        self::MFG_LOT => [MfgLot::class, 'code', 'L-{Y}-', 4],
        self::MFG_DISPATCH => [MfgDispatch::class, 'code', 'DES-{Y}-', 4],
        self::MFG_REFERENCE => [MfgReference::class, 'code', '{code}-', 4],
    ];

    /** Entrega y consume el siguiente número de la serie. */
    public function next(string $type, array $vars = []): string
    {
        [$prefix, $pad, $floor] = $this->resolve($type, $vars);
        $value = $this->nextValue("{$type}:{$prefix}", $floor);

        return $prefix.str_pad((string) $value, $pad, '0', STR_PAD_LEFT);
    }

    /** El número que entregaría next() ahora mismo, sin consumirlo (solo para mostrar). */
    public function peek(string $type, array $vars = []): string
    {
        [$prefix, $pad, $floor] = $this->resolve($type, $vars);
        $value = $this->peekValue("{$type}:{$prefix}", $floor);

        return $prefix.str_pad((string) $value, $pad, '0', STR_PAD_LEFT);
    }

    /**
     * Serie libre: siguiente entero de la clave $key, nunca menor que $floor() + 1.
     * Bloquea la fila hasta que termine la transacción que la envuelve.
     */
    public function nextValue(string $key, ?Closure $floor = null): int
    {
        return DB::transaction(function () use ($key, $floor) {
            $seq = NumberSequence::where('key', $key)->lockForUpdate()->first();
            if (! $seq) {
                // Primera vez: se crea la fila (si otra petición la creó a la vez, se ignora)
                // y se vuelve a leer con bloqueo.
                NumberSequence::query()->insertOrIgnore([
                    'key' => $key, 'lastValue' => 0, 'createdAt' => now(), 'updatedAt' => now(),
                ]);
                $seq = NumberSequence::where('key', $key)->lockForUpdate()->firstOrFail();
            }

            $next = max((int) $seq->lastValue, $floor ? (int) $floor() : 0) + 1;
            $seq->lastValue = $next;
            $seq->save();

            return $next;
        });
    }

    /** Lo que entregaría nextValue() sin bloquear ni escribir. */
    public function peekValue(string $key, ?Closure $floor = null): int
    {
        $last = (int) NumberSequence::where('key', $key)->value('lastValue');

        return max($last, $floor ? (int) $floor() : 0) + 1;
    }

    /** @return array{0: string, 1: int, 2: Closure} prefijo con periodo, relleno y piso. */
    private function resolve(string $type, array $vars): array
    {
        if (! isset(self::DEFINITIONS[$type])) {
            throw new InvalidArgumentException("Serie de numeración desconocida: {$type}");
        }
        [$model, $column, $template, $pad] = self::DEFINITIONS[$type];

        $now = now();
        $prefix = strtr($template, [
            '{ymd}' => $now->format('ymd'),
            '{Y}' => $now->format('Y'),
            '{code}' => (string) ($vars['code'] ?? ''),
        ]);

        return [$prefix, $pad, fn () => $this->maxExisting($model, $column, $prefix)];
    }

    /** Mayor número ya usado en la tabla del documento para ese prefijo (0 si no hay). */
    private function maxExisting(string $model, string $column, string $prefix): int
    {
        $query = $model::query();
        $wrapped = $query->getQuery()->getGrammar()->wrap($column);

        // SUBSTR y CAST(… AS SIGNED INTEGER) funcionan igual en MariaDB/MySQL y SQLite;
        // un sufijo no numérico (código escrito a mano) cuenta como 0.
        return (int) $query->where($column, 'like', $prefix.'%')
            ->selectRaw("MAX(CAST(SUBSTR({$wrapped}, ?) AS SIGNED INTEGER)) as maxNumber", [strlen($prefix) + 1])
            ->value('maxNumber');
    }
}
