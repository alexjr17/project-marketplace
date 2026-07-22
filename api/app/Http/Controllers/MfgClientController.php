<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgClient;
use Illuminate\Http\Request;

/** Catálogo de clientes de la app Fábrica. */
class MfgClientController extends Controller
{
    use ApiResponse;

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:150',
            'documentId' => 'nullable|string|max:40',
            'businessName' => 'nullable|string|max:150',
            'phone' => 'nullable|string|max:40',
            'city' => 'nullable|string|max:100',
            'isActive' => 'boolean',
        ];
    }

    public function index()
    {
        return $this->success(MfgClient::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        return $this->created(MfgClient::create($request->validate($this->rules())), 'Cliente creado');
    }

    public function update(Request $request, int $id)
    {
        $c = MfgClient::find($id);
        if (! $c) {
            return $this->error('Cliente no encontrado', 404);
        }
        $c->fill($request->validate($this->rules()))->save();

        return $this->success($c, 'Cliente actualizado');
    }

    public function destroy(int $id)
    {
        $c = MfgClient::find($id);
        if (! $c) {
            return $this->error('Cliente no encontrado', 404);
        }
        if ($c->purchaseOrders()->exists()) {
            return $this->error('No se puede eliminar: el cliente tiene pedidos.', 422);
        }
        $c->delete();

        return $this->success(null, 'Cliente eliminado');
    }
}
