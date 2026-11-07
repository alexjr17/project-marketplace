<?php

namespace App\Services\Purchasing;

use App\Exceptions\BusinessRuleException;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Services\NumberSequenceService;

/**
 * Proveedores: código único (PROV-NNN sugerido por la serie), y no se borra un proveedor
 * con órdenes de compra.
 */
class SupplierService
{
    public function __construct(private NumberSequenceService $numbers) {}

    public function peekCode(): string
    {
        return $this->numbers->peek(NumberSequenceService::SUPPLIER);
    }

    public function list(array $filters): array
    {
        $query = Supplier::withCount('purchaseOrders');

        if (! empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('code', 'like', "%{$s}%")
                    ->orWhere('taxId', 'like', "%{$s}%")
                    ->orWhere('contactName', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%");
            });
        }
        if (array_key_exists('isActive', $filters) && $filters['isActive'] !== null) {
            $query->where('isActive', filter_var($filters['isActive'], FILTER_VALIDATE_BOOLEAN));
        }
        if (! empty($filters['city'])) {
            $query->where('city', $filters['city']);
        }

        return $query->orderBy('name')->get()->map(fn ($s) => $this->withCount($s))->all();
    }

    public function stats(): array
    {
        return [
            'total' => Supplier::count(),
            'active' => Supplier::where('isActive', true)->count(),
            'withOrders' => Supplier::has('purchaseOrders')->count(),
        ];
    }

    /** Proveedor con el conteo y sus últimas 10 órdenes. */
    public function detail(int $id): array
    {
        $supplier = Supplier::withCount('purchaseOrders')
            ->with(['purchaseOrders' => fn ($q) => $q->with('items')->orderByDesc('createdAt')->take(10)])
            ->find($id) ?? throw new BusinessRuleException('Proveedor no encontrado', 404);

        $arr = $this->withCount($supplier);
        $arr['purchaseOrders'] = $supplier->purchaseOrders;

        return $arr;
    }

    public function create(array $data): Supplier
    {
        $this->assertCodeFree($data['code']);

        return Supplier::create($data + ['country' => $data['country'] ?? 'Colombia', 'isActive' => $data['isActive'] ?? true]);
    }

    public function update(int $id, array $data): Supplier
    {
        $supplier = Supplier::find($id) ?? throw new BusinessRuleException('Proveedor no encontrado', 404);
        if (! empty($data['code']) && $data['code'] !== $supplier->code) {
            $this->assertCodeFree($data['code']);
        }

        $supplier->fill($data);
        $supplier->save();

        return $supplier;
    }

    public function delete(int $id): void
    {
        $count = PurchaseOrder::where('supplierId', $id)->count();
        if ($count > 0) {
            throw new BusinessRuleException("No se puede eliminar: el proveedor tiene {$count} órdenes de compra asociadas", 400);
        }

        $supplier = Supplier::find($id) ?? throw new BusinessRuleException('Proveedor no encontrado', 404);
        $supplier->delete();
    }

    private function assertCodeFree(string $code): void
    {
        if (Supplier::where('code', $code)->exists()) {
            throw new BusinessRuleException('Ya existe un proveedor con este código', 400);
        }
    }

    /** Agrega el conteo de órdenes de compra en formato { _count: { purchaseOrders } }. */
    private function withCount(Supplier $supplier): array
    {
        $arr = $supplier->toArray();
        $arr['_count'] = ['purchaseOrders' => $supplier->purchase_orders_count ?? $supplier->purchaseOrders()->count()];

        return $arr;
    }
}
