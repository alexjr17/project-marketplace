<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * El rol Cliente (todo usuario registrado) tenía products.view, orders.view y
     * orders.create, nombres heredados que en la tienda no se usan. products.view le
     * abría las escrituras de /barcodes (asignar códigos, etiquetas en lote) y, al pasar
     * las rutas del panel a permisos por rol, orders.view le daría todos los pedidos.
     * La tienda no los necesita: el cliente ve sus pedidos por /orders/my.
     * Idempotente: se puede correr dos veces.
     */
    private const REMOVE = ['products.view', 'orders.view', 'orders.create'];

    public function up(): void
    {
        Role::where('slug', 'cliente')->get()->each(function (Role $role) {
            $perms = is_array($role->permissions) ? $role->permissions : [];
            $role->permissions = array_values(array_diff($perms, self::REMOVE));
            $role->save();
        });
    }

    public function down(): void
    {
        Role::where('slug', 'cliente')->get()->each(function (Role $role) {
            $perms = is_array($role->permissions) ? $role->permissions : [];
            $role->permissions = array_values(array_unique(array_merge($perms, self::REMOVE)));
            $role->save();
        });
    }
};
