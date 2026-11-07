<?php

namespace App\Services\Pos;

use App\Exceptions\BusinessRuleException;
use App\Models\Order;
use App\Models\Product;
use App\Models\Setting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Mail;
use Picqer\Barcode\BarcodeGeneratorPNG;

/**
 * Recibo de una venta POS: datos de la factura, formato de impresión (Configuración →
 * Impresión + datos de la empresa), PDF y envío por correo.
 */
class PosInvoiceService
{
    /** Etiquetas legibles de método de pago para la factura. */
    private const PAYMENT_LABELS = [
        'cash' => 'Efectivo',
        'card' => 'Tarjeta',
        'mixed' => 'Mixto (Efectivo + Tarjeta)',
        'transfer' => 'Transferencia',
        'debe' => 'Debe (fiado)',
    ];

    /** PDF del recibo de la venta (con los datos ya armados). @return array{0: \Barryvdh\DomPDF\PDF, 1: array} */
    public function pdf(Order $order): array
    {
        $data = $this->invoiceData($order);

        return [$this->buildPdf($data, $this->printConfig()), $data];
    }

    /** Envía el recibo en PDF al correo y lo guarda como correo del cliente si no tenía. */
    public function send(Order $order, string $email): void
    {
        [$pdf, $data] = $this->pdf($order);

        try {
            Mail::send('emails.pos-invoice', ['invoice' => $data], function ($message) use ($email, $data, $pdf) {
                $message->to($email)
                    ->subject('Recibo '.$data['orderNumber'])
                    ->attachData($pdf->output(), 'Recibo_'.$data['orderNumber'].'.pdf', [
                        'mime' => 'application/pdf',
                    ]);
            });
        } catch (\Throwable $e) {
            throw new BusinessRuleException('Error al enviar el email: '.$e->getMessage(), 400);
        }

        if (! $order->customerEmail) {
            $order->customerEmail = $email;
            $order->save();
        }
    }

    /** Arma los datos de la factura a partir de la orden. */
    public function invoiceData(Order $order): array
    {
        $baseOf = function ($item): float {
            $base = $item->variant?->product?->basePrice ?? optional(Product::find($item->productId))->basePrice;

            return (float) ($base ?? $item->unitPrice);
        };

        return [
            'orderNumber' => $order->orderNumber,
            'customerName' => $order->customerName ?: ($order->user->name ?? 'Cliente'),
            'customerEmail' => $order->customerEmail ?: '',
            'date' => $order->createdAt,
            'items' => $order->items->map(function ($item) use ($baseOf) {
                $name = $item->variant
                    ? $item->variant->product->name.' ('
                        .($item->variant->color->name ?? '').' - '
                        .($item->variant->size->abbreviation ?? $item->variant->size->name ?? '').')'
                    : $item->productName;

                // Precio original del producto para mostrar el ahorro por oferta.
                $base = $baseOf($item);
                $unit = (float) $item->unitPrice;

                return [
                    'name' => $name,
                    'quantity' => $item->quantity,
                    'unitPrice' => $unit,
                    'basePrice' => $base,
                    'hasDiscount' => $base > $unit,
                    'saved' => $base > $unit ? ($base - $unit) * $item->quantity : 0,
                    'subtotal' => $unit * $item->quantity,
                ];
            })->all(),
            'subtotal' => (float) $order->subtotal,
            'discount' => (float) ($order->discount ?? 0),
            'savings' => (float) $order->items->sum(function ($item) use ($baseOf) {
                $base = $baseOf($item);

                return $base > (float) $item->unitPrice ? ($base - (float) $item->unitPrice) * $item->quantity : 0;
            }),
            'tax' => (float) ($order->tax ?? 0),
            'total' => (float) $order->total,
            'paymentMethod' => self::PAYMENT_LABELS[$order->paymentMethod ?? 'cash'] ?? 'Efectivo',
            'isCredit' => ($order->paymentMethod === 'debe'),
            'paid' => (float) ($order->cashAmount ?? 0) + (float) ($order->cardAmount ?? 0),
            'remaining' => max(0, (float) $order->total - ((float) ($order->cashAmount ?? 0) + (float) ($order->cardAmount ?? 0))),
            'sellerName' => $order->seller->name ?? 'Vendedor',
        ];
    }

    /**
     * Formato de impresión del recibo. Sin la configuración de impresión guardada se usan los
     * valores por defecto (antes leía ticketLogo sin valor por defecto y el recibo daba 500).
     */
    public function printConfig(): array
    {
        $printing = $this->settingValue('printing_settings');
        $general = $this->settingValue('general_settings');
        $fiscal = is_array($general['fiscal'] ?? null) ? $general['fiscal'] : [];

        $width = (float) ($printing['ticketWidth'] ?? 80);
        $height = (float) ($printing['ticketHeight'] ?? 0); // 0 = continuo (térmico)

        $margins = is_array($printing['ticketMargins'] ?? null)
            ? $printing['ticketMargins']
            : ['top' => 5, 'right' => 5, 'bottom' => 10, 'left' => 5];

        $fontMap = ['small' => 10, 'medium' => 12, 'large' => 14];

        return [
            'width' => $width,
            'height' => $height,
            'thermal' => $width <= 80,
            'margins' => [
                'top' => (float) ($margins['top'] ?? 5),
                'right' => (float) ($margins['right'] ?? 5),
                'bottom' => (float) ($margins['bottom'] ?? 10),
                'left' => (float) ($margins['left'] ?? 5),
            ],
            'baseFont' => $fontMap[$printing['fontSize'] ?? 'medium'] ?? 12,
            'showLogo' => (bool) ($printing['showLogo'] ?? true),
            'showStoreName' => (bool) ($printing['showStoreName'] ?? true),
            'showNit' => (bool) ($printing['showNit'] ?? true),
            'showQR' => (bool) ($printing['showQR'] ?? false),
            'logo' => ($printing['ticketLogo'] ?? '') ?: ($general['logo'] ?? ''),
            'storeName' => $general['siteName'] ?? '',
            'nit' => $fiscal['nit'] ?? '',
            'address' => $general['address'] ?? '',
            'phone' => $general['contactPhone'] ?? '',
        ];
    }

    private function settingValue(string $key): array
    {
        $setting = Setting::where('key', $key)->first();

        return is_array($setting?->value) ? $setting->value : [];
    }

    /** Genera el PDF del recibo aplicando el formato de papel configurado. */
    private function buildPdf(array $invoiceData, array $cfg)
    {
        // Código escaneable del recibo (Code128) si está activado en la config.
        $cfg['codeImg'] = '';
        if ($cfg['showQR']) {
            try {
                $generator = new BarcodeGeneratorPNG;
                $png = $generator->getBarcode((string) $invoiceData['orderNumber'], $generator::TYPE_CODE_128, 2, 50);
                $cfg['codeImg'] = 'data:image/png;base64,'.base64_encode($png);
            } catch (\Throwable) {
                $cfg['codeImg'] = '';
            }
        }

        $pdf = Pdf::loadView('pdf.pos-invoice', ['invoice' => $invoiceData, 'cfg' => $cfg]);

        $mmToPt = 2.834645669;
        $wPt = $cfg['width'] * $mmToPt;
        if ($cfg['height'] > 0) {
            $hPt = $cfg['height'] * $mmToPt;
        } else {
            // Térmico continuo: estimar alto según contenido para no dejar una hoja en blanco.
            $lines = count($invoiceData['items']);
            $mm = 70 + ($lines * 7) + (! empty($invoiceData['isCredit']) ? 14 : 0)
                + ($cfg['showLogo'] && $cfg['logo'] ? 20 : 0)
                + ($cfg['showQR'] ? 22 : 0);
            $hPt = max(180, $mm) * $mmToPt;
        }

        return $pdf->setPaper([0, 0, $wPt, $hPt]);
    }
}
