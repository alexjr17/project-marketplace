<?php

namespace App\Services\Social;

use App\Models\Channel;
use App\Models\SocialPost;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Publica posts en la Página de Facebook usando la Graph API.
 * Lee credenciales del canal `messenger` (mismo Page Access Token).
 */
class FacebookPageService
{
    private const GRAPH_VERSION = 'v19.0';

    /** Publica un post (texto, foto única o carrusel multi-foto) en la Página. */
    public function publish(SocialPost $post): SocialPost
    {
        $channel = $post->channel ?: Channel::where('type', 'messenger')->first();
        if (! $channel) {
            return $this->markFailed($post, 'No hay canal Messenger/FB configurado');
        }

        $config = (array) $channel->config;
        $pageId = (string) ($config['pageId'] ?? '');
        $token = (string) ($config['pageAccessToken'] ?? '');

        if (! $pageId || ! $token) {
            return $this->markFailed($post, 'Falta Page ID o Page Access Token en el canal');
        }

        // Lista de URLs a publicar: prioriza mediaUrls (array), cae a mediaUrl (string única).
        $rawUrls = is_array($post->mediaUrls) ? $post->mediaUrls : [];
        if (empty($rawUrls) && $post->mediaUrl) {
            $rawUrls = [$post->mediaUrl];
        }

        // Convertir URLs locales/relativas en URLs HTTPS públicas (Meta debe poder descargarlas).
        $urls = array_values(array_filter(array_map(
            fn ($u) => $this->publicizeUrl((string) $u),
            $rawUrls
        )));

        try {
            $external = match (true) {
                count($urls) >= 2 => $this->publishCarousel($pageId, $token, $post->content ?? '', $urls),
                count($urls) === 1 => $this->publishPhoto($pageId, $token, $post->content ?? '', $urls[0]),
                default => $this->publishText($pageId, $token, $post->content ?? ''),
            };

            $post->externalId = $external['id'] ?? null;
            $post->externalUrl = $external['url'] ?? null;
            $post->status = 'published';
            $post->publishedAt = now();
            $post->error = null;
            $post->save();
        } catch (Throwable $e) {
            return $this->markFailed($post, $e->getMessage());
        }

        return $post;
    }

    /**
     * Reescribe URLs locales o de localhost a la URL pública (ngrok / Render)
     * para que Meta pueda descargarlas. Si ya es HTTPS pública, no toca.
     */
    private function publicizeUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }

        $publicBase = $this->publicBaseUrl();

        // Ruta relativa "/uploads/..."
        if (str_starts_with($url, '/')) {
            return $publicBase ? rtrim($publicBase, '/').$url : $url;
        }

        $parsed = parse_url($url);
        $host = strtolower($parsed['host'] ?? '');
        $localHosts = ['localhost', '127.0.0.1', '0.0.0.0', 'api', 'vexa-api'];

        if ($host && in_array($host, $localHosts, true)) {
            if (! $publicBase) {
                return $url;
            }
            $path = $parsed['path'] ?? '';
            $query = isset($parsed['query']) ? '?'.$parsed['query'] : '';

            return rtrim($publicBase, '/').$path.$query;
        }

        // URL externa (Cloudinary, S3, etc.): tal cual.
        return $url;
    }

    private function publicBaseUrl(): string
    {
        $domain = (string) env('NGROK_DOMAIN', '');
        if ($domain) {
            return 'https://'.ltrim($domain, '/');
        }

        // Fallback: APP_URL si está configurada con un dominio público.
        $appUrl = (string) env('APP_URL', '');
        if ($appUrl && ! str_contains($appUrl, 'localhost')) {
            return rtrim($appUrl, '/');
        }

        return '';
    }

    /** Borra el post en Facebook (deja la fila local como referencia). */
    public function delete(SocialPost $post): bool
    {
        if (! $post->externalId) {
            return false;
        }
        $channel = $post->channel ?: Channel::where('type', 'messenger')->first();
        $token = (string) ($channel?->config['pageAccessToken'] ?? '');
        if (! $token) {
            throw new RuntimeException('Falta Page Access Token');
        }

        $response = Http::timeout(10)
            ->withQueryParameters(['access_token' => $token])
            ->delete('https://graph.facebook.com/'.self::GRAPH_VERSION.'/'.$post->externalId);

        if (! $response->successful()) {
            $error = $response->json('error.message') ?? $response->body();
            throw new RuntimeException("Meta rechazó el borrado: {$error}");
        }

        return true;
    }

    // ============================== INTERNOS ==============================

    private function publishText(string $pageId, string $token, string $message): array
    {
        $response = Http::timeout(15)
            ->withQueryParameters(['access_token' => $token])
            ->post("https://graph.facebook.com/".self::GRAPH_VERSION."/{$pageId}/feed", [
                'message' => $message,
            ]);

        $this->ensureSuccess($response);
        $id = $response->json('id');

        return [
            'id' => $id,
            'url' => $this->fetchPermalink($id, $token),
        ];
    }

    private function publishPhoto(string $pageId, string $token, string $caption, string $imageUrl): array
    {
        $response = Http::timeout(20)
            ->withQueryParameters(['access_token' => $token])
            ->post("https://graph.facebook.com/".self::GRAPH_VERSION."/{$pageId}/photos", [
                'url' => $imageUrl,
                'caption' => $caption,
            ]);

        $this->ensureSuccess($response);
        $postId = $response->json('post_id') ?? $response->json('id');

        return [
            'id' => $postId,
            'url' => $this->fetchPermalink($postId, $token),
        ];
    }

    /**
     * Publica un carrusel (varias fotos en un solo post) en el feed de la Página.
     * Flujo Meta:
     *   1) Sube cada foto con `published=false` → recibe el id de cada foto.
     *   2) Crea un post del feed con `attached_media=[{media_fbid:id}, ...]`.
     */
    private function publishCarousel(string $pageId, string $token, string $caption, array $imageUrls): array
    {
        $mediaIds = [];

        foreach ($imageUrls as $url) {
            // NO usar `temporary=true` aquí: las fotos efímeras no se pueden
            // adjuntar después a un feed post (FB las rechaza con "Missing or
            // invalid image file"). `published=false` deja la foto "no publicada
            // de forma independiente" pero asociable al feed.
            $resp = Http::timeout(20)
                ->withQueryParameters(['access_token' => $token])
                ->post('https://graph.facebook.com/'.self::GRAPH_VERSION."/{$pageId}/photos", [
                    'url' => $url,
                    'published' => false,
                ]);
            $this->ensureSuccess($resp);
            $id = $resp->json('id');
            if (! $id) {
                throw new RuntimeException('Meta no devolvió ID para una de las fotos del carrusel');
            }
            $mediaIds[] = $id;
        }

        $attached = array_map(fn ($id) => ['media_fbid' => $id], $mediaIds);

        $feedResp = Http::timeout(20)
            ->withQueryParameters(['access_token' => $token])
            ->post('https://graph.facebook.com/'.self::GRAPH_VERSION."/{$pageId}/feed", [
                'message' => $caption,
                'attached_media' => json_encode($attached),
            ]);
        $this->ensureSuccess($feedResp);
        $postId = $feedResp->json('id');

        return [
            'id' => $postId,
            'url' => $this->fetchPermalink($postId, $token),
        ];
    }

    private function fetchPermalink(?string $postId, string $token): ?string
    {
        if (! $postId) {
            return null;
        }
        try {
            $response = Http::timeout(5)
                ->withQueryParameters(['access_token' => $token, 'fields' => 'permalink_url'])
                ->get("https://graph.facebook.com/".self::GRAPH_VERSION."/{$postId}");

            return $response->successful() ? $response->json('permalink_url') : null;
        } catch (Throwable $e) {
            Log::warning('[FacebookPage] No se pudo leer permalink: '.$e->getMessage());

            return null;
        }
    }

    private function ensureSuccess(\Illuminate\Http\Client\Response $response): void
    {
        if ($response->successful()) {
            return;
        }
        $error = $response->json('error.message') ?? $response->body();
        throw new RuntimeException("Meta rechazó la publicación: {$error}");
    }

    private function markFailed(SocialPost $post, string $reason): SocialPost
    {
        $post->status = 'failed';
        $post->error = $reason;
        $post->save();
        Log::error('[FacebookPage] Publicación fallida', ['post' => $post->id, 'reason' => $reason]);

        return $post;
    }
}
