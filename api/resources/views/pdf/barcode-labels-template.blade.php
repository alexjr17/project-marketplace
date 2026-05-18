<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        @php($margin = $template->pageMargin ?? 20)
        @php($spacing = $template->labelSpacing ?? 5.67)
        @page { margin: {{ $margin }}pt; }
        * { font-family: DejaVu Sans, sans-serif; }
        body { margin: 0; }
        .label {
            position: relative;
            display: inline-block;
            vertical-align: top;
            width: {{ $template->width }}pt;
            height: {{ $template->height }}pt;
            margin: 0 {{ $spacing }}pt {{ $spacing }}pt 0;
            overflow: hidden;
        }
        .label .bg {
            position: absolute; top: 0; left: 0;
            width: {{ $template->width }}pt;
            height: {{ $template->height }}pt;
        }
        .zone { position: absolute; overflow: hidden; }
        .zone img { width: 100%; height: 100%; }
    </style>
</head>
<body>
    @foreach ($labels as $label)
        @php($v = $label['variant'])
        <div class="label">
            @if ($template->backgroundImage)
                <img class="bg" src="{{ $template->backgroundImage }}" alt="bg">
            @endif
            @foreach ($template->zones as $zone)
                @php($showLabel = $zone->showLabel !== false)
                @php($content = match ($zone->zoneType) {
                    'PRODUCT_NAME' => $v->product->name,
                    'SIZE' => ($showLabel ? 'Talla: ' : '').($v->size->abbreviation ?? $v->size->name ?? 'Única'),
                    'COLOR' => ($showLabel ? 'Color: ' : '').($v->color->name ?? 'N/A'),
                    'BARCODE_TEXT' => $v->barcode,
                    'SKU' => ($showLabel ? 'SKU: ' : '').$v->sku,
                    'PRICE' => '$'.number_format($label['finalPrice'], 0, ',', '.'),
                    default => '',
                })
                <div class="zone" style="
                    left: {{ $zone->x }}pt; top: {{ $zone->y }}pt;
                    width: {{ $zone->width }}pt; height: {{ $zone->height }}pt;
                    font-size: {{ $zone->fontSize }}pt;
                    font-weight: {{ $zone->fontWeight === 'bold' ? 'bold' : 'normal' }};
                    text-align: {{ $zone->textAlign ?? 'center' }};
                    color: {{ $zone->fontColor ?? '#000000' }};">
                    @if ($zone->zoneType === 'BARCODE')
                        <img src="{{ $label['barcodeUri'] }}" alt="barcode">
                    @else
                        {{ $content }}
                    @endif
                </div>
            @endforeach
        </div>
    @endforeach
</body>
</html>
