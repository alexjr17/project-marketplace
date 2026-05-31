<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Factura {{ $invoice['orderNumber'] }}</title>
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { font-size: 12px; color: #1f2937; margin: 0; padding: 24px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .muted { color: #6b7280; }
        .header { border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { padding: 6px 8px; text-align: left; }
        thead th { background: #111827; color: #fff; font-size: 11px; }
        tbody tr { border-bottom: 1px solid #e5e7eb; }
        .right { text-align: right; }
        .totals { margin-top: 12px; width: 40%; float: right; }
        .totals td { padding: 4px 8px; }
        .grand { font-weight: bold; font-size: 14px; border-top: 2px solid #111827; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Factura de Venta</h1>
        <div class="muted">N.º {{ $invoice['orderNumber'] }}</div>
        <div class="muted">Fecha: {{ \Illuminate\Support\Carbon::parse($invoice['date'])->format('d/m/Y H:i') }}</div>
    </div>

    <p>
        <strong>Cliente:</strong> {{ $invoice['customerName'] }}<br>
        @if($invoice['customerEmail'])<strong>Email:</strong> {{ $invoice['customerEmail'] }}<br>@endif
        <strong>Vendedor:</strong> {{ $invoice['sellerName'] }}<br>
        <strong>Método de pago:</strong> {{ $invoice['paymentMethod'] }}
    </p>

    <table>
        <thead>
            <tr>
                <th>Producto</th>
                <th class="right">Cant.</th>
                <th class="right">Precio</th>
                <th class="right">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            @foreach($invoice['items'] as $item)
                <tr>
                    <td>{{ $item['name'] }}</td>
                    <td class="right">{{ $item['quantity'] }}</td>
                    <td class="right">${{ number_format($item['unitPrice'], 0, ',', '.') }}</td>
                    <td class="right">${{ number_format($item['subtotal'], 0, ',', '.') }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals">
        <tr><td>Subtotal</td><td class="right">${{ number_format($invoice['subtotal'], 0, ',', '.') }}</td></tr>
        @if($invoice['discount'] > 0)
            <tr><td>Descuento</td><td class="right">-${{ number_format($invoice['discount'], 0, ',', '.') }}</td></tr>
        @endif
        @if($invoice['tax'] > 0)
            <tr><td>Impuesto</td><td class="right">${{ number_format($invoice['tax'], 0, ',', '.') }}</td></tr>
        @endif
        <tr class="grand"><td>Total</td><td class="right">${{ number_format($invoice['total'], 0, ',', '.') }}</td></tr>
        @if(!empty($invoice['isCredit']))
            @if($invoice['paid'] > 0)
                <tr><td>Abonado</td><td class="right">${{ number_format($invoice['paid'], 0, ',', '.') }}</td></tr>
            @endif
            <tr class="grand"><td>Saldo (debe)</td><td class="right">${{ number_format($invoice['remaining'], 0, ',', '.') }}</td></tr>
        @endif
    </table>
</body>
</html>
