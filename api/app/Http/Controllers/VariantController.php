<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\VariantService;
use Illuminate\Http\Request;
use RuntimeException;

class VariantController extends Controller
{
    use ApiResponse;

    public function __construct(private VariantService $variants) {}

    public function index(Request $request)
    {
        $filter = $this->buildFilter($request);

        return $this->success($this->variants->getVariants($filter));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'productId' => 'required|integer',
            'colorId' => 'required|integer',
            'sizeId' => 'required|integer',
            'sku' => 'nullable|string',
            'barcode' => 'nullable|string',
            'stock' => 'nullable|integer',
            'minStock' => 'nullable|integer',
            'priceAdjustment' => 'nullable|numeric',
        ]);

        try {
            $variant = $this->variants->createVariant($data);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->created(
            $this->variants->withFinalPrice($variant),
            'Variante creada exitosamente'
        );
    }

    public function show(int $id)
    {
        $variant = $this->variants->getVariantById($id);

        return $variant ? $this->success($variant) : $this->error('Variante no encontrada', 404);
    }

    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'sku' => 'nullable|string',
            'barcode' => 'nullable|string',
            'stock' => 'nullable|integer',
            'minStock' => 'nullable|integer',
            'priceAdjustment' => 'nullable|numeric',
            'isActive' => 'nullable|boolean',
        ]);

        try {
            $variant = $this->variants->updateVariant($id, $data);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($this->variants->withFinalPrice($variant), 'Variante actualizada exitosamente');
    }

    public function destroy(int $id)
    {
        try {
            $this->variants->deleteVariant($id);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success(null, 'Variante eliminada exitosamente');
    }

    public function byBarcode(string $barcode)
    {
        $variant = $this->variants->getVariantByBarcode($barcode);

        return $variant ? $this->success($variant) : $this->error('Variante no encontrada', 404);
    }

    public function bySku(string $sku)
    {
        $variant = $this->variants->getVariantBySku($sku);

        return $variant ? $this->success($variant) : $this->error('Variante no encontrada', 404);
    }

    public function lookup(Request $request)
    {
        $data = $request->validate([
            'productId' => 'required|integer',
            'colorHex' => 'required|string',
            'sizeName' => 'required|string',
        ]);

        $variant = $this->variants->getVariantByProductColorSize(
            $data['productId'],
            $data['colorHex'],
            $data['sizeName']
        );

        return $variant ? $this->success($variant) : $this->error('Variante no encontrada', 404);
    }

    public function lowStock()
    {
        return $this->success($this->variants->checkLowStock());
    }

    public function productVariants(Request $request)
    {
        $result = $this->variants->getProductVariants($this->buildFilter($request, true));

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'pagination' => $result['pagination'],
        ]);
    }

    public function templateVariants(Request $request)
    {
        $result = $this->variants->getTemplateVariants($this->buildFilter($request, true));

        return response()->json([
            'success' => true,
            'data' => $result['data'],
            'pagination' => $result['pagination'],
        ]);
    }

    public function generate(Request $request, int $productId)
    {
        $initialStock = (int) $request->input('initialStock', 0);

        try {
            $created = $this->variants->generateVariantsForProduct($productId, $initialStock);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->created([
            'created' => $created,
            'errors' => [],
            'total' => count($created),
        ], 'Se generaron '.count($created).' variantes');
    }

    public function adjustStock(Request $request, int $id)
    {
        $data = $request->validate(['quantity' => 'required|integer']);

        try {
            $variant = $this->variants->adjustStock($id, $data['quantity']);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($this->variants->withFinalPrice($variant), 'Stock ajustado exitosamente');
    }

    /** Construye el filtro de variantes desde el query string. */
    private function buildFilter(Request $request, bool $paginated = false): array
    {
        $filter = [];
        foreach (['productId', 'colorId', 'sizeId'] as $key) {
            if ($request->filled($key)) {
                $filter[$key] = (int) $request->query($key);
            }
        }
        if ($request->has('isActive')) {
            $filter['isActive'] = filter_var($request->query('isActive'), FILTER_VALIDATE_BOOLEAN);
        }
        if ($request->has('lowStock')) {
            $filter['lowStock'] = filter_var($request->query('lowStock'), FILTER_VALIDATE_BOOLEAN);
        }
        if ($paginated) {
            if ($request->filled('page')) {
                $filter['page'] = (int) $request->query('page');
            }
            if ($request->filled('limit')) {
                $filter['limit'] = (int) $request->query('limit');
            }
            if ($request->filled('search')) {
                $filter['search'] = $request->query('search');
            }
        }

        return $filter;
    }
}
