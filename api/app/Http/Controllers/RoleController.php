<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Users\RoleService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Roles y permisos (solo SuperAdmin). Las reglas y el catálogo viven en Users\RoleService. */
class RoleController extends Controller
{
    use ApiResponse;

    public function __construct(private RoleService $roles) {}

    public function index(Request $request)
    {
        $data = $request->validate([
            'page' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string',
            'isActive' => 'nullable',
            'includeUsers' => 'nullable',
        ]);

        return response()->json(['success' => true] + $this->roles->paginate($data));
    }

    public function show(Request $request, int $id)
    {
        $includeUsers = filter_var($request->query('includeUsers', false), FILTER_VALIDATE_BOOLEAN);

        return $this->success($this->roles->format($this->roles->find($id, $includeUsers), $includeUsers));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|min:2|max:50',
            'description' => 'required|string|min:5|max:200',
            'permissions' => 'required|array|min:1',
            'permissions.*' => ['string', Rule::in(RoleService::AVAILABLE_PERMISSIONS)],
            'isActive' => 'nullable|boolean',
        ]);

        return $this->created($this->roles->format($this->roles->create($data)), 'Rol creado exitosamente');
    }

    public function update(Request $request, int $id)
    {
        $role = $this->roles->find($id);

        $data = $request->validate([
            'name' => 'nullable|string|min:2|max:50',
            'description' => 'nullable|string|min:5|max:200',
            'permissions' => 'nullable|array|min:1',
            'permissions.*' => ['string', Rule::in(RoleService::AVAILABLE_PERMISSIONS)],
            'isActive' => 'nullable|boolean',
        ]);

        return $this->success($this->roles->format($this->roles->update($role, $data)), 'Rol actualizado exitosamente');
    }

    public function destroy(int $id)
    {
        $this->roles->delete($id);

        return $this->success(null, 'Rol eliminado exitosamente');
    }

    public function assign(Request $request)
    {
        $data = $request->validate([
            'userId' => 'required',
            'roleId' => 'required|integer',
        ]);

        return $this->success($this->roles->assign($data['userId'], (int) $data['roleId']), 'Rol asignado exitosamente');
    }

    public function usersByRole(Request $request, int $id)
    {
        return response()->json(['success' => true] + $this->roles->usersOf(
            $id,
            (int) $request->query('page', 1),
            (int) $request->query('limit', 20),
        ));
    }

    public function permissions()
    {
        return $this->success([
            'permissions' => RoleService::AVAILABLE_PERMISSIONS,
            'groups' => RoleService::PERMISSION_GROUPS,
        ]);
    }

    public function stats()
    {
        return $this->success($this->roles->stats());
    }
}
