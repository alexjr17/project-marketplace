<?php

namespace App\Services\Manufacturing;

use App\Exceptions\BusinessRuleException;
use App\Models\MfgExchangeRate;
use App\Models\MfgGarmentType;
use App\Models\MfgReference;
use App\Services\NumberSequenceService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Referencias de Fábrica con su ficha técnica: imagen, colores (primario/secundario),
 * componentes, materiales (BOM con valor), grupos de tallas (listas de precio con recargo
 * por color) y cálculo de costos/precio.
 *
 * Precio:
 *   costVariable = Σ (consumption × unitValue) de materiales
 *   costUnit     = costVariable + fixedCost
 *   basePrice    = costUnit × factor
 *   grupo.listPrice (si no se envía) = (costUnit + grupo.fixedCostExtra) × grupo.factor
 *   recargo por color: se define por grupo y se suma en la venta (no altera listPrice).
 */
class MfgReferenceService
{
    public const RELATIONS = [
        'garmentType:id,code,name,brandId,fixedCost,factor,factorExport',
        'garmentType.brand:id,name',
        'brand:id,name',
        'collection:id,name,year,semester',
        'colors.color:id,name,hexCode,code',
        'sizes.size:id,name,abbreviation,sortOrder,market',
        'components',
        'materials.input:id,code,name,unitOfMeasure,inputTypeId,scope',
        'materials.input.inputType:id,name,classification',
        'materials.color:id,name,hexCode,code',
        'materials.component',
        'sizeGroups.sizes.size:id,name,abbreviation,sortOrder',
        'sizeGroups.surcharges.color:id,name,hexCode,code',
    ];

    public function __construct(private NumberSequenceService $numbers) {}

    /** @param array{search?:?string, isActive?:?bool} $filters */
    public function list(array $filters = []): Collection
    {
        $query = MfgReference::with(self::RELATIONS)->orderByDesc('createdAt');

        if (! empty($filters['search'])) {
            $term = '%'.$filters['search'].'%';
            $query->where(fn ($q) => $q->where('code', 'like', $term)->orWhere('name', 'like', $term));
        }
        if (isset($filters['isActive'])) {
            $query->where('isActive', $filters['isActive']);
        }

        return $query->get();
    }

    public function find(int $id): ?MfgReference
    {
        return MfgReference::with(self::RELATIONS)->find($id);
    }

    /** Próximo código del tipo de prenda, sin consumir la numeración (para mostrarlo en el formulario). */
    public function previewCode(int $garmentTypeId): string
    {
        return $this->nextCode($garmentTypeId, false);
    }

    public function create(array $data): MfgReference
    {
        $costs = $this->computeCosts($data['materials'] ?? [], $data);
        $code = $this->resolveCode((int) $data['garmentTypeId'], $data['code'] ?? null);
        $this->assertCodeFree($code);

        $ref = DB::transaction(function () use ($data, $costs, $code) {
            $ref = MfgReference::create($this->attributes($data, $costs, $code));
            $this->syncTechnicalSheet($ref, $data, $costs);

            return $ref;
        });

        return $ref->load(self::RELATIONS);
    }

    public function update(MfgReference $ref, array $data): MfgReference
    {
        // Sin 'materials' en la petición el BOM no se toca, así que el costo sale del BOM guardado.
        $materials = array_key_exists('materials', $data)
            ? ($data['materials'] ?? [])
            : $ref->materials()->get(['consumption', 'unitValue'])->toArray();
        $costs = $this->computeCosts($materials, $data);
        $code = $this->resolveCode((int) $data['garmentTypeId'], $data['code'] ?? null, $ref);
        $this->assertCodeFree($code, $ref->id);

        DB::transaction(function () use ($ref, $data, $costs, $code) {
            $ref->fill($this->attributes($data, $costs, $code))->save();
            $this->syncTechnicalSheet($ref, $data, $costs);
        });

        return $ref->load(self::RELATIONS);
    }

    public function delete(MfgReference $ref): void
    {
        $ref->delete();
    }

    private function assertCodeFree(string $code, ?int $ignoreId = null): void
    {
        $taken = MfgReference::where('code', $code)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();
        if ($taken) {
            throw new BusinessRuleException('El código ya existe', 422, ['code' => ['El código ya existe']]);
        }
    }

    private function attributes(array $data, array $costs, string $code): array
    {
        return [
            'code' => $code,
            'name' => $data['name'],
            'garmentTypeId' => $data['garmentTypeId'],
            'brandId' => MfgGarmentType::whereKey($data['garmentTypeId'])->value('brandId'),
            'collectionId' => $data['collectionId'] ?? null,
            'description' => $data['description'] ?? null,
            'isActive' => $data['isActive'] ?? true,
            'imagePath' => $data['imagePath'] ?? null,
            'fixedCost' => $data['fixedCost'] ?? 0,
            'factor' => $data['factor'] ?? 1,
            'costVariable' => $costs['costVariable'],
            'costUnit' => $costs['costUnit'],
            'basePrice' => $costs['basePrice'],
        ];
    }

    /**
     * costVariable / costUnit / basePrice a partir de los materiales + costo fijo + factor.
     *
     * @param  array<int, array{consumption?:mixed, unitValue?:mixed}>  $materials
     */
    public function computeCosts(array $materials, array $data): array
    {
        $costVariable = 0.0;
        foreach ($materials as $m) {
            $costVariable += ((float) ($m['consumption'] ?? 0)) * ((float) ($m['unitValue'] ?? 0));
        }
        $costUnit = $costVariable + (float) ($data['fixedCost'] ?? 0);

        return [
            'costVariable' => round($costVariable, 2),
            'costUnit' => round($costUnit, 2),
            'basePrice' => round($costUnit * (float) ($data['factor'] ?? 1), 2),
        ];
    }

    /** Reescribe las partes de la ficha técnica que vienen en la petición (borrar y reinsertar). */
    private function syncTechnicalSheet(MfgReference $ref, array $data, array $costs): void
    {
        // Colores (con tipo).
        if (array_key_exists('colors', $data)) {
            $ref->colors()->delete();
            $seen = [];
            foreach ($data['colors'] ?? [] as $c) {
                if (isset($seen[$c['colorId']])) {
                    continue;
                }
                $seen[$c['colorId']] = true;
                $ref->colors()->create(['colorId' => $c['colorId'], 'colorType' => $c['type'] ?? 'SECONDARY']);
            }
        }

        // Tallas base.
        if (array_key_exists('sizeIds', $data)) {
            $ref->sizes()->delete();
            foreach (array_unique($data['sizeIds'] ?? []) as $sizeId) {
                $ref->sizes()->create(['sizeId' => $sizeId]);
            }
        }

        // Componentes (primero, para mapear índice → id en materiales).
        $componentIds = [];
        if (array_key_exists('components', $data)) {
            $ref->components()->delete();
            foreach ($data['components'] ?? [] as $comp) {
                $componentIds[] = $ref->components()->create([
                    'position' => $comp['position'],
                    'description' => $comp['description'] ?? null,
                ])->id;
            }
        }

        // Materiales (con valor y componente).
        if (array_key_exists('materials', $data)) {
            $ref->materials()->delete();
            foreach ($data['materials'] ?? [] as $m) {
                $ref->materials()->create([
                    'inputId' => $m['inputId'],
                    'colorId' => $m['colorId'] ?? null,
                    'componentId' => isset($m['componentIndex']) ? ($componentIds[$m['componentIndex']] ?? null) : null,
                    'consumptionInitial' => $m['consumptionInitial'] ?? null,
                    'increment' => $m['increment'] ?? 0,
                    'consumption' => $m['consumption'] ?? 0,
                    'unitValue' => $m['unitValue'] ?? 0,
                    'unitOfMeasure' => $m['unitOfMeasure'] ?? null,
                    'notes' => $m['notes'] ?? null,
                ]);
            }
        }

        // Grupos de tallas (listas de precio) + tallas + recargos por color.
        if (array_key_exists('sizeGroups', $data)) {
            $ref->sizeGroups()->delete();
            $rate = (float) (MfgExchangeRate::active()?->rate ?? 0);
            foreach ($data['sizeGroups'] ?? [] as $i => $g) {
                $market = $g['market'] ?? 'NATIONAL';
                $factor = (float) ($g['factor'] ?? 1);
                $extra = (float) ($g['fixedCostExtra'] ?? 0);
                $provided = (float) ($g['listPrice'] ?? 0);
                $listPrice = $provided > 0 ? $provided : round(($costs['costUnit'] + $extra) * $factor, 2);
                // Exportación se guarda en USD: pesos ÷ tasa activa (sin tasa queda en 0, nunca en pesos).
                if ($provided <= 0 && $market === 'EXPORT') {
                    $listPrice = $rate > 0 ? round($listPrice / $rate, 2) : 0;
                }

                $group = $ref->sizeGroups()->create([
                    'name' => $g['name'],
                    'market' => $market,
                    'fixedCostExtra' => $extra,
                    'factor' => $factor,
                    'listPrice' => $listPrice,
                    'isWholesale' => $g['isWholesale'] ?? false,
                    'sortOrder' => $i,
                ]);
                foreach (array_unique($g['sizeIds'] ?? []) as $sizeId) {
                    $group->sizes()->create(['sizeId' => $sizeId]);
                }
                $seenColor = [];
                foreach ($g['surcharges'] ?? [] as $s) {
                    $amount = (float) ($s['amount'] ?? 0);
                    if ($amount <= 0 || isset($seenColor[$s['colorId']])) {
                        continue;
                    }
                    $seenColor[$s['colorId']] = true;
                    $group->surcharges()->create(['colorId' => $s['colorId'], 'amount' => $amount]);
                }
            }
        }
    }

    /**
     * Código final: el prefijo siempre es el del tipo de prenda (no editable); el sufijo lo
     * puede editar el usuario. Vacío → se autogenera (nuevo) o se conserva (edición).
     */
    private function resolveCode(int $garmentTypeId, ?string $provided, ?MfgReference $existing = null): string
    {
        $provided = $provided !== null ? trim($provided) : '';
        $fallback = fn () => $existing ? $existing->code : $this->nextCode($garmentTypeId);

        if ($provided === '') {
            return $fallback();
        }
        // El sufijo editable es lo que va después del primer '-'; el prefijo se fuerza.
        $suffix = str_contains($provided, '-') ? substr($provided, strpos($provided, '-') + 1) : $provided;
        $suffix = strtoupper((string) preg_replace('/[^A-Za-z0-9._-]/', '', $suffix));

        return $suffix === '' ? $fallback() : $this->codePrefix($garmentTypeId).'-'.$suffix;
    }

    /** Prefijo del código según el tipo de prenda (CAM, HOO…; REF si no existe). */
    private function codePrefix(int $garmentTypeId): string
    {
        $code = MfgGarmentType::whereKey($garmentTypeId)->value('code');

        return $code ? strtoupper($code) : 'REF';
    }

    /** Próximo código PREFIJO-####; con $consume=false solo lo muestra. */
    private function nextCode(int $garmentTypeId, bool $consume = true): string
    {
        $vars = ['code' => $this->codePrefix($garmentTypeId)];

        return $consume
            ? $this->numbers->next(NumberSequenceService::MFG_REFERENCE, $vars)
            : $this->numbers->peek(NumberSequenceService::MFG_REFERENCE, $vars);
    }
}
