<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Discount;
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
            // Automático aplica solo a producto o categoría; con código admite todo.
            'appliesTo' => $isAuto ? 'nullable|in:product,category' : 'nullable|in:all,product,category,user',
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

    // ==================== ADMIN ====================

    public function index()
    {
        return $this->success(Discount::orderByDesc('createdAt')->get());
    }

    public function store(Request $request)
    {
        return $this->created($this->discounts->save($request->validate($this->rules($request))), 'Descuento creado');
    }

    public function update(Request $request, int $id)
    {
        $d = Discount::find($id);
        if (! $d) {
            return $this->error('Descuento no encontrado', 404);
        }

        return $this->success($this->discounts->save($request->validate($this->rules($request, $id)), $d), 'Descuento actualizado');
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

        try {
            $result = $this->discounts->validateForItems(
                $data['code'],
                $data['items'] ?? [],
                $data['channel'] ?? 'online',
                $request->user()?->id,
            );
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
