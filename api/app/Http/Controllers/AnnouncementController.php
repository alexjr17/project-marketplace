<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Announcement;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    use ApiResponse;

    private function rules(): array
    {
        return [
            'type' => 'required|in:bar,popup,marquee,floating',
            'title' => 'nullable|string',
            'message' => 'nullable|string',
            'imageUrl' => 'nullable|string',
            'ctaText' => 'nullable|string',
            'ctaUrl' => 'nullable|string',
            'couponCode' => 'nullable|string',
            'variant' => 'nullable|in:info,promo,warning,success,dark',
            'bgColor' => 'nullable|string',
            'textColor' => 'nullable|string',
            'isActive' => 'boolean',
            'dismissible' => 'boolean',
            'target' => 'nullable|in:all,home,catalog',
            'frequency' => 'nullable|in:always,session,daily',
            'priority' => 'nullable|integer',
            'startsAt' => 'nullable|date',
            'endsAt' => 'nullable|date',
        ];
    }

    // ==================== ADMIN ====================

    public function index()
    {
        return $this->success(
            Announcement::orderByDesc('priority')->orderByDesc('createdAt')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->rules());

        return $this->created(Announcement::create($data), 'Anuncio creado');
    }

    public function update(Request $request, int $id)
    {
        $a = Announcement::find($id);
        if (! $a) {
            return $this->error('Anuncio no encontrado', 404);
        }
        $a->fill($request->validate($this->rules()))->save();

        return $this->success($a, 'Anuncio actualizado');
    }

    public function destroy(int $id)
    {
        $a = Announcement::find($id);
        if (! $a) {
            return $this->error('Anuncio no encontrado', 404);
        }
        $a->delete();

        return $this->success(null, 'Anuncio eliminado');
    }

    // ==================== PÚBLICO ====================

    /** Anuncios activos según fecha (la segmentación por página la hace el front). */
    public function active()
    {
        $now = now();
        $items = Announcement::where('isActive', true)
            ->where(fn ($q) => $q->whereNull('startsAt')->orWhere('startsAt', '<=', $now))
            ->where(fn ($q) => $q->whereNull('endsAt')->orWhere('endsAt', '>=', $now))
            ->orderByDesc('priority')
            ->orderByDesc('createdAt')
            ->get();

        return $this->success($items);
    }
}
