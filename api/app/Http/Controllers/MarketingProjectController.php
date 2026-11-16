<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Marketing\MarketingCreativeService;
use App\Services\Marketing\MarketingProjectService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** App Social → Estudio de contenido: proyectos (trabajo en curso). Reglas en MarketingProjectService. */
class MarketingProjectController extends Controller
{
    use ApiResponse;

    public function __construct(private MarketingProjectService $projects) {}

    /** GET /messaging/marketing/projects?format= */
    public function index(Request $request)
    {
        $data = $request->validate(['format' => ['nullable', Rule::in(MarketingProjectService::FORMATS)]]);

        return $this->success($this->projects->list($data['format'] ?? null));
    }

    /** GET /messaging/marketing/projects/{id} (con todo lo armado) */
    public function show(int $id)
    {
        return $this->success($this->projects->show($id));
    }

    /** POST /messaging/marketing/projects */
    public function store(Request $request)
    {
        return $this->created($this->projects->create($this->validated($request, true), $request->user()?->id), 'Proyecto creado');
    }

    /** PUT /messaging/marketing/projects/{id} */
    public function update(Request $request, int $id)
    {
        return $this->success($this->projects->update($id, $this->validated($request, false), $request->user()?->id));
    }

    /** POST /messaging/marketing/projects/{id}/duplicate */
    public function duplicate(Request $request, int $id)
    {
        return $this->created($this->projects->duplicate($id, $request->user()?->id), 'Proyecto duplicado');
    }

    /** DELETE /messaging/marketing/projects/{id} */
    public function destroy(int $id)
    {
        $this->projects->delete($id);

        return $this->success(null, 'Proyecto eliminado');
    }

    /** POST /messaging/marketing/projects/assets (multipart: image, una imagen o un audio) */
    public function asset(Request $request)
    {
        $request->validate(['image' => 'required|file|max:15360']);

        return $this->created($this->projects->storeAsset($request->file('image')));
    }

    private function validated(Request $request, bool $creating): array
    {
        $req = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$creating ? 'required' : 'sometimes', 'nullable', 'string', 'max:120'],
            'format' => [$req, Rule::in(MarketingProjectService::FORMATS)],
            'source' => ['sometimes', 'nullable', Rule::in(MarketingCreativeService::SOURCES)],
            'template' => ['sometimes', 'nullable', 'string', 'max:30'],
            'data' => [$req, 'array'],
            'thumb' => ['sometimes', 'nullable', 'string', 'max:900000'],
        ]);
    }
}
