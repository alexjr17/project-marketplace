<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgSize;
use Illuminate\Http\Request;

/**
 * Catálogo de tallas propio de la app Fábrica.
 */
class MfgSizeController extends Controller
{
    use ApiResponse;

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:60',
            'abbreviation' => 'required|string|max:10',
            'market' => 'nullable|in:NATIONAL,EXPORT',
            'sortOrder' => 'nullable|integer|min:0',
            'isActive' => 'boolean',
        ];
    }

    public function index()
    {
        return $this->success(MfgSize::orderBy('sortOrder')->orderBy('id')->get());
    }

    public function store(Request $request)
    {
        return $this->created(MfgSize::create($request->validate($this->rules())), 'Talla creada');
    }

    public function update(Request $request, int $id)
    {
        $s = MfgSize::find($id);
        if (! $s) {
            return $this->error('Talla no encontrada', 404);
        }
        $s->fill($request->validate($this->rules()))->save();

        return $this->success($s, 'Talla actualizada');
    }

    public function destroy(int $id)
    {
        $s = MfgSize::find($id);
        if (! $s) {
            return $this->error('Talla no encontrada', 404);
        }
        $s->delete();

        return $this->success(null, 'Talla eliminada');
    }
}
