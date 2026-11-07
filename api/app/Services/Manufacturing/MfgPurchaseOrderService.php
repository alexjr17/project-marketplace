<?php

namespace App\Services\Manufacturing;

use App\Exceptions\BusinessRuleException;
use App\Models\MfgCollection;
use App\Models\MfgPurchaseOrder;
use App\Services\NumberSequenceService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Pedidos de clientes de Fábrica: un cliente pide varias referencias (matriz talla×color).
 * Desde un pedido se generan las órdenes de producción (una por referencia), copiando la matriz.
 */
class MfgPurchaseOrderService
{
    public const RELATIONS = [
        'client:id,name,businessName,city,phone',
        'collection:id,name,year,semester',
        'items.reference:id,code,name,imagePath',
        'items.color:id,name,hexCode',
        'items.size:id,name,abbreviation,sortOrder',
        'productionOrders:id,code,referenceId,purchaseOrderId,status',
        'productionOrders.reference:id,code,name',
    ];

    public function __construct(
        private NumberSequenceService $numbers,
        private MfgProductionOrderService $production,
    ) {}

    /** @param array{status?:?string, search?:?string} $filters */
    public function list(array $filters = []): Collection
    {
        $query = MfgPurchaseOrder::with(['client:id,name,businessName', 'collection:id,name'])
            ->withCount('items')
            ->orderByDesc('createdAt');
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['search'])) {
            $query->where('code', 'like', '%'.$filters['search'].'%');
        }

        return $query->get();
    }

    public function detail(int $id): MfgPurchaseOrder
    {
        return $this->findOrFail($id)->load(self::RELATIONS);
    }

    public function peekCode(): string
    {
        return $this->numbers->peek(NumberSequenceService::MFG_PURCHASE_ORDER);
    }

    public function create(array $data, ?int $userId): MfgPurchaseOrder
    {
        $order = DB::transaction(function () use ($data, $userId) {
            $order = MfgPurchaseOrder::create([
                'code' => $this->numbers->next(NumberSequenceService::MFG_PURCHASE_ORDER),
                'clientId' => $data['clientId'],
                'collectionId' => $data['collectionId'] ?? null,
                'semester' => $this->semesterFrom($data),
                'market' => $data['market'] ?? 'NATIONAL',
                'status' => $data['status'] ?? 'DRAFT',
                'dispatchStartDate' => $data['dispatchStartDate'] ?? null,
                'deliveryDate' => $data['deliveryDate'] ?? null,
                'partialDates' => $this->cleanDates($data['partialDates'] ?? null),
                'notes' => $data['notes'] ?? null,
                'createdBy' => $userId,
            ]);
            $this->syncItems($order, $data['references']);

            return $order;
        });

        return $order->load(self::RELATIONS);
    }

    /** 404 si no existe; 422 si ya tiene producción generada (no se edita). */
    public function assertEditable(int $id): MfgPurchaseOrder
    {
        $order = $this->findOrFail($id);
        if ($order->productionOrders()->exists()) {
            throw new BusinessRuleException('El pedido ya tiene producción generada; no se puede editar.');
        }

        return $order;
    }

    public function update(int $id, array $data): MfgPurchaseOrder
    {
        $order = $this->assertEditable($id);

        DB::transaction(function () use ($order, $data) {
            $order->update([
                'clientId' => $data['clientId'],
                'collectionId' => $data['collectionId'] ?? null,
                'semester' => $this->semesterFrom($data),
                // Sin market en el PUT se conserva el actual (no se reinicia a Nacional).
                'market' => $data['market'] ?? $order->market,
                'dispatchStartDate' => $data['dispatchStartDate'] ?? null,
                'deliveryDate' => $data['deliveryDate'] ?? null,
                'partialDates' => $this->cleanDates($data['partialDates'] ?? null),
                'notes' => $data['notes'] ?? null,
            ]);
            // Reemplaza el detalle (solo celdas > 0).
            $order->items()->delete();
            $this->syncItems($order, $data['references']);
        });

        return $order->load(self::RELATIONS);
    }

    public function changeStatus(int $id, string $status): MfgPurchaseOrder
    {
        $order = $this->findOrFail($id);
        $order->status = $status;
        $order->save();

        return $order->load(self::RELATIONS);
    }

    public function delete(int $id): void
    {
        $order = $this->findOrFail($id);
        if ($order->productionOrders()->exists()) {
            throw new BusinessRuleException('No se puede eliminar: el pedido tiene producción generada.');
        }
        $order->delete();
    }

    /**
     * Genera órdenes de producción desde el pedido: una por cada referencia con celdas aún no
     * enviadas a producción, copiando su matriz talla×color. Un pedido anulado no genera
     * producción (antes pasaba a IN_PRODUCTION igual).
     *
     * @param  int[]|null  $onlyRefs  referencias a generar; null = todas las pendientes
     * @return array{purchaseOrder: MfgPurchaseOrder, created: int}
     */
    public function generateProduction(int $id, ?array $onlyRefs, ?int $userId): array
    {
        $order = MfgPurchaseOrder::with('items')->find($id);
        if (! $order) {
            throw new BusinessRuleException('Pedido no encontrado', 404);
        }
        if ($order->status === 'CANCELLED') {
            throw new BusinessRuleException('El pedido está anulado; no se puede generar producción.');
        }

        $created = DB::transaction(function () use ($order, $userId, $onlyRefs) {
            $pending = $order->items->whereNull('productionOrderId')->where('quantity', '>', 0);
            $created = [];

            foreach ($pending->groupBy('referenceId') as $referenceId => $items) {
                if (is_array($onlyRefs) && ! in_array((int) $referenceId, array_map('intval', $onlyRefs), true)) {
                    continue;
                }
                // Agrega por color×talla (por si hubiera duplicados).
                $agg = [];
                foreach ($items as $it) {
                    $key = $it->colorId.'-'.$it->sizeId;
                    $agg[$key] = [
                        'colorId' => $it->colorId,
                        'sizeId' => $it->sizeId,
                        'quantity' => ($agg[$key]['quantity'] ?? 0) + $it->quantity,
                    ];
                }
                $prod = $this->production->createForReference((int) $referenceId, array_values($agg), [
                    'purchaseOrderId' => $order->id,
                    'collectionId' => $order->collectionId,
                    'semester' => $order->semester,
                    'market' => $order->market,
                    'notes' => 'Generada desde pedido '.$order->code,
                    'createdBy' => $userId,
                ]);
                // Marca las celdas del pedido como enviadas a producción.
                $order->items()->where('referenceId', $referenceId)->whereNull('productionOrderId')
                    ->update(['productionOrderId' => $prod->id]);
                $created[] = $prod;
            }

            if (! empty($created) && $order->status !== 'DELIVERED') {
                $order->status = 'IN_PRODUCTION';
                $order->save();
            }

            return $created;
        });

        if (empty($created)) {
            throw new BusinessRuleException('No hay referencias pendientes por producir en este pedido.');
        }

        return ['purchaseOrder' => $order->load(self::RELATIONS), 'created' => count($created)];
    }

    // ---- reglas internas ----

    public function findOrFail(int $id): MfgPurchaseOrder
    {
        $order = MfgPurchaseOrder::find($id);
        if (! $order) {
            throw new BusinessRuleException('Pedido no encontrado', 404);
        }

        return $order;
    }

    /** Limpia la lista de fechas parciales (quita vacías, reindexada). */
    private function cleanDates(?array $dates): ?array
    {
        if (empty($dates)) {
            return null;
        }
        $clean = array_values(array_filter($dates, fn ($d) => ! empty($d)));

        return $clean ?: null;
    }

    /** El semestre se toma de la colección (que ya incluye año+semestre). */
    private function semesterFrom(array $data): ?string
    {
        if (! empty($data['collectionId'])) {
            $sem = MfgCollection::whereKey($data['collectionId'])->value('semester');
            if ($sem) {
                return $sem;
            }
        }

        return $data['semester'] ?? null;
    }

    private function syncItems(MfgPurchaseOrder $order, array $references): void
    {
        foreach ($references as $ref) {
            foreach ($ref['items'] as $it) {
                if ((int) $it['quantity'] <= 0) {
                    continue;
                }
                $order->items()->create([
                    'referenceId' => $ref['referenceId'],
                    'colorId' => $it['colorId'],
                    'sizeId' => $it['sizeId'],
                    'quantity' => $it['quantity'],
                ]);
            }
        }
    }
}
