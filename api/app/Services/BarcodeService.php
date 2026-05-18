<?php

namespace App\Services;

use App\Models\LabelTemplate;
use App\Models\ProductVariant;
use Barryvdh\DomPDF\Facade\Pdf;
use Picqer\Barcode\BarcodeGeneratorPNG;
use Picqer\Barcode\BarcodeGeneratorSVG;
use RuntimeException;

/**
 * Generación de imágenes de códigos de barras, etiquetas y PDF de impresión.
 * Migrado de backend/src/services/barcode.service.ts (antes bwip-js + pdfkit).
 */
class BarcodeService
{
    public function __construct(private VariantService $variants) {}

    /** Valida el formato de un código de barras (ean13 o code128). */
    public function validateBarcode(string $barcode, string $type = 'ean13'): bool
    {
        if ($type === 'ean13') {
            if (! preg_match('/^\d{13}$/', $barcode)) {
                return false;
            }
            $digits = array_map('intval', str_split($barcode));
            $sum = 0;
            for ($i = 0; $i < 12; $i++) {
                $sum += $digits[$i] * ($i % 2 === 0 ? 1 : 3);
            }
            $check = (10 - ($sum % 10)) % 10;

            return $check === $digits[12];
        }

        if ($type === 'code128') {
            return $barcode !== '' && preg_match('/^[\x00-\x7F]+$/', $barcode) === 1;
        }

        return false;
    }

    /** Determina el tipo de simbología picqer según el contenido. */
    private function symbology(string $barcode, object $generator): string
    {
        if (preg_match('/^\d{13}$/', $barcode)) {
            return $generator::TYPE_EAN_13;
        }
        if (preg_match('/^\d{12}$/', $barcode)) {
            return $generator::TYPE_UPC_A;
        }

        return $generator::TYPE_CODE_128;
    }

    /** Genera la imagen del código de barras (PNG o SVG) como bytes binarios. */
    public function generateBarcodeImage(string $barcode, array $options = []): string
    {
        $format = $options['format'] ?? 'png';
        $widthFactor = (int) ($options['width'] ?? 3);
        $height = (int) ($options['height'] ?? 50);

        try {
            if ($format === 'svg') {
                $generator = new BarcodeGeneratorSVG;

                return $generator->getBarcode($barcode, $this->symbology($barcode, $generator), 2, $height);
            }

            $generator = new BarcodeGeneratorPNG;

            return $generator->getBarcode($barcode, $this->symbology($barcode, $generator), $widthFactor, $height);
        } catch (\Throwable $e) {
            throw new RuntimeException('Error generando código de barras: '.$e->getMessage());
        }
    }

    /** Genera la imagen del código de barras de una variante. */
    public function generateVariantBarcodeImage(int $variantId, array $options = []): string
    {
        $variant = ProductVariant::find($variantId);
        if (! $variant) {
            throw new RuntimeException('Variante no encontrada');
        }
        if (! $variant->barcode) {
            throw new RuntimeException('La variante no tiene código de barras asignado');
        }

        return $this->generateBarcodeImage($variant->barcode, $options);
    }

    /** Genera los datos completos de etiqueta de una variante (con imagen base64). */
    public function generateBarcodeLabel(int $variantId): array
    {
        $variant = ProductVariant::with(['product', 'color', 'size'])->find($variantId);
        if (! $variant) {
            throw new RuntimeException('Variante no encontrada');
        }
        if (! $variant->barcode) {
            throw new RuntimeException('La variante no tiene código de barras asignado');
        }

        $image = $this->generateBarcodeImage($variant->barcode, ['width' => 2, 'height' => 40]);
        $finalPrice = (float) $variant->product->basePrice + (float) ($variant->priceAdjustment ?? 0);

        return [
            'variantId' => $variant->id,
            'barcode' => $variant->barcode,
            'productName' => $variant->product->name,
            'sku' => $variant->sku,
            'color' => $variant->color?->name ?? 'N/A',
            'size' => $variant->size?->name ?? 'N/A',
            'price' => $finalPrice,
            'image' => base64_encode($image),
        ];
    }

    /** Genera etiquetas para varias variantes, omitiendo las que fallen. */
    public function generateBarcodeLabels(array $variantIds): array
    {
        $labels = [];
        foreach ($variantIds as $id) {
            try {
                $labels[] = $this->generateBarcodeLabel((int) $id);
            } catch (RuntimeException) {
                // Variante sin código o inexistente: se omite.
            }
        }

        return $labels;
    }

    /** Genera etiquetas para todas las variantes de un producto. */
    public function generateProductBarcodeLabels(int $productId): array
    {
        $ids = ProductVariant::where('productId', $productId)
            ->whereNotNull('barcode')->where('isActive', true)
            ->pluck('id')->all();

        return $this->generateBarcodeLabels($ids);
    }

    /** Asigna un código de barras a una variante (manual o autogenerado). */
    public function assignBarcodeToVariant(int $variantId, ?string $barcode = null): array
    {
        $variant = ProductVariant::find($variantId);
        if (! $variant) {
            throw new RuntimeException('Variante no encontrada');
        }
        if ($variant->barcode) {
            throw new RuntimeException('La variante ya tiene código de barras asignado');
        }

        if ($barcode) {
            if (ProductVariant::where('barcode', $barcode)->exists()) {
                throw new RuntimeException('El código de barras ya está en uso');
            }
        } else {
            $barcode = $this->variants->generateUniqueBarcode();
            if (! $barcode) {
                throw new RuntimeException('No se pudo generar un código de barras único');
            }
        }

        $variant->barcode = $barcode;
        $variant->save();

        return ['variantId' => $variantId, 'barcode' => $barcode];
    }

    /** Asigna códigos de barras a todas las variantes activas sin código. */
    public function assignBarcodeToAllVariants(): array
    {
        $variants = ProductVariant::whereNull('barcode')->where('isActive', true)->get();
        $result = ['success' => 0, 'failed' => 0, 'errors' => []];

        foreach ($variants as $variant) {
            try {
                $this->assignBarcodeToVariant($variant->id);
                $result['success']++;
            } catch (RuntimeException $e) {
                $result['failed']++;
                $result['errors'][] = ['variantId' => $variant->id, 'error' => $e->getMessage()];
            }
        }

        return $result;
    }

    /** Expande los items {variantId, quantity} a una lista plana de etiquetas. */
    private function expandLabelItems(array $items): array
    {
        $variantIds = array_column($items, 'variantId');
        $variants = ProductVariant::with(['product.productType', 'color', 'size'])
            ->whereIn('id', $variantIds)->get()->keyBy('id');

        $labels = [];
        foreach ($items as $item) {
            $variant = $variants->get($item['variantId']);
            if (! $variant || ! $variant->barcode) {
                continue;
            }
            $finalPrice = (float) $variant->product->basePrice + (float) ($variant->priceAdjustment ?? 0);
            for ($i = 0; $i < (int) $item['quantity']; $i++) {
                $labels[] = ['variant' => $variant, 'finalPrice' => $finalPrice];
            }
        }

        return $labels;
    }

    /** Genera el PDF de etiquetas; usa plantilla personalizada si se indica. */
    public function generateBarcodeLabelsPDF(array $items, ?int $templateId = null): string
    {
        $labels = $this->expandLabelItems($items);
        if (empty($labels)) {
            throw new RuntimeException('No hay variantes con código de barras para imprimir');
        }

        $template = null;
        if ($templateId) {
            $template = LabelTemplate::with(['zones' => fn ($q) => $q->orderBy('zIndex')])->find($templateId);
            if (! $template || $template->zones->isEmpty()) {
                throw new RuntimeException('Plantilla no encontrada o sin zonas definidas');
            }
        }

        // Precalcula la imagen del código de barras (data URI) para cada etiqueta.
        $rendered = [];
        foreach ($labels as $label) {
            $variant = $label['variant'];
            $png = $this->generateBarcodeImage($variant->barcode, ['width' => 2, 'height' => 40]);
            $rendered[] = [
                'variant' => $variant,
                'finalPrice' => $label['finalPrice'],
                'barcodeUri' => 'data:image/png;base64,'.base64_encode($png),
            ];
        }

        $view = $template ? 'pdf.barcode-labels-template' : 'pdf.barcode-labels';
        $pdf = Pdf::loadView($view, [
            'labels' => $rendered,
            'template' => $template,
        ])->setPaper($template?->pageType ?? 'a4');

        return $pdf->output();
    }
}
