<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            ['email' => 'admin@marketplace.com', 'password' => 'admin123', 'name' => 'Administrador', 'phone' => '+57 300 000 0000', 'roleId' => 1],
            ['email' => 'vendedor@marketplace.com', 'password' => 'vendedor123', 'name' => 'Vendedor', 'phone' => '+57 300 111 1111', 'roleId' => 3],
            ['email' => 'cliente@marketplace.com', 'password' => 'cliente123', 'name' => 'Cliente Demo', 'phone' => '+57 311 111 1111', 'roleId' => 2],
            ['email' => 'cajero@marketplace.com', 'password' => 'cajero123', 'name' => 'Cajero POS', 'phone' => '+57 312 222 2222', 'roleId' => 4],
        ];

        foreach ($users as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                [
                    'passwordHash' => Hash::make($user['password']),
                    'name' => $user['name'],
                    'phone' => $user['phone'],
                    'roleId' => $user['roleId'],
                    'status' => 'ACTIVE',
                ]
            );
        }
    }
}
