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
        // Cada usuario tiene 3 direcciones en departamentos distintos para probar
        // zonas/tarifas de envío.
        $users = [
            [
                'email' => 'admin@vexa.com', 'password' => 'admin123', 'name' => 'Administrador', 'phone' => '+57 300 000 0000', 'roleId' => 1,
                'addresses' => [
                    ['label' => 'Casa - Sincelejo', 'address' => 'Calle 20 #15-30', 'city' => 'Sincelejo', 'department' => 'Sucre', 'postalCode' => '700001', 'country' => 'Colombia', 'isDefault' => true],
                    ['label' => 'Montería', 'address' => 'Calle 30 #5-20', 'city' => 'Montería', 'department' => 'Córdoba', 'postalCode' => '230001', 'country' => 'Colombia', 'isDefault' => false],
                    ['label' => 'Cartagena', 'address' => 'Av. Pedro de Heredia #40-10', 'city' => 'Cartagena', 'department' => 'Bolívar', 'postalCode' => '130001', 'country' => 'Colombia', 'isDefault' => false],
                ],
            ],
            [
                'email' => 'vendedor@vexa.com', 'password' => 'vendedor123', 'name' => 'Vendedor', 'phone' => '+57 300 111 1111', 'roleId' => 3,
                'addresses' => [
                    ['label' => 'Barranquilla', 'address' => 'Calle 84 #50-15', 'city' => 'Barranquilla', 'department' => 'Atlántico', 'postalCode' => '080001', 'country' => 'Colombia', 'isDefault' => true],
                    ['label' => 'Medellín', 'address' => 'Carrera 70 #45-30', 'city' => 'Medellín', 'department' => 'Antioquia', 'postalCode' => '050001', 'country' => 'Colombia', 'isDefault' => false],
                    ['label' => 'Bogotá', 'address' => 'Carrera 7 #71-21', 'city' => 'Bogotá', 'department' => 'Cundinamarca', 'postalCode' => '110111', 'country' => 'Colombia', 'isDefault' => false],
                ],
            ],
            [
                'email' => 'cliente@vexa.com', 'password' => 'cliente123', 'name' => 'Cliente Demo', 'phone' => '+57 311 111 1111', 'roleId' => 2,
                'addresses' => [
                    ['label' => 'Casa - Medellín', 'address' => 'Calle 80 #12-34', 'city' => 'Medellín', 'department' => 'Antioquia', 'postalCode' => '050001', 'country' => 'Colombia', 'isDefault' => true],
                    ['label' => 'Sincelejo', 'address' => 'Carrera 25 #18-40', 'city' => 'Sincelejo', 'department' => 'Sucre', 'postalCode' => '700001', 'country' => 'Colombia', 'isDefault' => false],
                    ['label' => 'Cartagena', 'address' => 'Bocagrande Cra 2 #10-15', 'city' => 'Cartagena', 'department' => 'Bolívar', 'postalCode' => '130001', 'country' => 'Colombia', 'isDefault' => false],
                ],
            ],
            [
                'email' => 'pos@vexa.com', 'password' => 'pos123', 'name' => 'Cajero POS', 'phone' => '+57 312 222 2222', 'roleId' => 4,
                'addresses' => [
                    ['label' => 'Bogotá', 'address' => 'Calle 100 #15-20', 'city' => 'Bogotá', 'department' => 'Cundinamarca', 'postalCode' => '110111', 'country' => 'Colombia', 'isDefault' => true],
                    ['label' => 'Barranquilla', 'address' => 'Carrera 53 #76-50', 'city' => 'Barranquilla', 'department' => 'Atlántico', 'postalCode' => '080001', 'country' => 'Colombia', 'isDefault' => false],
                    ['label' => 'Montería', 'address' => 'Calle 41 #8-25', 'city' => 'Montería', 'department' => 'Córdoba', 'postalCode' => '230001', 'country' => 'Colombia', 'isDefault' => false],
                ],
            ],
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
