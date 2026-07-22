<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgGarmentType;
use App\Models\MfgReference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Referencias de la app Fábrica con ficha técnica completa (réplica de
 * project-fabrica-ropa, con nuestro estándar): imagen, colores (primario/
 * secundario), componentes, materiales (BOM con valor), grupos de tallas
 * (listas de precio con recargo por color) y cálculo de costos/precio.
 *
 * Precio:
 *   costVariable = Σ (consumption × unitValue) de materiales
 *   costUnit     = costVariable + fixedCost
 *   basePrice    = costUnit × factor
 *   grupo.listPrice (si no se envía) = (costUnit + grupo.fixedCostExtra) × grupo.factor
 *   recargo por color: se define por grupo y se suma en la venta (no altera listPrice).
 */
class MfgReferenceController extends Controller
{
    use ApiResponse;

    private const RELATIONS = [
        'garmentType:id,code,name',
        'collection:id,name,year,semester',
        'colors.color:id,name,hexCode,code',
        'sizes.size:id,name,abbreviation,sortOrder',
        'components',
        'materials.input:id,code,name,unitOfMeasure,inputTypeId,scope',
        'materials.input.inputType:id,name,classification',
        'materials.color:id,name,hexCode,code',
        'materials.component',
        'sizeGroups.sizes.size:id,name,abbreviation,sortOrder',
        'sizeGroups.surcharges.color:id,name,hexCode,code',
    ];

    private function rules(): array
    {
        return [
            'name' => 'required|string|max:150',
            'code' => 'nullable|string|max:60',
            'garmentTypeId' => 'required|integer|exists:mfg_garment_types,id',
            'collectionId' => 'nullable|integer|exists:mfg_collections,id',
            'description' => 'nullable|string',
            'isActive' => 'boolean',
            'imagePath' => 'nullable|string|max:500',
            'fixedCost' => 'nullable|numeric|min:0',
            'factor' => 'nullable|numeric|min:0',
            // Colores con tipo.
            'colors' => 'nullable|array',
            'colors.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'colors.*.type' => 'nullable|in:PRIMARY,SECONDARY',
            // Tallas base.
            'sizeIds' => 'nullable|array',
            'sizeIds.*' => 'integer|exists:mfg_sizes,id',
            // Componentes.
            'components' => 'nullable|array',
            'components.*.position' => 'required|in:SUPERIOR,INFERIOR',
            'components.*.description' => 'nullable|string|max:200',
            // Materiales (BOM).
            'materials' => 'nullable|array',
            'materials.*.inputId' => 'required|integer|exists:mfg_inputs,id',
            'materials.*.colorId' => 'nullable|integer|exists:mfg_colors,id',
            'materials.*.componentIndex' => 'nullable|integer|min:0',
            'materials.*.consumption' => 'nullable|numeric|min:0',
            'materials.*.unitValue' => 'nullable|numeric|min:0',
            'materials.*.unitOfMeasure' => 'nullable|string|max:20',
            'materials.*.notes' => 'nullable|string',
            // Grupos de tallas (listas de precio).
            'sizeGroups' => 'nullable|array',
            'sizeGroups.*.name' => 'required|string|max:120',
            'sizeGroups.*.market' => 'nullable|in:NATIONAL,EXPORT',
            'sizeGroups.*.fixedCostExtra' => 'nullable|numeric|min:0',
            'sizeGroups.*.factor' => 'nullable|numeric|min:0',
            'sizeGroups.*.listPrice' => 'nullable|numeric|min:0',
            'sizeGroups.*.isWholesale' => 'boolean',
            'sizeGroups.*.sizeIds' => 'nullable|array',
            'sizeGroups.*.sizeIds.*' => 'integer|exists:mfg_sizes,id',
            'sizeGroups.*.surcharges' => 'nullable|array',
            'sizeGroups.*.surcharges.*.colorId' => 'required|integer|exists:mfg_colors,id',
            'sizeGroups.*.surcharges.*.amount' => 'nullable|numeric|min:0',
        ];
    }

    public function index(Request $request)
    {
        $query = MfgReference::with(self::RELATIONS)->orderByDesc('createdAt');

        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where(function ($q) use ($term) {
                $q->where('code', 'like', $term)->orWhere('name', 'like', $term);
            });
        }
        if ($request->filled('isActive')) {
            $query->where('isActive', $request->boolean('isActive'));
        }

        return $this->success($query->get());
    }

    public function show(int $id)
    {
        $ref = MfgReference::with(self::RELATIONS)->find($id);
        if (! $ref) {
            return $this->error('Referencia no encontrada', 404);
        }

        return $this->success($ref);
    }

    public function generateCode(Request $request)
    {
        $data = $request->validate(['garmentTypeId' => 'required|integer|exists:mfg_garment_types,id']);

        return $this->success(['code' => $this->nextCode((int) $data['garmentTypeId'])]);
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $costs = $this->computeCosts($data);
        $code = $this->resolveCode((int) $data['garmentTypeId'], $data['code'] ?? null);
        if (MfgReference::where('code', $code)->exists()) {
            return $this->error('El código ya existe', 422, ['code' => ['El código ya existe']]);
        }

        $ref = DB::transaction(function () use ($data, $costs, $code) {
            $ref = MfgReference::create([
                'code' => $code,
                'name' => $data['name'],
                'garmentTypeId' => $data['garmentTypeId'],
                'collectionId' => $data['collectionId'] ?? null,
                'description' => $data['description'] ?? null,
                'isActive' => $data['isActive'] ?? true,
                'imagePath' => $data['imagePath'] ?? null,
                'fixedCost' => $data['fixedCost'] ?? 0,
                'factor' => $data['factor'] ?? 1,
                'costVariable' => $costs['costVariable'],
                'costUnit' => $costs['costUnit'],
                'basePrice' => $costs['basePrice'],
            ]);
            $this->syncTechnicalSheet($ref, $data, $costs);

            return $ref;
        });

        return $this->created($ref->load(self::RELATIONS), 'Referencia creada');
    }

    public function update(Request $request, int $id)
    {
        $ref = MfgReference::find($id);
        if (! $ref) {
            return $this->error('Referencia no encontrada', 404);
        }
        $data = $request->validate($this->rules());
        $costs = $this->computeCosts($data);
        $code = $this->resolveCode((int) $data['garmentTypeId'], $data['code'] ?? null, $ref);
        if (MfgReference::where('code', $code)->where('id', '!=', $ref->id)->exists()) {
            return $this->error('El código ya existe', 422, ['code' => ['El código ya existe']]);
        }

        DB::transaction(function () use ($ref, $data, $costs, $code) {
            $ref->fill([
                'code' => $code,
                'name' => $data['name'],
                'garmentTypeId' => $data['garmentTypeId'],
                'collectionId' => $data['collectionId'] ?? null,
                'description' => $data['description'] ?? null,
                'isActive' => $data['isActive'] ?? true,
                'imagePath' => $data['imagePath'] ?? null,
                'fixedCost' => $data['fixedCost'] ?? 0,
                'factor' => $data['factor'] ?? 1,
                'costVariable' => $costs['costVariable'],
                'costUnit' => $costs['costUnit'],
                'basePrice' => $costs['basePrice'],
            ])->save();
            $this->syncTechnicalSheet($ref, $data, $costs);
        });

        return $this->success($ref->load(self::RELATIONS), 'Referencia actualizada');
    }

    public function destroy(int $id)
    {
        $ref = MfgReference::find($id);
        if (! $ref) {
            return $this->error('Referencia no encontrada', 404);
        }
        $ref->delete();

        return $this->success(null, 'Referencia eliminada');
    }

    /** costVariable / costUnit / basePrice a partir de materiales + costo fijo + factor. */
    private function computeCosts(array $data): array
    {
        $costVariable = 0.0;
        foreach ($data['materials'] ?? [] as $m) {
            $costVariable += ((float) ($m['consumption'] ?? 0)) * ((float) ($m['unitValue'] ?? 0));
        }
        $fixedCost = (float) ($data['fixedCost'] ?? 0);
        $factor = (float) ($data['factor'] ?? 1);
        $costUnit = $costVariable + $fixedCost;

        return [
            'costVariable' => round($costVariable, 2),
            'costUnit' => round($costUnit, 2),
            'basePrice' => round($costUnit * $factor, 2),
        ];
    }

    /** Reescribe toda la ficha técnica (borrar y reinsertar). */
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
                $created = $ref->components()->create([
                    'position' => $comp['position'],
                    'description' => $comp['description'] ?? null,
                ]);
                $componentIds[] = $created->id;
            }
        }

        // Materiales (con valor y componente).
        if (array_key_exists('materials', $data)) {
            $ref->materials()->delete();
            foreach ($data['materials'] ?? [] as $m) {
                $componentId = null;
                if (isset($m['componentIndex']) && isset($componentIds[$m['componentIndex']])) {
                    $componentId = $componentIds[$m['componentIndex']];
                }
                $ref->materials()->create([
                    'inputId' => $m['inputId'],
                    'colorId' => $m['colorId'] ?? null,
                    'componentId' => $componentId,
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
            foreach ($data['sizeGroups'] ?? [] as $i => $g) {
                $factor = (float) ($g['factor'] ?? 1);
                $extra = (float) ($g['fixedCostExtra'] ?? 0);
                $provided = (float) ($g['listPrice'] ?? 0);
                $listPrice = $provided > 0 ? $provided : round(($costs['costUnit'] + $extra) * $factor, 2);

                $group = $ref->sizeGroups()->create([
                    'name' => $g['name'],
                    'market' => $g['market'] ?? 'NATIONAL',
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
     * Resuelve el código final: el prefijo siempre es el del tipo de prenda
     * (no editable); el sufijo lo puede editar el usuario. Si viene vacío,
     * se autogenera (nuevo) o se conserva el existente (edición).
     */
    private function resolveCode(int $garmentTypeId, ?string $provided, ?MfgReference $existing = null): string
    {
        $gt = MfgGarmentType::find($garmentTypeId);
        $prefix = $gt ? strtoupper($gt->code) : 'REF';
        $provided = $provided !== null ? trim($provided) : '';

        if ($provided === '') {
            return $existing ? $existing->code : $this->nextCode($garmentTypeId);
        }
        // El sufijo editable es lo que va después del primer '-'; el prefijo se fuerza.
        $suffix = str_contains($provided, '-') ? substr($provided, strpos($provided, '-') + 1) : $provided;
        $suffix = strtoupper((string) preg_replace('/[^A-Za-z0-9._-]/', '', $suffix));

        return $suffix === '' ? ($existing ? $existing->code : $this->nextCode($garmentTypeId)) : $prefix.'-'.$suffix;
    }

    /** Próximo código: PREFIJO-#### según el tipo de prenda. */
    private function nextCode(int $garmentTypeId): string
    {
        $gt = MfgGarmentType::find($garmentTypeId);
        $prefix = $gt ? strtoupper($gt->code) : 'REF';

        $last = MfgReference::where('code', 'like', $prefix.'-%')
            ->orderByRaw('CAST(SUBSTRING_INDEX(code, "-", -1) AS UNSIGNED) DESC')
            ->first();
        $n = $last ? ((int) substr(strrchr($last->code, '-'), 1)) + 1 : 1;

        return sprintf('%s-%04d', $prefix, $n);
    }
}
