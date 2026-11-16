<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Customizer\DesignLibraryService;
use Illuminate\Http\Request;

/** Familias de diseños (pack familiar). Reglas en DesignLibraryService. */
class DesignFamilyController extends Controller
{
    use ApiResponse;

    public function __construct(private DesignLibraryService $library) {}

    /** GET /design-families?season= (tienda: solo las activas con diseños activos) */
    public function index(Request $request)
    {
        return $this->success($this->library->families(true, $request->query('season')));
    }

    /** GET /design-families/{id} */
    public function show(int $id)
    {
        return $this->success($this->library->family($id, true));
    }

    /** GET /design-families/admin (todas, con los diseños inactivos) */
    public function adminIndex()
    {
        return $this->success($this->library->families(false));
    }

    public function store(Request $request)
    {
        return $this->created($this->library->saveFamily(null, $this->validated($request, true)), 'Familia creada');
    }

    public function update(Request $request, int $id)
    {
        return $this->success($this->library->saveFamily($id, $this->validated($request, false)), 'Familia guardada');
    }

    public function destroy(int $id)
    {
        $this->library->deleteFamily($id);

        return $this->success(null, 'Familia eliminada');
    }

    private function validated(Request $request, bool $creating): array
    {
        return $request->validate([
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:120'],
            'description' => 'sometimes|nullable|string|max:500',
            'season' => 'sometimes|nullable|string|max:30',
            'sortOrder' => 'sometimes|integer',
            'isActive' => 'sometimes|boolean',
            'designs' => 'sometimes|array|max:12',
            'designs.*.id' => 'required|integer|distinct|exists:design_images,id',
            'designs.*.role' => 'nullable|string|max:40',
        ]);
    }
}
