import type { MfgProductionOrder, MfgProductionOrderStage } from '../../types/manufacturing';

const STAGE_LABEL: Record<string, string> = { PENDING: 'Pendiente', IN_PROCESS: 'En proceso', COMPLETED: 'Completada', SKIPPED: 'Omitida' };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const today = () => new Date().toLocaleDateString('es-CO', { dateStyle: 'long' });

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
  h1 { font-size: 18px; margin: 0; }
  .muted { color: #666; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:14px; }
  .brand { font-weight:800; font-size:16px; }
  .box { border:1px solid #ccc; border-radius:6px; padding:10px 12px; margin-bottom:12px; }
  .row { display:flex; flex-wrap:wrap; gap:18px; }
  .row div b { display:block; font-size:10px; color:#666; text-transform:uppercase; }
  table { width:100%; border-collapse:collapse; margin:8px 0 14px; }
  th, td { border:1px solid #bbb; padding:5px 7px; text-align:center; }
  th { background:#f1f1f1; }
  td.l, th.l { text-align:left; }
  .tot { font-weight:700; background:#fafafa; }
  h2 { font-size:13px; margin:16px 0 6px; border-left:4px solid #f97316; padding-left:8px; }
  @media print { body { margin: 12mm; } button { display:none; } }
`;

/** Documento HTML completo (para mostrar en un iframe dentro del modal de PDF). */
export function buildReportDoc(title: string, body: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLES}</style></head><body>${body}</body></html>`;
}

export function printReport(title: string, body: string) {
  const w = window.open('', '_blank', 'width=980,height=760');
  if (!w) { alert('Permite las ventanas emergentes para ver el reporte.'); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLES}</style></head><body>${body}<scr` + `ipt>window.onload=function(){setTimeout(function(){window.print();},250);}</scr` + `ipt></body></html>`);
  w.document.close();
}

function header(subtitle: string, order: MfgProductionOrder) {
  return `<div class="head">
    <div><div class="brand">Fábrica</div><div class="muted">Producción</div></div>
    <div style="text-align:right"><h1>${esc(subtitle)}</h1><div class="muted">${esc(order.code)} · ${today()}</div></div>
  </div>`;
}

/** Matriz talla (filas) × color (columnas) a partir de las líneas de la orden. */
function orderMatrix(order: MfgProductionOrder) {
  const sizes = new Map<number, { abbr: string; sort: number }>();
  const colors = new Map<number, string>();
  const cell = new Map<string, number>();
  order.items.forEach((it) => {
    if (it.size) sizes.set(it.sizeId, { abbr: it.size.abbreviation, sort: it.size.sortOrder });
    if (it.color) colors.set(it.colorId, it.color.name);
    cell.set(`${it.sizeId}-${it.colorId}`, it.quantity);
  });
  const S = [...sizes.entries()].sort((a, b) => a[1].sort - b[1].sort);
  const C = [...colors.entries()];
  const colTot: Record<number, number> = {}; let grand = 0;
  const rows = S.map(([sid, s]) => {
    let rt = 0;
    const tds = C.map(([cid]) => { const q = cell.get(`${sid}-${cid}`) ?? 0; rt += q; colTot[cid] = (colTot[cid] ?? 0) + q; return `<td>${q || ''}</td>`; }).join('');
    grand += rt;
    return `<tr><td class="l">${esc(s.abbr)}</td>${tds}<td class="tot">${rt}</td></tr>`;
  }).join('');
  const foot = `<tr class="tot"><td class="l">Total</td>${C.map(([cid]) => `<td>${colTot[cid] ?? 0}</td>`).join('')}<td>${grand}</td></tr>`;
  const head = `<tr><th class="l">Talla \\ Color</th>${C.map(([, n]) => `<th>${esc(n)}</th>`).join('')}<th>Total</th></tr>`;
  return `<table><thead>${head}</thead><tbody>${rows}${foot}</tbody></table>`;
}

/** Reporte 1 — Orden de producción. */
export function reportOrder(order: MfgProductionOrder): string {
  const total = order.items.reduce((t, it) => t + it.quantity, 0);
  return header('ORDEN DE PRODUCCIÓN', order) + `
    <div class="box"><div class="row">
      <div><b>Referencia</b>${esc(order.reference ? `${order.reference.code} · ${order.reference.name}` : '—')}</div>
      <div><b>Bodega</b>${esc(order.warehouse?.name ?? '—')}</div>
      <div><b>Total</b>${total} und</div>
      <div><b>Estado</b>${esc(order.status)}</div>
    </div>${order.notes ? `<div style="margin-top:8px"><b class="muted">Observaciones</b> ${esc(order.notes)}</div>` : ''}</div>
    <h2>Cantidades a producir</h2>
    ${orderMatrix(order)}`;
}

/** Reporte 2 — Solicitud de servicio a talleres externos. */
export function reportExternal(order: MfgProductionOrder): string {
  const ext = order.stages.filter((s) => s.process?.type === 'EXTERNAL').sort((a, b) => a.sequence - b.sequence);
  if (ext.length === 0) return header('SOLICITUD DE SERVICIO EXTERNO', order) + '<p class="muted">Esta orden no tiene etapas externas.</p>';
  const blocks = ext.map((st: MfgProductionOrderStage) => {
    const rows = order.items.map((it) => `<tr><td class="l">${esc(order.reference?.code)}</td><td class="l">${esc(it.color?.name)}</td><td>${esc(it.size?.abbreviation)}</td><td>${it.quantity}</td><td></td></tr>`).join('');
    return `<h2>${esc(st.process?.name)} — Servicio externo</h2>
      <div class="box"><div class="row">
        <div><b>Taller</b>${esc(st.workshop?.name ?? 'Por asignar')}</div>
        <div><b>Referencia</b>${esc(order.reference ? `${order.reference.code} · ${order.reference.name}` : '—')}</div>
        <div><b>Fecha</b>${today()}</div>
      </div></div>
      <table><thead><tr><th class="l">Referencia</th><th class="l">Color</th><th>Talla</th><th>Cantidad</th><th>Observaciones</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
  return header('SOLICITUD DE SERVICIO EXTERNO', order) + blocks;
}

const COMP_LABEL: Record<string, string> = { SUPERIOR: 'Superior', INFERIOR: 'Inferior' };

/** Secciones por componente (cada uno con su taller e insumos), para etapas externas. */
function componentSections(order: MfgProductionOrder, stage: MfgProductionOrderStage, stageTotal: number): string {
  const comps = order.reference?.components ?? [];
  if (!comps.length) return '';
  const wsByComp = new Map<number, string | undefined>();
  (stage.stageComponents ?? []).forEach((sc) => wsByComp.set(sc.componentId, sc.workshop?.name ?? undefined));
  const mats = order.reference?.materials ?? [];
  return comps.map((comp) => {
    const cm = mats.filter((m) => m.componentId === comp.id);
    const insRows = cm.map((m) => {
      const exp = Number(m.consumption) * stageTotal;
      return `<tr><td class="l">${esc(m.input?.name)}${m.color ? ' · ' + esc(m.color.name) : ''}</td><td>${Number(exp.toFixed(4))} ${esc(m.input?.unitOfMeasure ?? '')}</td></tr>`;
    }).join('');
    return `<h2>Componente: ${esc(COMP_LABEL[comp.position] ?? comp.position)}${comp.description ? ' · ' + esc(comp.description) : ''}</h2>
      <div class="box"><div class="row">
        <div><b>Taller</b>${esc(wsByComp.get(comp.id) ?? 'Por asignar')}</div>
        <div><b>Cantidad</b>${stageTotal} und</div>
      </div></div>
      ${insRows ? `<table><thead><tr><th class="l">Insumo del componente</th><th>Esperado</th></tr></thead><tbody>${insRows}</tbody></table>` : '<p class="muted">Sin insumos asignados a este componente.</p>'}`;
  }).join('');
}

/** Reporte por ETAPA (PDF de cada proceso). Externo → solicitud a taller; interno → producción. */
export function reportStage(order: MfgProductionOrder, stage: MfgProductionOrderStage): string {
  const external = stage.process?.type === 'EXTERNAL';
  const title = external ? 'SOLICITUD DE SERVICIO EXTERNO' : 'REPORTE DE PRODUCCIÓN';
  // Matriz de la etapa (completadas si hay, si no programadas).
  const sizes = new Map<number, { abbr: string; sort: number }>();
  const colors = new Map<number, string>();
  const cell = new Map<string, number>();
  order.items.forEach((it) => { if (it.size) sizes.set(it.sizeId, { abbr: it.size.abbreviation, sort: it.size.sortOrder }); if (it.color) colors.set(it.colorId, it.color.name); });
  const src = (stage.cells && stage.cells.length) ? stage.cells.map((c) => ({ colorId: c.colorId, sizeId: c.sizeId, quantity: c.quantity })) : (stage.programmed ?? []);
  src.forEach((c) => cell.set(`${c.sizeId}-${c.colorId}`, c.quantity));
  const stageTotal = src.reduce((t, c) => t + c.quantity, 0);
  const S = [...sizes.entries()].sort((a, b) => a[1].sort - b[1].sort); const C = [...colors.entries()];
  const rows = S.map(([sid, s]) => `<tr><td class="l">${esc(s.abbr)}</td>${C.map(([cid]) => `<td>${cell.get(`${sid}-${cid}`) ?? ''}</td>`).join('')}</tr>`).join('');
  const matrix = C.length ? `<table><thead><tr><th class="l">Talla \\ Color</th>${C.map(([, n]) => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>` : '';
  let costExp = 0; let costReal = 0;
  const cons = (stage.consumptions ?? []).map((c) => {
    const exp = Number(c.expectedQty); const real = Number(c.realQty); const uv = Number(c.unitValue || 0); const diff = real - exp;
    costExp += exp * uv; costReal += real * uv;
    return `<tr><td class="l">${esc(c.input?.name)}${c.color ? ' · ' + esc(c.color.name) : ''}</td><td>${exp} ${esc(c.input?.unitOfMeasure ?? '')}</td><td>${real} ${esc(c.input?.unitOfMeasure ?? '')}</td><td>${diff > 0 ? '+' : ''}${Number(diff.toFixed(4))}</td></tr>`;
  }).join('');
  const over = costReal - costExp;
  const consFoot = cons ? `<tr class="tot"><td class="l">Costo insumos</td><td>$${Math.round(costExp).toLocaleString('es-CO')}</td><td>$${Math.round(costReal).toLocaleString('es-CO')}</td><td>${over > 0 ? '+' : ''}$${Math.round(over).toLocaleString('es-CO')}</td></tr>` : '';
  // Etapa externa con componentes → una sección por componente (cada uno con su taller).
  const hasComponents = external && (order.reference?.components?.length ?? 0) > 0;
  return header(title, order) + `
    <div class="box"><div class="row">
      <div><b>Proceso</b>${esc(stage.process?.name)} ${external ? '(externo)' : '(interno)'}</div>
      <div><b>Referencia</b>${esc(order.reference ? `${order.reference.code} · ${order.reference.name}` : '—')}</div>
      ${external && !hasComponents ? `<div><b>Taller</b>${esc(stage.workshop?.name ?? 'Por asignar')}</div>` : ''}
      <div><b>Encargado</b>${esc(stage.assignee ?? '—')}</div>
      <div><b>Fecha</b>${today()}</div>
    </div></div>
    <h2>Cantidades</h2>
    ${matrix || '<p class="muted">Sin matriz.</p>'}
    ${cons ? `<h2>Consumo de insumos (esperado → real)</h2><table><thead><tr><th class="l">Insumo</th><th>Esperado</th><th>Real</th><th>Diferencia</th></tr></thead><tbody>${cons}${consFoot}</tbody></table>` : ''}
    ${hasComponents ? componentSections(order, stage, stageTotal) : ''}`;
}

/** Reporte 3 — Producción interna (avance por etapa). */
export function reportInternal(order: MfgProductionOrder): string {
  const rows = [...order.stages].sort((a, b) => a.sequence - b.sequence).map((st) => {
    const prog = (st.programmed ?? []).reduce((t, c) => t + c.quantity, 0);
    const cons = (st.consumptions ?? []).map((c) => { const r = Number(c.realQty); const e = Number(c.expectedQty); const um = esc(c.input?.unitOfMeasure ?? ''); return `${esc(c.input?.name)}${c.color ? ' · ' + esc(c.color.name) : ''}: ${r} ${um}${r !== e ? ` <span class="muted">(esp. ${e})</span>` : ''}`; }).join('<br>') || '—';
    return `<tr>
      <td>${st.sequence}</td>
      <td class="l">${esc(st.process?.name)}${st.process?.type === 'EXTERNAL' ? ' <span class="muted">(ext.)</span>' : ''}</td>
      <td>${esc(STAGE_LABEL[st.status] ?? st.status)}</td>
      <td>${st.quantityDone}/${prog}</td>
      <td class="l">${esc(st.assignee ?? '')}</td>
      <td class="l">${cons}</td>
    </tr>`;
  }).join('');
  return header('PRODUCCIÓN INTERNA — AVANCE', order) + `
    <div class="box"><div class="row">
      <div><b>Referencia</b>${esc(order.reference ? `${order.reference.code} · ${order.reference.name}` : '—')}</div>
      <div><b>Estado</b>${esc(order.status)}</div>
    </div></div>
    <h2>Etapas</h2>
    <table><thead><tr><th>#</th><th class="l">Proceso</th><th>Estado</th><th>Avance</th><th class="l">Encargado</th><th class="l">Consumo esperado</th></tr></thead><tbody>${rows}</tbody></table>`;
}
