<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\SocialPost;
use App\Services\Social\SocialPostService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Publicaciones en redes (Fase A: página de Facebook). Valida y responde; borradores,
 * publicación y borrado en Meta los hace SocialPostService.
 */
class SocialPostController extends Controller
{
    use ApiResponse;

    public function __construct(private SocialPostService $posts) {}

    public function index(Request $request)
    {
        $paginator = $this->posts->paginate(
            $request->filled('status') ? (string) $request->query('status') : null,
            $request->filled('platform') ? (string) $request->query('platform') : null,
            (int) $request->query('perPage', 20),
        );

        return response()->json([
            'success' => true,
            'data' => collect($paginator->items())->map(fn ($p) => $this->posts->format($p))->all(),
            'pagination' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'totalPages' => $paginator->lastPage(),
            ],
        ]);
    }

    public function show(int $id)
    {
        $post = SocialPost::with('channel', 'createdBy')->find($id);
        if (! $post) {
            return $this->error('Publicación no encontrada', 404);
        }

        return $this->success($this->posts->format($post));
    }

    /** Crea borrador (sin publicar). */
    public function store(Request $request)
    {
        $post = $this->posts->createDraft($this->validatePostPayload($request), $request->user()->id);

        return $this->created($this->posts->format($post), 'Borrador creado');
    }

    /** Crea + publica en un solo paso. */
    public function publishNow(Request $request)
    {
        $post = $this->posts->publishNow($this->validatePostPayload($request), $request->user()->id);

        return $this->created($this->posts->format($post), 'Publicado en Facebook');
    }

    /** Publica un borrador existente. */
    public function publishExisting(int $id)
    {
        $post = SocialPost::with('channel')->find($id);
        if (! $post) {
            return $this->error('Publicación no encontrada', 404);
        }

        return $this->success($this->posts->format($this->posts->publishExisting($post)), 'Publicado');
    }

    /** Elimina en Meta y en local. */
    public function destroy(int $id)
    {
        $post = SocialPost::with('channel')->find($id);
        if (! $post) {
            return $this->error('Publicación no encontrada', 404);
        }
        $this->posts->delete($post);

        return $this->success(null, 'Publicación eliminada');
    }

    /**
     * Valida y normaliza el contenido: mediaUrl y mediaUrls quedan en una sola lista
     * (mediaUrls tiene precedencia).
     *
     * @return array{platform: string, content: ?string, mediaUrl: ?string, mediaUrls: array<int,string>}
     */
    private function validatePostPayload(Request $request): array
    {
        $data = $request->validate([
            'platform' => ['required', Rule::in(['facebook'])],
            'content' => 'nullable|string|max:10000',
            // 2000 chars: cubre URLs largas con transformaciones, pero rechaza data:base64
            // (que Meta no acepta de todas formas).
            'mediaUrl' => 'nullable|string|max:2000',
            'mediaUrls' => 'nullable|array|max:10',
            'mediaUrls.*' => 'string|max:2000',
        ]);

        $urls = $data['mediaUrls'] ?? [];
        if (empty($urls) && ! empty($data['mediaUrl'])) {
            $urls = [$data['mediaUrl']];
        }
        $urls = array_values(array_filter(array_map('trim', $urls), fn ($u) => $u !== ''));

        return [
            'platform' => $data['platform'],
            'content' => $data['content'] ?? null,
            'mediaUrl' => $urls[0] ?? null,
            'mediaUrls' => $urls,
        ];
    }
}
