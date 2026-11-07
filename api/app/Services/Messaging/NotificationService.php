<?php

namespace App\Services\Messaging;

use App\Models\Notification;
use App\Models\Product;
use Illuminate\Support\Collection;

/**
 * Notificaciones del usuario: listado paginado, conteo de no leídas y marcado. Todas las
 * consultas van filtradas por el dueño.
 */
class NotificationService
{
    /**
     * Página de notificaciones del usuario, ya formateadas.
     *
     * @return array{items: array<int, array>, total:int, page:int, limit:int, unreadCount:int}
     */
    public function paginate(int $userId, int $page, int $limit, bool $unreadOnly = false, ?string $type = null): array
    {
        $page = max(1, $page);
        $limit = max(1, $limit);

        $query = Notification::where('userId', $userId)
            ->when($unreadOnly, fn ($q) => $q->where('isRead', false))
            ->when($type, fn ($q) => $q->where('type', $type));

        $total = $query->count();
        $items = $query->orderByDesc('createdAt')->skip(($page - 1) * $limit)->take($limit)->get();

        return [
            'items' => $this->formatMany($items),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'unreadCount' => $this->unreadCount($userId),
        ];
    }

    public function unreadCount(int $userId): int
    {
        return Notification::where('userId', $userId)->where('isRead', false)->count();
    }

    public function findForUser(int $userId, int $id): ?Notification
    {
        return Notification::where('id', $id)->where('userId', $userId)->first();
    }

    public function markRead(Notification $n): void
    {
        $n->isRead = true;
        $n->save();
    }

    /** Marca como leídas las notificaciones indicadas (solo las del usuario); null = todas. */
    public function markManyRead(int $userId, ?array $ids = null): void
    {
        Notification::where('userId', $userId)
            ->when($ids !== null, fn ($q) => $q->whereIn('id', $ids), fn ($q) => $q->where('isRead', false))
            ->update(['isRead' => true]);
    }

    public function format(Notification $n): array
    {
        return $this->formatMany(collect([$n]))[0];
    }

    /**
     * Formato de respuesta; las de reseña disponible llevan nombre e imagen del producto
     * (los productos se cargan en una sola consulta).
     */
    private function formatMany(Collection $notifications): array
    {
        $productIds = $notifications
            ->filter(fn ($n) => $n->type === 'REVIEW_AVAILABLE' && $n->referenceId)
            ->pluck('referenceId')->unique()->all();
        $products = $productIds ? Product::whereIn('id', $productIds)->get(['id', 'name', 'images'])->keyBy('id') : collect();

        return $notifications->map(function (Notification $n) use ($products) {
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

            $product = $n->type === 'REVIEW_AVAILABLE' ? $products->get($n->referenceId) : null;
            if ($product) {
                $data['productName'] = $product->name;
                $images = is_array($product->images) ? $product->images : [];
                $data['productImage'] = $images['front'] ?? ($images[0] ?? null);
            }

            return $data;
        })->values()->all();
    }
}
