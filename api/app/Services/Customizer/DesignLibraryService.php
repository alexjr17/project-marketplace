<?php

namespace App\Services\Customizer;

use App\Exceptions\BusinessRuleException;
use App\Models\DesignFamily;
use App\Models\DesignImage;
use Illuminate\Support\Str;

/**
 * Galería de diseños del personalizador: diseños con texto editable (ej. el nombre en un diseño
 * navideño) y familias de diseños que van juntos (Papá, Mamá, Hijo…) para el pack familiar.
 *
 * Un texto editable (textFields[]) dice dónde va el texto sobre la imagen (caja en % de la imagen),
 * qué dice por defecto, cuántas letras admite y con qué letra se dibuja (fuente, color, forma,
 * contorno). Es para estampar en DTF: sin sombras.
 */
class DesignLibraryService
{
    public const MAX_FIELDS = 6;

    /** El diseño por capas (con los SVG adentro) no pasa de esto. */
    private const MAX_EDITOR_BYTES = 2_000_000;

    private const SHAPES = ['recto', 'arco', 'puente', 'circulo', 'onda'];

    /** Deja los textos editables en su forma (números en rango, solo lo que se conoce). */
    public function normalizeTextFields(?array $fields): ?array
    {
        if (! $fields) {
            return null;
        }
        if (count($fields) > self::MAX_FIELDS) {
            throw new BusinessRuleException('Un diseño admite hasta '.self::MAX_FIELDS.' textos editables', 422);
        }
        $num = fn ($v, float $min, float $max, float $def) => is_numeric($v) ? max($min, min($max, (float) $v)) : $def;
        $hex = fn ($v, string $def) => is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v) ? strtoupper($v) : $def;
        $out = [];
        $keys = [];
        foreach (array_values($fields) as $i => $f) {
            if (! is_array($f)) {
                continue;
            }
            $label = trim(mb_substr((string) ($f['label'] ?? ''), 0, 40)) ?: 'Nombre';
            $key = Str::slug((string) ($f['key'] ?? '')) ?: Str::slug($label) ?: 'texto';
            while (in_array($key, $keys, true)) {
                $key .= '-'.($i + 1);
            }
            $keys[] = $key;
            $max = (int) $num($f['maxLength'] ?? 14, 1, 40, 14);
            $box = (array) ($f['box'] ?? []);
            $x = $num($box['x'] ?? 10, 0, 100, 10);
            $y = $num($box['y'] ?? 70, 0, 100, 70);
            $s = (array) ($f['style'] ?? []);
            $outline = is_array($s['outline'] ?? null)
                ? ['color' => $hex($s['outline']['color'] ?? null, '#FFFFFF'), 'width' => $num($s['outline']['width'] ?? 6, 0, 20, 6)]
                : null;
            $out[] = [
                'key' => $key,
                'label' => $label,
                'default' => mb_substr(trim((string) ($f['default'] ?? '')), 0, $max) ?: $label,
                'maxLength' => $max,
                'box' => [
                    'x' => round($x, 2), 'y' => round($y, 2),
                    'w' => round($num($box['w'] ?? 80, 2, 100 - $x, 80), 2),
                    'h' => round($num($box['h'] ?? 20, 2, 100 - $y, 20), 2),
                ],
                'style' => [
                    'font' => mb_substr((string) ($s['font'] ?? 'Anton'), 0, 60) ?: 'Anton',
                    'weight' => (int) $num($s['weight'] ?? 400, 100, 900, 400),
                    'italic' => (bool) ($s['italic'] ?? false),
                    'color' => $hex($s['color'] ?? null, '#111111'),
                    'upper' => (bool) ($s['upper'] ?? false),
                    'spacing' => $num($s['spacing'] ?? 2, -10, 60, 2),
                    'shape' => in_array($s['shape'] ?? null, self::SHAPES, true) ? $s['shape'] : 'recto',
                    'curve' => $num($s['curve'] ?? 40, 0, 100, 40),
                    'outline' => $outline && $outline['width'] > 0 ? $outline : null,
                ],
            ];
        }

        return $out ?: null;
    }

    /** El diseño a guardar (alta o cambio): los campos nuevos ya revisados. */
    public function designFields(array $data): array
    {
        if (array_key_exists('textFields', $data)) {
            $data['textFields'] = $this->normalizeTextFields($data['textFields']);
        }
        if (array_key_exists('season', $data)) {
            $data['season'] = $data['season'] ? Str::slug($data['season']) : null;
        }
        if (array_key_exists('editorData', $data)) {
            $data['editorData'] = $this->editorData($data['editorData']);
        }
        if (! empty($data['printUrl'])) {
            $data['printUrl'] = $this->uploadPath($data['printUrl']);
        }
        if (array_key_exists('familyId', $data) && ! $data['familyId']) {
            $data['familyId'] = null;
            $data['familyRole'] = null;
        }
        if (array_key_exists('familyRole', $data)) {
            $data['familyRole'] = $data['familyRole'] ? trim(mb_substr($data['familyRole'], 0, 40)) : null;
        }

        return $data;
    }

    /**
     * Las capas del editor: dentro de su tamaño y con los SVG limpios (sin scripts, eventos ni enlaces
     * javascript:), por si alguien manda uno armado a mano.
     */
    private function editorData(?array $d): ?array
    {
        if (! $d) {
            return null;
        }
        foreach (($d['layers'] ?? []) as $i => $l) {
            if (is_array($l) && ($l['kind'] ?? null) === 'svg') {
                $d['layers'][$i]['svg'] = $this->cleanSvg((string) ($l['svg'] ?? ''));
            }
            if (is_array($l) && ($l['kind'] ?? null) === 'image' && isset($l['src']) && str_starts_with((string) $l['src'], 'data:')) {
                throw new BusinessRuleException('Las imágenes del diseño se suben aparte', 422);
            }
        }
        if (strlen((string) json_encode($d)) > self::MAX_EDITOR_BYTES) {
            throw new BusinessRuleException('El diseño es demasiado grande (los SVG pesan mucho): simplifícalo', 422);
        }

        return $d;
    }

    public function cleanSvg(string $svg): string
    {
        $svg = preg_replace('#<script\b[^>]*>.*?</script\s*>#is', '', $svg) ?? '';
        $svg = preg_replace('#<script\b[^>]*/>#is', '', $svg) ?? '';
        $svg = preg_replace('#<foreignObject\b.*?</foreignObject\s*>#is', '', $svg) ?? '';
        $svg = preg_replace('#\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)#i', '', $svg) ?? '';

        return preg_replace('#(href|xlink:href)\s*=\s*(["\'])\s*javascript:[^"\']*\2#i', '$1="#"', $svg) ?? '';
    }

    /** "/uploads/…" (la API a veces recibe la dirección completa del mismo servidor). */
    private function uploadPath(string $url): string
    {
        $i = strpos($url, '/uploads/');

        return $i !== false ? substr($url, $i) : $url;
    }

    // ─── Familias ───────────────────────────────────────────────────────────

    public function families(bool $onlyActive, ?string $season = null): array
    {
        return DesignFamily::with(['designs' => fn ($q) => $onlyActive ? $q->where('isActive', true) : $q])
            ->when($onlyActive, fn ($q) => $q->where('isActive', true))
            ->when($season, fn ($q) => $q->where('season', $season))
            ->orderBy('sortOrder')->orderBy('id')->get()
            // Una familia sin diseños activos no sirve en la tienda.
            ->filter(fn ($f) => ! $onlyActive || $f->designs->isNotEmpty())
            ->map(fn ($f) => $this->formatFamily($f))->values()->all();
    }

    public function family(int $id, bool $onlyActive): array
    {
        $f = DesignFamily::with(['designs' => fn ($q) => $onlyActive ? $q->where('isActive', true) : $q])->find($id);
        if (! $f || ($onlyActive && ! $f->isActive)) {
            throw new BusinessRuleException('Familia no encontrada', 404);
        }

        return $this->formatFamily($f);
    }

    public function saveFamily(?int $id, array $data): array
    {
        $f = $id ? DesignFamily::find($id) : new DesignFamily(['isActive' => true]);
        if (! $f) {
            throw new BusinessRuleException('Familia no encontrada', 404);
        }
        if (array_key_exists('season', $data)) {
            $data['season'] = $data['season'] ? Str::slug($data['season']) : null;
        }
        $f->fill(array_intersect_key($data, array_flip(['name', 'description', 'season', 'sortOrder', 'isActive'])));
        $f->save();
        // Diseños de la familia, en orden, con su rol (los que salen quedan sueltos).
        if (array_key_exists('designs', $data)) {
            $ids = array_column($data['designs'], 'id');
            DesignImage::where('familyId', $f->id)->whereNotIn('id', $ids)->update(['familyId' => null, 'familyRole' => null]);
            foreach ($data['designs'] as $i => $d) {
                DesignImage::where('id', $d['id'])->update([
                    'familyId' => $f->id,
                    'familyRole' => isset($d['role']) && trim($d['role']) !== '' ? trim(mb_substr($d['role'], 0, 40)) : null,
                    'sortOrder' => $i,
                ]);
            }
        }

        return $this->family($f->id, false);
    }

    public function deleteFamily(int $id): void
    {
        $f = DesignFamily::find($id) ?? throw new BusinessRuleException('Familia no encontrada', 404);
        // Los diseños se quedan en la galería, sin familia.
        DesignImage::where('familyId', $f->id)->update(['familyId' => null, 'familyRole' => null]);
        $f->delete();
    }

    private function formatFamily(DesignFamily $f): array
    {
        return [
            'id' => $f->id,
            'name' => $f->name,
            'description' => $f->description,
            'season' => $f->season,
            'sortOrder' => $f->sortOrder,
            'isActive' => $f->isActive,
            'designs' => $f->designs->values()->all(),
        ];
    }
}
