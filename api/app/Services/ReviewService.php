<?php

namespace App\Services;

use App\Models\Review;
use App\Support\ImageUrls;

/**
 * Reseñas para mostrar en la tienda pública.
 */
class ReviewService
{
    public const FEATURED_MAX = 12;

    /**
     * Últimas reseñas aprobadas con 4 o 5 estrellas y comentario, de productos visibles en la
     * tienda (activos y que no son plantillas). Del cliente solo se expone el nombre de pila y
     * la inicial del apellido; nunca el email ni el id.
     *
     * @return array<int, array{id:int, rating:int, title:?string, comment:string, verifiedPurchase:bool, createdAt:mixed, customerName:string, product:array{id:int, name:string, image:?string}}>
     */
    public function featured(int $limit = 6): array
    {
        $limit = max(1, min(self::FEATURED_MAX, $limit));

        return Review::with(['user:id,name', 'product:id,name,images,updatedAt,isActive,isTemplate'])
            ->where('status', 'APPROVED')
            ->where('rating', '>=', 4)
            ->whereNotNull('comment')
            ->whereRaw("TRIM(comment) <> ''")
            ->whereHas('product', fn ($q) => $q->where('isActive', true)->where('isTemplate', false))
            ->orderByDesc('createdAt')
            ->orderByDesc('id')
            ->take($limit)
            ->get()
            ->map(fn (Review $r) => [
                'id' => $r->id,
                'rating' => (int) $r->rating,
                'title' => $r->title,
                'comment' => trim((string) $r->comment),
                'verifiedPurchase' => (bool) $r->verifiedPurchase,
                'createdAt' => $r->createdAt,
                'customerName' => $this->publicName($r->user?->name),
                'product' => [
                    'id' => $r->product->id,
                    'name' => $r->product->name,
                    'image' => ImageUrls::forModel($r->product->images, 'product', $r->product->id, $r->product->updatedAt)['front'] ?: null,
                ],
            ])
            ->values()
            ->all();
    }

    /** "María Gómez" → "María G."; "Ana María Gómez Ruiz" → "Ana G."; "Carlos" → "Carlos"; vacío → "Cliente". */
    public function publicName(?string $fullName): string
    {
        $parts = preg_split('/\s+/u', trim((string) $fullName), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if ($parts === []) {
            return 'Cliente';
        }
        // Si el "nombre" parece un correo, no se muestra.
        if (str_contains(implode(' ', $parts), '@')) {
            return 'Cliente';
        }
        $first = mb_convert_case(mb_strtolower($parts[0]), MB_CASE_TITLE);
        if (count($parts) === 1) {
            return $first;
        }

        // Con dos nombres y dos apellidos ("Ana María Gómez Ruiz") el apellido es el tercero.
        $surname = count($parts) >= 4 ? $parts[2] : end($parts);

        return $first.' '.mb_strtoupper(mb_substr($surname, 0, 1)).'.';
    }
}
