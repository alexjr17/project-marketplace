<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Customizer\MannequinModelService;
use App\Services\Marketing\MarketingBrandService;
use App\Services\Marketing\MarketingCopyService;
use App\Services\Marketing\MarketingCreativeService;
use App\Services\Marketing\MarketingSourceService;
use App\Services\Marketing\MarketingImageService;
use App\Services\Marketing\MarketingNarrationService;
use App\Services\Marketing\MarketingVideoAdviceService;
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
        private MarketingVideoAdviceService $videoAdvice,
        private MarketingNarrationService $narration,
        private MarketingImageService $aiImages,
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
            'scenes' => 'nullable|array|max:12',
            'scenes.*.kind' => ['required', Rule::in(MarketingCopyService::SCENE_KINDS)],
            'scenes.*.about' => 'nullable|string|max:120',
        ]);

        return $this->success($this->copy->write($data));
    }

    /** POST /messaging/marketing/video-advice: la IA revisa el video y recomienda transiciones, sonidos y tiempos. */
    public function videoAdvice(Request $request)
    {
        $data = $request->validate([
            'tone' => ['nullable', Rule::in(MarketingCopyService::TONES)],
            'brief' => 'nullable|string|max:500',
            'ratio' => 'nullable|in:9:16,4:5,1:1',
            'hasMusic' => 'boolean',
            'endCard' => 'boolean',
            'scenes' => 'required|array|min:1|max:12',
            'scenes.*.kind' => ['required', Rule::in(MarketingVideoAdviceService::SCENE_KINDS)],
            'scenes.*.about' => 'nullable|string|max:120',
            'scenes.*.title' => 'nullable|string|max:90',
            'scenes.*.seconds' => 'nullable|numeric|min:0|max:60',
            'scenes.*.transition' => 'nullable|string|max:20',
            'scenes.*.sound' => 'nullable|string|max:20',
            'scenes.*.motion' => 'nullable|string|max:20',
        ]);

        return $this->success($this->videoAdvice->advise($data));
    }

    /** GET /messaging/marketing/narration/voices: voces del narrador. */
    public function voices()
    {
        return $this->success($this->narration->voices());
    }

    /** POST /messaging/marketing/narration/script: la IA escribe lo que dice el narrador en cada escena. */
    public function narrationScript(Request $request)
    {
        $data = $request->validate([
            'tone' => ['nullable', Rule::in(MarketingCopyService::TONES)],
            'brief' => 'nullable|string|max:500',
            'scenes' => 'required|array|min:1|max:12',
            'scenes.*.kind' => ['required', Rule::in(MarketingVideoAdviceService::SCENE_KINDS)],
            'scenes.*.about' => 'nullable|string|max:120',
            'scenes.*.title' => 'nullable|string|max:120',
            'scenes.*.seconds' => 'required|numeric|min:0.5|max:60',
        ]);

        return $this->success($this->narration->script($data));
    }

    /** POST /messaging/marketing/narration/speak: audio MP3 de una línea con la voz elegida. */
    public function speak(Request $request)
    {
        $data = $request->validate([
            'text' => 'required|string|max:400',
            'voice' => ['required', Rule::in(array_keys(MarketingNarrationService::VOICES))],
            'rate' => 'nullable|integer|min:-30|max:30',
        ]);
        [$bytes, $type] = $this->narration->speak($data['text'], $data['voice'], (int) ($data['rate'] ?? 0));

        return response($bytes, 200, ['Content-Type' => $type, 'Cache-Control' => 'private, max-age=86400']);
    }

    /** POST /messaging/marketing/ai-image: crea una imagen con IA (diseño, fondo, foto o prenda lisa). */
    public function aiImage(Request $request)
    {
        $data = $request->validate([
            'prompt' => 'required|string|min:3|max:500',
            'kind' => ['required', Rule::in(MarketingImageService::KINDS)],
            'ratio' => ['nullable', Rule::in(array_keys(MarketingImageService::RATIOS))],
        ]);

        return $this->success($this->aiImages->generate($data['prompt'], $data['kind'], $data['ratio'] ?? '1:1'));
    }

    /** POST /messaging/marketing/ai-backdrop: fondo profesional con IA a partir de los diseños de la prenda. */
    public function aiBackdrop(Request $request)
    {
        $data = $request->validate([
            'style' => ['required', Rule::in(array_keys(MarketingImageService::BACKDROP_STYLES))],
            'idea' => 'nullable|string|max:300',
            'palette' => 'nullable|array|max:6',
            'palette.*' => ['string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'designs' => 'nullable|array|max:3',
            'designs.*' => ['string', 'max:400000', 'regex:/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/'],
            'ratio' => ['nullable', Rule::in(array_keys(MarketingImageService::RATIOS))],
        ]);

        return $this->success($this->aiImages->backdrop($data['style'], (string) ($data['idea'] ?? ''), $data['palette'] ?? [], $data['designs'] ?? [], $data['ratio'] ?? '1:1'));
    }

    /** POST /messaging/marketing/ai-garment/front: foto maestra (frente) de una prenda lisa. */
    public function garmentFront(Request $request)
    {
        $data = $request->validate([
            'idea' => 'required|string|min:3|max:400',
            'mannequin' => 'boolean',
            'background' => 'nullable|in:oscuro,claro',
        ]);

        return $this->success($this->aiImages->garmentFront($data['idea'], (bool) ($data['mannequin'] ?? true), $data['background'] ?? 'oscuro'));
    }

    /** POST /messaging/marketing/ai-garment/view: otra vista de la misma prenda (espalda o mangas). */
    public function garmentView(Request $request)
    {
        $data = $request->validate([
            'path' => 'required|string|max:200',
            'view' => ['required', Rule::in(MarketingImageService::VIEWS)],
            'mannequin' => 'boolean',
        ]);

        return $this->success($this->aiImages->garmentView($data['path'], $data['view'], (bool) ($data['mannequin'] ?? true)));
    }

    /** POST /messaging/marketing/ai-garment/edit: ajusta una foto de prenda (quitar logos, menos arrugas, otro corte). */
    public function garmentEdit(Request $request)
    {
        $data = $request->validate(['path' => 'required|string|max:200', 'instruction' => 'required|string|min:3|max:600']);

        return $this->success($this->aiImages->garmentEdit($data['path'], $data['instruction']));
    }

    /** POST /messaging/marketing/ai-garment/cutout: la imagen en PNG con fondo transparente. */
    public function garmentCutout(Request $request)
    {
        $data = $request->validate(['path' => 'required|string|max:200']);

        return $this->success($this->aiImages->cutout($data['path']));
    }

    /** POST /messaging/marketing/product-cutout: la foto de un producto sin su fondo (queda guardada). */
    public function productCutout(Request $request)
    {
        $data = $request->validate(['url' => 'required|string|max:1000']);

        return $this->success($this->aiImages->productCutout($data['url']));
    }

    /** POST /messaging/marketing/ai-garment/mirror: espejo de una vista en PNG (manga derecha desde la izquierda). */
    public function garmentMirror(Request $request)
    {
        $data = $request->validate(['path' => 'required|string|max:200']);

        return $this->success($this->aiImages->mirror($data['path']));
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
