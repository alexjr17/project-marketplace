<?php

namespace Database\Seeders\Concerns;

/**
 * Catálogo compartido de prendas del negocio. Cada entrada genera:
 *  - un insumo prenda base (el suéter en blanco que se consume al producir)
 *  - un producto modelo (plantilla personalizable)
 *  - un producto normal de catálogo
 * Lo usan InventorySeeder y CommerceSeeder.
 */
trait GarmentCatalog
{
    /** Colores con los que se siembra cada producto. */
    protected array $garmentColorSlugs = ['blanco', 'negro', 'gris-jaspe'];

    /** Una entrada por tipo de prenda del negocio. */
    protected function garments(): array
    {
        return [
            [
                'typeSlug' => 'sueter-basico',
                'label' => 'Suéter Básico',
                'sizes' => ['U', 'S', 'M', 'L', 'XL'],
                'baseInputCode' => 'INS-0001',
                'baseInputName' => 'Suéter Básico TDF',
                'baseInputCost' => 16000,
                'templateSku' => 'TPL-0001',
                'templatePrice' => 70000,
                'normalSku' => 'PRD-0001',
                'normalPrice' => 58000,
            ],
            [
                'typeSlug' => 'sueter-oversize',
                'label' => 'Suéter Oversize',
                'sizes' => ['U', 'S', 'M', 'L', 'XL'],
                'baseInputCode' => 'INS-0002',
                'baseInputName' => 'Suéter Oversize TDF',
                'baseInputCost' => 19000,
                'templateSku' => 'TPL-0002',
                'templatePrice' => 78000,
                'normalSku' => 'PRD-0002',
                'normalPrice' => 64000,
            ],
            [
                'typeSlug' => 'buso',
                'label' => 'Buso',
                'sizes' => ['U', 'S', 'M', 'L', 'XL'],
                'baseInputCode' => 'INS-0003',
                'baseInputName' => 'Buso TDF',
                'baseInputCost' => 22000,
                'templateSku' => 'TPL-0003',
                'templatePrice' => 85000,
                'normalSku' => 'PRD-0003',
                'normalPrice' => 70000,
            ],
            [
                'typeSlug' => 'bluson',
                'label' => 'Blusón',
                'sizes' => ['U'],
                'baseInputCode' => 'INS-0004',
                'baseInputName' => 'Blusón TDF',
                'baseInputCost' => 14000,
                'templateSku' => 'TPL-0004',
                'templatePrice' => 60000,
                'normalSku' => 'PRD-0004',
                'normalPrice' => 48000,
            ],
        ];
    }

    /** Prefijo corto para SKU a partir del slug de un color. */
    protected function colorTag(string $colorSlug): string
    {
        return strtoupper(substr(str_replace('-', '', $colorSlug), 0, 3));
    }
}
