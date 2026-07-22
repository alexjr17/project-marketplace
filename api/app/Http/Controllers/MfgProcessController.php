<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\MfgProcess;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Catálogo de estaciones / etapas de producción de la app Fábrica.
 */
class MfgProcessController extends Controller
{
    use ApiResponse;

    private function rules(int $ignoreId = 0): array
    {
        return [
            'name' => 'required|string|max:120',
            'code' => ['nullable', 'string', 'max:60', Rule::unique('mfg_processes', 'code')->ignore($ignoreId)],
            'sequence' => 'nullable|integer|min:0',
            'type' => 'nullable|in:INTERNAL,EXTERNAL',
            'isActive' => 'boolean',
            // Consumo: qué insumos consume el proceso (por tipo o insumo específico).
            'consumptions' => 'nullable|array',
            'consumptions.*.kind' => 'required|in:TYPE,INPUT',
            'consumptions.*.inputTypeId' => 'nullable|integer|exists:mfg_input_types,id',
            'consumptions.*.inputId' => 'nullable|integer|exists:mfg_inputs,id',
        ];
    }

    private const RELATIONS = ['consumptions.inputType:id,name,classification', 'consumptions.input:id,code,name'];

    public function index()
    {
        return $this->success(
            MfgProcess::with(self::RELATIONS)->orderBy('sequence')->orderBy('id')->get()
        );
    }

    private function syncConsumptions(MfgProcess $p, ?array $consumptions): void
    {
        if ($consumptions === null) {
            return;
        }
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

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());
        $consumptions = $data['consumptions'] ?? null;
        unset($data['consumptions']);
        $p = MfgProcess::create($data);
        $this->syncConsumptions($p, $consumptions);

        return $this->created($p->load(self::RELATIONS), 'Proceso creado');
    }

    public function update(Request $request, int $id)
    {
        $p = MfgProcess::find($id);
        if (! $p) {
            return $this->error('Proceso no encontrado', 404);
        }
        $data = $request->validate($this->rules($id));
        $consumptions = $data['consumptions'] ?? null;
        unset($data['consumptions']);
        $p->fill($data)->save();
        $this->syncConsumptions($p, $consumptions);

        return $this->success($p->load(self::RELATIONS), 'Proceso actualizado');
    }

    public function destroy(int $id)
    {
        $p = MfgProcess::find($id);
        if (! $p) {
            return $this->error('Proceso no encontrado', 404);
        }
        $p->delete();

        return $this->success(null, 'Proceso eliminado');
    }
}
