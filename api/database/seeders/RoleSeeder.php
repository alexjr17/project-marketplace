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
                'permissions' => ['products.view', 'orders.view', 'orders.create'],
            ],
            [
                'id' => 3,
                'name' => 'Administrador',
                'slug' => 'administrador',
                'description' => 'Administrador del marketplace con acceso al panel',
                'isSystem' => false,
                'isActive' => true,
                'permissions' => [
                    'dashboard.view',
                    'products.view', 'products.create', 'products.edit',
                    'orders.view', 'orders.edit',
                    'users.view',
                    'catalogs.view', 'catalogs.create', 'catalogs.edit',
                    'reports.view',
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
                    'pos.access', 'pos.create_sale', 'pos.view_sales',
                    'pos.cash_register', 'pos.open_close_session', 'products.view',
                ],
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['id' => $role['id']], $role);
        }
    }
}
