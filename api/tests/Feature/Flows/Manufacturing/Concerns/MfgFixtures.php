<?php

namespace Tests\Feature\Flows\Manufacturing\Concerns;

use App\Models\MfgBrand;
use App\Models\MfgClient;
use App\Models\MfgColor;
use App\Models\MfgGarmentType;
use App\Models\MfgInput;
use App\Models\MfgInputType;
use App\Models\MfgProcess;
use App\Models\MfgSize;
use App\Models\MfgWarehouse;
use Illuminate\Support\Facades\DB;

/**
 * Datos base de la app Fábrica para los tests de caracterización.
 *
 * Los consecutivos (PED-, OP-, L-, DES-, CAM-) usan SUBSTRING_INDEX de MySQL, que SQLite
 * no tiene: aquí se registra una versión equivalente sobre la conexión de pruebas.
 */
trait MfgFixtures
{
    /** @var array<string, mixed> */
    protected array $mfg = [];

    protected function registerMysqlShims(): void
    {
        $pdo = DB::connection()->getPdo();
        if (method_exists($pdo, 'sqliteCreateFunction')) {
            $pdo->sqliteCreateFunction('SUBSTRING_INDEX', function ($str, $delim, $count) {
                $parts = explode((string) $delim, (string) $str);
                $count = (int) $count;

                return $count >= 0
                    ? implode((string) $delim, array_slice($parts, 0, $count))
                    : implode((string) $delim, array_slice($parts, $count));
            }, 3);
        }
    }

    /**
     * Catálogo mínimo: marca, tipo de prenda CAM (costo fijo 1000, factor 2), colores
     * Blanco/Negro, tallas S/M (nacional) y 10 (exportación), tipos de insumo Telas (por color)
     * e Hilos, insumos TEL-01 / HIL-01, procesos Corte(1, consume Telas) → Confección(2, consume
     * HIL-01) → Empaque(3), bodega y cliente.
     */
    protected function seedMfgCatalog(): array
    {
        $brand = MfgBrand::create(['name' => 'Vexa', 'code' => 'VX']);
        $cam = MfgGarmentType::create([
            'code' => 'CAM', 'name' => 'Camiseta', 'composition' => 'SUPERIOR',
            'brandId' => $brand->id, 'fixedCost' => 1000, 'factor' => 2, 'factorExport' => 2.5,
        ]);
        $blanco = MfgColor::create(['name' => 'Blanco', 'hexCode' => '#FFFFFF', 'code' => '00']);
        $negro = MfgColor::create(['name' => 'Negro', 'hexCode' => '#111111', 'code' => '01']);
        $s = MfgSize::create(['name' => 'S', 'abbreviation' => 'S', 'sortOrder' => 1, 'market' => 'NATIONAL']);
        $m = MfgSize::create(['name' => 'M', 'abbreviation' => 'M', 'sortOrder' => 2, 'market' => 'NATIONAL']);
        $t10 = MfgSize::create(['name' => 'Talla 10', 'abbreviation' => '10', 'sortOrder' => 10, 'market' => 'EXPORT']);
        $telas = MfgInputType::create(['name' => 'Telas', 'classification' => 'PRODUCTO', 'consumesByColor' => true]);
        $hilos = MfgInputType::create(['name' => 'Hilos', 'classification' => 'PRODUCTO', 'consumesByColor' => false]);
        $tela = MfgInput::create(['code' => 'TEL-01', 'name' => 'Tela algodón', 'unitOfMeasure' => 'm', 'inputTypeId' => $telas->id]);
        $hilo = MfgInput::create(['code' => 'HIL-01', 'name' => 'Hilo', 'unitOfMeasure' => 'cono', 'inputTypeId' => $hilos->id]);
        $corte = MfgProcess::create(['name' => 'Corte', 'code' => 'CRT', 'sequence' => 1, 'type' => 'INTERNAL']);
        $confeccion = MfgProcess::create(['name' => 'Confección', 'code' => 'CNF', 'sequence' => 2, 'type' => 'INTERNAL']);
        $empaque = MfgProcess::create(['name' => 'Empaque', 'code' => 'EMP', 'sequence' => 3, 'type' => 'INTERNAL']);
        $corte->consumptions()->create(['kind' => 'TYPE', 'inputTypeId' => $telas->id]);
        $confeccion->consumptions()->create(['kind' => 'INPUT', 'inputId' => $hilo->id]);
        $bodega = MfgWarehouse::create(['name' => 'Bodega Principal', 'code' => 'BP']);
        $cliente = MfgClient::create(['name' => 'Almacenes Éxito', 'city' => 'Medellín']);

        return $this->mfg = compact(
            'brand', 'cam', 'blanco', 'negro', 's', 'm', 't10', 'telas', 'hilos', 'tela', 'hilo',
            'corte', 'confeccion', 'empaque', 'bodega', 'cliente'
        );
    }

    /**
     * Referencia por la API con BOM: tela 1.5 m × 4000 (sin color fijo, por color) + hilo
     * 0.1 × 500 → costVariable 6050, costo fijo 1000 → costUnit 7050, factor 2 → basePrice 14100.
     */
    protected function createReference(array $overrides = []): array
    {
        $payload = array_merge([
            'name' => 'Camiseta básica',
            'garmentTypeId' => $this->mfg['cam']->id,
            'fixedCost' => 1000,
            'factor' => 2,
            'colors' => [
                ['colorId' => $this->mfg['blanco']->id, 'type' => 'PRIMARY'],
                ['colorId' => $this->mfg['negro']->id],
            ],
            'sizeIds' => [$this->mfg['s']->id, $this->mfg['m']->id],
            'materials' => [
                ['inputId' => $this->mfg['tela']->id, 'consumption' => 1.5, 'unitValue' => 4000],
                ['inputId' => $this->mfg['hilo']->id, 'consumption' => 0.1, 'unitValue' => 500],
            ],
        ], $overrides);

        return $this->postJson('/api/manufacturing/references', $payload)->assertCreated()->json('data');
    }

    /** Matriz estándar: Blanco S=10, Blanco M=5, Negro S=4. */
    protected function standardMatrix(): array
    {
        return [
            ['colorId' => $this->mfg['blanco']->id, 'sizeId' => $this->mfg['s']->id, 'quantity' => 10],
            ['colorId' => $this->mfg['blanco']->id, 'sizeId' => $this->mfg['m']->id, 'quantity' => 5],
            ['colorId' => $this->mfg['negro']->id, 'sizeId' => $this->mfg['s']->id, 'quantity' => 4],
        ];
    }

    protected function createProductionOrder(int $referenceId, array $overrides = []): array
    {
        return $this->postJson('/api/manufacturing/production-orders', array_merge([
            'referenceId' => $referenceId,
            'items' => $this->standardMatrix(),
        ], $overrides))->assertCreated()->json('data');
    }

    /** Etapas ordenadas por secuencia de una orden (desde la respuesta de show). */
    protected function stagesOf(int $orderId): array
    {
        return $this->getJson("/api/manufacturing/production-orders/{$orderId}")->assertOk()->json('data.stages');
    }

    /**
     * Lleva la orden hasta el lote: omite las etapas intermedias y completa la última
     * con la matriz dada (o la estándar) en la bodega indicada.
     */
    protected function finishOrder(int $orderId, ?array $cells = null, ?int $warehouseId = null): array
    {
        $stages = $this->stagesOf($orderId);
        $last = array_pop($stages);
        foreach ($stages as $st) {
            $this->patchJson("/api/manufacturing/production-orders/{$orderId}/stages/{$st['id']}", ['status' => 'SKIPPED'])->assertOk();
        }

        return $this->patchJson("/api/manufacturing/production-orders/{$orderId}/stages/{$last['id']}", array_filter([
            'status' => 'COMPLETED',
            'cells' => $cells ?? $this->standardMatrix(),
            'warehouseId' => $warehouseId ?? $this->mfg['bodega']->id,
        ]))->assertOk()->json('data');
    }
}
