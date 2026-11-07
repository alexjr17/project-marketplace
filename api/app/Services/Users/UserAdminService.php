<?php

namespace App\Services\Users;

use App\Exceptions\BusinessRuleException;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;

/**
 * Usuarios desde el panel y perfil propio. Quién puede ver, crear o cambiar el rol de quién
 * lo decide UserPolicy (solo el SuperAdmin gestiona staff); aquí viven las demás reglas:
 * email único en minúsculas, rol existente y que el SuperAdmin no se elimina.
 */
class UserAdminService
{
    private const SUPERADMIN = 1;

    private const CLIENTE = 2;

    /** Forma del usuario que espera el frontend (replica formatUserResponse del Node). */
    public function format(User $user): array
    {
        $role = $user->role;

        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'phone' => $user->phone,
            'cedula' => $user->cedula,
            'avatar' => $user->avatar,
            'roleId' => $user->roleId,
            'role' => $role?->name ?? '',
            'permissions' => is_array($role?->permissions) ? $role->permissions : [],
            'status' => $user->status,
            'createdAt' => $user->createdAt,
            'updatedAt' => $user->updatedAt,
        ];
    }

    /**
     * Listado paginado. Sin ser SuperAdmin solo incluye clientes (UserPolicy::listAllRoles).
     *
     * @return array{data: array<int, array>, pagination: array}
     */
    public function paginate(User $actor, array $filters): array
    {
        $page = (int) ($filters['page'] ?? 1);
        $limit = (int) ($filters['limit'] ?? 10);

        $query = User::with('role');
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('cedula', 'like', "%{$search}%");
            });
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['roleId'])) {
            $query->where('roleId', $filters['roleId']);
        }
        if (Gate::forUser($actor)->denies('listAllRoles', User::class)) {
            $query->where('roleId', self::CLIENTE);
        }

        $total = $query->count();
        $users = $query->orderBy($filters['sortBy'] ?? 'createdAt', $filters['sortOrder'] ?? 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        return [
            'data' => $users->map(fn ($u) => $this->format($u))->all(),
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => $limit > 0 ? (int) ceil($total / $limit) : 0,
            ],
        ];
    }

    /** Usuario que $actor puede gestionar; si no existe o no puede, 404 (no se revela). */
    public function findManageable(User $actor, int $id): User
    {
        $user = User::with('role')->find($id);
        if (! $user || Gate::forUser($actor)->denies('manage', $user)) {
            throw new BusinessRuleException('Usuario no encontrado', 404);
        }

        return $user;
    }

    public function create(User $actor, array $data): User
    {
        $email = $this->normalizeEmail($data['email']);
        if (User::where('email', $email)->exists()) {
            throw new BusinessRuleException('El email ya está registrado', 409);
        }
        $this->assertRoleAssignable($actor, (int) $data['roleId'], 'Solo el SuperAdmin puede crear usuarios del staff');

        return User::create([
            'email' => $email,
            'passwordHash' => Hash::make($data['password']),
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'cedula' => $data['cedula'] ?? null,
            'roleId' => $data['roleId'],
            'status' => $data['status'] ?? 'ACTIVE',
        ])->load('role');
    }

    public function update(User $actor, User $user, array $data): User
    {
        if (! empty($data['email'])) {
            $email = $this->normalizeEmail($data['email']);
            if ($email !== $user->email && User::where('email', $email)->exists()) {
                throw new BusinessRuleException('El email ya está en uso', 409);
            }
            $user->email = $email;
        }
        if (! empty($data['roleId'])) {
            $this->assertRoleAssignable($actor, (int) $data['roleId'], 'Solo el SuperAdmin puede cambiar roles');
        }

        foreach (['name', 'phone', 'cedula', 'roleId', 'status'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $user->{$field} = $data[$field];
            }
        }
        $user->save();

        return $user->load('role');
    }

    public function delete(User $user): void
    {
        if ((int) $user->roleId === self::SUPERADMIN) {
            throw new BusinessRuleException('No se puede eliminar un superadmin', 400);
        }
        $user->delete();
    }

    /** Perfil propio: solo nombre, teléfono y cédula. */
    public function updateProfile(User $user, array $data): User
    {
        foreach (['name', 'phone', 'cedula'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $user->{$field} = $data[$field];
            }
        }
        $user->save();

        return $user->load('role');
    }

    private function assertRoleAssignable(User $actor, int $roleId, string $deniedMessage): void
    {
        if (! Role::whereKey($roleId)->exists()) {
            throw new BusinessRuleException('El rol especificado no existe', 400);
        }
        if (Gate::forUser($actor)->denies('assignRole', [User::class, $roleId])) {
            throw new BusinessRuleException($deniedMessage, 403);
        }
    }

    private function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }
}
