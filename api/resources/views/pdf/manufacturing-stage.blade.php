@php
    $external = ($stage->process->type ?? null) === 'EXTERNAL';
    $title = $external ? 'SOLICITUD DE SERVICIO EXTERNO' : 'REPORTE DE PRODUCCIÓN';
    $today = \Carbon\CarbonImmutable::now()->locale('es')->isoFormat('D [de] MMMM [de] YYYY');
    $ref = $order->reference;
    $refLabel = $ref ? ($ref->code.' · '.$ref->name) : '—';

    // Matriz de la etapa: completadas si hay, si no la programada (cascada).
    $src = ($stage->cells && count($stage->cells))
        ? $stage->cells->map(fn ($c) => ['colorId' => $c->colorId, 'sizeId' => $c->sizeId, 'quantity' => (int) $c->quantity])->values()->all()
        : ($stage->programmed ?? []);
    $stageTotal = collect($src)->sum('quantity');

    $sizes = [];
    $colors = [];
    foreach ($order->items as $it) {
        if ($it->size) {
            $sizes[$it->sizeId] = ['abbr' => $it->size->abbreviation, 'sort' => (int) ($it->size->sortOrder ?? 0)];
        }
        if ($it->color) {
            $colors[$it->colorId] = $it->color->name;
        }
    }
    uasort($sizes, fn ($a, $b) => $a['sort'] <=> $b['sort']);

    $cell = [];
    foreach ($src as $c) {
        $cell[$c['sizeId'].'-'.$c['colorId']] = (int) $c['quantity'];
    }

    $matrix = '';
    if ($colors) {
        $head = '<tr><th class="l">Talla \ Color</th>';
        foreach ($colors as $n) {
            $head .= '<th>'.e($n).'</th>';
        }
        $head .= '</tr>';
        $body = '';
        foreach ($sizes as $sid => $s) {
            $tds = '';
            foreach ($colors as $cid => $n) {
                $tds .= '<td>'.($cell[$sid.'-'.$cid] ?? '').'</td>';
            }
            $body .= '<tr><td class="l">'.e($s['abbr']).'</td>'.$tds.'</tr>';
        }
        $matrix = '<table><thead>'.$head.'</thead><tbody>'.$body.'</tbody></table>';
    }

    // Consumo de insumos (esperado → real) con costos.
    $fmt = fn ($n, int $dec) => number_format(round((float) $n, $dec), $dec, '.', '');
    $fmtCost = fn ($n) => number_format(round((float) $n), 0, ',', '.');
    $cons = '';
    $costExp = 0;
    $costReal = 0;
    if ($includeInputs && $stage->consumptions && count($stage->consumptions)) {
        foreach ($stage->consumptions as $c) {
            $exp = (float) $c->expectedQty;
            $real = (float) $c->realQty;
            $uv = (float) ($c->unitValue ?? 0);
            $diff = $real - $exp;
            $costExp += $exp * $uv;
            $costReal += $real * $uv;
            $name = $c->input->name ?? '—';
            if ($c->color) {
                $name .= ' · '.$c->color->name;
            }
            $um = $c->input->unitOfMeasure ?? '';
            $cons .= '<tr><td class="l">'.e($name).'</td><td>'.e($fmt($exp, 4).' '.$um).'</td><td>'.e($fmt($real, 4).' '.$um).'</td><td>'.e(($diff > 0 ? '+' : '').$fmt($diff, 4)).'</td></tr>';
        }
        $over = $costReal - $costExp;
        $cons .= '<tr class="tot"><td class="l">Costo insumos</td><td>$'.$fmtCost($costExp).'</td><td>$'.$fmtCost($costReal).'</td><td>'.e(($over > 0 ? '+' : '').'$'.$fmtCost($over)).'</td></tr>';
        $cons = '<h2>Consumo de insumos (esperado → real)</h2><table><thead><tr><th class="l">Insumo</th><th>Esperado</th><th>Real</th><th>Diferencia</th></tr></thead><tbody>'.$cons.'</tbody></table>';
    }

    // Etapa externa con componentes → una sección por componente (cada uno con su taller).
    // Si se pide un componente puntual, solo se muestra ese.
    $comps = $ref && $ref->components ? $ref->components : collect();
    if ($componentId) {
        $comps = $comps->filter(fn ($c) => (int) $c->id === (int) $componentId)->values();
    }
    $hasComponents = $external && count($comps);
    $wsByComp = [];
    if ($stage->stageComponents) {
        foreach ($stage->stageComponents as $sc) {
            $wsByComp[$sc->componentId] = $sc->workshop->name ?? null;
        }
    }
    $compSections = '';
    if ($hasComponents) {
        foreach ($comps as $comp) {
            $cm = $ref->materials ? $ref->materials->where('componentId', $comp->id) : collect();
            $insRows = '';
            if ($includeInputs) {
                foreach ($cm as $m) {
                    $exp = (float) $m->consumption * $stageTotal;
                    $insRows .= '<tr><td class="l">'.e(($m->input->name ?? '—').($m->color ? ' · '.$m->color->name : '')).'</td><td>'.e($fmt($exp, 4).' '.($m->input->unitOfMeasure ?? '')).'</td></tr>';
                }
            }
            $compLabel = $comp->position === 'SUPERIOR' ? 'Superior' : ($comp->position === 'INFERIOR' ? 'Inferior' : ($comp->position ?? ''));
            $compSections .= '<h2>Componente: '.e($compLabel.($comp->description ? ' · '.$comp->description : '')).'</h2>'
                .'<div class="box"><table class="info"><tr>'
                .'<td><b>Taller</b>'.e($wsByComp[$comp->id] ?? 'Por asignar').'</td>'
                .'<td><b>Cantidad</b>'.$stageTotal.' und</td>'
                .'</tr></table></div>';
            $compSections .= $insRows
                ? '<table><thead><tr><th class="l">Insumo del componente</th><th>Esperado</th></tr></thead><tbody>'.$insRows.'</tbody></table>'
                : '<p class="muted">Sin insumos asignados a este componente.</p>';
        }
    }
@endphp
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{{ $title }}</title>
<style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; }
    h1 { font-size: 18px; margin: 0; }
    .muted { color: #666; }
    .head { width: 100%; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 14px; }
    .brand { font-weight: 800; font-size: 16px; }
    .box { border: 1px solid #ccc; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; }
    .box table.info { border-collapse: collapse; width: 100%; }
    .box table.info td { border: none; padding: 2px 16px 2px 0; vertical-align: top; font-size: 11px; }
    .box b { display: block; font-size: 10px; color: #666; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
    th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: center; }
    th { background: #f1f1f1; }
    td.l, th.l { text-align: left; }
    .tot { font-weight: 700; background: #fafafa; }
    h2 { font-size: 13px; margin: 16px 0 6px; border-left: 4px solid #f97316; padding-left: 8px; }
</style>
</head>
<body>
<table class="head"><tr>
    <td><div class="brand">Fábrica</div><div class="muted">Producción</div></td>
    <td align="right"><h1>{{ $title }}</h1><div class="muted">{{ $order->code }} · {{ $today }}</div></td>
</tr></table>

<div class="box">
    <table class="info"><tr>
        <td><b>Proceso</b>{{ ($stage->process->name ?? '—').($external ? ' (externo)' : ' (interno)') }}</td>
        <td><b>Referencia</b>{{ $refLabel }}</td>
        @if ($external && ! $hasComponents)
            <td><b>Taller</b>{{ $stage->workshop->name ?? 'Por asignar' }}</td>
        @endif
        <td><b>Encargado</b>{{ $stage->assignee ?? '—' }}</td>
        <td><b>Fecha</b>{{ $today }}</td>
    </tr></table>
</div>

<h2>Cantidades</h2>
{!! $matrix ?: '<p class="muted">Sin matriz.</p>' !!}
{!! $cons !!}
{!! $compSections !!}
</body>
</html>
