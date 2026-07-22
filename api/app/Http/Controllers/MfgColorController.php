<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgColor;
use Illuminate\Http\Request;

/**
 * Catálogo de colores propio de la app Fábrica.
 */
class MfgColorController extends Controller
{
    use ApiResponse;

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:80',
            'hexCode' => 'nullable|string|max:9',
            'code' => 'nullable|string|max:10',
            'isActive' => 'boolean',
        ];
    }

    public function index()
    {
        return $this->success(MfgColor::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        return $this->created(MfgColor::create($request->validate($this->rules())), 'Color creado');
    }

    public function update(Request $request, int $id)
    {
        $c = MfgColor::find($id);
        if (! $c) {
            return $this->error('Color no encontrado', 404);
        }
        $c->fill($request->validate($this->rules()))->save();

        return $this->success($c, 'Color actualizado');
    }

    public function destroy(int $id)
    {
        $c = MfgColor::find($id);
        if (! $c) {
            return $this->error('Color no encontrado', 404);
        }
        $c->delete();

        return $this->success(null, 'Color eliminado');
    }
}
