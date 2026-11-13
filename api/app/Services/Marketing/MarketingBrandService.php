<?php

namespace App\Services\Marketing;

use App\Models\Setting;
use App\Services\Settings\ImageUploadService;

/**
 * Ficha de la marca para el estudio de contenido (setting brand_kit): logos, colores, tipografía,
 * lema y voz. Las piezas se arman con ella y la IA escribe con su voz. Por defecto es la ficha de
 * TOCLEX (Brand Reference Board), con los datos de la tienda donde existan.
 */
class MarketingBrandService
{
    private const KEY = 'brand_kit';

    public const FONTS = ['Inter', 'Poppins', 'Montserrat', 'Manrope', 'Space Grotesk', 'Archivo', 'Oswald', 'Bebas Neue', 'Playfair Display', 'DM Serif Display'];

    public function __construct(private ImageUploadService $uploads) {}

    public function defaults(): array
    {
        $general = (array) (Setting::where('key', 'general_settings')->value('value') ?? []);

        return [
            'name' => $general['siteName'] ?? 'TOCLEX',
            'slogan' => $general['slogan'] ?? 'Made with intention',
            'description' => $general['siteDescription'] ?? 'Ropa con temáticas que te representan y prendas personalizadas.',
            'logos' => [
                'wordmark' => '/brand/toclex-wordmark.png',
                'wordmarkLight' => '/brand/toclex-wordmark-light.png',
                'icon' => '/brand/toclex-icon.png',
                'iconLight' => '/brand/toclex-icon-light.png',
            ],
            'colors' => [
                ['key' => 'primary', 'name' => 'Charcoal Black', 'hex' => '#1F1D1E'],
                ['key' => 'paper', 'name' => 'Off-White', 'hex' => '#F3F3EE'],
                ['key' => 'secondary', 'name' => 'Graphite Gray', 'hex' => '#747474'],
                ['key' => 'accent', 'name' => 'Elegant Lime', 'hex' => '#ABD04C'],
            ],
            'fonts' => ['heading' => 'Inter', 'body' => 'Inter', 'headingUppercase' => true],
            'voice' => [
                'tone' => 'cercano',
                'personality' => 'Minimalista, urbana y con intención: prendas que representan a quien las usa. Directa y sin exagerar.',
                'avoid' => 'Promesas exageradas, demasiados emojis, mayúsculas sostenidas en el texto del post.',
                'hashtags' => ['toclex', 'madewithintention'],
            ],
        ];
    }

    public function get(): array
    {
        $saved = (array) (Setting::where('key', self::KEY)->value('value') ?? []);
        $d = $this->defaults();

        return [
            'name' => $saved['name'] ?? $d['name'],
            'slogan' => $saved['slogan'] ?? $d['slogan'],
            'description' => $saved['description'] ?? $d['description'],
            'logos' => array_merge($d['logos'], (array) ($saved['logos'] ?? [])),
            'colors' => ! empty($saved['colors']) ? $saved['colors'] : $d['colors'],
            'fonts' => array_merge($d['fonts'], (array) ($saved['fonts'] ?? [])),
            'voice' => array_merge($d['voice'], (array) ($saved['voice'] ?? [])),
            'fontOptions' => self::FONTS,
        ];
    }

    /** Guarda la ficha. Los logos nuevos llegan en base64 y se guardan en uploads/marketing. */
    public function save(array $data): array
    {
        $current = $this->get();
        $logos = $current['logos'];
        foreach (['wordmark', 'wordmarkLight', 'icon', 'iconLight'] as $k) {
            $v = $data['logos'][$k] ?? null;
            if (is_string($v) && str_starts_with($v, 'data:')) {
                $saved = $this->uploads->store($this->uploads->decodeBase64($v), 'marketing', 'logo-'.$k);
                $logos[$k] = $saved['url'];
            } elseif (is_string($v) && $v !== '') {
                $logos[$k] = $v;
            }
        }
        $colors = array_values(array_filter(array_map(fn ($c) => [
            'key' => (string) ($c['key'] ?? ''),
            'name' => mb_substr(trim((string) ($c['name'] ?? '')), 0, 40),
            'hex' => strtoupper((string) ($c['hex'] ?? '')),
        ], (array) ($data['colors'] ?? $current['colors'])), fn ($c) => preg_match('/^#[0-9A-F]{6}$/', $c['hex'])));
        $fonts = $data['fonts'] ?? $current['fonts'];
        $voice = $data['voice'] ?? $current['voice'];

        $value = [
            'name' => mb_substr(trim((string) ($data['name'] ?? $current['name'])), 0, 60),
            'slogan' => mb_substr(trim((string) ($data['slogan'] ?? $current['slogan'])), 0, 80),
            'description' => mb_substr(trim((string) ($data['description'] ?? $current['description'])), 0, 300),
            'logos' => $logos,
            'colors' => $colors ?: $current['colors'],
            'fonts' => [
                'heading' => in_array($fonts['heading'] ?? '', self::FONTS, true) ? $fonts['heading'] : 'Inter',
                'body' => in_array($fonts['body'] ?? '', self::FONTS, true) ? $fonts['body'] : 'Inter',
                'headingUppercase' => (bool) ($fonts['headingUppercase'] ?? true),
            ],
            'voice' => [
                'tone' => in_array($voice['tone'] ?? '', MarketingCopyService::TONES, true) ? $voice['tone'] : 'cercano',
                'personality' => mb_substr(trim((string) ($voice['personality'] ?? '')), 0, 400),
                'avoid' => mb_substr(trim((string) ($voice['avoid'] ?? '')), 0, 300),
                'hashtags' => array_values(array_slice(array_filter(array_map(
                    fn ($t) => preg_replace('/[^\p{L}\p{N}_]/u', '', ltrim((string) $t, '#')),
                    (array) ($voice['hashtags'] ?? [])
                )), 0, 10)),
            ],
        ];
        Setting::updateOrCreate(['key' => self::KEY], ['value' => $value]);

        return $this->get();
    }
}
