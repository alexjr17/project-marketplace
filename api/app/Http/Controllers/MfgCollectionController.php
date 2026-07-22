<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgCollection;
use Illuminate\Http\Request;

/**
 * Catálogo de colecciones (año + semestre) de la app Fábrica.
 */
class MfgCollectionController extends Controller
{
    use ApiResponse;

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:120',
            'year' => 'nullable|integer|min:2000|max:2100',
            'semester' => 'nullable|in:I,II',
            'isActive' => 'boolean',
        ];
    }

    public function index()
    {
        return $this->success(MfgCollection::orderByDesc('year')->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        return $this->created(MfgCollection::create($request->validate($this->rules())), 'Colección creada');
    }

    public function update(Request $request, int $id)
    {
        $c = MfgCollection::find($id);
        if (! $c) {
            return $this->error('Colección no encontrada', 404);
        }
        $c->fill($request->validate($this->rules()))->save();

        return $this->success($c, 'Colección actualizada');
    }

    public function destroy(int $id)
    {
        $c = MfgCollection::find($id);
        if (! $c) {
            return $this->error('Colección no encontrada', 404);
        }
        $c->delete();

        return $this->success(null, 'Colección eliminada');
    }
}
