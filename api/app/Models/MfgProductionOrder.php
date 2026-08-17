<?php

namespace App\Models;

/**
 * Orden de producción manual de la app Fábrica.
 */
class MfgProductionOrder extends BaseModel
{
    protected $table = 'mfg_production_orders';

    protected $casts = [
        'startedAt' => 'datetime',
        'finishedAt' => 'datetime',
        'scheduledAt' => 'datetime',
        'estimatedDeliveryAt' => 'datetime',
    ];

    /** Próximo código OP-{año}-####. */
    public static function nextCode(): string
    {
        $year = now()->year;
        $prefix = 'OP-'.$year.'-';
        $last = self::where('code', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING_INDEX(code, "-", -1) AS UNSIGNED) DESC')
            ->first();
        $n = $last ? ((int) substr(strrchr($last->code, '-'), 1)) + 1 : 1;

        return sprintf('%s%04d', $prefix, $n);
    }

    /** Genera las etapas de la orden desde el catálogo de procesos activos (en orden). */
    public function generateStages(): void
    {
        $processes = MfgProcess::where('isActive', true)->orderBy('sequence')->orderBy('id')->get();
        foreach ($processes as $i => $process) {
            $this->stages()->create([
                'processId' => $process->id,
                'sequence' => $process->sequence ?: ($i + 1),
                'status' => 'PENDING',
            ]);
        }
    }

    /**
     * Crea una orden de producción para una referencia con su matriz de ítems
     * ([{colorId,sizeId,quantity}]) y genera sus etapas. Reutilizado por la
     * creación manual y por la generación desde una orden de pedido.
     */
    public static function createForReference(int $referenceId, array $items, array $attrs = []): self
    {
        $order = self::create(array_merge([
            'code' => self::nextCode(),
            'referenceId' => $referenceId,
            'status' => 'PROGRAMMED',
        ], $attrs));
        foreach ($items as $it) {
            if ((int) ($it['quantity'] ?? 0) <= 0) {
                continue;
            }
            $order->items()->create([
                'colorId' => $it['colorId'],
                'sizeId' => $it['sizeId'],
                'quantity' => $it['quantity'],
            ]);
        }
        $order->generateStages();

        return $order;
    }

    public function reference()
    {
        return $this->belongsTo(MfgReference::class, 'referenceId');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(MfgPurchaseOrder::class, 'purchaseOrderId');
    }

    public function warehouse()
    {
        return $this->belongsTo(MfgWarehouse::class, 'warehouseId');
    }

    public function collection()
    {
        return $this->belongsTo(MfgCollection::class, 'collectionId');
    }

    public function items()
    {
        return $this->hasMany(MfgProductionOrderItem::class, 'productionOrderId');
    }

    public function stages()
    {
        return $this->hasMany(MfgProductionOrderStage::class, 'productionOrderId');
    }

    public function lots()
    {
        return $this->hasMany(MfgLot::class, 'productionOrderId');
    }

    public function substitutions()
    {
        return $this->hasMany(MfgOrderInputSubstitution::class, 'productionOrderId');
    }
}
