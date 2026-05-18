<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Configuración de envíos: zonas por departamento y transportadoras.
 * Las zonas se ordenan de la más cercana al origen (Sucre) a la más lejana.
 */
class ShippingSeeder extends Seeder
{
    public function run(): void
    {
        // [id, departamento, ciudades, costo base, costo/kg, díasMin, díasMax]
        $zones = [
            ['zone-sucre', 'Sucre', [
                'Sincelejo', 'Corozal', 'Sampués', 'San Marcos', 'Tolú', 'Coveñas', 'San Onofre',
                'Sincé', 'Morroa', 'Los Palmitos', 'Ovejas', 'Galeras', 'San Pedro', 'Tolú Viejo',
                'San Benito Abad', 'Majagual', 'Sucre', 'Buenavista', 'Caimito', 'Chalán', 'Colosó',
                'El Roble', 'Guaranda', 'La Unión', 'Palmito', 'San Juan de Betulia',
            ], 6000, 1200, 1, 2],
            ['zone-cordoba', 'Córdoba', [
                'Montería', 'Cereté', 'Sahagún', 'Lorica', 'Montelíbano', 'Planeta Rica', 'Tierralta',
                'Ciénaga de Oro', 'Ayapel', 'Puerto Libertador', 'San Antero', 'Chinú', 'Pueblo Nuevo',
            ], 8000, 1500, 1, 3],
            ['zone-bolivar', 'Bolívar', [
                'Cartagena', 'Magangué', 'El Carmen de Bolívar', 'Turbaco', 'Arjona', 'Mompós',
                'María la Baja', 'San Juan Nepomuceno', 'San Pablo', 'Simití', 'Mahates',
            ], 9000, 1700, 2, 3],
            ['zone-atlantico', 'Atlántico', [
                'Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Baranoa', 'Puerto Colombia',
                'Galapa', 'Sabanagrande', 'Santo Tomás', 'Palmar de Varela',
            ], 9500, 1700, 2, 4],
            ['zone-antioquia', 'Antioquia', [
                'Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'La Estrella', 'Copacabana',
                'Girardota', 'Rionegro', 'Marinilla', 'Apartadó', 'Turbo', 'Caucasia',
            ], 13000, 2300, 3, 5],
            ['zone-cundinamarca', 'Cundinamarca', [
                'Bogotá', 'Soacha', 'Facatativá', 'Zipaquirá', 'Chía', 'Mosquera', 'Madrid',
                'Funza', 'Fusagasugá', 'Girardot', 'Cajicá', 'Cota',
            ], 14000, 2500, 3, 5],
        ];

        $zoneList = array_map(fn ($z) => [
            'id' => $z[0],
            'name' => $z[1],
            'department' => $z[1],
            'cities' => $z[2],
            'isActive' => true,
        ], $zones);

        // Genera las tarifas por zona de una transportadora aplicando un factor.
        $ratesFor = fn (float $factor) => array_map(fn ($z) => [
            'zoneId' => $z[0],
            'baseCost' => (int) round($z[3] * $factor / 100) * 100,
            'costPerKg' => (int) round($z[4] * $factor / 100) * 100,
            'estimatedDays' => ['min' => $z[5], 'max' => $z[6]],
        ], $zones);

        $shipping = [
            'origin' => [
                'companyName' => 'Vexa',
                'contactName' => 'Vexa',
                'phone' => '+57 300 000 0000',
                'address' => 'Sincelejo, Sucre',
                'city' => 'Sincelejo',
                'state' => 'Sucre',
                'postalCode' => '700007',
                'country' => 'Colombia',
            ],
            'zones' => $zoneList,
            'carriers' => [
                [
                    'id' => 'carrier-1',
                    'name' => 'Servientrega',
                    'code' => 'SERVI',
                    'trackingUrlTemplate' => 'https://www.servientrega.com/wps/portal/rastreo-envio?guia={tracking}',
                    'isActive' => true,
                    'volumetricFactor' => 6000,
                    'integrationType' => 'table',
                    'apiCarrierCode' => 'serviEntrega',
                    'zoneRates' => $ratesFor(1.0),
                ],
                [
                    'id' => 'carrier-2',
                    'name' => 'Coordinadora',
                    'code' => 'COORD',
                    'trackingUrlTemplate' => 'https://www.coordinadora.com/rastreo/?guia={tracking}',
                    'isActive' => true,
                    'volumetricFactor' => 5000,
                    'integrationType' => 'table',
                    'apiCarrierCode' => 'coordinadora',
                    'zoneRates' => $ratesFor(0.95),
                ],
                [
                    'id' => 'carrier-3',
                    'name' => 'Interrapidísimo',
                    'code' => 'INTER',
                    'trackingUrlTemplate' => 'https://www.interrapidisimo.com/rastreo/?guia={tracking}',
                    'isActive' => true,
                    'volumetricFactor' => 5000,
                    'integrationType' => 'table',
                    'apiCarrierCode' => 'interRapidisimo',
                    'zoneRates' => $ratesFor(0.9),
                ],
                [
                    'id' => 'carrier-4',
                    'name' => 'TCC',
                    'code' => 'TCC',
                    'trackingUrlTemplate' => 'https://www.tcc.com.co/rastreo/?guia={tracking}',
                    'isActive' => true,
                    'volumetricFactor' => 5000,
                    'integrationType' => 'table',
                    'apiCarrierCode' => 'tcc',
                    'zoneRates' => $ratesFor(0.92),
                ],
                [
                    'id' => 'carrier-5',
                    'name' => 'Deprisa',
                    'code' => 'DEPRISA',
                    'trackingUrlTemplate' => 'https://www.deprisa.com/RastreoEnvios?guia={tracking}',
                    'isActive' => true,
                    'volumetricFactor' => 5000,
                    'integrationType' => 'table',
                    'apiCarrierCode' => 'deprisa',
                    'zoneRates' => $ratesFor(1.05),
                ],
            ],
            'defaultCarrierId' => 'carrier-1',
            'handlingTime' => 2,
            'packageDefaults' => [
                'defaultLength' => 30,
                'defaultWidth' => 25,
                'defaultHeight' => 5,
                'defaultWeightPerItem' => 0.25,
                'volumetricDivisor' => 5000,
            ],
        ];

        Setting::updateOrCreate(['key' => 'shipping_settings'], ['value' => $shipping]);
    }
}
