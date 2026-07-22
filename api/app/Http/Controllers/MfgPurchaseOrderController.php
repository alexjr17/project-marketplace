<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgProductionOrder;
use App\Models\MfgPurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Órdenes de pedido de la app Fábrica (como `OrdenPedido`). Un cliente pide
 * varias referencias (matriz talla×color). Desde un pedido se generan las
 * órdenes de producción (una por referencia), copiando la matriz.
 */
class MfgPurchaseOrderController extends Controller
{
    use ApiResponse;

    private const RELATIONS = [
        'client:id,name,businessName,city,phone',
        'collection:id,name,year,semester',
        'items.reference:id,code,name,imagePath',
        'items.color:id,name,hexCode',
        'items.size:id,name,abbreviation,sortOrder',
        'productionOrders:id,code,referenceId,purchaseOrderId,status',
        'productionOrders.reference:id,code,name',
    ];

    public function index(Request $request)
    {
        $query = MfgPurchaseOrder::with(['client:id,name,businessName', 'collection:id,name'])
            ->withCount('items')
            ->orderByDesc('createdAt');
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('search')) {
            $query->where('code', 'like', '%'.$request->string('search').'%');
        }

        return $this->success($query->get());
    }

    public function show(int $id)
    {
        $order = MfgPurchaseOrder::with(self::RELATIONS)->find($id);
        if (! $order) {
            return $this->error('Pedido no encontrado', 404);
        }

        return $this->success($order);
    }

    public function generateNumber()
    {
        return $this->success(['code' => $this->nextCode()]);
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);

        $order = DB::transaction(function () use ($data, $request) {
            $order = MfgPurchaseOrder::create([
                'code' => $this->nextCode(),
                'clientId' => $data['clientId'],
                'collectionId' => $data['collectionId'] ?? null,
                'semester' => $data['semester'] ?? null,
                'status' => $data['status'] ?? 'DRAFT',
                'deliveryDate' => $data['deliveryDate'] ?? null,
                'notes' => $data['notes'] ?? null,
                'createdBy' => $request->user()?->id,
            ]);
            $this->syncItems($order, $data['references']);

            return $order;
        });

        return $this->created($order->load(self::RELATIONS), 'Pedido creado');
    }

    public function update(Request $request, int $id)
    {
        $order = MfgPurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Pedido no encontrado', 404);
        }
        if ($order->productionOrders()->exists()) {
            return $this->error('El pedido ya tiene producción generada; no se puede editar.', 422);
        }
        $data = $this->validateData($request);

        DB::transaction(function () use ($order, $data) {
            $order->update([
                'clientId' => $data['clientId'],
                'collectionId' => $data['collectionId'] ?? null,
                'semester' => $data['semester'] ?? null,
                'deliveryDate' => $data['deliveryDate'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
            // Reemplaza el detalle (solo celdas > 0).
            $order->items()->delete();
            $this->syncItems($order, $data['references']);
        });

        return $this->success($order->load(self::RELATIONS), 'Pedido actualizado');
    }

    public function changeStatus(Request $request, int $id)
    {
        $order = MfgPurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Pedido no encontrado', 404);
        }
        $data = $request->validate(['status' => 'required|in:DRAFT,APPROVED,IN_PRODUCTION,DELIVERED,CANCELLED']);
        $order->status = $data['status'];
        $order->save();

        return $this->success($order->load(self::RELATIONS), 'Estado actualizado');
    }

    public function destroy(int $id)
    {
        $order = MfgPurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Pedido no encontrado', 404);
        }
        if ($order->productionOrders()->exists()) {
            return $this->error('No se puede eliminar: el pedido tiene producción generada.', 422);
        }
        $order->delete();

        return $this->success(null, 'Pedido eliminado');
    }

    /**
     * Genera órdenes de producción desde el pedido: una por cada referencia con
     * celdas aún no enviadas a producción, copiando su matriz talla×color.
     */
    public function generateProduction(Request $request, int $id)
    {
        $order = MfgPurchaseOrder::with('items')->find($id);
        if (! $order) {
            return $this->error('Pedido no encontrado', 404);
        }

        // Filtra por referencias opcionales; por defecto todas las pendientes.
        $onlyRefs = $request->input('referenceIds'); // array | null

        $created = DB::transaction(function () use ($order, $request, $onlyRefs) {
            $pending = $order->items->whereNull('productionOrderId')->where('quantity', '>', 0);
            $byRef = $pending->groupBy('referenceId');
            $created = [];

            foreach ($byRef as $referenceId => $items) {
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
                $prod = MfgProductionOrder::createForReference(
                    (int) $referenceId,
                    array_values($agg),
                    $order->id,
                    $request->user()?->id,
                    'Generada desde pedido '.$order->code,
                );
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
            return $this->error('No hay referencias pendientes por producir en este pedido.', 422);
        }

        return $this->success([
            'purchaseOrder' => $order->load(self::RELATIONS),
            'created' => count($created),
        ], 'Se generaron '.count($created).' orden(es) de producción');
    }

    // ---- helpers ----

    private function validateData(Request $request): array
    {
        return $request->validate([
            'clientId' => 'required|integer|exists:mfg_clients,id',
            'collectionId' => 'nullable|integer|exists:mfg_collections,id',
            'semester' => 'nullable|in:I,II',
            'status' => 'nullable|in:DRAFT,APPROVED,IN_PRODUCTION,DELIVERED,CANCELLED',
            'deliveryDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'references' => 'required|array|min:1',
            'references.*.referenceId' => 'required|integer|exists:mfg_references,id',
            'references.*.items' => 'required|array|min:1',
            'references.*.items.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'references.*.items.*.sizeId' => 'required|integer|exists:mfg_sizes,id',
            'references.*.items.*.quantity' => 'required|integer|min:0',
        ]);
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

    private function nextCode(): string
    {
        $year = now()->year;
        $prefix = 'PED-'.$year.'-';
        $last = MfgPurchaseOrder::where('code', 'like', $prefix.'%')
            ->orderByRaw('CAST(SUBSTRING_INDEX(code, "-", -1) AS UNSIGNED) DESC')
            ->first();
        $n = $last ? ((int) substr(strrchr($last->code, '-'), 1)) + 1 : 1;

        return sprintf('%s%04d', $prefix, $n);
    }
}
