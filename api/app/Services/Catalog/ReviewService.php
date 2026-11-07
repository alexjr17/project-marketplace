<?php

namespace App\Services\Catalog;

use App\Exceptions\BusinessRuleException;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\ReviewHelpfulVote;
use App\Models\User;
use App\Support\ImageUrls;
use Illuminate\Support\Facades\DB;

/**
 * Reseñas: las destacadas de la portada, quién puede reseñar (compra verificada, una por
 * producto), edición y borrado del autor, votos, moderación y la calificación del producto,
 * que se recalcula en la misma transacción que cada cambio.
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

    // ==================== Reglas de las reseñas ====================

    /** Estados de pedido que cuentan como compra válida. */
    public const PURCHASED_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

    /**
     * Reseña por id para la tienda. Una pendiente o rechazada solo la ve su autor o quien
     * modera reseñas; para los demás no existe (antes el detalle público devolvía también las
     * rechazadas).
     */
    public function findVisible(int $id, ?User $viewer): Review
    {
        $query = Review::with('user:id,name,avatar');
        if ($viewer) {
            $query->with(['helpfulVotes' => fn ($q) => $q->where('userId', $viewer->id)]);
        }
        $review = $query->find($id);

        $visible = $review && ($review->status === 'APPROVED'
            || ($viewer && ($review->userId === $viewer->id || $this->canModerate($viewer))));
        if (! $visible) {
            throw new BusinessRuleException('Review no encontrada', 404);
        }

        return $review;
    }

    /** Puede reseñar quien compró el producto y aún no lo ha reseñado. */
    public function canReview(int $userId, int $productId): array
    {
        $existing = Review::with('user:id,name,avatar')
            ->where('userId', $userId)->where('productId', $productId)->first();
        if ($existing) {
            return [
                'canReview' => false,
                'reason' => 'Ya has dejado una reseña para este producto',
                'existingReview' => $this->format($existing),
            ];
        }

        $purchased = OrderItem::where('productId', $productId)
            ->whereHas('order', fn ($q) => $q->where('userId', $userId)->whereIn('status', self::PURCHASED_STATUSES))
            ->exists();
        if (! $purchased) {
            return [
                'canReview' => false,
                'reason' => 'Debes comprar este producto para poder dejar una reseña',
            ];
        }

        return ['canReview' => true];
    }

    /** Productos comprados que el usuario aún no ha reseñado (uno por producto). */
    public function awaitingReview(int $userId): array
    {
        $items = OrderItem::whereHas('order', fn ($q) => $q->where('userId', $userId)
            ->whereIn('status', self::PURCHASED_STATUSES))
            ->with('order:id,orderNumber,paidAt,createdAt')
            ->get();

        $reviewedProductIds = Review::where('userId', $userId)->pluck('productId')->all();

        return $items
            ->reject(fn ($item) => in_array($item->productId, $reviewedProductIds, true))
            ->unique('productId')
            ->map(fn ($item) => [
                'productId' => $item->productId,
                'productName' => $item->productName,
                'productImage' => $item->productImage,
                'orderId' => $item->order?->id,
                'orderNumber' => $item->order?->orderNumber,
                'purchaseDate' => $item->order?->paidAt ?? $item->order?->createdAt,
            ])
            ->values()
            ->all();
    }

    /** Publica la reseña de una compra verificada y recalcula la calificación del producto. */
    public function create(int $userId, array $data): Review
    {
        $can = $this->canReview($userId, $data['productId']);
        if (! $can['canReview']) {
            throw new BusinessRuleException($can['reason'] ?? 'No puedes dejar una reseña', 400);
        }

        $review = DB::transaction(function () use ($userId, $data) {
            $review = Review::create([
                'userId' => $userId,
                'productId' => $data['productId'],
                'rating' => $data['rating'],
                'title' => $data['title'] ?? null,
                'comment' => $data['comment'],
                'verifiedPurchase' => true,
                'status' => 'APPROVED',
            ]);
            $this->refreshProductRating($data['productId']);

            return $review;
        });

        return $review->load('user:id,name,avatar');
    }

    /** El autor edita calificación, título o comentario. */
    public function update(int $userId, int $id, array $data): Review
    {
        $review = $this->findOwn($userId, $id, 'No puedes editar esta reseña');

        DB::transaction(function () use ($review, $data) {
            foreach (['rating', 'title', 'comment'] as $field) {
                if (array_key_exists($field, $data) && $data[$field] !== null) {
                    $review->{$field} = $data[$field];
                }
            }
            $review->save();
            $this->refreshProductRating($review->productId);
        });

        return $review->load('user:id,name,avatar');
    }

    /** Borra una reseña: la del autor ($userId) o cualquiera desde moderación ($userId null). */
    public function delete(int $id, ?int $userId = null): void
    {
        $review = $userId === null
            ? (Review::find($id) ?? throw new BusinessRuleException('Review no encontrada', 404))
            : $this->findOwn($userId, $id, 'No puedes eliminar esta reseña');

        DB::transaction(function () use ($review) {
            $review->delete();
            $this->refreshProductRating($review->productId);
        });
    }

    /** Voto útil / no útil; no se vota la propia. Devuelve el nuevo conteo de útiles. */
    public function vote(int $userId, int $id, bool $isHelpful): int
    {
        $review = Review::find($id) ?? throw new BusinessRuleException('Review no encontrada', 404);
        if ($review->userId === $userId) {
            throw new BusinessRuleException('No puedes votar tu propia reseña', 400);
        }

        ReviewHelpfulVote::updateOrCreate(['reviewId' => $id, 'userId' => $userId], ['isHelpful' => $isHelpful]);

        return $this->recountHelpful($id);
    }

    public function removeVote(int $userId, int $id): int
    {
        ReviewHelpfulVote::where('reviewId', $id)->where('userId', $userId)->delete();

        return $this->recountHelpful($id);
    }

    public function find(int $id): Review
    {
        return Review::find($id) ?? throw new BusinessRuleException('Review no encontrada', 404);
    }

    /** Moderación: cambia el estado y recalcula la calificación del producto. */
    public function moderate(int $id, string $status): Review
    {
        $review = $this->find($id);

        DB::transaction(function () use ($review, $status) {
            $review->status = $status;
            $review->save();
            $this->refreshProductRating($review->productId);
        });

        return $review->load('user:id,name,avatar');
    }

    /** Promedio y distribución de las reseñas APROBADAS de un producto. */
    public function summary(int $productId): array
    {
        $ratings = Review::where('productId', $productId)->where('status', 'APPROVED')->pluck('rating');

        $distribution = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
        $total = 0;
        foreach ($ratings as $rating) {
            if (isset($distribution[$rating])) {
                $distribution[$rating]++;
            }
            $total += $rating;
        }
        $count = $ratings->count();

        return [
            'averageRating' => $count > 0 ? round($total / $count, 1) : 0,
            'totalReviews' => $count,
            'ratingDistribution' => $distribution,
        ];
    }

    /** Forma de una reseña para el frontend (con el voto del usuario actual si se cargó). */
    public function format(Review $review, ?int $currentUserId = null): array
    {
        $userVote = null;
        if ($currentUserId && $review->relationLoaded('helpfulVotes')) {
            $vote = $review->helpfulVotes->firstWhere('userId', $currentUserId);
            $userVote = $vote ? $vote->isHelpful : null;
        }

        return [
            'id' => $review->id,
            'userId' => $review->userId,
            'productId' => $review->productId,
            'rating' => $review->rating,
            'title' => $review->title,
            'comment' => $review->comment,
            'verifiedPurchase' => $review->verifiedPurchase,
            'helpfulCount' => $review->helpfulCount,
            'status' => $review->status,
            'createdAt' => $review->createdAt,
            'updatedAt' => $review->updatedAt,
            'user' => [
                'id' => $review->user?->id,
                'name' => $review->user?->name,
                'avatar' => $review->user?->avatar,
            ],
            'userVote' => $userVote,
        ];
    }

    /** Reseña del usuario: 404 si no existe, 403 ($deniedMessage) si es de otro. */
    public function findOwn(int $userId, int $id, string $deniedMessage): Review
    {
        $review = Review::find($id) ?? throw new BusinessRuleException('Review no encontrada', 404);
        if ($review->userId !== $userId) {
            throw new BusinessRuleException($deniedMessage, 403);
        }

        return $review;
    }

    private function refreshProductRating(int $productId): void
    {
        $summary = $this->summary($productId);
        Product::where('id', $productId)->update([
            'rating' => $summary['averageRating'],
            'reviewsCount' => $summary['totalReviews'],
        ]);
    }

    private function recountHelpful(int $reviewId): int
    {
        $count = ReviewHelpfulVote::where('reviewId', $reviewId)->where('isHelpful', true)->count();
        Review::where('id', $reviewId)->update(['helpfulCount' => $count]);

        return $count;
    }

    /** Quien modera reseñas (SuperAdmin o permiso reviews.view) también ve las no aprobadas. */
    private function canModerate(User $user): bool
    {
        if ((int) $user->roleId === 1) {
            return true;
        }
        $permissions = $user->role?->permissions;

        return is_array($permissions) && in_array('reviews.view', $permissions, true);
    }

    // ==================== Listados ====================

    /**
     * Reseñas aprobadas de un producto, paginadas, con el voto del visitante y el resumen.
     *
     * @return array{data: array, meta: array, summary: array}
     */
    public function forProduct(int $productId, array $filters, ?int $viewerId): array
    {
        if (! Product::whereKey($productId)->exists()) {
            throw new BusinessRuleException('Producto no encontrado', 404);
        }
        [$page, $limit] = $this->pageAndLimit($filters);

        $query = Review::with('user:id,name,avatar')
            ->where('productId', $productId)
            ->where('status', 'APPROVED');
        if (! empty($filters['rating'])) {
            $query->where('rating', (int) $filters['rating']);
        }
        if ($viewerId) {
            $query->with(['helpfulVotes' => fn ($q) => $q->where('userId', $viewerId)]);
        }
        $this->applySort($query, $filters['sortBy'] ?? null);

        $total = $query->count();
        $reviews = $query->skip(($page - 1) * $limit)->take($limit)->get();

        return [
            'data' => $reviews->map(fn ($r) => $this->format($r, $viewerId))->all(),
            'meta' => $this->meta($total, $page, $limit),
            'summary' => $this->summary($productId),
        ];
    }

    public function summaryForProduct(int $productId): array
    {
        if (! Product::whereKey($productId)->exists()) {
            throw new BusinessRuleException('Producto no encontrado', 404);
        }

        return $this->summary($productId);
    }

    /** Reseñas del usuario, con el producto, paginadas. */
    public function mine(int $userId, array $filters): array
    {
        [$page, $limit] = $this->pageAndLimit($filters);

        $total = Review::where('userId', $userId)->count();
        $reviews = Review::with(['user:id,name,avatar', 'product:id,name,images'])
            ->where('userId', $userId)
            ->orderByDesc('createdAt')
            ->skip(($page - 1) * $limit)->take($limit)->get();

        return [
            'data' => $reviews->map(function ($r) {
                $images = is_array($r->product?->images) ? $r->product->images : [];

                return $this->format($r) + [
                    'product' => [
                        'id' => $r->product?->id,
                        'name' => $r->product?->name,
                        'image' => $images['front'] ?? ($images[0] ?? null),
                    ],
                ];
            })->all(),
            'meta' => $this->meta($total, $page, $limit),
        ];
    }

    /** Listado de moderación: cualquier estado, con filtros y orden. */
    public function forModeration(array $filters): array
    {
        [$page, $limit] = $this->pageAndLimit($filters);

        $query = Review::with(['user:id,name,avatar', 'product:id,name']);
        foreach (['status', 'productId', 'userId', 'rating'] as $key) {
            if (isset($filters[$key]) && $filters[$key] !== '') {
                $query->where($key, $filters[$key]);
            }
        }
        $this->applySort($query, $filters['sortBy'] ?? null);

        $total = $query->count();
        $reviews = $query->skip(($page - 1) * $limit)->take($limit)->get();

        return [
            'data' => $reviews->map(fn ($r) => $this->format($r) + [
                'product' => ['id' => $r->product?->id, 'name' => $r->product?->name],
            ])->all(),
            'meta' => $this->meta($total, $page, $limit),
        ];
    }

    /** @return array{0:int, 1:int} página (≥1) y tamaño (≥1, por defecto 10). */
    private function pageAndLimit(array $filters): array
    {
        return [max(1, (int) ($filters['page'] ?? 1)), max(1, (int) ($filters['limit'] ?? 10))];
    }

    private function applySort($query, ?string $sortBy): void
    {
        match ($sortBy) {
            'oldest' => $query->orderBy('createdAt'),
            'highest' => $query->orderByDesc('rating'),
            'lowest' => $query->orderBy('rating'),
            'helpful' => $query->orderByDesc('helpfulCount'),
            default => $query->orderByDesc('createdAt'),
        };
    }

    private function meta(int $total, int $page, int $limit): array
    {
        return [
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'totalPages' => (int) ceil($total / $limit),
        ];
    }
}
