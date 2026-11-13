<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Customizer\MannequinEditService;
use App\Services\Customizer\MannequinModelService;
use Illuminate\Http\Request;

/** Admin → Modelos 3D: maniquíes generados con IA (reglas en MannequinModelService). */
class MannequinModelController extends Controller
{
    use ApiResponse;

    public function __construct(private MannequinModelService $models, private MannequinEditService $edits) {}

    /** GET /api/mannequin-models/public: publicados, para la tienda y el editor. */
    public function publicList()
    {
        return $this->success($this->models->publicList());
    }

    /** GET /api/mannequin-models */
    public function index()
    {
        return $this->success($this->models->list());
    }

    /** GET /api/mannequin-models/{id} */
    public function show(int $id)
    {
        return $this->success($this->models->format($this->models->find($id)));
    }

    /** GET /api/mannequin-models/accounts?fresh=1: cuota de GPU de cada cuenta de Hugging Face. */
    public function accounts(Request $request)
    {
        return $this->success($this->models->accounts($request->boolean('fresh')));
    }

    /** POST /api/mannequin-models: crea el borrador y manda el primer mensaje al chat. */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:80',
            'kind' => 'nullable|in:maniqui,cabeza,piernas,objeto',
            'prompt' => 'nullable|string|max:1000',
            'image' => 'nullable|string',
        ]);

        return $this->created($this->edits->createModel($data, $request->user()?->id), 'Modelo 3D creado');
    }

    /** PUT /api/mannequin-models/{id}: revisión (nombre, ajustes, foto de carga, publicar). */
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:80',
            'config' => 'sometimes|array',
            'config.*' => 'nullable',
            'config.kind' => 'sometimes|in:maniqui,cabeza,piernas,objeto',
            'config.split' => 'sometimes|in:color,altura',
            'poster' => 'nullable|string',
            'published' => 'sometimes|boolean',
        ]);

        return $this->success($this->models->update($id, $data), 'Modelo 3D guardado');
    }

    /** POST /api/mannequin-models/{id}/retry */
    public function retry(int $id)
    {
        return $this->success($this->models->retry($id), 'Generando de nuevo');
    }

    /** GET /api/mannequin-models/{id}/edits: chat de ajustes del modelo. */
    public function edits(int $id)
    {
        return $this->success($this->edits->list($id));
    }

    /** POST /api/mannequin-models/{id}/edits: nuevo mensaje (texto y/o foto de referencia). */
    public function storeEdit(Request $request, int $id)
    {
        $data = $request->validate([
            'prompt' => 'nullable|string|max:1000',
            'image' => 'nullable|string',
            'fromEditId' => 'nullable|integer',
        ]);

        return $this->created($this->edits->create($id, (string) ($data['prompt'] ?? ''), $data['image'] ?? null, $data['fromEditId'] ?? null, $request->user()?->id), 'Armando la foto');
    }

    /** POST /api/mannequin-models/{id}/edits/{editId}/approve: foto de frente aprobada → arma las otras 3 vistas. */
    public function approveEdit(int $id, int $editId)
    {
        return $this->success($this->edits->approve($id, $editId), 'Armando la espalda y los lados');
    }

    /** POST /api/mannequin-models/{id}/views/{view}: rehace una vista. */
    public function redoView(Request $request, int $id, string $view)
    {
        $data = $request->validate(['prompt' => 'nullable|string|max:1000']);

        return $this->created($this->edits->redoView($id, $view, (string) ($data['prompt'] ?? ''), $request->user()?->id), 'Rehaciendo la vista');
    }

    /** POST /api/mannequin-models/{id}/views/upload: fotos reales como las 4 vistas (sin GPU). */
    public function uploadViews(Request $request, int $id)
    {
        $data = $request->validate([
            'images' => 'required|array',
            'images.front' => 'required|string',
            'images.back' => 'required|string',
            'images.left' => 'required|string',
            'images.right' => 'required|string',
        ]);

        return $this->success($this->edits->uploadViews($id, $data['images'], $request->user()?->id), 'Fotos cargadas como vistas');
    }

    /** POST /api/mannequin-models/{id}/views/generate: el 3D con las 4 vistas. */
    public function generateFromViews(int $id)
    {
        return $this->success($this->edits->generateFromViews($id), 'Generando el modelo 3D con las 4 vistas');
    }

    /** POST /api/mannequin-models/{id}/edits/{editId}/apply: genera el 3D con esa foto. */
    public function applyEdit(int $id, int $editId)
    {
        return $this->success($this->edits->apply($id, $editId), 'Generando el modelo 3D con esa foto');
    }

    /** DELETE /api/mannequin-models/{id} */
    public function destroy(int $id)
    {
        $this->models->delete($id);

        return $this->success(null, 'Modelo 3D eliminado');
    }
}
