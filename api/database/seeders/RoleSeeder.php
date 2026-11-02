<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'id' => 1,
                'name' => 'SuperAdmin',
                'slug' => 'superadmin',
                'description' => 'Administrador con acceso total al sistema',
                'isSystem' => true,
                'isActive' => true,
                'permissions' => [
                    'dashboard.view',
                    'products.view', 'products.create', 'products.edit', 'products.delete', 'products.manage',
                    'orders.view', 'orders.create', 'orders.edit', 'orders.delete', 'orders.manage',
                    'users.view', 'users.create', 'users.edit', 'users.delete',
                    'admins.view', 'admins.create', 'admins.edit', 'admins.delete',
                    'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
                    'settings.view', 'settings.edit',
                    'settings.general', 'settings.appearance', 'settings.home',
                    'settings.catalog', 'settings.shipping', 'settings.payment', 'settings.legal',
                    'reports.view', 'reports.export',
                    'catalogs.view', 'catalogs.create', 'catalogs.edit', 'catalogs.delete',
                    'pos.access', 'pos.create_sale', 'pos.view_sales', 'pos.cancel_sale',
                    'pos.cash_register', 'pos.open_close_session', 'pos.view_reports',
                ],
            ],
            [
                'id' => 2,
                'name' => 'Cliente',
                'slug' => 'cliente',
                'description' => 'Cliente del marketplace - Sin acceso al panel administrativo',
                'isSystem' => true,
                'isActive' => true,
                // Sin permisos del panel: ve la tienda y sus pedidos (/orders/my).
                'permissions' => [],
            ],
            [
                'id' => 3,
                'name' => 'Administrador',
                'slug' => 'administrador',
                'description' => 'Administrador del marketplace con acceso al panel',
                'isSystem' => false,
                'isActive' => true,
                // Operación de la tienda (ver la migración role_permissions_by_module).
                'permissions' => [
                    'admin.access', 'dashboard.view',
                    'orders.view', 'shipping.dispatch', 'payments.view', 'reviews.view',
                    'products.view', 'products.manage', 'variants.view', 'templates.view',
                    'categories.view', 'product_types.view', 'sizes.view', 'colors.view',
                    'users.view', 'discounts.view', 'announcements.view',
                ],
            ],
            [
                'id' => 4,
                'name' => 'Cajero',
                'slug' => 'cajero',
                'description' => 'Cajero con acceso al sistema POS para ventas físicas',
                'isSystem' => false,
                'isActive' => true,
                'permissions' => [
                    'pos.access', 'pos.create_sale', 'pos.view_sales', 'pos.cancel_sale',
                    'pos.cash_register', 'pos.open_close_session', 'products.view',
                ],
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['id' => $role['id']], $role);
        }
    }
}
