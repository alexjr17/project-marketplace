<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Catalog\ReviewService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Reseñas de productos. Las reglas viven en Catalog\ReviewService. */
class ReviewController extends Controller
{
    use ApiResponse;

    public function __construct(private ReviewService $reviews) {}

    // ==================== RUTAS PÚBLICAS ====================

    /** Reseñas destacadas para la portada (aprobadas, 4-5 estrellas, con comentario). */
    public function featured(Request $request)
    {
        $data = $request->validate(['limit' => 'nullable|integer|min:1|max:'.ReviewService::FEATURED_MAX]);

        return $this->success($this->reviews->featured((int) ($data['limit'] ?? 6)));
    }

    public function productReviews(Request $request, int $productId)
    {
        $result = $this->reviews->forProduct(
            $productId,
            $request->only(['page', 'limit', 'rating', 'sortBy']),
            $request->user()?->id,
        );

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
            'pagination' => $result['meta'],
            'summary' => $result['summary'],
        ]);
    }

    public function productSummary(int $productId)
    {
        return $this->success($this->reviews->summaryForProduct($productId));
    }

    public function show(Request $request, int $id)
    {
        $viewer = $request->user();

        return $this->success($this->reviews->format($this->reviews->findVisible($id, $viewer), $viewer?->id));
    }

    // ==================== USUARIO AUTENTICADO ====================

    public function canReview(Request $request, int $productId)
    {
        return $this->success($this->reviews->canReview($request->user()->id, $productId));
    }

    public function awaitingReview(Request $request)
    {
        return $this->success($this->reviews->awaitingReview($request->user()->id));
    }

    public function myReviews(Request $request)
    {
        $result = $this->reviews->mine($request->user()->id, $request->only(['page', 'limit']));

        return $this->paginated($result);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'productId' => 'required|integer',
            'rating' => 'required|integer|min:1|max:5',
            'title' => 'nullable|string|max:200',
            'comment' => 'required|string',
        ]);

        $review = $this->reviews->create($request->user()->id, $data);

        return $this->created($this->reviews->format($review), 'Reseña publicada exitosamente');
    }

    public function update(Request $request, int $id)
    {
        // Antes de validar, como siempre: inexistente → 404; de otro usuario → 403.
        $this->reviews->findOwn($request->user()->id, $id, 'No puedes editar esta reseña');

        $data = $request->validate([
            'rating' => 'nullable|integer|min:1|max:5',
            'title' => 'nullable|string|max:200',
            'comment' => 'nullable|string',
        ]);

        $review = $this->reviews->update($request->user()->id, $id, $data);

        return $this->success($this->reviews->format($review), 'Reseña actualizada exitosamente');
    }

    public function destroy(Request $request, int $id)
    {
        $this->reviews->delete($id, $request->user()->id);

        return $this->success(null, 'Reseña eliminada exitosamente');
    }

    public function vote(Request $request, int $id)
    {
        $data = $request->validate(['isHelpful' => 'required|boolean']);

        return $this->success(['helpfulCount' => $this->reviews->vote($request->user()->id, $id, (bool) $data['isHelpful'])]);
    }

    public function removeVote(Request $request, int $id)
    {
        return $this->success(['helpfulCount' => $this->reviews->removeVote($request->user()->id, $id)]);
    }

    // ==================== ADMIN ====================

    public function adminList(Request $request)
    {
        return $this->paginated($this->reviews->forModeration(
            $request->only(['page', 'limit', 'status', 'productId', 'userId', 'rating', 'sortBy'])
        ));
    }

    public function moderate(Request $request, int $id)
    {
        $this->reviews->find($id);

        $data = $request->validate([
            'status' => ['required', Rule::in(['PENDING', 'APPROVED', 'REJECTED'])],
        ]);

        return $this->success($this->reviews->format($this->reviews->moderate($id, $data['status'])), 'Review moderada exitosamente');
    }

    public function adminDestroy(int $id)
    {
        $this->reviews->delete($id);

        return $this->success(null, 'Review eliminada exitosamente');
    }

    /** { success, data, meta, pagination } (meta y pagination son lo mismo, por compatibilidad). */
    private function paginated(array $result)
    {
        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'meta' => $result['meta'],
            'pagination' => $result['meta'],
        ]);
    }
}
