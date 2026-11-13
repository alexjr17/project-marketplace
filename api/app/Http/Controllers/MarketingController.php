<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Customizer\MannequinModelService;
use App\Services\Marketing\MarketingBrandService;
use App\Services\Marketing\MarketingCopyService;
use App\Services\Marketing\MarketingCreativeService;
use App\Services\Marketing\MarketingSourceService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** App Social → Estudio de contenido y Calendario (reglas en los servicios de Marketing). */
class MarketingController extends Controller
{
    use ApiResponse;

    public function __construct(
        private MarketingSourceService $sources,
        private MarketingCopyService $copy,
        private MarketingCreativeService $creatives,
    ) {}

    /** GET /messaging/marketing/sources?type=producto|coleccion|promocion|diseno|plantilla&q= */
    public function sources(Request $request)
    {
        $data = $request->validate(['type' => ['required', Rule::in(MarketingSourceService::TYPES)], 'q' => 'nullable|string|max:80']);

        return $this->success($this->sources->list($data['type'], $data['q'] ?? null));
    }

    /** GET /messaging/marketing/image?url=: foto externa para el lienzo (sin bloqueo CORS). */
    public function image(Request $request)
    {
        $data = $request->validate(['url' => 'required|string|max:2000']);
        [$bytes, $type] = $this->sources->image($data['url']);

        return response($bytes, 200, ['Content-Type' => $type, 'Cache-Control' => 'private, max-age=86400']);
    }

    /** POST /messaging/marketing/copy: textos con IA. */
    public function copy(Request $request)
    {
        $data = $request->validate([
            'kind' => ['required', Rule::in(MarketingCreativeService::KINDS)],
            'source' => ['required', Rule::in(MarketingCreativeService::SOURCES)],
            'tone' => ['nullable', Rule::in(MarketingCopyService::TONES)],
            'brief' => 'nullable|string|max:500',
            'items' => 'nullable|array|max:12',
        ]);

        return $this->success($this->copy->write($data));
    }

    /** GET /messaging/marketing/creatives?kind= */
    public function index(Request $request)
    {
        return $this->success($this->creatives->list($request->query('kind')));
    }

    /** POST /messaging/marketing/creatives (multipart: media + datos en JSON). */
    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:120',
            'kind' => ['required', Rule::in(MarketingCreativeService::KINDS)],
            'source' => ['nullable', Rule::in(MarketingCreativeService::SOURCES)],
            'sourceIds' => 'nullable|string',
            'template' => 'nullable|string|max:30',
            'data' => 'nullable|string',
            'caption' => 'nullable|string|max:2200',
            'hashtags' => 'nullable|string',
            'media' => 'required|file|max:65536',
        ]);
        foreach (['sourceIds', 'data', 'hashtags'] as $k) {
            $data[$k] = isset($data[$k]) ? (json_decode($data[$k], true) ?: []) : [];
        }

        return $this->created($this->creatives->store($data, $request->file('media'), $request->user()?->id), 'Pieza guardada');
    }

    /** PATCH /messaging/marketing/creatives/{id} */
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:120',
            'caption' => 'sometimes|nullable|string|max:2200',
            'hashtags' => 'sometimes|array',
        ]);

        return $this->success($this->creatives->update($id, $data));
    }

    /** DELETE /messaging/marketing/creatives/{id} */
    public function destroy(int $id)
    {
        $this->creatives->delete($id);

        return $this->success(null, 'Pieza eliminada');
    }

    /** POST /messaging/marketing/publish: publicar ya o programar. */
    public function publish(Request $request)
    {
        $data = $request->validate([
            'creativeIds' => 'required|array|min:1|max:10',
            'creativeIds.*' => 'integer',
            'platforms' => 'required|array|min:1',
            'platforms.*' => [Rule::in(['facebook', 'instagram'])],
            'caption' => 'nullable|string|max:2200',
            'scheduledAt' => 'nullable|date',
        ]);

        return $this->success(
            $this->creatives->publish($data, $request->user()->id),
            empty($data['scheduledAt']) ? 'Publicación enviada' : 'Publicación programada',
        );
    }

    /** GET /messaging/marketing/calendar?month=YYYY-MM */
    public function calendar(Request $request)
    {
        $data = $request->validate(['month' => ['required', 'date_format:Y-m']]);

        return $this->success($this->creatives->calendar($data['month']));
    }

    /** PATCH /messaging/marketing/posts/{id}/schedule */
    public function reschedule(Request $request, int $id)
    {
        $data = $request->validate(['scheduledAt' => 'required|date']);

        return $this->success($this->creatives->reschedule($id, $data['scheduledAt']), 'Fecha cambiada');
    }

    /** GET /messaging/marketing/brand: ficha de la marca. */
    public function brand(MarketingBrandService $brand)
    {
        return $this->success($brand->get());
    }

    /** PUT /messaging/marketing/brand */
    public function saveBrand(Request $request, MarketingBrandService $brand)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:60',
            'slogan' => 'sometimes|nullable|string|max:80',
            'description' => 'sometimes|nullable|string|max:300',
            'logos' => 'sometimes|array',
            'logos.*' => 'nullable|string',
            'colors' => 'sometimes|array|max:8',
            'colors.*.key' => 'nullable|string|max:20',
            'colors.*.name' => 'nullable|string|max:40',
            'colors.*.hex' => ['required_with:colors', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'fonts' => 'sometimes|array',
            'voice' => 'sometimes|array',
        ]);

        return $this->success($brand->save($data), 'Ficha de la marca guardada');
    }

    /** GET /messaging/marketing/accounts?fresh=1: cuota de GPU de las cuentas de Hugging Face. */
    public function accounts(Request $request, MannequinModelService $models)
    {
        return $this->success($models->accounts($request->boolean('fresh')) + ['groq' => $this->copy->configured()]);
    }
}
