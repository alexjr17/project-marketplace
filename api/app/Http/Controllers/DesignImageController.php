<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\DesignImage;
use Illuminate\Http\Request;

class DesignImageController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $query = DesignImage::query();

        if ($request->has('isActive')) {
            $query->where('isActive', filter_var($request->query('isActive'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }
        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")->orWhere('description', 'like', "%{$s}%");
            });
        }

        return $this->success($query->orderBy('sortOrder')->get());
    }

    public function categories()
    {
        $categories = DesignImage::whereNotNull('category')
            ->distinct()->orderBy('category')->pluck('category');

        return $this->success($categories);
    }

    public function show(int $id)
    {
        $image = DesignImage::find($id);

        return $image ? $this->success($image) : $this->error('Imagen no encontrada', 404);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'thumbnailUrl' => 'required|string',
            'fullUrl' => 'required|string',
            'category' => 'nullable|string',
            'tags' => 'nullable|array',
            'sortOrder' => 'nullable|integer',
        ]);

        $image = DesignImage::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'thumbnailUrl' => $data['thumbnailUrl'],
            'fullUrl' => $data['fullUrl'],
            'category' => $data['category'] ?? null,
            'tags' => $data['tags'] ?? null,
            'sortOrder' => $data['sortOrder'] ?? 0,
            'isActive' => true,
        ]);

        return $this->created($image);
    }

    public function update(Request $request, int $id)
    {
        $image = DesignImage::find($id);
        if (! $image) {
            return $this->error('Imagen no encontrada', 404);
        }

        $data = $request->validate([
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'thumbnailUrl' => 'nullable|string',
            'fullUrl' => 'nullable|string',
            'category' => 'nullable|string',
            'tags' => 'nullable|array',
            'sortOrder' => 'nullable|integer',
            'isActive' => 'nullable|boolean',
        ]);

        $image->fill(array_filter($data, fn ($v) => $v !== null));
        $image->save();

        return $this->success($image);
    }

    public function destroy(Request $request, int $id)
    {
        $image = DesignImage::find($id);
        if (! $image) {
            return $this->error('Imagen no encontrada', 404);
        }

        if (filter_var($request->query('permanent'), FILTER_VALIDATE_BOOLEAN)) {
            $image->delete();
        } else {
            $image->isActive = false;
            $image->save();
        }

        return $this->success($image);
    }

    public function updateSortOrder(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|integer',
            'items.*.sortOrder' => 'required|integer',
        ]);

        foreach ($data['items'] as $item) {
            DesignImage::where('id', $item['id'])->update(['sortOrder' => $item['sortOrder']]);
        }

        return $this->success(DesignImage::orderBy('sortOrder')->get());
    }
}
