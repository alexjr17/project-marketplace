<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Notification;
use App\Models\Product;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponse;

    /** Da formato a una notificación, enriqueciendo las de tipo reseña con datos del producto. */
    private function formatNotification(Notification $n): array
    {
        $data = [
            'id' => $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'message' => $n->message,
            'referenceType' => $n->referenceType,
            'referenceId' => $n->referenceId,
            'isRead' => $n->isRead,
            'createdAt' => $n->createdAt,
        ];

        if ($n->type === 'REVIEW_AVAILABLE' && $n->referenceId) {
            $product = Product::find($n->referenceId);
            if ($product) {
                $data['productName'] = $product->name;
                $images = is_array($product->images) ? $product->images : [];
                $data['productImage'] = $images['front'] ?? ($images[0] ?? null);
            }
        }

        return $data;
    }

    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $page = max(1, (int) $request->query('page', 1));
        $limit = max(1, (int) $request->query('limit', 20));

        $query = Notification::where('userId', $userId);
        if (filter_var($request->query('unreadOnly'), FILTER_VALIDATE_BOOLEAN)) {
            $query->where('isRead', false);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        $total = $query->count();
        $notifications = $query->orderByDesc('createdAt')
            ->skip(($page - 1) * $limit)->take($limit)->get();
        $unreadCount = Notification::where('userId', $userId)->where('isRead', false)->count();

        return response()->json([
            'success' => true,
            'data' => $notifications->map(fn ($n) => $this->formatNotification($n))->all(),
            'meta' => [
                'total' => $total,
                'page' => $page,
                'limit' => $limit,
                'totalPages' => (int) ceil($total / $limit),
                'unreadCount' => $unreadCount,
            ],
        ]);
    }

    public function unreadCount(Request $request)
    {
        $count = Notification::where('userId', $request->user()->id)->where('isRead', false)->count();

        return $this->success(['unreadCount' => $count]);
    }

    public function show(Request $request, int $id)
    {
        $notification = Notification::where('id', $id)->where('userId', $request->user()->id)->first();
        if (! $notification) {
            return $this->error('Notificación no encontrada', 404);
        }

        return $this->success($this->formatNotification($notification));
    }

    public function markAsRead(Request $request, int $id)
    {
        $notification = Notification::where('id', $id)->where('userId', $request->user()->id)->first();
        if (! $notification) {
            return $this->error('Notificación no encontrada', 404);
        }
        $notification->isRead = true;
        $notification->save();

        return $this->success(null, 'Notificación marcada como leída');
    }

    public function markMultipleAsRead(Request $request)
    {
        $data = $request->validate(['notificationIds' => 'required|array']);

        Notification::whereIn('id', $data['notificationIds'])
            ->where('userId', $request->user()->id)
            ->update(['isRead' => true]);

        return $this->success(null, 'Notificaciones marcadas como leídas');
    }

    public function markAllAsRead(Request $request)
    {
        Notification::where('userId', $request->user()->id)->where('isRead', false)
            ->update(['isRead' => true]);

        return $this->success(null, 'Todas las notificaciones marcadas como leídas');
    }

    public function destroy(Request $request, int $id)
    {
        $notification = Notification::where('id', $id)->where('userId', $request->user()->id)->first();
        if (! $notification) {
            return $this->error('Notificación no encontrada', 404);
        }
        $notification->delete();

        return $this->success(null, 'Notificación eliminada');
    }
}
