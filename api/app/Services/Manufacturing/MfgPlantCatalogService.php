<?php

namespace App\Services\Manufacturing;

use App\Exceptions\BusinessRuleException;
use App\Models\MfgClient;
use App\Models\MfgGarmentType;
use App\Models\MfgInput;
use App\Models\MfgInputBatch;
use App\Models\MfgProcess;
use App\Models\MfgWorkshop;
use Illuminate\Support\Facades\DB;

/**
 * Catálogos de Fábrica que guardan algo más que sus propios campos: tallas del tipo de
 * prenda, consumos del proceso, procesos del taller, lotes del insumo y la regla de borrado
 * de clientes. Cada guardado con relaciones va en una transacción.
 */
class MfgPlantCatalogService
{
    public const GARMENT_TYPE_RELATIONS = ['sizes:id,name,abbreviation,sortOrder', 'brand:id,name'];

    public const PROCESS_RELATIONS = ['consumptions.inputType:id,name,classification', 'consumptions.input:id,code,name'];

    // ==================== Tipos de prenda ====================

    /** Crea o actualiza el tipo de prenda y reescribe sus tallas por mercado (si vienen). */
    public function saveGarmentType(array $data, ?MfgGarmentType $g = null): MfgGarmentType
    {
        $national = $data['nationalSizeIds'] ?? null;
        $export = $data['exportSizeIds'] ?? null;
        unset($data['nationalSizeIds'], $data['exportSizeIds']);
        $data['code'] = strtoupper(trim($data['code']));

        $g = DB::transaction(function () use ($data, $g, $national, $export) {
            $g = $g ? tap($g, fn ($m) => $m->fill($data)->save()) : MfgGarmentType::create($data);
            $this->syncGarmentTypeSizes($g, $national, $export);

            return $g;
        });

        return $g->load(self::GARMENT_TYPE_RELATIONS);
    }

    private function syncGarmentTypeSizes(MfgGarmentType $g, ?array $national, ?array $export): void
    {
        if ($national === null && $export === null) {
            return;
        }
        DB::table('mfg_garment_type_sizes')->where('garmentTypeId', $g->id)->delete();
        $rows = [];
        foreach (array_unique($national ?? []) as $sid) {
            $rows[] = ['garmentTypeId' => $g->id, 'sizeId' => $sid, 'market' => 'NATIONAL'];
        }
        foreach (array_unique($export ?? []) as $sid) {
            $rows[] = ['garmentTypeId' => $g->id, 'sizeId' => $sid, 'market' => 'EXPORT'];
        }
        if ($rows) {
            DB::table('mfg_garment_type_sizes')->insert($rows);
        }
    }

    // ==================== Procesos ====================

    /** Crea o actualiza el proceso y reescribe sus consumos (por tipo o insumo), si vienen. */
    public function saveProcess(array $data, ?MfgProcess $p = null): MfgProcess
    {
        $consumptions = $data['consumptions'] ?? null;
        unset($data['consumptions']);

        $p = DB::transaction(function () use ($data, $p, $consumptions) {
            $p = $p ? tap($p, fn ($m) => $m->fill($data)->save()) : MfgProcess::create($data);
            if ($consumptions !== null) {
                $p->consumptions()->delete();
                foreach ($consumptions as $c) {
                    $kind = $c['kind'];
                    $p->consumptions()->create([
                        'kind' => $kind,
                        'inputTypeId' => $kind === 'TYPE' ? ($c['inputTypeId'] ?? null) : null,
                        'inputId' => $kind === 'INPUT' ? ($c['inputId'] ?? null) : null,
                    ]);
                }
            }

            return $p;
        });

        return $p->load(self::PROCESS_RELATIONS);
    }

    // ==================== Talleres ====================

    /** Crea o actualiza el taller y sus procesos (si vienen). */
    public function saveWorkshop(array $data, ?MfgWorkshop $w = null): MfgWorkshop
    {
        $processIds = $data['processIds'] ?? null;
        unset($data['processIds']);

        $w = DB::transaction(function () use ($data, $w, $processIds) {
            $w = $w ? tap($w, fn ($m) => $m->fill($data)->save()) : MfgWorkshop::create($data);
            if ($processIds !== null) {
                $w->processes()->sync($processIds);
            }

            return $w;
        });

        return $w->load('processes:id,name');
    }

    // ==================== Lotes de insumo ====================

    /** Lotes del insumo (más recientes primero) y su costo unitario promedio. */
    public function inputBatches(int $inputId): array
    {
        $batches = MfgInputBatch::with('color:id,name,hexCode')
            ->where('inputId', $inputId)->orderByDesc('purchasedAt')->orderByDesc('id')->get();

        return [
            'batches' => $batches,
            'average' => $batches->count() ? round((float) $batches->avg('unitCost'), 2) : 0,
        ];
    }

    public function addInputBatch(MfgInput $input, array $data): MfgInputBatch
    {
        return MfgInputBatch::create($data + ['inputId' => $input->id])->load('color:id,name,hexCode');
    }

    // ==================== Clientes ====================

    public function deleteClient(MfgClient $c): void
    {
        if ($c->purchaseOrders()->exists()) {
            throw new BusinessRuleException('No se puede eliminar: el cliente tiene pedidos.');
        }
        $c->delete();
    }
}
