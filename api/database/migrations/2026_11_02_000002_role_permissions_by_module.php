<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Las rutas del panel pasan de "solo SuperAdmin" a permisos por módulo. Ajusta los roles:
     * - Administrador: operación de la tienda (pedidos, despachos, pagos, catálogo, reseñas,
     *   clientes, cupones y anuncios). Antes tenía nombres viejos que ya no existen.
     * - Cajero: recibe pos.cancel_sale (anular, devolver y editar ventas ahora lo exigen). Ve
     *   productos (products.view) pero no los gestiona (products.manage es solo del Administrador).
     * - Nadie salvo el SuperAdmin conserva admins.view / roles.view: Administradores y Roles
     *   son solo del SuperAdmin.
     * Idempotente.
     */
    public const ADMINISTRADOR = [
        'admin.access', 'dashboard.view',
        'orders.view', 'shipping.dispatch', 'payments.view', 'reviews.view',
        'products.view', 'products.manage', 'variants.view', 'templates.view',
        'categories.view', 'product_types.view', 'sizes.view', 'colors.view',
        'users.view', 'discounts.view', 'announcements.view',
    ];

    private const SOLO_SUPERADMIN = ['admins.view', 'roles.view'];

    public function up(): void
    {
        Role::where('slug', 'administrador')->update(['permissions' => json_encode(self::ADMINISTRADOR)]);

        Role::where('slug', 'cajero')->get()->each(function (Role $role) {
            $perms = is_array($role->permissions) ? $role->permissions : [];
            $role->permissions = array_values(array_unique(array_merge($perms, ['pos.cancel_sale'])));
            $role->save();
        });

        Role::where('id', '!=', 1)->get()->each(function (Role $role) {
            $perms = is_array($role->permissions) ? $role->permissions : [];
            $clean = array_values(array_diff($perms, self::SOLO_SUPERADMIN));
            if ($clean !== $perms) {
                $role->permissions = $clean;
                $role->save();
            }
        });
    }

    public function down(): void
    {
        // Sin vuelta atrás automática: los permisos anteriores del Administrador eran nombres
        // que ya no existen. Solo se revierte el permiso agregado al Cajero.
        Role::where('slug', 'cajero')->get()->each(function (Role $role) {
            $perms = is_array($role->permissions) ? $role->permissions : [];
            $role->permissions = array_values(array_diff($perms, ['pos.cancel_sale']));
            $role->save();
        });
    }
};
