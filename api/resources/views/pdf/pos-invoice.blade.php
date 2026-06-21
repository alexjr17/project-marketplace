@php
    // Configuración de impresión (con valores por defecto si no llega $cfg).
    $cfg = $cfg ?? [];
    $thermal = $cfg['thermal'] ?? true;
    $m = $cfg['margins'] ?? ['top' => 5, 'right' => 5, 'bottom' => 10, 'left' => 5];
    $base = $cfg['baseFont'] ?? 12;
    $showLogo = ($cfg['showLogo'] ?? false) && !empty($cfg['logo']);
    $showStoreName = ($cfg['showStoreName'] ?? false) && !empty($cfg['storeName']);
    $showNit = ($cfg['showNit'] ?? false) && !empty($cfg['nit']);
    $codeImg = $cfg['codeImg'] ?? '';
    $address = $cfg['address'] ?? '';
    $phone = $cfg['phone'] ?? '';
@endphp
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Recibo {{ $invoice['orderNumber'] }}</title>
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        @page { margin: {{ $m['top'] }}mm {{ $m['right'] }}mm {{ $m['bottom'] }}mm {{ $m['left'] }}mm; }
        body { font-size: {{ $base }}px; color: #1f2937; margin: 0; padding: 0; }
        .muted { color: #6b7280; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .logo { max-width: {{ $thermal ? '120px' : '160px' }}; max-height: {{ $thermal ? '60px' : '80px' }}; }
        h1 { font-size: {{ $base + ($thermal ? 2 : 8) }}px; margin: 0 0 4px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: {{ $thermal ? '2px 2px' : '6px 8px' }}; text-align: left; vertical-align: top; }

        @if($thermal)
            .header { text-align: center; border-bottom: 1px dashed #111827; padding-bottom: 6px; margin-bottom: 6px; }
            .store { font-size: {{ $base + 2 }}px; font-weight: bold; }
            .items th { border-bottom: 1px solid #111827; font-size: {{ $base - 1 }}px; }
            .items td { font-size: {{ $base - 1 }}px; border-bottom: 1px dotted #d1d5db; }
            .meta { font-size: {{ $base - 1 }}px; margin: 6px 0; }
            .totals { margin-top: 6px; border-top: 1px dashed #111827; padding-top: 4px; }
            .grand td { font-weight: bold; font-size: {{ $base + 1 }}px; }
        @else
            .header { border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
            .store { font-size: {{ $base + 4 }}px; font-weight: bold; }
            .items thead th { background: #111827; color: #fff; font-size: {{ $base - 1 }}px; }
            .items tbody tr { border-bottom: 1px solid #e5e7eb; }
            .meta { margin: 12px 0; }
            .totals { margin-top: 12px; width: 45%; float: right; }
            .grand td { font-weight: bold; font-size: {{ $base + 2 }}px; border-top: 2px solid #111827; }
        @endif
    </style>
</head>
<body>
    <div class="header">
        @if($showLogo)
            <div class="center"><img class="logo" src="{{ $cfg['logo'] }}" alt="logo"></div>
        @endif
        @if($showStoreName)
            <div class="store {{ $thermal ? 'center' : '' }}">{{ $cfg['storeName'] }}</div>
        @endif
        @if($showNit)
            <div class="muted {{ $thermal ? 'center' : '' }}">NIT: {{ $cfg['nit'] }}</div>
        @endif
        @if($address)
            <div class="muted {{ $thermal ? 'center' : '' }}">{{ $address }}</div>
        @endif
        @if($phone)
            <div class="muted {{ $thermal ? 'center' : '' }}">Tel: {{ $phone }}</div>
        @endif

        @unless($thermal)<h1>Recibo de Venta</h1>@endunless
        <div class="muted {{ $thermal ? 'center' : '' }}">N.º {{ $invoice['orderNumber'] }}</div>
        <div class="muted {{ $thermal ? 'center' : '' }}">{{ \Illuminate\Support\Carbon::parse($invoice['date'])->format('d/m/Y H:i') }}</div>
    </div>

    <div class="meta">
        <strong>Cliente:</strong> {{ $invoice['customerName'] }}<br>
        @if($invoice['customerEmail'])<strong>Email:</strong> {{ $invoice['customerEmail'] }}<br>@endif
        <strong>Vendedor:</strong> {{ $invoice['sellerName'] }}<br>
        <strong>Pago:</strong> {{ $invoice['paymentMethod'] }}
    </div>

    <table class="items">
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

    @if($codeImg)
        <div class="center" style="clear: both; margin-top: {{ $thermal ? '8px' : '24px' }};">
            <img src="{{ $codeImg }}" alt="código" style="height: {{ $thermal ? '40px' : '50px' }};"><br>
            <span class="muted" style="font-size: {{ $base - 2 }}px;">{{ $invoice['orderNumber'] }}</span>
        </div>
    @endif

    @if($thermal)
        <div class="center muted" style="clear: both; margin-top: 8px; font-size: {{ $base - 2 }}px;">¡Gracias por su compra!</div>
    @endif
</body>
</html>
