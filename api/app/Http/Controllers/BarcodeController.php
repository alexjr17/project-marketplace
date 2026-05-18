<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\BarcodeService;
use Illuminate\Http\Request;

class BarcodeController extends Controller
{
    use ApiResponse;

    public function __construct(private BarcodeService $barcodes) {}

    /** GET /api/barcodes/image/{variantId} */
    public function variantImage(Request $request, int $variantId)
    {
        $format = $request->query('format', 'png');
        try {
            $image = $this->barcodes->generateVariantBarcodeImage($variantId, [
                'format' => $format,
                'width' => $request->query('width'),
                'height' => $request->query('height'),
            ]);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return response($image, 200, [
            'Content-Type' => $format === 'svg' ? 'image/svg+xml' : 'image/png',
            'Content-Disposition' => "inline; filename=barcode-{$variantId}.{$format}",
        ]);
    }

    /** POST /api/barcodes/image */
    public function generateImage(Request $request)
    {
        $barcode = $request->input('barcode');
        if (! $barcode) {
            return $this->error('El código de barras es requerido', 400);
        }
        $format = $request->input('format', 'png');

        try {
            $image = $this->barcodes->generateBarcodeImage($barcode, [
                'format' => $format,
                'width' => $request->input('width'),
                'height' => $request->input('height'),
            ]);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return response($image, 200, [
            'Content-Type' => $format === 'svg' ? 'image/svg+xml' : 'image/png',
            'Content-Disposition' => "inline; filename=barcode-{$barcode}.{$format}",
        ]);
    }

    /** GET /api/barcodes/label/{variantId} */
    public function variantLabel(int $variantId)
    {
        try {
            return $this->success($this->barcodes->generateBarcodeLabel($variantId));
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }
    }

    /** POST /api/barcodes/labels/batch */
    public function batchLabels(Request $request)
    {
        $data = $request->validate([
            'variantIds' => 'required|array|min:1',
            'variantIds.*' => 'integer',
        ]);

        $labels = $this->barcodes->generateBarcodeLabels($data['variantIds']);

        return response()->json([
            'success' => true,
            'data' => $labels,
            'total' => count($labels),
        ]);
    }

    /** GET /api/barcodes/labels/product/{productId} */
    public function productLabels(int $productId)
    {
        $labels = $this->barcodes->generateProductBarcodeLabels($productId);

        return response()->json([
            'success' => true,
            'data' => $labels,
            'total' => count($labels),
        ]);
    }

    /** POST /api/barcodes/assign/{variantId} */
    public function assign(Request $request, int $variantId)
    {
        try {
            $result = $this->barcodes->assignBarcodeToVariant($variantId, $request->input('barcode'));
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($result, 'Código de barras asignado exitosamente');
    }

    /** POST /api/barcodes/assign-all */
    public function assignAll()
    {
        $result = $this->barcodes->assignBarcodeToAllVariants();

        return $this->success(
            $result,
            "{$result['success']} códigos asignados, {$result['failed']} fallidos"
        );
    }

    /** POST /api/barcodes/validate */
    public function validateBarcode(Request $request)
    {
        $barcode = $request->input('barcode');
        if (! $barcode) {
            return $this->error('El código de barras es requerido', 400);
        }
        $type = $request->input('type', 'ean13');

        return $this->success([
            'barcode' => $barcode,
            'type' => $type,
            'isValid' => $this->barcodes->validateBarcode($barcode, $type),
        ]);
    }

    /** POST /api/barcodes/print */
    public function print(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'templateId' => 'nullable|integer',
        ]);

        try {
            $pdf = $this->barcodes->generateBarcodeLabelsPDF($data['items'], $data['templateId'] ?? null);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename=etiquetas-codigos-barras.pdf',
        ]);
    }
}
