<?php

namespace App\Policies;

use App\Models\User;

/**
 * Gestión de usuarios desde el panel (rutas /users con permiso users.view).
 * Solo el SuperAdmin gestiona cuentas de staff y asigna roles; los demás roles con
 * users.view solo pueden ver y gestionar CLIENTES (rol 2). Así nadie puede crearse un
 * SuperAdmin ni darse más permisos editando su propia cuenta.
 */
class UserPolicy
{
    private const SUPERADMIN = 1;

    private const CLIENTE = 2;

    private function isSuperAdmin(User $actor): bool
    {
        return (int) $actor->roleId === self::SUPERADMIN;
    }

    /** Ver, editar o eliminar a $target. */
    public function manage(User $actor, User $target): bool
    {
        return $this->isSuperAdmin($actor) || (int) $target->roleId === self::CLIENTE;
    }

    /** Crear un usuario o cambiarle el rol a $roleId. */
    public function assignRole(User $actor, int $roleId): bool
    {
        return $this->isSuperAdmin($actor) || $roleId === self::CLIENTE;
    }

    /** Listar usuarios de cualquier rol (si no, el listado se limita a clientes). */
    public function listAllRoles(User $actor): bool
    {
        return $this->isSuperAdmin($actor);
    }
}
