<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgBrand;
use Illuminate\Http\Request;

/** Catálogo de marcas de la app Fábrica. */
class MfgBrandController extends Controller
{
    use ApiResponse;

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:120',
            'code' => 'nullable|string|max:20',
            'isActive' => 'boolean',
        ];
    }

    public function index()
    {
        return $this->success(MfgBrand::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        return $this->created(MfgBrand::create($request->validate($this->rules())), 'Marca creada');
    }

    public function update(Request $request, int $id)
    {
        $b = MfgBrand::find($id);
        if (! $b) {
            return $this->error('Marca no encontrada', 404);
        }
        $b->fill($request->validate($this->rules()))->save();

        return $this->success($b, 'Marca actualizada');
    }

    public function destroy(int $id)
    {
        $b = MfgBrand::find($id);
        if (! $b) {
            return $this->error('Marca no encontrada', 404);
        }
        $b->delete();

        return $this->success(null, 'Marca eliminada');
    }
}
