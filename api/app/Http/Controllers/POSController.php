<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Models\Setting;
use App\Services\POSService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class POSController extends Controller
{
    use ApiResponse;

    public function __construct(private POSService $pos) {}

    /** Etiquetas legibles de método de pago para la factura. */
    private const PAYMENT_LABELS = [
        'cash' => 'Efectivo',
        'card' => 'Tarjeta',
        'mixed' => 'Mixto (Efectivo + Tarjeta)',
        'transfer' => 'Transferencia',
        'debe' => 'Debe (fiado)',
    ];

    /** POST /api/pos/scan */
    public function scan(Request $request)
    {
        $barcode = trim((string) $request->input('barcode'));
        if ($barcode === '') {
            return $this->error('El código de barras es requerido', 400);
        }

        try {
            $product = $this->pos->scanProduct($barcode);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        if (! $product) {
            return $this->error('Producto no encontrado', 404);
        }

        return $this->success($product);
    }

    /** POST /api/pos/search */
    public function search(Request $request)
    {
        $query = $request->input('query');
        if (! is_string($query) || trim($query) === '') {
            return $this->error('El parámetro query es requerido', 400);
        }

        try {
            return $this->success($this->pos->search($query, $request->user()->id));
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }
    }

    /** GET /api/pos/products — lista paginada de productos para el POS. */
    public function products(Request $request)
    {
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(50, max(1, (int) $request->query('perPage', 12)));
        $search = $request->query('search');

        return $this->success($this->pos->browseProducts($page, $perPage, $search, $request->user()->id));
    }

    /** POST /api/pos/calculate */
    public function calculate(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.discount' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
        ]);

        try {
            return $this->success($this->pos->calculateSale($data['items'], (float) ($data['discount'] ?? 0)));
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }
    }

    /** POST /api/pos/sale */
    public function createSale(Request $request)
    {
        $data = $request->validate([
            'cashRegisterId' => 'required|integer',
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.price' => 'required|numeric|min:0',
            'items.*.discount' => 'nullable|numeric|min:0',
            'customerId' => 'nullable|integer',
            'customerName' => 'nullable|string',
            'customerEmail' => 'nullable|string',
            'customerPhone' => 'nullable|string',
            'customerCedula' => 'nullable|string',
            'paymentMethod' => 'required|in:cash,card,transfer,mixed,debe',
            'cashAmount' => 'nullable|numeric',
            'cardAmount' => 'nullable|numeric',
            'cardReference' => 'nullable|string',
            'cardType' => 'nullable|string',
            'cardLastFour' => 'nullable|string',
            'discount' => 'nullable|numeric',
            'notes' => 'nullable|string',
        ]);
        $data['sellerId'] = $request->user()->id;

        try {
            $sale = $this->pos->createSale($data);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->created($sale, 'Venta creada exitosamente');
    }

    /** POST /api/pos/sale/{id}/cancel */
    public function cancelSale(Request $request, int $id)
    {
        $reason = $request->input('reason');
        if (! $reason) {
            return $this->error('El motivo de cancelación es requerido', 400);
        }

        $isAdmin = ((int) $request->user()->roleId === 1);

        try {
            $sale = $this->pos->cancelSale($id, $request->user()->id, $reason, $isAdmin);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($sale, 'Venta anulada exitosamente');
    }

    /** PUT /api/pos/sale/{id} — editar una venta. */
    public function updateSale(Request $request, int $id)
    {
        $data = $request->validate([
            'items' => 'nullable|array',
            'items.*.variantId' => 'required_with:items|integer',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.price' => 'required_with:items|numeric|min:0',
            'customerId' => 'nullable|integer',
            'customerName' => 'nullable|string',
            'customerPhone' => 'nullable|string',
            'customerEmail' => 'nullable|string',
            'customerCedula' => 'nullable|string',
            'paymentMethod' => 'nullable|in:cash,card,transfer,mixed,debe',
            'discount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $isAdmin = ((int) $request->user()->roleId === 1);

        try {
            $sale = $this->pos->updateSale($id, $data, $request->user()->id, $isAdmin);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($sale, 'Venta actualizada exitosamente');
    }

    /** GET /api/pos/sales */
    public function salesHistory(Request $request)
    {
        $sales = $this->pos->salesHistory([
            'sellerId' => $request->user()->id,
            'cashRegisterId' => $request->query('cashRegisterId'),
            'dateFrom' => $request->query('dateFrom'),
            'dateTo' => $request->query('dateTo'),
            'status' => $request->query('status'),
        ]);

        return $this->success($sales);
    }

    /** GET /api/pos/sale/{id} */
    public function saleDetail(int $id)
    {
        $sale = $this->pos->saleById($id);
        if (! $sale) {
            return $this->error('Venta no encontrada', 404);
        }

        return $this->success($sale);
    }

    /** GET /api/pos/customer/search */
    public function customerSearch(Request $request)
    {
        // Búsqueda por nombre/cédula/teléfono (autocompletar): ?q=...
        $q = $request->query('q');
        if (is_string($q) && $q !== '') {
            return $this->success($this->pos->searchCustomers($q));
        }

        // Compatibilidad: búsqueda exacta por cédula (?cedula=...).
        $cedula = $request->query('cedula');
        if (! is_string($cedula) || $cedula === '') {
            return $this->error('La cédula o el término de búsqueda es requerido', 400);
        }

        return $this->success($this->pos->customerByCedula($cedula));
    }

    /** GET /api/pos/debts — fiados pendientes de cobro. */
    public function debts()
    {
        return $this->success($this->pos->pendingDebts());
    }

    /** POST /api/pos/sale/{id}/collect — cobrar un fiado. */
    public function collectDebt(Request $request, int $id)
    {
        $data = $request->validate([
            'paymentMethod' => 'required|in:cash,card,transfer',
            'amount' => 'nullable|numeric|min:0',
        ]);

        try {
            $order = $this->pos->collectDebt($id, $data['paymentMethod'], $request->user()->id, $data['amount'] ?? null);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($order, 'Abono registrado exitosamente');
    }

    /** GET /api/pos/customers — lista de clientes con su deuda. */
    public function customers(Request $request)
    {
        return $this->success($this->pos->listCustomers($request->query('q')));
    }

    /** GET /api/pos/customers/{id} — detalle del cliente con su historial. */
    public function customerDetail(int $id)
    {
        $data = $this->pos->customerDetail($id);
        if (! $data) {
            return $this->error('Cliente no encontrado', 404);
        }

        return $this->success($data);
    }

    /** Arma los datos de la factura a partir de la orden. */
    private function invoiceData($order): array
    {
        return [
            'orderNumber' => $order->orderNumber,
            'customerName' => $order->customerName ?: ($order->user->name ?? 'Cliente'),
            'customerEmail' => $order->customerEmail ?: '',
            'date' => $order->createdAt,
            'items' => $order->items->map(function ($item) {
                $name = $item->variant
                    ? $item->variant->product->name.' ('
                        .($item->variant->color->name ?? '').' - '
                        .($item->variant->size->abbreviation ?? $item->variant->size->name ?? '').')'
                    : $item->productName;

                return [
                    'name' => $name,
                    'quantity' => $item->quantity,
                    'unitPrice' => (float) $item->unitPrice,
                    'subtotal' => (float) $item->unitPrice * $item->quantity,
                ];
            })->all(),
            'subtotal' => (float) $order->subtotal,
            'discount' => (float) ($order->discount ?? 0),
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
     * Configuración de impresión del recibo a partir de las settings guardadas
     * (Configuración → Impresión + datos generales de la empresa).
     */
    private function printConfig(): array
    {
        $printing = $this->readSettingValue('printing_settings');
        $general = $this->readSettingValue('general_settings');
        $fiscal = is_array($general['fiscal'] ?? null) ? $general['fiscal'] : [];

        $width = (float) ($printing['ticketWidth'] ?? 80);
        $height = (float) ($printing['ticketHeight'] ?? 0); // 0 = continuo (térmico)
        $thermal = $width <= 80;

        $margins = is_array($printing['ticketMargins'] ?? null)
            ? $printing['ticketMargins']
            : ['top' => 5, 'right' => 5, 'bottom' => 10, 'left' => 5];

        $fontMap = ['small' => 10, 'medium' => 12, 'large' => 14];
        $baseFont = $fontMap[$printing['fontSize'] ?? 'medium'] ?? 12;

        return [
            'width' => $width,
            'height' => $height,
            'thermal' => $thermal,
            'margins' => [
                'top' => (float) ($margins['top'] ?? 5),
                'right' => (float) ($margins['right'] ?? 5),
                'bottom' => (float) ($margins['bottom'] ?? 10),
                'left' => (float) ($margins['left'] ?? 5),
            ],
            'baseFont' => $baseFont,
            'showLogo' => (bool) ($printing['showLogo'] ?? true),
            'showStoreName' => (bool) ($printing['showStoreName'] ?? true),
            'showNit' => (bool) ($printing['showNit'] ?? true),
            'showQR' => (bool) ($printing['showQR'] ?? false),
            'logo' => $printing['ticketLogo'] ?: ($general['logo'] ?? ''),
            'storeName' => $general['siteName'] ?? '',
            'nit' => $fiscal['nit'] ?? '',
            'address' => $general['address'] ?? '',
            'phone' => $general['contactPhone'] ?? '',
        ];
    }

    private function readSettingValue(string $key): array
    {
        $setting = Setting::where('key', $key)->first();

        return is_array($setting?->value) ? $setting->value : [];
    }

    /** Genera el PDF del recibo aplicando el formato de papel configurado. */
    private function buildInvoicePdf(array $invoiceData, array $cfg)
    {
        // Código escaneable del recibo (Code128) si está activado en la config.
        $cfg['codeImg'] = '';
        if ($cfg['showQR']) {
            try {
                $generator = new \Picqer\Barcode\BarcodeGeneratorPNG();
                $png = $generator->getBarcode((string) $invoiceData['orderNumber'], $generator::TYPE_CODE_128, 2, 50);
                $cfg['codeImg'] = 'data:image/png;base64,'.base64_encode($png);
            } catch (\Throwable $e) {
                $cfg['codeImg'] = '';
            }
        }

        $pdf = Pdf::loadView('pdf.pos-invoice', ['invoice' => $invoiceData, 'cfg' => $cfg]);

        $mmToPt = 2.834645669;
        $wPt = $cfg['width'] * $mmToPt;
        if ($cfg['height'] > 0) {
            $hPt = $cfg['height'] * $mmToPt;
        } else {
            // Térmico continuo: estimar alto según contenido para no dejar
            // una hoja enorme en blanco.
            $lines = count($invoiceData['items']);
            $mm = 70 + ($lines * 7) + (! empty($invoiceData['isCredit']) ? 14 : 0)
                + ($cfg['showLogo'] && $cfg['logo'] ? 20 : 0)
                + ($cfg['showQR'] ? 22 : 0);
            $hPt = max(180, $mm) * $mmToPt;
        }

        return $pdf->setPaper([0, 0, $wPt, $hPt]);
    }

    /** POST /api/pos/sale/{id}/send-invoice */
    public function sendInvoice(Request $request, int $id)
    {
        $email = $request->input('email');
        if (! $email) {
            return $this->error('El email es requerido', 400);
        }

        try {
            $order = $this->pos->saleForInvoice($id);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        $data = $this->invoiceData($order);
        $pdf = $this->buildInvoicePdf($data, $this->printConfig());

        try {
            Mail::send('emails.pos-invoice', ['invoice' => $data], function ($message) use ($email, $data, $pdf) {
                $message->to($email)
                    ->subject('Recibo '.$data['orderNumber'])
                    ->attachData($pdf->output(), 'Recibo_'.$data['orderNumber'].'.pdf', [
                        'mime' => 'application/pdf',
                    ]);
            });
        } catch (\Throwable $e) {
            return $this->error('Error al enviar el email: '.$e->getMessage(), 400);
        }

        if (! $order->customerEmail) {
            $order->customerEmail = $email;
            $order->save();
        }

        return $this->success(null, 'Recibo enviado correctamente');
    }

    /** GET /api/pos/sale/{id}/invoice-pdf */
    public function invoicePdf(int $id)
    {
        try {
            $order = $this->pos->saleForInvoice($id);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        $pdf = $this->buildInvoicePdf($this->invoiceData($order), $this->printConfig());

        return $pdf->stream('Recibo_'.$order->orderNumber.'.pdf');
    }

    /** POST /api/pos/sale/{id}/payment-evidence */
    public function uploadPaymentEvidence(Request $request, int $id)
    {
        $evidence = $request->input('evidence');
        if (! $evidence) {
            return $this->error('La evidencia de pago es requerida', 400);
        }

        try {
            $sale = $this->pos->uploadPaymentEvidence($id, $evidence, $request->user()->id);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($sale, 'Evidencia de pago subida exitosamente');
    }

    /** GET /api/pos/sale/{id}/payment-evidence */
    public function getPaymentEvidence(int $id)
    {
        return $this->success(['evidence' => $this->pos->paymentEvidence($id)]);
    }
}
