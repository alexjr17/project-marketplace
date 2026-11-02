<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Http\Requests\ReceivePurchaseOrderRequest;
use App\Models\InputBatchMovement;
use App\Models\InputVariantMovement;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\VariantMovement;
use App\Services\PurchaseOrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PurchaseOrderController extends Controller
{
    use ApiResponse;

    public function __construct(private PurchaseOrderService $purchaseOrders) {}

    private const VALID_TRANSITIONS = [
        'DRAFT' => ['SENT', 'CANCELLED'],
        'SENT' => ['CONFIRMED', 'CANCELLED'],
        'CONFIRMED' => ['PARTIAL', 'RECEIVED', 'CANCELLED'],
        'PARTIAL' => ['RECEIVED', 'CANCELLED'],
        'RECEIVED' => [],
        'CANCELLED' => [],
    ];

    private const LIST_RELATIONS = [
        'supplier:id,code,name',
        'items.variant:id,sku,productId',
        'items.variant.product:id,name',
        'items.input:id,code,name',
    ];

    private const DETAIL_RELATIONS = [
        'supplier',
        'items.variant.product:id,name,sku',
        'items.variant.color:id,name,hexCode',
        'items.variant.size:id,name,abbreviation',
        'items.input.inputType:id,name',
        'items.inputVariant.input:id,name,code',
        'items.inputVariant.color:id,name,hexCode',
        'items.inputVariant.size:id,name,abbreviation',
    ];

    public function index(Request $request)
    {
        $query = PurchaseOrder::with(self::LIST_RELATIONS);

        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('orderNumber', 'like', "%{$s}%")
                    ->orWhere('supplierInvoice', 'like', "%{$s}%")
                    ->orWhereHas('supplier', fn ($sup) => $sup->where('name', 'like', "%{$s}%"));
            });
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('supplierId')) {
            $query->where('supplierId', $request->query('supplierId'));
        }
        if ($request->filled('fromDate')) {
            $query->where('orderDate', '>=', $request->query('fromDate'));
        }
        if ($request->filled('toDate')) {
            $query->where('orderDate', '<=', $request->query('toDate'));
        }

        return $this->success($query->orderByDesc('createdAt')->get());
    }

    public function stats()
    {
        $byStatus = PurchaseOrder::selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');
        $monthly = PurchaseOrder::where('status', 'RECEIVED')
            ->where('receivedDate', '>=', now()->startOfMonth())->sum('total');

        $counts = fn ($s) => (int) ($byStatus[$s] ?? 0);

        return $this->success([
            'total' => PurchaseOrder::count(),
            'byStatus' => [
                'draft' => $counts('DRAFT'), 'sent' => $counts('SENT'),
                'confirmed' => $counts('CONFIRMED'), 'partial' => $counts('PARTIAL'),
                'received' => $counts('RECEIVED'), 'cancelled' => $counts('CANCELLED'),
            ],
            'pendingCount' => $counts('DRAFT') + $counts('SENT') + $counts('CONFIRMED') + $counts('PARTIAL'),
            'monthlyTotal' => (float) $monthly,
        ]);
    }

    public function generateNumber()
    {
        return $this->success(['orderNumber' => $this->purchaseOrders->peekNumber()]);
    }

    public function show(int $id)
    {
        $order = PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id);

        return $order ? $this->success($order) : $this->error('Orden de compra no encontrada', 404);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplierId' => 'required|integer',
            'expectedDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'nullable|integer',
            'items.*.inputId' => 'nullable|integer',
            'items.*.inputVariantId' => 'nullable|integer',
            'items.*.description' => 'nullable|string',
            'items.*.quantity' => 'required|numeric|min:0',
            'items.*.unitCost' => 'required|numeric|min:0',
            'items.*.notes' => 'nullable|string',
        ]);

        $order = $this->purchaseOrders->create($data, $request->user()->id);

        return $this->created(PurchaseOrder::with(self::DETAIL_RELATIONS)->find($order->id), 'Orden de compra creada');
    }

    public function update(Request $request, int $id)
    {
        $order = PurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }
        if ($order->status !== 'DRAFT') {
            return $this->error('Solo se pueden editar órdenes en estado borrador', 400);
        }

        $data = $request->validate([
            'supplierId' => 'nullable|integer',
            'expectedDate' => 'nullable|date',
            'notes' => 'nullable|string',
            'supplierInvoice' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.variantId' => 'nullable|integer',
            'items.*.inputId' => 'nullable|integer',
            'items.*.inputVariantId' => 'nullable|integer',
            'items.*.description' => 'nullable|string',
            'items.*.quantity' => 'required_with:items|numeric|min:0',
            'items.*.unitCost' => 'required_with:items|numeric|min:0',
            'items.*.notes' => 'nullable|string',
        ]);

        DB::transaction(function () use ($order, $data) {
            $subtotal = (float) $order->subtotal;
            if (array_key_exists('items', $data) && is_array($data['items'])) {
                PurchaseOrderItem::where('purchaseOrderId', $order->id)->delete();
                $subtotal = 0;
                foreach ($data['items'] as $item) {
                    $sub = $item['quantity'] * $item['unitCost'];
                    $subtotal += $sub;
                    PurchaseOrderItem::create([
                        'purchaseOrderId' => $order->id,
                        'variantId' => $item['variantId'] ?? null,
                        'inputId' => $item['inputId'] ?? null,
                        'inputVariantId' => $item['inputVariantId'] ?? null,
                        'description' => $item['description'] ?? null,
                        'quantity' => $item['quantity'],
                        'unitCost' => $item['unitCost'],
                        'subtotal' => $sub,
                        'notes' => $item['notes'] ?? null,
                    ]);
                }
            }
            foreach (['supplierId', 'expectedDate', 'notes', 'supplierInvoice'] as $f) {
                if (array_key_exists($f, $data) && $data[$f] !== null) {
                    $order->{$f} = $data[$f];
                }
            }
            $order->subtotal = $subtotal;
            $order->total = $subtotal;
            $order->save();
        });

        return $this->success(PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id), 'Orden actualizada');
    }

    public function updateStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => 'required|in:DRAFT,SENT,CONFIRMED,PARTIAL,RECEIVED,CANCELLED',
        ]);
        $order = PurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }
        if (! in_array($data['status'], self::VALID_TRANSITIONS[$order->status] ?? [], true)) {
            return $this->error("No se puede cambiar de {$order->status} a {$data['status']}", 400);
        }

        $order->status = $data['status'];
        if ($data['status'] === 'RECEIVED') {
            $order->receivedDate = now();
        }
        $order->save();

        return $this->success(PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id), 'Estado actualizado');
    }

    public function receive(ReceivePurchaseOrderRequest $request, int $id)
    {
        try {
            $this->purchaseOrders->receive($id, $request->validated('items'), $request->user()->id);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), $e->getCode() === 404 ? 404 : 400);
        }

        return $this->success(PurchaseOrder::with(self::DETAIL_RELATIONS)->find($id), 'Items recibidos');
    }

    public function destroy(Request $request, int $id)
    {
        $order = PurchaseOrder::find($id);
        if (! $order) {
            return $this->error('Orden de compra no encontrada', 404);
        }

        // ?force=1 (solo admin): permite eliminar órdenes en cualquier estado,
        // limpiando en cascada sus ítems y los movimientos de inventario que
        // generó su recepción. Sin force se mantiene la regla normal.
        $force = $request->boolean('force');

        if (! $force && ! in_array($order->status, ['DRAFT', 'CANCELLED'], true)) {
            return $this->error('Solo se pueden eliminar órdenes en borrador o canceladas', 400);
        }

        DB::transaction(function () use ($order) {
            VariantMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            InputBatchMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            InputVariantMovement::where('referenceType', 'purchase_order')->where('referenceId', $order->id)->delete();
            PurchaseOrderItem::where('purchaseOrderId', $order->id)->delete();
            $order->delete();
        });

        return $this->success(null, 'Orden eliminada correctamente');
    }
}
