<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\ReviewHelpfulVote;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReviewController extends Controller
{
    use ApiResponse;

    /** Estados de pedido que cuentan como compra válida. */
    private const PURCHASED_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

    // ==================== RUTAS PÚBLICAS ====================

    public function productReviews(Request $request, int $productId)
    {
        if (! Product::whereKey($productId)->exists()) {
            return $this->error('Producto no encontrado', 404);
        }

        $page = max(1, (int) $request->query('page', 1));
        $limit = max(1, (int) $request->query('limit', 10));
        $rating = $request->query('rating');
        $currentUserId = $request->user()?->id;

        $query = Review::with('user:id,name,avatar')
            ->where('productId', $productId)
            ->where('status', 'APPROVED');
        if ($rating) {
            $query->where('rating', (int) $rating);
        }
        if ($currentUserId) {
            $query->with(['helpfulVotes' => fn ($q) => $q->where('userId', $currentUserId)]);
        }

        $this->applySort($query, $request->query('sortBy'));

        $total = $query->count();
        $reviews = $query->skip(($page - 1) * $limit)->take($limit)->get();
        $meta = $this->meta($total, $page, $limit);

        return response()->json([
            'success' => true,
            'data' => $reviews->map(fn ($r) => $this->formatReview($r, $currentUserId))->all(),
            'meta' => $meta,
            'pagination' => $meta,
            'summary' => $this->calculateSummary($productId),
        ]);
    }

    public function productSummary(int $productId)
    {
        if (! Product::whereKey($productId)->exists()) {
            return $this->error('Producto no encontrado', 404);
        }

        return $this->success($this->calculateSummary($productId));
    }

    public function show(Request $request, int $id)
    {
        $currentUserId = $request->user()?->id;

        $query = Review::with('user:id,name,avatar');
        if ($currentUserId) {
            $query->with(['helpfulVotes' => fn ($q) => $q->where('userId', $currentUserId)]);
        }
        $review = $query->find($id);

        if (! $review) {
            return $this->error('Review no encontrada', 404);
        }

        return $this->success($this->formatReview($review, $currentUserId));
    }

    // ==================== USUARIO AUTENTICADO ====================

    public function canReview(Request $request, int $productId)
    {
        return $this->success($this->resolveCanReview($request->user()->id, $productId));
    }

    public function awaitingReview(Request $request)
    {
        $userId = $request->user()->id;

        $items = OrderItem::whereHas('order', fn ($q) => $q->where('userId', $userId)
            ->whereIn('status', self::PURCHASED_STATUSES))
            ->with('order:id,orderNumber,paidAt,createdAt')
            ->get();

        $reviewedProductIds = Review::where('userId', $userId)->pluck('productId')->all();

        $awaiting = $items
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
            ->values();

        return $this->success($awaiting);
    }

    public function myReviews(Request $request)
    {
        $userId = $request->user()->id;
        $page = max(1, (int) $request->query('page', 1));
        $limit = max(1, (int) $request->query('limit', 10));

        $total = Review::where('userId', $userId)->count();
        $reviews = Review::with(['user:id,name,avatar', 'product:id,name,images'])
            ->where('userId', $userId)
            ->orderByDesc('createdAt')
            ->skip(($page - 1) * $limit)->take($limit)->get();

        $meta = $this->meta($total, $page, $limit);

        return response()->json([
            'success' => true,
            'data' => $reviews->map(function ($r) {
                $images = is_array($r->product?->images) ? $r->product->images : [];

                return $this->formatReview($r) + [
                    'product' => [
                        'id' => $r->product?->id,
                        'name' => $r->product?->name,
                        'image' => $images[0] ?? null,
                    ],
                ];
            })->all(),
            'meta' => $meta,
            'pagination' => $meta,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'productId' => 'required|integer',
            'rating' => 'required|integer|min:1|max:5',
            'title' => 'nullable|string|max:200',
            'comment' => 'required|string',
        ]);

        $userId = $request->user()->id;
        $can = $this->resolveCanReview($userId, $data['productId']);
        if (! $can['canReview']) {
            return $this->error($can['reason'] ?? 'No puedes dejar una reseña', 400);
        }

        $review = Review::create([
            'userId' => $userId,
            'productId' => $data['productId'],
            'rating' => $data['rating'],
            'title' => $data['title'] ?? null,
            'comment' => $data['comment'],
            'verifiedPurchase' => true,
            'status' => 'APPROVED',
        ]);

        $this->updateProductRating($data['productId']);

        return $this->created(
            $this->formatReview($review->load('user:id,name,avatar')),
            'Reseña publicada exitosamente'
        );
    }

    public function update(Request $request, int $id)
    {
        $review = Review::find($id);
        if (! $review) {
            return $this->error('Review no encontrada', 404);
        }
        if ($review->userId !== $request->user()->id) {
            return $this->error('No puedes editar esta reseña', 403);
        }

        $data = $request->validate([
            'rating' => 'nullable|integer|min:1|max:5',
            'title' => 'nullable|string|max:200',
            'comment' => 'nullable|string',
        ]);

        foreach (['rating', 'title', 'comment'] as $field) {
            if (array_key_exists($field, $data) && $data[$field] !== null) {
                $review->{$field} = $data[$field];
            }
        }
        $review->save();
        $this->updateProductRating($review->productId);

        return $this->success(
            $this->formatReview($review->load('user:id,name,avatar')),
            'Reseña actualizada exitosamente'
        );
    }

    public function destroy(Request $request, int $id)
    {
        $review = Review::find($id);
        if (! $review) {
            return $this->error('Review no encontrada', 404);
        }
        if ($review->userId !== $request->user()->id) {
            return $this->error('No puedes eliminar esta reseña', 403);
        }

        $productId = $review->productId;
        $review->delete();
        $this->updateProductRating($productId);

        return $this->success(null, 'Reseña eliminada exitosamente');
    }

    public function vote(Request $request, int $id)
    {
        $data = $request->validate(['isHelpful' => 'required|boolean']);

        $review = Review::find($id);
        if (! $review) {
            return $this->error('Review no encontrada', 404);
        }
        if ($review->userId === $request->user()->id) {
            return $this->error('No puedes votar tu propia reseña', 400);
        }

        ReviewHelpfulVote::updateOrCreate(
            ['reviewId' => $id, 'userId' => $request->user()->id],
            ['isHelpful' => $data['isHelpful']]
        );

        return $this->success(['helpfulCount' => $this->recountHelpful($id)]);
    }

    public function removeVote(Request $request, int $id)
    {
        ReviewHelpfulVote::where('reviewId', $id)->where('userId', $request->user()->id)->delete();

        return $this->success(['helpfulCount' => $this->recountHelpful($id)]);
    }

    // ==================== ADMIN ====================

    public function adminList(Request $request)
    {
        $page = max(1, (int) $request->query('page', 1));
        $limit = max(1, (int) $request->query('limit', 10));

        $query = Review::with(['user:id,name,avatar', 'product:id,name']);
        foreach (['status', 'productId', 'userId', 'rating'] as $key) {
            if ($request->filled($key)) {
                $query->where($key, $request->query($key));
            }
        }
        $this->applySort($query, $request->query('sortBy'));

        $total = $query->count();
        $reviews = $query->skip(($page - 1) * $limit)->take($limit)->get();
        $meta = $this->meta($total, $page, $limit);

        return response()->json([
            'success' => true,
            'data' => $reviews->map(fn ($r) => $this->formatReview($r) + [
                'product' => ['id' => $r->product?->id, 'name' => $r->product?->name],
            ])->all(),
            'meta' => $meta,
            'pagination' => $meta,
        ]);
    }

    public function moderate(Request $request, int $id)
    {
        $review = Review::find($id);
        if (! $review) {
            return $this->error('Review no encontrada', 404);
        }

        $data = $request->validate([
            'status' => ['required', Rule::in(['PENDING', 'APPROVED', 'REJECTED'])],
        ]);

        $review->status = $data['status'];
        $review->save();
        $this->updateProductRating($review->productId);

        return $this->success(
            $this->formatReview($review->load('user:id,name,avatar')),
            'Review moderada exitosamente'
        );
    }

    public function adminDestroy(int $id)
    {
        $review = Review::find($id);
        if (! $review) {
            return $this->error('Review no encontrada', 404);
        }

        $productId = $review->productId;
        $review->delete();
        $this->updateProductRating($productId);

        return $this->success(null, 'Review eliminada exitosamente');
    }

    // ==================== HELPERS ====================

    private function formatReview(Review $review, ?int $currentUserId = null): array
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

    private function calculateSummary(int $productId): array
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

    private function updateProductRating(int $productId): void
    {
        $summary = $this->calculateSummary($productId);
        Product::where('id', $productId)->update([
            'rating' => $summary['averageRating'],
            'reviewsCount' => $summary['totalReviews'],
        ]);
    }

    private function userPurchased(int $userId, int $productId): bool
    {
        return OrderItem::where('productId', $productId)
            ->whereHas('order', fn ($q) => $q->where('userId', $userId)
                ->whereIn('status', self::PURCHASED_STATUSES))
            ->exists();
    }

    private function resolveCanReview(int $userId, int $productId): array
    {
        $existing = Review::with('user:id,name,avatar')
            ->where('userId', $userId)->where('productId', $productId)->first();

        if ($existing) {
            return [
                'canReview' => false,
                'reason' => 'Ya has dejado una reseña para este producto',
                'existingReview' => $this->formatReview($existing),
            ];
        }

        if (! $this->userPurchased($userId, $productId)) {
            return [
                'canReview' => false,
                'reason' => 'Debes comprar este producto para poder dejar una reseña',
            ];
        }

        return ['canReview' => true];
    }

    private function recountHelpful(int $reviewId): int
    {
        $count = ReviewHelpfulVote::where('reviewId', $reviewId)->where('isHelpful', true)->count();
        Review::where('id', $reviewId)->update(['helpfulCount' => $count]);

        return $count;
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
