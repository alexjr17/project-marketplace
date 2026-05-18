<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 28px; }
        * { font-family: DejaVu Sans, sans-serif; }
        body { margin: 0; }
        .label {
            display: inline-block;
            width: 102px;
            height: 188px;
            vertical-align: top;
            text-align: center;
            padding: 4px 3px;
            margin: 0 4px 8px 0;
            box-sizing: border-box;
            overflow: hidden;
        }
        .name { font-size: 7px; font-weight: bold; line-height: 1.1; height: 24px; overflow: hidden; }
        .size { font-size: 7px; margin-top: 2px; }
        .barcode { margin-top: 4px; }
        .barcode img { width: 92px; height: 42px; }
        .code { font-size: 6px; margin-top: 1px; }
        .sku { font-size: 5px; margin-top: 2px; color: #333; }
        .price { font-size: 12px; font-weight: bold; margin-top: 3px; }
    </style>
</head>
<body>
    @foreach ($labels as $label)
        @php($v = $label['variant'])
        <div class="label">
            <div class="name">{{ $v->product->name }}</div>
            <div class="size">Talla: {{ $v->size->name ?? $v->size->abbreviation ?? 'Única' }}</div>
            <div class="barcode"><img src="{{ $label['barcodeUri'] }}" alt="barcode"></div>
            <div class="code">{{ $v->barcode }}</div>
            <div class="sku">SKU: {{ $v->sku }}</div>
            <div class="price">${{ number_format($label['finalPrice'], 0, ',', '.') }}</div>
        </div>
    @endforeach
</body>
</html>
