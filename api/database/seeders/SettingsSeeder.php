<?php

namespace Database\Seeders;

use App\Models\LabelTemplate;
use App\Models\LabelZone;
use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Configuración por defecto: ajustes de impresión de tickets POS, datos
 * básicos de la tienda y una plantilla de etiqueta de código de barras.
 */
class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        // ---- Datos básicos de la tienda (los usa el ticket POS) ----
        Setting::updateOrCreate(
            ['key' => 'store_settings'],
            ['value' => [
                'storeName' => 'Mi Tienda de Personalización',
                'nit' => '900000000-0',
                'phone' => '+57 300 000 0000',
                'email' => 'contacto@mitienda.com',
                'address' => 'Colombia',
                'currency' => 'COP',
            ]]
        );

        // ---- Configuración de impresión (módulo settings/printing) ----
        // Ticket térmico de 80 mm, altura continua.
        Setting::updateOrCreate(
            ['key' => 'printing_settings'],
            ['value' => [
                'ticketFormat' => '80mm',
                'ticketWidth' => 80,
                'ticketHeight' => 0,
                'ticketMargins' => ['top' => 5, 'right' => 5, 'bottom' => 10, 'left' => 5],
                'ticketLogo' => '',
                'showLogo' => true,
                'showStoreName' => true,
                'showNit' => true,
                'showQR' => false,
                'fontSize' => 'medium',
                'showPreviewModal' => true,
                'selectedTemplateId' => 'thermal-80mm',
            ]]
        );

        // ---- Plantilla de etiqueta de código de barras ----
        $labelTemplate = LabelTemplate::updateOrCreate(
            ['name' => 'Etiqueta Estándar Suéter'],
            [
                'backgroundImage' => null,
                'width' => 150,
                'height' => 220,
                'pageType' => 'A4',
                'pageMargin' => 20,
                'labelSpacing' => 5.67,
                'isDefault' => true,
                'isActive' => true,
            ]
        );

        // Zonas de la etiqueta (nombre, talla, código de barras, número y precio)
        $zones = [
            ['zoneType' => 'PRODUCT_NAME', 'x' => 8, 'y' => 8, 'width' => 134, 'height' => 30,
                'fontSize' => 9, 'fontWeight' => 'bold', 'zIndex' => 1],
            ['zoneType' => 'SIZE', 'x' => 8, 'y' => 42, 'width' => 134, 'height' => 18,
                'fontSize' => 9, 'fontWeight' => 'normal', 'zIndex' => 2],
            ['zoneType' => 'BARCODE', 'x' => 15, 'y' => 64, 'width' => 120, 'height' => 70,
                'fontSize' => 10, 'fontWeight' => 'normal', 'zIndex' => 3],
            ['zoneType' => 'BARCODE_TEXT', 'x' => 8, 'y' => 138, 'width' => 134, 'height' => 14,
                'fontSize' => 7, 'fontWeight' => 'normal', 'zIndex' => 4],
            ['zoneType' => 'PRICE', 'x' => 8, 'y' => 158, 'width' => 134, 'height' => 34,
                'fontSize' => 16, 'fontWeight' => 'bold', 'zIndex' => 5],
        ];
        foreach ($zones as $zone) {
            LabelZone::updateOrCreate(
                ['labelTemplateId' => $labelTemplate->id, 'zoneType' => $zone['zoneType']],
                $zone + [
                    'labelTemplateId' => $labelTemplate->id,
                    'textAlign' => 'center',
                    'fontColor' => '#000000',
                    'showLabel' => true,
                    'rotation' => 0,
                ]
            );
        }
    }
}
