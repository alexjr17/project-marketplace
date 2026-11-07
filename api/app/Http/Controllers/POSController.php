<?php

namespace App\Http\Controllers;

use App\Http\Concerns\ApiResponse;
use App\Services\Pos\PosInvoiceService;
use App\Services\Pos\POSService;
use Illuminate\Http\Request;

/**
 * Punto de venta (POS). Valida y responde; las ventas, el stock y los fiados los maneja
 * POSService y el recibo (PDF/correo) PosInvoiceService.
 */
class POSController extends Controller
{
    use ApiResponse;

    public function __construct(
        private POSService $pos,
        private PosInvoiceService $invoices,
    ) {}

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
        $categoryId = $request->query('categoryId') ? (int) $request->query('categoryId') : null;
        $type = in_array($request->query('type'), ['product', 'template'], true) ? $request->query('type') : null;

        return $this->success($this->pos->browseProducts($page, $perPage, $search, $request->user()->id, $categoryId, $type));
    }

    /** GET /api/pos/product/{productId}/variants — variantes para elegir color/talla. */
    public function productVariants(int $productId)
    {
        return $this->success($this->pos->productVariants($productId));
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
            'discount' => 'nullable|numeric|min:0',
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

    /** POST /api/pos/sale/{id}/return — devolución parcial de una venta. */
    public function returnSale(Request $request, int $id)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.variantId' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'reason' => 'nullable|string',
            'refundMethod' => 'nullable|in:cash,transfer',
        ]);

        $isAdmin = ((int) $request->user()->roleId === 1);

        try {
            $sale = $this->pos->returnSaleItems(
                $id, $data['items'], $data['reason'] ?? '',
                $data['refundMethod'] ?? 'cash', $request->user()->id, $isAdmin
            );
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($sale, 'Devolución registrada exitosamente');
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
            'cashAmount' => 'nullable|numeric|min:0',
            'cardAmount' => 'nullable|numeric|min:0',
            'cardReference' => 'nullable|string',
            'cardType' => 'nullable|string',
            'cardLastFour' => 'nullable|string',
        ]);

        $isAdmin = ((int) $request->user()->roleId === 1);

        try {
            $sale = $this->pos->updateSale($id, $data, $request->user()->id, $isAdmin);
        } catch (\RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }

        return $this->success($sale, 'Venta actualizada exitosamente');
    }

    /** GET /api/pos/stats — estadísticas/reportes del POS. */
    public function stats(Request $request)
    {
        $range = (string) $request->query('range', 'today');

        return $this->success($this->pos->posStats($request->user()->id, $range));
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
        $this->invoices->send($order, (string) $email);

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
        [$pdf] = $this->invoices->pdf($order);

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
