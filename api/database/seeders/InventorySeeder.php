<?php

namespace Database\Seeders;

use App\Models\Color;
use App\Models\Input;
use App\Models\InputColor;
use App\Models\InputSize;
use App\Models\InputType;
use App\Models\InputTypeSize;
use App\Models\InputVariant;
use App\Models\Size;
use App\Models\Supplier;
use Database\Seeders\Concerns\GarmentCatalog;
use Illuminate\Database\Seeder;

/**
 * Catálogo de materia prima: proveedor, tipos de insumo e insumos.
 * Todo se crea en stock CERO; el stock entra después mediante órdenes de
 * compra recibidas (ver PurchaseSeeder).
 *
 *  - Prenda base: tipo con hasVariants = true → matriz color × talla.
 *  - Consumibles: insumos normales (sin variantes).
 */
class InventorySeeder extends Seeder
{
    use GarmentCatalog;

    public function run(): void
    {
        // ---- Proveedor de ejemplo ----
        $supplier = Supplier::updateOrCreate(
            ['code' => 'PROV-0001'],
            [
                'name' => 'Textiles del Norte S.A.S.',
                'taxId' => '900123456-7',
                'taxIdType' => 'NIT',
                'contactName' => 'María Restrepo',
                'email' => 'ventas@textilesdelnorte.com',
                'phone' => '+57 604 444 5566',
                'address' => 'Carrera 50 # 38-21',
                'city' => 'Medellín',
                'department' => 'Antioquia',
                'country' => 'Colombia',
                'paymentTerms' => '30 días',
                'paymentMethod' => 'Transferencia bancaria',
                'notes' => 'Proveedor principal de prendas base y materiales de personalización.',
                'isActive' => true,
            ]
        );

        // ---- Tipos de insumo ----
        $prendaBase = InputType::updateOrCreate(
            ['slug' => 'prenda-base'],
            ['name' => 'Prenda Base', 'description' => 'Prendas en blanco con matriz de color y talla',
                'sortOrder' => 1, 'isActive' => true, 'hasVariants' => true]
        );
        $transferencia = InputType::updateOrCreate(
            ['slug' => 'material-transferencia'],
            ['name' => 'Material de Transferencia', 'description' => 'Materiales para estampado y sublimación',
                'sortOrder' => 2, 'isActive' => true, 'hasVariants' => false]
        );
        $confeccion = InputType::updateOrCreate(
            ['slug' => 'insumo-confeccion'],
            ['name' => 'Insumo de Confección', 'description' => 'Materiales de costura y terminado de prendas',
                'sortOrder' => 3, 'isActive' => true, 'hasVariants' => false]
        );

        // Tallas que puede manejar el tipo Prenda Base (unión de todas las prendas).
        $allSizes = Size::whereIn('abbreviation', ['U', 'S', 'M', 'L', 'XL'])->get();
        foreach ($allSizes as $size) {
            InputTypeSize::updateOrCreate(['inputTypeId' => $prendaBase->id, 'sizeId' => $size->id]);
        }

        $colors = Color::whereIn('slug', $this->garmentColorSlugs)->get()->keyBy('slug');

        // ---- Prendas base: matriz color × talla, todo en stock cero ----
        foreach ($this->garments() as $g) {
            $sizes = Size::whereIn('abbreviation', $g['sizes'])->get();

            $input = Input::updateOrCreate(
                ['code' => $g['baseInputCode']],
                [
                    'name' => $g['baseInputName'],
                    'description' => 'Prenda base en blanco para producir: '.$g['label'].'.',
                    'inputTypeId' => $prendaBase->id,
                    'unitOfMeasure' => 'unidad',
                    'unitCost' => $g['baseInputCost'],
                    'currentStock' => 0,
                    'minStock' => 40,
                    'maxStock' => 800,
                    'supplier' => $supplier->name,
                    'supplierCode' => 'PROV-0001',
                    'isActive' => true,
                ]
            );

            foreach ($this->garmentColorSlugs as $slug) {
                InputColor::updateOrCreate(['inputId' => $input->id, 'colorId' => $colors[$slug]->id]);
            }
            foreach ($sizes as $size) {
                InputSize::updateOrCreate(['inputId' => $input->id, 'sizeId' => $size->id]);
            }

            foreach ($this->garmentColorSlugs as $slug) {
                foreach ($sizes as $size) {
                    InputVariant::updateOrCreate(
                        [
                            'inputId' => $input->id,
                            'colorId' => $colors[$slug]->id,
                            'sizeId' => $size->id,
                        ],
                        [
                            'sku' => $g['baseInputCode'].'-'.$this->colorTag($slug).'-'.$size->abbreviation,
                            'unitCost' => $g['baseInputCost'],
                            'currentStock' => 0,
                            'minStock' => 10,
                            'maxStock' => 200,
                            'isActive' => true,
                        ]
                    );
                }
            }
        }

        // ---- Consumibles: insumos normales, en stock cero ----
        $consumibles = [
            ['code' => 'INS-0005', 'name' => 'Cinta Térmica', 'typeId' => $transferencia->id,
                'description' => 'Cinta de transferencia térmica para fijar diseños.',
                'unit' => 'metro', 'cost' => 350, 'min' => 100, 'max' => 2000],
            ['code' => 'INS-0006', 'name' => 'Papel Transfer Sublimación', 'typeId' => $transferencia->id,
                'description' => 'Hojas de papel transfer para sublimación de diseños.',
                'unit' => 'hoja', 'cost' => 280, 'min' => 150, 'max' => 3000],
            ['code' => 'INS-0007', 'name' => 'Vinilo Textil', 'typeId' => $transferencia->id,
                'description' => 'Vinilo textil de corte para estampado por termofijado.',
                'unit' => 'metro', 'cost' => 4500, 'min' => 30, 'max' => 400],
            ['code' => 'INS-0008', 'name' => 'Tinta de Sublimación', 'typeId' => $transferencia->id,
                'description' => 'Tinta para impresión de diseños sublimables.',
                'unit' => 'mililitro', 'cost' => 120, 'min' => 500, 'max' => 12000],
            ['code' => 'INS-0009', 'name' => 'Hilo de Costura', 'typeId' => $confeccion->id,
                'description' => 'Cono de hilo de poliéster para confección y terminado.',
                'unit' => 'cono', 'cost' => 6500, 'min' => 10, 'max' => 150],
            ['code' => 'INS-0010', 'name' => 'Marquilla de Tela', 'typeId' => $confeccion->id,
                'description' => 'Marquilla/etiqueta de tela para identificar la prenda.',
                'unit' => 'unidad', 'cost' => 90, 'min' => 300, 'max' => 6000],
        ];

        foreach ($consumibles as $i) {
            Input::updateOrCreate(
                ['code' => $i['code']],
                [
                    'name' => $i['name'],
                    'description' => $i['description'],
                    'inputTypeId' => $i['typeId'],
                    'unitOfMeasure' => $i['unit'],
                    'unitCost' => $i['cost'],
                    'currentStock' => 0,
                    'minStock' => $i['min'],
                    'maxStock' => $i['max'],
                    'supplier' => $supplier->name,
                    'supplierCode' => 'PROV-0001',
                    'isActive' => true,
                ]
            );
        }
    }
}
