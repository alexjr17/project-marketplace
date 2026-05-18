<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    use ApiResponse;

    /** Agrega el conteo de órdenes de compra en formato { _count: { purchaseOrders } }. */
    private function withCount(Supplier $supplier): array
    {
        $arr = $supplier->toArray();
        $arr['_count'] = ['purchaseOrders' => $supplier->purchase_orders_count ?? $supplier->purchaseOrders()->count()];

        return $arr;
    }

    public function index(Request $request)
    {
        $query = Supplier::withCount('purchaseOrders');

        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('code', 'like', "%{$s}%")
                    ->orWhere('taxId', 'like', "%{$s}%")
                    ->orWhere('contactName', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%");
            });
        }
        if ($request->has('isActive')) {
            $query->where('isActive', filter_var($request->query('isActive'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('city')) {
            $query->where('city', $request->query('city'));
        }

        $suppliers = $query->orderBy('name')->get()->map(fn ($s) => $this->withCount($s));

        return $this->success($suppliers);
    }

    public function stats()
    {
        return $this->success([
            'total' => Supplier::count(),
            'active' => Supplier::where('isActive', true)->count(),
            'withOrders' => Supplier::has('purchaseOrders')->count(),
        ]);
    }

    public function generateCode()
    {
        $last = Supplier::where('code', 'like', 'PROV-%')->orderByDesc('code')->first();
        $next = $last ? ((int) str_replace('PROV-', '', $last->code)) + 1 : 1;

        return $this->success(['code' => 'PROV-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT)]);
    }

    public function show(int $id)
    {
        $supplier = Supplier::withCount('purchaseOrders')
            ->with(['purchaseOrders' => fn ($q) => $q->with('items')->orderByDesc('createdAt')->take(10)])
            ->find($id);

        if (! $supplier) {
            return $this->error('Proveedor no encontrado', 404);
        }

        $arr = $this->withCount($supplier);
        $arr['purchaseOrders'] = $supplier->purchaseOrders;

        return $this->success($arr);
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);

        if (Supplier::where('code', $data['code'])->exists()) {
            return $this->error('Ya existe un proveedor con este código', 400);
        }

        $supplier = Supplier::create($data + ['country' => $data['country'] ?? 'Colombia', 'isActive' => $data['isActive'] ?? true]);

        return $this->created($supplier, 'Proveedor creado correctamente');
    }

    public function update(Request $request, int $id)
    {
        $supplier = Supplier::find($id);
        if (! $supplier) {
            return $this->error('Proveedor no encontrado', 404);
        }

        $data = $this->validateData($request, false);

        if (! empty($data['code']) && $data['code'] !== $supplier->code
            && Supplier::where('code', $data['code'])->exists()) {
            return $this->error('Ya existe un proveedor con este código', 400);
        }

        $supplier->fill($data);
        $supplier->save();

        return $this->success($supplier, 'Proveedor actualizado correctamente');
    }

    public function destroy(int $id)
    {
        $count = PurchaseOrder::where('supplierId', $id)->count();
        if ($count > 0) {
            return $this->error("No se puede eliminar: el proveedor tiene {$count} órdenes de compra asociadas", 400);
        }

        $supplier = Supplier::find($id);
        if (! $supplier) {
            return $this->error('Proveedor no encontrado', 404);
        }
        $supplier->delete();

        return $this->success(null, 'Proveedor eliminado correctamente');
    }

    private function validateData(Request $request, bool $creating = true): array
    {
        $req = $creating ? 'required' : 'nullable';

        return $request->validate([
            'code' => "{$req}|string",
            'name' => "{$req}|string",
            'taxId' => 'nullable|string',
            'taxIdType' => 'nullable|string',
            'contactName' => 'nullable|string',
            'email' => 'nullable|string',
            'phone' => 'nullable|string',
            'altPhone' => 'nullable|string',
            'website' => 'nullable|string',
            'address' => 'nullable|string',
            'city' => 'nullable|string',
            'department' => 'nullable|string',
            'postalCode' => 'nullable|string',
            'country' => 'nullable|string',
            'paymentTerms' => 'nullable|string',
            'paymentMethod' => 'nullable|string',
            'bankName' => 'nullable|string',
            'bankAccountType' => 'nullable|string',
            'bankAccount' => 'nullable|string',
            'notes' => 'nullable|string',
            'isActive' => 'nullable|boolean',
        ]);
    }
}
