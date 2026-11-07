<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Purchasing\SupplierService;
use Illuminate\Http\Request;

/** Proveedores. Las reglas (código único, borrado) viven en Purchasing\SupplierService. */
class SupplierController extends Controller
{
    use ApiResponse;

    public function __construct(private SupplierService $suppliers) {}

    public function index(Request $request)
    {
        return $this->success($this->suppliers->list($request->only(['search', 'isActive', 'city'])));
    }

    public function stats()
    {
        return $this->success($this->suppliers->stats());
    }

    public function generateCode()
    {
        return $this->success(['code' => $this->suppliers->peekCode()]);
    }

    public function show(int $id)
    {
        return $this->success($this->suppliers->detail($id));
    }

    public function store(Request $request)
    {
        return $this->created($this->suppliers->create($this->validateData($request)), 'Proveedor creado correctamente');
    }

    public function update(Request $request, int $id)
    {
        $data = $this->validateData($request, false);

        return $this->success($this->suppliers->update($id, $data), 'Proveedor actualizado correctamente');
    }

    public function destroy(int $id)
    {
        $this->suppliers->delete($id);

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
