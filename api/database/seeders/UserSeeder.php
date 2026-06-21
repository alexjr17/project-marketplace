<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Usuarios por defecto (genéricos, no personales). Se pueden cambiar luego.
        $users = [
            [
                'email' => 'admin@vexa.com', 'password' => 'admin123', 'name' => 'Administrador', 'phone' => '+57 300 000 0000', 'roleId' => 1,
                'addresses' => [
                    ['label' => 'Casa - Sincelejo', 'address' => 'Calle 20 #15-30', 'city' => 'Sincelejo', 'department' => 'Sucre', 'postalCode' => '700001', 'country' => 'Colombia', 'isDefault' => true],
                ],
            ],
            ['email' => 'vendedor@vexa.com', 'password' => 'vendedor123', 'name' => 'Vendedor', 'phone' => '+57 300 111 1111', 'roleId' => 3],
            [
                'email' => 'cliente@vexa.com', 'password' => 'cliente123', 'name' => 'Cliente Demo', 'phone' => '+57 311 111 1111', 'roleId' => 2,
                'addresses' => [
                    ['label' => 'Casa', 'address' => 'Calle 80 #12-34', 'city' => 'Medellín', 'department' => 'Antioquia', 'postalCode' => '050001', 'country' => 'Colombia', 'isDefault' => true],
                ],
            ],
            ['email' => 'pos@vexa.com', 'password' => 'pos123', 'name' => 'Cajero POS', 'phone' => '+57 312 222 2222', 'roleId' => 4],
        ];

        foreach ($users as $user) {
            $model = User::updateOrCreate(
                ['email' => $user['email']],
                [
                    'passwordHash' => Hash::make($user['password']),
                    'name' => $user['name'],
                    'phone' => $user['phone'],
                    'roleId' => $user['roleId'],
                    'status' => 'ACTIVE',
                ]
            );

            // Reemplaza las direcciones por las definidas (estado limpio).
            if (isset($user['addresses'])) {
                $model->addresses()->delete();
                foreach ($user['addresses'] as $address) {
                    Address::create($address + ['userId' => $model->id]);
                }
            }
        }
    }
}
