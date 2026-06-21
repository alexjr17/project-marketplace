<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Discount;
use App\Models\Product;
use App\Services\DiscountService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

class DiscountController extends Controller
{
    use ApiResponse;

    public function __construct(private DiscountService $discounts) {}

    private function rules(Request $request, int $ignoreId = 0): array
    {
        $isAuto = $request->boolean('isAuto');

        return [
            'isAuto' => 'boolean',
            // Con código (canjeable) requiere code; automático no lo necesita.
            'code' => [$isAuto ? 'nullable' : 'required', 'nullable', 'string', 'max:60', Rule::unique('discounts', 'code')->ignore($ignoreId)],
            'name' => 'nullable|string',
            'type' => 'required|in:percent,fixed',
            'value' => 'required|numeric|min:0',
            // Automático aplica a producto/categoría/todo (no por usuario).
            'appliesTo' => $isAuto ? 'nullable|in:all,product,category' : 'nullable|in:all,product,category,user',
            'targetIds' => 'nullable|array',
            'targetIds.*' => 'integer',
            'channel' => 'nullable|in:all,online,pos',
            'minSubtotal' => 'nullable|numeric|min:0',
            'maxUses' => 'nullable|integer|min:1',
            'maxUsesPerUser' => 'nullable|integer|min:1',
            'isActive' => 'boolean',
            'startsAt' => 'nullable|date',
            'endsAt' => 'nullable|date',
        ];
    }

    /** Normaliza el código: mayúsculas, o null si es automático. */
    private function normalizeCode(array $data): array
    {
        $data['code'] = ! empty($data['code']) ? strtoupper(trim($data['code'])) : null;

        return $data;
    }

    // ==================== ADMIN ====================

    public function index()
    {
        return $this->success(Discount::orderByDesc('createdAt')->get());
    }

    public function store(Request $request)
    {
        $data = $this->normalizeCode($request->validate($this->rules($request)));

        return $this->created(Discount::create($data), 'Descuento creado');
    }

    public function update(Request $request, int $id)
    {
        $d = Discount::find($id);
        if (! $d) {
            return $this->error('Descuento no encontrado', 404);
        }
        $data = $this->normalizeCode($request->validate($this->rules($request, $id)));
        $d->fill($data)->save();

        return $this->success($d, 'Descuento actualizado');
    }

    public function destroy(int $id)
    {
        $d = Discount::find($id);
        if (! $d) {
            return $this->error('Cupón no encontrado', 404);
        }
        $d->delete();

        return $this->success(null, 'Cupón eliminado');
    }

    // ==================== VALIDACIÓN (checkout / POS) ====================

    /**
     * Valida un cupón y devuelve el monto del descuento, sin aplicarlo.
     * Recibe el código, el canal y los ítems (productId + quantity).
     */
    public function validateCoupon(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string',
            'channel' => 'nullable|in:online,pos',
            'items' => 'nullable|array',
            'items.*.productId' => 'nullable|integer',
            'items.*.price' => 'nullable|numeric',
            'items.*.quantity' => 'nullable|integer',
        ]);

        // Resolver categoría/oferta y subtotal a partir de los ítems (no confiamos en el front).
        $items = [];
        $subtotal = 0;
        $channel = $data['channel'] ?? 'online';
        $autos = $this->discounts->activeAutoDiscounts($channel);
        $productIds = collect($data['items'] ?? [])->pluck('productId')->filter()->unique()->all();
        $products = Product::whereIn('id', $productIds)->get()->keyBy('id');

        foreach (($data['items'] ?? []) as $it) {
            $pid = (int) ($it['productId'] ?? 0);
            $product = $products[$pid] ?? null;
            // Precio confiable: el del backend con la oferta automática ya aplicada.
            $price = $product ? $this->discounts->autoPrice($product, $autos) : (float) ($it['price'] ?? 0);
            $qty = (int) ($it['quantity'] ?? 0);
            $subtotal += $price * $qty;
            $items[] = [
                'productId' => $pid,
                'categoryId' => $product?->categoryId,
                'price' => $price,
                'quantity' => $qty,
                // No acumulable: marcar si el producto ya tiene oferta automática.
                'discounted' => $product ? $price < (float) $product->basePrice : false,
            ];
        }

        try {
            $result = $this->discounts->validate($data['code'], [
                'subtotal' => $subtotal,
                'items' => $items,
                'userId' => $request->user()?->id,
                'channel' => $channel,
            ]);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        $d = $result['discount'];

        return $this->success([
            'code' => $d->code,
            'name' => $d->name,
            'type' => $d->type,
            'value' => $d->value,
            'amount' => $result['amount'],
        ], 'Cupón válido');
    }
}
