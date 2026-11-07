<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Messaging\NotificationService;
use Illuminate\Http\Request;

/** Notificaciones del usuario con sesión (solo las suyas). */
class NotificationController extends Controller
{
    use ApiResponse;

    public function __construct(private NotificationService $notifications) {}

    public function index(Request $request)
    {
        $page = $this->notifications->paginate(
            $request->user()->id,
            (int) $request->query('page', 1),
            (int) $request->query('limit', 20),
            filter_var($request->query('unreadOnly'), FILTER_VALIDATE_BOOLEAN),
            $request->filled('type') ? (string) $request->query('type') : null,
        );

        return response()->json([
            'success' => true,
            'data' => $page['items'],
            'meta' => [
                'total' => $page['total'],
                'page' => $page['page'],
                'limit' => $page['limit'],
                'totalPages' => (int) ceil($page['total'] / $page['limit']),
                'unreadCount' => $page['unreadCount'],
            ],
        ]);
    }

    public function unreadCount(Request $request)
    {
        return $this->success(['unreadCount' => $this->notifications->unreadCount($request->user()->id)]);
    }

    public function show(Request $request, int $id)
    {
        $notification = $this->notifications->findForUser($request->user()->id, $id);
        if (! $notification) {
            return $this->error('Notificación no encontrada', 404);
        }

        return $this->success($this->notifications->format($notification));
    }

    public function markAsRead(Request $request, int $id)
    {
        $notification = $this->notifications->findForUser($request->user()->id, $id);
        if (! $notification) {
            return $this->error('Notificación no encontrada', 404);
        }
        $this->notifications->markRead($notification);

        return $this->success(null, 'Notificación marcada como leída');
    }

    public function markMultipleAsRead(Request $request)
    {
        $data = $request->validate(['notificationIds' => 'required|array']);
        $this->notifications->markManyRead($request->user()->id, $data['notificationIds']);

        return $this->success(null, 'Notificaciones marcadas como leídas');
    }

    public function markAllAsRead(Request $request)
    {
        $this->notifications->markManyRead($request->user()->id);

        return $this->success(null, 'Todas las notificaciones marcadas como leídas');
    }

    public function destroy(Request $request, int $id)
    {
        $notification = $this->notifications->findForUser($request->user()->id, $id);
        if (! $notification) {
            return $this->error('Notificación no encontrada', 404);
        }
        $notification->delete();

        return $this->success(null, 'Notificación eliminada');
    }
}
