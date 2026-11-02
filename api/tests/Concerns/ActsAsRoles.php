<?php

namespace Tests\Concerns;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Laravel\Sanctum\Sanctum;

/**
 * Siembra los roles y los usuarios de prueba (admin, cliente, vendedor, pos) y
 * permite autenticarse como cualquiera de ellos con Sanctum.
 * Usar junto con RefreshDatabase.
 */
trait ActsAsRoles
{
    protected function seedRolesAndUsers(): void
    {
        $this->seed([RoleSeeder::class, UserSeeder::class]);
    }

    protected function userByEmail(string $email): User
    {
        return User::where('email', $email)->firstOrFail();
    }

    protected function actingAsAdmin(): User
    {
        return $this->actingAsEmail('admin@vexa.com');
    }

    protected function actingAsCliente(): User
    {
        return $this->actingAsEmail('cliente@vexa.com');
    }

    protected function actingAsVendedor(): User
    {
        return $this->actingAsEmail('vendedor@vexa.com');
    }

    protected function actingAsCajero(): User
    {
        return $this->actingAsEmail('pos@vexa.com');
    }

    protected function actingAsEmail(string $email): User
    {
        $user = $this->userByEmail($email);
        Sanctum::actingAs($user);

        return $user;
    }

    /** Crea un cliente adicional (rol 2) para probar el acceso a datos ajenos. */
    protected function otroCliente(string $email = 'otro@vexa.test'): User
    {
        return User::create([
            'email' => $email,
            'name' => 'Otro Cliente',
            'passwordHash' => bcrypt('secret123'),
            'roleId' => 2,
            'status' => 'ACTIVE',
        ]);
    }
}
