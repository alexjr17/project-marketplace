<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    use ApiResponse;

    /**
     * Permisos disponibles para roles personalizados.
     * Organizados por aplicación/módulo, deben coincidir con el catálogo del
     * frontend (web/src/types/roles.ts) y con lo que enforce el sidebar/rutas.
     */
    private const AVAILABLE_PERMISSIONS = [
        'store.access', 'admin.access', 'messaging.access',
        'dashboard.view',
        'orders.view', 'orders.manage', 'orders.delete',
        'pos.access', 'pos.create_sale', 'pos.view_sales', 'pos.cancel_sale',
        'pos.cash_register', 'pos.open_close_session', 'pos.view_reports',
        'products.view', 'products.create', 'products.edit', 'products.delete',
        'catalogs.view', 'catalogs.manage',
        'inventory.view', 'inventory.manage',
        'shipping.view', 'shipping.manage',
        'users.view', 'users.edit', 'users.delete',
        'admins.view', 'admins.create', 'admins.edit', 'admins.delete',
        'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
        'settings.general', 'settings.appearance', 'settings.home',
        'settings.catalog', 'settings.payment', 'settings.legal',
    ];

    private const PERMISSION_GROUPS = [
        'apps' => ['store.access', 'pos.access', 'admin.access', 'messaging.access'],
        'dashboard' => ['dashboard.view'],
        'orders' => ['orders.view', 'orders.manage', 'orders.delete'],
        'pos' => ['pos.create_sale', 'pos.view_sales', 'pos.cancel_sale', 'pos.cash_register', 'pos.open_close_session', 'pos.view_reports'],
        'products' => ['products.view', 'products.create', 'products.edit', 'products.delete'],
        'catalogs' => ['catalogs.view', 'catalogs.manage'],
        'inventory' => ['inventory.view', 'inventory.manage'],
        'shipping' => ['shipping.view', 'shipping.manage'],
        'users' => ['users.view', 'users.edit', 'users.delete'],
        'admins' => ['admins.view', 'admins.create', 'admins.edit', 'admins.delete'],
        'roles' => ['roles.view', 'roles.create', 'roles.edit', 'roles.delete'],
        'settings' => ['settings.general', 'settings.appearance', 'settings.home', 'settings.catalog', 'settings.payment', 'settings.legal'],
    ];

    /** Roles del sistema: no se pueden eliminar ni cambiar nombre/permisos. */
    private const SYSTEM_ROLE_IDS = [1, 2, 3];

    private function formatRole(Role $role, bool $includeUsers = false): array
    {
        $data = [
            'id' => $role->id,
            'name' => $role->name,
            'slug' => $role->slug,
            'description' => $role->description,
            'permissions' => is_array($role->permissions) ? $role->permissions : [],
            'isSystem' => $role->isSystem,
            'isActive' => $role->isActive,
            '_count' => ['users' => $role->users_count ?? $role->users()->count()],
            'createdAt' => $role->createdAt,
            'updatedAt' => $role->updatedAt,
        ];

        if ($includeUsers && $role->relationLoaded('users')) {
            $data['users'] = $role->users->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'avatar' => $u->avatar,
            ])->all();
        }

        return $data;
    }

    public function index(Request $request)
    {
        $data = $request->validate([
            'page' => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string',
            'isActive' => 'nullable',
            'includeUsers' => 'nullable',
        ]);

        $page = (int) ($data['page'] ?? 1);
        $limit = (int) ($data['limit'] ?? 10);
        $includeUsers = filter_var($data['includeUsers'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $query = Role::withCount('users');

        if (! empty($data['search'])) {
            $search = $data['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }
        if (array_key_exists('isActive', $data) && $data['isActive'] !== null) {
            $query->where('isActive', filter_var($data['isActive'], FILTER_VALIDATE_BOOLEAN));
        }
        if ($includeUsers) {
            $query->with('users');
        }

        $total = $query->count();
        $roles = $query->orderBy('id')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $roles->map(fn ($r) => $this->formatRole($r, $includeUsers))->all(),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => $limit > 0 ? (int) ceil($total / $limit) : 0,
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $includeUsers = filter_var($request->query('includeUsers', false), FILTER_VALIDATE_BOOLEAN);

        $query = Role::withCount('users');
        if ($includeUsers) {
            $query->with('users');
        }
        $role = $query->find($id);

        if (! $role) {
            return $this->error('Rol no encontrado', 404);
        }

        return $this->success($this->formatRole($role, $includeUsers));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|min:2|max:50',
            'description' => 'required|string|min:5|max:200',
            'permissions' => 'required|array|min:1',
            'permissions.*' => ['string', Rule::in(self::AVAILABLE_PERMISSIONS)],
            'isActive' => 'nullable|boolean',
        ]);

        if (Role::where('name', $data['name'])->exists()) {
            return $this->error("Ya existe un rol con el nombre \"{$data['name']}\"", 409);
        }

        $role = Role::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'description' => $data['description'],
            'permissions' => $data['permissions'],
            'isActive' => $data['isActive'] ?? true,
            'isSystem' => false,
        ]);

        return $this->created($this->formatRole($role), 'Rol creado exitosamente');
    }

    public function update(Request $request, int $id)
    {
        $role = Role::find($id);

        if (! $role) {
            return $this->error('Rol no encontrado', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string|min:2|max:50',
            'description' => 'nullable|string|min:5|max:200',
            'permissions' => 'nullable|array|min:1',
            'permissions.*' => ['string', Rule::in(self::AVAILABLE_PERMISSIONS)],
            'isActive' => 'nullable|boolean',
        ]);

        // Los roles del sistema no permiten cambiar nombre ni permisos.
        if ($role->isSystem && (! empty($data['name']) || ! empty($data['permissions']))) {
            return $this->error('No se pueden modificar los roles del sistema', 403);
        }

        if (! empty($data['name']) && $data['name'] !== $role->name
            && Role::where('name', $data['name'])->where('id', '!=', $id)->exists()) {
            return $this->error("Ya existe un rol con el nombre \"{$data['name']}\"", 409);
        }

        if (! empty($data['name'])) {
            $role->name = $data['name'];
        }
        if (! empty($data['description'])) {
            $role->description = $data['description'];
        }
        if (! empty($data['permissions'])) {
            $role->permissions = $data['permissions'];
        }
        if (array_key_exists('isActive', $data) && $data['isActive'] !== null) {
            $role->isActive = $data['isActive'];
        }
        $role->save();

        return $this->success($this->formatRole($role), 'Rol actualizado exitosamente');
    }

    public function destroy(int $id)
    {
        $role = Role::withCount('users')->find($id);

        if (! $role) {
            return $this->error('Rol no encontrado', 404);
        }

        if ($role->isSystem) {
            return $this->error('No se pueden eliminar los roles del sistema', 403);
        }

        if ($role->users_count > 0) {
            return $this->error(
                "No se puede eliminar el rol porque tiene {$role->users_count} usuario(s) asignado(s)",
                409
            );
        }

        $role->delete();

        return $this->success(null, 'Rol eliminado exitosamente');
    }

    public function assign(Request $request)
    {
        $data = $request->validate([
            'userId' => 'required',
            'roleId' => 'required|integer',
        ]);

        $role = Role::find($data['roleId']);
        if (! $role) {
            return $this->error('Rol no encontrado', 404);
        }
        if (! $role->isActive) {
            return $this->error('No se puede asignar un rol inactivo', 403);
        }

        $user = User::find($data['userId']);
        if (! $user) {
            return $this->error('Usuario no encontrado', 404);
        }

        $user->roleId = $role->id;
        $user->save();

        return $this->success([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions,
            ],
        ], 'Rol asignado exitosamente');
    }

    public function usersByRole(Request $request, int $id)
    {
        $role = Role::find($id);
        if (! $role) {
            return $this->error('Rol no encontrado', 404);
        }

        $page = max(1, (int) $request->query('page', 1));
        $limit = max(1, (int) $request->query('limit', 20));

        $total = User::where('roleId', $id)->count();
        $users = User::where('roleId', $id)
            ->orderByDesc('createdAt')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get(['id', 'name', 'email', 'phone', 'avatar', 'status', 'createdAt']);

        return response()->json([
            'success' => true,
            'role' => ['id' => $role->id, 'name' => $role->name],
            'users' => $users,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => (int) ceil($total / $limit),
            ],
        ]);
    }

    public function permissions()
    {
        return $this->success([
            'permissions' => self::AVAILABLE_PERMISSIONS,
            'groups' => self::PERMISSION_GROUPS,
        ]);
    }

    public function stats()
    {
        $roles = Role::withCount('users')->orderBy('id')->get();
        $total = $roles->count();
        $active = $roles->where('isActive', true)->count();

        return $this->success([
            'totalRoles' => $total,
            'activeRoles' => $active,
            'inactiveRoles' => $total - $active,
            'distribution' => $roles->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'isSystem' => $r->isSystem,
                'isActive' => $r->isActive,
                'userCount' => $r->users_count,
            ])->all(),
        ]);
    }
}
