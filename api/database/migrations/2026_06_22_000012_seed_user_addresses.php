<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Da 3 direcciones (en departamentos distintos) a cada usuario por defecto,
     * para probar zonas/tarifas de envío en la base ya sembrada.
     */
    public function up(): void
    {
        if (! Schema::hasTable('addresses') || ! Schema::hasTable('users')) {
            return;
        }

        $now = now();
        $byUser = [
            'admin@vexa.com' => [
                ['label' => 'Casa - Sincelejo', 'address' => 'Calle 20 #15-30', 'city' => 'Sincelejo', 'department' => 'Sucre', 'postalCode' => '700001', 'isDefault' => true],
                ['label' => 'Montería', 'address' => 'Calle 30 #5-20', 'city' => 'Montería', 'department' => 'Córdoba', 'postalCode' => '230001', 'isDefault' => false],
                ['label' => 'Cartagena', 'address' => 'Av. Pedro de Heredia #40-10', 'city' => 'Cartagena', 'department' => 'Bolívar', 'postalCode' => '130001', 'isDefault' => false],
            ],
            'vendedor@vexa.com' => [
                ['label' => 'Barranquilla', 'address' => 'Calle 84 #50-15', 'city' => 'Barranquilla', 'department' => 'Atlántico', 'postalCode' => '080001', 'isDefault' => true],
                ['label' => 'Medellín', 'address' => 'Carrera 70 #45-30', 'city' => 'Medellín', 'department' => 'Antioquia', 'postalCode' => '050001', 'isDefault' => false],
                ['label' => 'Bogotá', 'address' => 'Carrera 7 #71-21', 'city' => 'Bogotá', 'department' => 'Cundinamarca', 'postalCode' => '110111', 'isDefault' => false],
            ],
            'cliente@vexa.com' => [
                ['label' => 'Casa - Medellín', 'address' => 'Calle 80 #12-34', 'city' => 'Medellín', 'department' => 'Antioquia', 'postalCode' => '050001', 'isDefault' => true],
                ['label' => 'Sincelejo', 'address' => 'Carrera 25 #18-40', 'city' => 'Sincelejo', 'department' => 'Sucre', 'postalCode' => '700001', 'isDefault' => false],
                ['label' => 'Cartagena', 'address' => 'Bocagrande Cra 2 #10-15', 'city' => 'Cartagena', 'department' => 'Bolívar', 'postalCode' => '130001', 'isDefault' => false],
            ],
            'pos@vexa.com' => [
                ['label' => 'Bogotá', 'address' => 'Calle 100 #15-20', 'city' => 'Bogotá', 'department' => 'Cundinamarca', 'postalCode' => '110111', 'isDefault' => true],
                ['label' => 'Barranquilla', 'address' => 'Carrera 53 #76-50', 'city' => 'Barranquilla', 'department' => 'Atlántico', 'postalCode' => '080001', 'isDefault' => false],
                ['label' => 'Montería', 'address' => 'Calle 41 #8-25', 'city' => 'Montería', 'department' => 'Córdoba', 'postalCode' => '230001', 'isDefault' => false],
            ],
        ];

        foreach ($byUser as $email => $addresses) {
            $userId = DB::table('users')->where('email', $email)->value('id');
            if (! $userId) {
                continue;
            }
            // Estado limpio: reemplaza las direcciones del usuario por estas 3.
            DB::table('addresses')->where('userId', $userId)->delete();
            foreach ($addresses as $a) {
                DB::table('addresses')->insert($a + [
                    'userId' => $userId,
                    'country' => 'Colombia',
                    'createdAt' => $now,
                    'updatedAt' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Ajuste de datos puntual: no se revierte.
    }
};
