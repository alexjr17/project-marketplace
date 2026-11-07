<?php

namespace App\Services\Users;

use App\Exceptions\BusinessRuleException;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Roles y su catálogo de permisos. Los roles del sistema no cambian nombre ni permisos ni se
 * borran; un rol con usuarios no se borra; no se asigna un rol inactivo.
 */
class RoleService
{
    /**
     * Permisos disponibles para roles personalizados, por aplicación/módulo. Deben coincidir
     * con el catálogo del frontend (web/src/types/roles.ts) y con lo que exigen las rutas.
     */
    public const AVAILABLE_PERMISSIONS = [
        'store.access', 'admin.access', 'messaging.access', 'manufacturing.access',
        'messaging.inbox', 'messaging.posts', 'messaging.pages',
        'messaging.knowledge', 'messaging.channels',
        'manufacturing.references.view', 'manufacturing.catalogs.view', 'manufacturing.orders.view',
        'pos.access', 'pos.create_sale', 'pos.view_sales', 'pos.cancel_sale',
        'pos.cash_register', 'pos.open_close_session', 'pos.view_reports',
        'dashboard.view',
        'orders.view', 'reviews.view', 'payments.view',
        'shipping.carriers', 'shipping.zones', 'shipping.connections', 'shipping.config', 'shipping.dispatch',
        'variants.view',
        'products.view', 'products.manage', 'templates.view', 'categories.view', 'product_types.view', 'sizes.view', 'colors.view',
        'zone_types.view', 'design_images.view',
        'inputs.view', 'input_types.view',
        'suppliers.view', 'purchase_orders.view', 'purchase_returns.view',
        'conversions.view', 'inventory_counts.view', 'inventory_movements.view',
        'users.view',
        'discounts.view', 'announcements.view',
        'settings.general', 'settings.appearance', 'settings.home', 'settings.catalog',
        'settings.payment', 'settings.legal', 'settings.printing', 'settings.label_templates',
    ];

    public const PERMISSION_GROUPS = [
        'apps' => ['store.access', 'pos.access', 'admin.access', 'messaging.access', 'manufacturing.access'],
        'manufacturing' => ['manufacturing.references.view', 'manufacturing.orders.view', 'manufacturing.catalogs.view'],
        'messaging' => ['messaging.inbox', 'messaging.posts', 'messaging.pages', 'messaging.knowledge', 'messaging.channels'],
        'pos' => ['pos.create_sale', 'pos.view_sales', 'pos.cancel_sale', 'pos.cash_register', 'pos.open_close_session', 'pos.view_reports'],
        'dashboard' => ['dashboard.view'],
        'sales' => ['orders.view', 'reviews.view', 'payments.view'],
        'shipping' => ['shipping.carriers', 'shipping.zones', 'shipping.connections', 'shipping.config', 'shipping.dispatch'],
        'catalog' => ['products.view', 'products.manage', 'variants.view', 'templates.view', 'categories.view', 'product_types.view', 'sizes.view', 'colors.view'],
        'production' => ['zone_types.view', 'design_images.view'],
        'supplies' => ['inputs.view', 'input_types.view'],
        'purchases' => ['suppliers.view', 'purchase_orders.view', 'purchase_returns.view', 'conversions.view', 'inventory_counts.view', 'inventory_movements.view'],
        // Administradores y Roles: solo SuperAdmin (no se asignan a otros roles).
        'users' => ['users.view'],
        'marketing' => ['discounts.view', 'announcements.view'],
        'settings' => ['settings.general', 'settings.appearance', 'settings.home', 'settings.catalog', 'settings.payment', 'settings.legal', 'settings.printing', 'settings.label_templates'],
    ];

    public function format(Role $role, bool $includeUsers = false): array
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

    /** @return array{data: array<int, array>, pagination: array} */
    public function paginate(array $filters): array
    {
        $page = (int) ($filters['page'] ?? 1);
        $limit = (int) ($filters['limit'] ?? 10);
        $includeUsers = filter_var($filters['includeUsers'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $query = Role::withCount('users');
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }
        if (array_key_exists('isActive', $filters) && $filters['isActive'] !== null) {
            $query->where('isActive', filter_var($filters['isActive'], FILTER_VALIDATE_BOOLEAN));
        }
        if ($includeUsers) {
            $query->with('users');
        }

        $total = $query->count();
        $roles = $query->orderBy('id')->skip(($page - 1) * $limit)->take($limit)->get();

        return [
            'data' => $roles->map(fn ($r) => $this->format($r, $includeUsers))->all(),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => $limit > 0 ? (int) ceil($total / $limit) : 0,
            ],
        ];
    }

    public function find(int $id, bool $includeUsers = false): Role
    {
        $query = Role::withCount('users');
        if ($includeUsers) {
            $query->with('users');
        }

        return $query->find($id) ?? throw new BusinessRuleException('Rol no encontrado', 404);
    }

    public function create(array $data): Role
    {
        $this->assertNameFree($data['name']);

        return Role::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']),
            'description' => $data['description'],
            'permissions' => $data['permissions'],
            'isActive' => $data['isActive'] ?? true,
            'isSystem' => false,
        ]);
    }

    public function update(Role $role, array $data): Role
    {
        // Los roles del sistema no permiten cambiar nombre ni permisos.
        if ($role->isSystem && (! empty($data['name']) || ! empty($data['permissions']))) {
            throw new BusinessRuleException('No se pueden modificar los roles del sistema', 403);
        }
        if (! empty($data['name']) && $data['name'] !== $role->name) {
            $this->assertNameFree($data['name'], $role->id);
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

        return $role;
    }

    public function delete(int $id): void
    {
        $role = $this->find($id);
        if ($role->isSystem) {
            throw new BusinessRuleException('No se pueden eliminar los roles del sistema', 403);
        }
        if ($role->users_count > 0) {
            throw new BusinessRuleException(
                "No se puede eliminar el rol porque tiene {$role->users_count} usuario(s) asignado(s)",
                409
            );
        }
        $role->delete();
    }

    /** Asigna un rol activo a un usuario. */
    public function assign(int|string $userId, int $roleId): array
    {
        $role = Role::find($roleId) ?? throw new BusinessRuleException('Rol no encontrado', 404);
        if (! $role->isActive) {
            throw new BusinessRuleException('No se puede asignar un rol inactivo', 403);
        }
        $user = User::find($userId) ?? throw new BusinessRuleException('Usuario no encontrado', 404);

        $user->roleId = $role->id;
        $user->save();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions,
            ],
        ];
    }

    /** Usuarios de un rol, paginados. */
    public function usersOf(int $roleId, int $page, int $limit): array
    {
        $role = Role::find($roleId) ?? throw new BusinessRuleException('Rol no encontrado', 404);
        $page = max(1, $page);
        $limit = max(1, $limit);

        $total = User::where('roleId', $roleId)->count();
        $users = User::where('roleId', $roleId)
            ->orderByDesc('createdAt')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get(['id', 'name', 'email', 'phone', 'avatar', 'status', 'createdAt']);

        return [
            'role' => ['id' => $role->id, 'name' => $role->name],
            'users' => $users,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => (int) ceil($total / $limit),
            ],
        ];
    }

    public function stats(): array
    {
        $roles = Role::withCount('users')->orderBy('id')->get();
        $total = $roles->count();
        $active = $roles->where('isActive', true)->count();

        return [
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
        ];
    }

    private function assertNameFree(string $name, ?int $exceptId = null): void
    {
        $query = Role::where('name', $name);
        if ($exceptId !== null) {
            $query->where('id', '!=', $exceptId);
        }
        if ($query->exists()) {
            throw new BusinessRuleException("Ya existe un rol con el nombre \"{$name}\"", 409);
        }
    }
}
