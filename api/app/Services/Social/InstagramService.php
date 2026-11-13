<?php

namespace App\Services\Social;

use App\Models\Channel;
use App\Models\SocialPost;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Publica en Instagram con la cuenta profesional enlazada a la Página de Facebook (mismo token de
 * página; requiere el permiso instagram_content_publish). Foto, carrusel, reel (video) e historia.
 *
 * Flujo de Meta: se crea un contenedor de medios con la URL pública y luego se publica. Los videos se
 * procesan unos segundos: se espera a que el contenedor quede listo antes de publicarlo.
 */
class InstagramService
{
    private const GRAPH = 'https://graph.facebook.com/v19.0';

    public function __construct(private FacebookPageService $facebook) {}

    public function publish(SocialPost $post): SocialPost
    {
        $channel = $post->channel ?: Channel::where('type', 'messenger')->first();
        $config = (array) ($channel?->config ?? []);
        $pageId = (string) ($config['pageId'] ?? '');
        $token = (string) ($config['pageAccessToken'] ?? '');
        if (! $pageId || ! $token) {
            return $this->fail($post, 'Falta Page ID o Page Access Token en el canal de Facebook');
        }

        $urls = is_array($post->mediaUrls) && $post->mediaUrls ? $post->mediaUrls : array_filter([$post->mediaUrl]);
        $urls = array_values(array_filter(array_map(fn ($u) => $this->facebook->publicizeUrl((string) $u), $urls)));
        if (! $urls) {
            return $this->fail($post, 'Instagram necesita al menos una imagen o un video');
        }
        foreach ($urls as $u) {
            if (! str_starts_with($u, 'https://')) {
                return $this->fail($post, 'Instagram necesita URLs públicas (https): configura NGROK_DOMAIN o el dominio de la tienda');
            }
        }

        try {
            $igId = $this->accountId($pageId, $token);
            $caption = (string) ($post->content ?? '');
            $creation = match (true) {
                $post->type === 'story' => $this->container($igId, $token, ['media_type' => 'STORIES'] + $this->mediaField($urls[0])),
                $post->type === 'video' => $this->container($igId, $token, ['media_type' => 'REELS', 'video_url' => $urls[0], 'caption' => $caption]),
                count($urls) >= 2 => $this->carousel($igId, $token, $urls, $caption),
                default => $this->container($igId, $token, ['image_url' => $urls[0], 'caption' => $caption]),
            };
            $this->waitReady($creation, $token);
            $published = Http::timeout(60)->withQueryParameters(['access_token' => $token])
                ->post(self::GRAPH."/{$igId}/media_publish", ['creation_id' => $creation]);
            $this->ensure($published);
            $mediaId = $published->json('id');

            $post->externalId = $mediaId;
            $post->externalUrl = $this->permalink($mediaId, $token);
            $post->status = 'published';
            $post->publishedAt = now();
            $post->error = null;
            $post->save();
        } catch (Throwable $e) {
            return $this->fail($post, $e->getMessage());
        }

        return $post;
    }

    /** Cuenta de Instagram profesional enlazada a la Página. */
    private function accountId(string $pageId, string $token): string
    {
        $r = Http::timeout(15)->withQueryParameters(['access_token' => $token, 'fields' => 'instagram_business_account'])
            ->get(self::GRAPH."/{$pageId}");
        $this->ensure($r);
        $id = (string) ($r->json('instagram_business_account.id') ?? '');
        if ($id === '') {
            throw new RuntimeException('La Página de Facebook no tiene una cuenta de Instagram profesional enlazada');
        }

        return $id;
    }

    private function mediaField(string $url): array
    {
        return $this->facebook->isVideo($url) ? ['video_url' => $url] : ['image_url' => $url];
    }

    private function container(string $igId, string $token, array $fields): string
    {
        $r = Http::timeout(60)->withQueryParameters(['access_token' => $token])->post(self::GRAPH."/{$igId}/media", $fields);
        $this->ensure($r);

        return (string) $r->json('id');
    }

    private function carousel(string $igId, string $token, array $urls, string $caption): string
    {
        $children = [];
        foreach (array_slice($urls, 0, 10) as $u) {
            $children[] = $this->container($igId, $token, ['is_carousel_item' => 'true'] + $this->mediaField($u));
        }
        foreach ($children as $c) {
            $this->waitReady($c, $token);
        }

        return $this->container($igId, $token, ['media_type' => 'CAROUSEL', 'children' => implode(',', $children), 'caption' => $caption]);
    }

    /** Espera a que Meta termine de procesar el contenedor (videos). Hasta ~2 minutos. */
    private function waitReady(string $containerId, string $token): void
    {
        for ($i = 0; $i < 40; $i++) {
            $r = Http::timeout(15)->withQueryParameters(['access_token' => $token, 'fields' => 'status_code,status'])
                ->get(self::GRAPH."/{$containerId}");
            $code = (string) ($r->json('status_code') ?? 'FINISHED');
            if ($code === 'FINISHED' || $code === 'PUBLISHED') {
                return;
            }
            if ($code === 'ERROR' || $code === 'EXPIRED') {
                throw new RuntimeException('Instagram no pudo procesar el archivo: '.($r->json('status') ?? $code));
            }
            sleep(3);
        }
        throw new RuntimeException('Instagram tardó demasiado procesando el video');
    }

    private function permalink(?string $mediaId, string $token): ?string
    {
        if (! $mediaId) {
            return null;
        }
        try {
            $r = Http::timeout(10)->withQueryParameters(['access_token' => $token, 'fields' => 'permalink'])->get(self::GRAPH."/{$mediaId}");

            return $r->successful() ? $r->json('permalink') : null;
        } catch (Throwable) {
            return null;
        }
    }

    private function ensure(\Illuminate\Http\Client\Response $r): void
    {
        if (! $r->successful()) {
            throw new RuntimeException('Instagram rechazó la publicación: '.($r->json('error.message') ?? mb_substr($r->body(), 0, 300)));
        }
    }

    private function fail(SocialPost $post, string $reason): SocialPost
    {
        $post->status = 'failed';
        $post->error = $reason;
        $post->save();
        Log::error('[Instagram] Publicación fallida', ['post' => $post->id, 'reason' => $reason]);

        return $post;
    }
}
