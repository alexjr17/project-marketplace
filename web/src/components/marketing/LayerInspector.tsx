/**
 * Propiedades de la capa elegida en el diseñador de piezas: texto (contenido o dato vinculado,
 * fuente, tamaño, color, fondo, sombra...), foto (de qué producto o cuál subida, encuadre, bordes),
 * forma (relleno, degradado, borde) y logo; y lo común a todas (posición, tamaño, giro, opacidad,
 * orden, alinear al lienzo, bloquear, duplicar y quitar).
 */
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical,
  ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Copy, Eye, EyeOff, Lock, Trash2, Unlock,
} from 'lucide-react';
import { Button, ColorInput, Field, IconButton, RadioGroup, SelectInput, Switch, TextArea, TextInput } from '../ui';
import type { Brand } from './render';
import { MOCK_VIEWS, TEXT_BINDS, type Layer, type MockView, type Paint, type TextBind } from './design';
import { paint } from './designRender';
import type { SceneDesign, SceneProduct } from './timeline';
import type { SourceProduct } from '../../services/marketing.service';
import { DesignPicker } from './DesignPicker';
import { BG_STYLES } from './backgrounds';
import { canonicalView } from '../customizer/customizerModel';
import { DictateButton } from './DictateButton';
import { appendText } from './dictation';
import { photoZones } from './mockup';

const BRAND_PAINTS: { value: Paint; label: string }[] = [
  { value: 'primary', label: 'Principal' }, { value: 'accent', label: 'Acento' }, { value: 'paper', label: 'Fondo de la marca' },
  { value: 'white', label: 'Blanco' }, { value: 'black', label: 'Negro' },
];

/** Selector de color: los de la marca (siguen a la marca si cambia) o uno propio. */
function PaintPicker({ label, value, onChange, brand, allowNone }: { label: string; value: Paint | null; onChange: (p: Paint | null) => void; brand: Brand; allowNone?: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1.5">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {allowNone && (
          <button type="button" onClick={() => onChange(null)} aria-pressed={value === null} title="Sin color" aria-label="Sin color"
            className={`w-7 h-7 rounded-full border-2 bg-white relative overflow-hidden ${value === null ? 'border-app-600 ring-2 ring-app-200' : 'border-gray-200'}`}>
            <span className="absolute inset-0 m-auto w-[140%] h-0.5 bg-red-500 rotate-45 -translate-x-[15%]" />
          </button>
        )}
        {BRAND_PAINTS.map((p) => (
          <button key={p.value} type="button" onClick={() => onChange(p.value)} aria-pressed={value === p.value} title={p.label} aria-label={p.label}
            className={`w-7 h-7 rounded-full border-2 ${value === p.value ? 'border-app-600 ring-2 ring-app-200' : 'border-gray-200'}`} style={{ background: paint(p.value, brand) }} />
        ))}
      </div>
      {value !== null && <ColorInput value={paint(value, brand).slice(0, 7)} onChange={(c) => onChange(c as Paint)} />}
    </div>
  );
}

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <TextInput type="number" step={step} value={Math.round(value)} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </label>
  );
}

function Range({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm text-gray-700"><span>{label}</span><span className="tabular-nums text-gray-900">{format(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-app-600" />
    </label>
  );
}

export function LayerInspector({
  layer: l, brand, W, H, patch, onArrange, onDuplicate, onRemove, products, photos, boundText, mockTemplates, defaultMockTemplate, onDesignAll,
}: {
  layer: Layer;
  brand: Brand;
  W: number;
  H: number;
  patch: (p: Partial<Layer>, merge?: string) => void;
  onArrange: (to: 'front' | 'up' | 'down' | 'back') => void;
  onDuplicate: () => void;
  onRemove: () => void;
  /** Productos de lo que se promociona (para fotos y precios vinculados). */
  products: SceneProduct[];
  /** Fotos subidas al diseñador. */
  photos: SceneProduct[];
  /** Texto que se ve ahora (el del dato si está vinculado). */
  boundText: string;
  /** Personalizables que se pueden mostrar con diseño. */
  mockTemplates: SourceProduct[];
  defaultMockTemplate: SourceProduct | null;
  /** Pone el mismo diseño en todas las prendas del post. */
  onDesignAll: (d: SceneDesign | null) => void;
}) {
  const itemOptions = Array.from({ length: Math.max(products.length, 4) }, (_, i) => ({ value: i, label: products[i] ? `${i + 1}. ${products[i].name}` : `Producto ${i + 1}` }));
  const align = (where: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    const p: Partial<Layer> = {};
    if (where === 'left') p.x = 0;
    if (where === 'hcenter') p.x = (W - l.w) / 2;
    if (where === 'right') p.x = W - l.w;
    if (where === 'top') p.y = 0;
    if (where === 'vcenter') p.y = (H - l.h) / 2;
    if (where === 'bottom') p.y = H - l.h;
    patch(p);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <TextInput aria-label="Nombre de la capa" value={l.name} maxLength={40} onChange={(e) => patch({ name: e.target.value }, 'name')} />
        <IconButton title={l.hidden ? 'Mostrar' : 'Ocultar'} onClick={() => patch({ hidden: !l.hidden })}>{l.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</IconButton>
        <IconButton title={l.locked ? 'Desbloquear' : 'Bloquear'} onClick={() => patch({ locked: !l.locked })}>{l.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</IconButton>
      </div>

      {l.type === 'text' && (
        <div className="space-y-3">
          <Field label="Texto" htmlFor="ly-text" hint={l.bind ? `Sale de "${TEXT_BINDS.find((b) => b.value === l.bind)?.label}". Si escribes aquí, queda fijo.` : undefined}>
            <div className="flex gap-1 items-start">
              <TextArea id="ly-text" rows={3} value={l.bind ? boundText : l.text} maxLength={300} onChange={(e) => patch({ text: e.target.value, bind: null }, 'text')} />
              <DictateButton label="Dictar el texto" onText={(t) => patch({ text: appendText(l.bind ? boundText : l.text, t).slice(0, 300), bind: null })} />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Vinculado a" htmlFor="ly-bind">
              <SelectInput id="ly-bind" value={l.bind ?? ''} onChange={(e) => patch({ bind: (e.target.value || null) as TextBind | null })}>
                <option value="">Texto fijo</option>
                {TEXT_BINDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </SelectInput>
            </Field>
            {(l.bind === 'price' || l.bind === 'listPrice' || l.bind === 'name' || l.bind === 'discount') && (
              <Field label="De" htmlFor="ly-item">
                <SelectInput id="ly-item" value={l.item} onChange={(e) => patch({ item: Number(e.target.value) })}>
                  {itemOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fuente" htmlFor="ly-font">
              <SelectInput id="ly-font" value={l.font} onChange={(e) => patch({ font: e.target.value as 'heading' | 'body' })}>
                <option value="heading">Títulos ({brand.headingFont || 'Inter'})</option>
                <option value="body">Texto ({brand.bodyFont || 'Inter'})</option>
              </SelectInput>
            </Field>
            <Field label="Grosor" htmlFor="ly-weight">
              <SelectInput id="ly-weight" value={l.weight} onChange={(e) => patch({ weight: Number(e.target.value) })}>
                {[300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
              </SelectInput>
            </Field>
          </div>
          <Range label="Tamaño" value={l.size} min={14} max={320} step={1} format={(v) => `${Math.round(v)} px`} onChange={(v) => patch({ size: v }, 'size')} />
          <RadioGroup variant="segmented" value={l.align} onChange={(v) => patch({ align: v })} options={[{ value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} />
          <PaintPicker label="Color" value={l.color} onChange={(c) => patch({ color: c ?? 'white' }, 'color')} brand={brand} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Range label="Interlineado" value={l.lineHeight} min={0.8} max={1.8} step={0.02} format={(v) => v.toFixed(2)} onChange={(v) => patch({ lineHeight: v }, 'lh')} />
            <Range label="Espaciado" value={l.letterSpacing} min={-6} max={30} step={1} format={(v) => `${v}`} onChange={(v) => patch({ letterSpacing: v }, 'ls')} />
          </div>
          <Range label="Máximo de líneas" value={l.maxLines} min={1} max={8} step={1} format={(v) => `${v}`} onChange={(v) => patch({ maxLines: v }, 'ml')} />
          <div className="grid grid-cols-2 gap-2">
            <Switch checked={l.upper} onChange={(v) => patch({ upper: v })} label="Mayúsculas" />
            <Switch checked={l.shadow} onChange={(v) => patch({ shadow: v })} label="Sombra" />
            <Switch checked={l.strike} onChange={(v) => patch({ strike: v })} label="Tachado" />
            <Switch checked={!!l.outline} onChange={(v) => patch({ outline: v })} label="Solo contorno" />
          </div>
          <PaintPicker label="Fondo (etiqueta o botón)" value={l.bg} onChange={(c) => patch({ bg: c }, 'bg')} brand={brand} allowNone />
          {l.bg && <Range label="Redondeo del fondo" value={Math.min(l.radius, 120)} min={0} max={120} step={2} format={(v) => (v >= 120 ? 'Píldora' : `${v} px`)} onChange={(v) => patch({ radius: v >= 120 ? 999 : v }, 'radius')} />}
        </div>
      )}

      {l.type === 'image' && (
        <div className="space-y-3">
          <Field label="Foto" htmlFor="ly-src">
            <SelectInput id="ly-src" value={l.mock ? `tpl:${l.mock.templateId ?? 'auto'}` : l.src ?? `item:${l.item}`} onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith('tpl:')) {
                const id = v === 'tpl:auto' ? null : Number(v.slice(4));
                patch({ mock: { templateId: id, zoneId: null, view: l.mock?.view ?? 'front', design: l.mock?.design ?? null, size: l.mock?.size ?? 0.85, color: l.mock?.color }, fit: 'contain' });
              } else if (v.startsWith('item:')) patch({ src: null, mock: null, item: Number(v.slice(5)) });
              else patch({ src: v, mock: null });
            }}>
              <optgroup label="De lo que promocionas">
                {itemOptions.map((o) => <option key={o.value} value={`item:${o.value}`}>{o.label}</option>)}
              </optgroup>
              {mockTemplates.length > 0 && (
                <optgroup label="Personalizable con tu diseño">
                  <option value="tpl:auto">La personalizable de Productos{defaultMockTemplate ? ` (${defaultMockTemplate.name})` : ''}</option>
                  {mockTemplates.map((t) => <option key={t.id} value={`tpl:${t.id}`}>{t.name}</option>)}
                </optgroup>
              )}
              {photos.length > 0 && (
                <optgroup label="Mis fotos">
                  {photos.map((p) => <option key={p.id} value={p.image ?? ''}>{p.name}</option>)}
                </optgroup>
              )}
            </SelectInput>
          </Field>
          {l.mock && (() => {
            const m = l.mock!;
            const t = (m.templateId != null ? mockTemplates.find((x) => x.id === m.templateId) : undefined) ?? defaultMockTemplate;
            const view = m.view ?? 'front';
            const pz = t ? photoZones(t).filter((z) => canonicalView(z.view) === view) : [];
            const is3d = !!t && !pz.length && !!t.model3d;
            const swatches = Array.from(new Set([...(t?.colors ?? []), '#FFFFFF', '#1F1D1E'].map((c) => c.toUpperCase())));
            const color = (m.color ?? t?.colors?.[0] ?? '#FFFFFF').toUpperCase();
            return (
              <div className="space-y-3 rounded-lg bg-gray-50 p-2.5">
                {!t && <p className="text-xs text-amber-700">Elige una personalizable en Productos (o aquí arriba) para ver la prenda.</p>}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Vista</p>
                  <RadioGroup variant="segmented" value={view} onChange={(v) => patch({ mock: { ...m, view: v as MockView, zoneId: null, closeUp: v === 'side' ? true : m.closeUp } })} options={MOCK_VIEWS.map((x) => ({ value: x.value, label: x.label }))} />
                  <p className="mt-1 text-xs text-gray-500">{is3d ? 'Sale del maniquí 3D girado a esta vista.' : pz.length ? 'Sale de la foto de esta vista de la plantilla.' : 'Esta plantilla no tiene foto de esta vista.'}</p>
                </div>
                {pz.length > 1 && (
                  <Field label="Zona del diseño" htmlFor="ly-zone">
                    <SelectInput id="ly-zone" value={m.zoneId ?? pz[0].id} onChange={(e) => patch({ mock: { ...m, zoneId: Number(e.target.value) } })}>
                      {pz.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </SelectInput>
                  </Field>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Color de la prenda</p>
                  <div className="flex flex-wrap gap-1.5">
                    {swatches.map((c) => {
                      const name = t?.colorNames?.[(t.colors ?? []).findIndex((x) => x.toUpperCase() === c)] ?? c;
                      return (
                        <button key={c} type="button" title={name} aria-label={`Color ${name}`} aria-pressed={!!m.color && color === c} onClick={() => patch({ mock: { ...m, color: c } })}
                          className={`w-7 h-7 rounded-full border-2 ${m.color && color === c ? 'border-app-600 ring-2 ring-app-200' : 'border-gray-200'}`} style={{ background: c }} />
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{m.color ? <button type="button" className="text-app-700 hover:underline" onClick={() => patch({ mock: { ...m, color: undefined } })}>Usar el color elegido en Productos</button> : 'Usa el color elegido en Productos.'}</p>
                </div>
                <Switch checked={!!m.closeUp} onChange={(v) => patch({ mock: { ...m, closeUp: v } })} label="Acercar al diseño" description="Muestra de cerca la zona del diseño (ideal en la manga)." />
                <DesignPicker idPrefix="ly" value={m.design} onChange={(d) => patch({ mock: { ...m, design: d } })} />
                {m.design && <Range label="Tamaño en la zona" value={Math.round(m.size * 100)} min={30} max={200} step={5} format={(v) => `${v}%`} onChange={(v) => patch({ mock: { ...m, size: v / 100 } }, 'msize')} />}
                {m.design && (
                  <div className="space-y-2 rounded-lg bg-gray-50 p-2">
                    <p className="text-xs text-gray-600">Arrastra el diseño sobre la prenda para moverlo, o ajústalo aquí.</p>
                    <Range label="A los lados" value={Math.round((m.offset?.x ?? 0) * 1000) / 10} min={-50} max={50} step={0.5} format={(v) => (v ? `${v > 0 ? '→' : '←'} ${Math.abs(v)}%` : 'Centrado')} onChange={(v) => patch({ mock: { ...m, offset: { x: v / 100, y: m.offset?.y ?? 0 } } }, 'moffx')} />
                    <Range label="Arriba o abajo" value={Math.round((m.offset?.y ?? 0) * 1000) / 10} min={-50} max={50} step={0.5} format={(v) => (v ? `${v > 0 ? '↓' : '↑'} ${Math.abs(v)}%` : 'Centrado')} onChange={(v) => patch({ mock: { ...m, offset: { x: m.offset?.x ?? 0, y: v / 100 } } }, 'moffy')} />
                    {(m.offset?.x || m.offset?.y) ? <Button size="sm" variant="secondary" onClick={() => patch({ mock: { ...m, offset: { x: 0, y: 0 } } })}>Centrar en la zona</Button> : null}
                  </div>
                )}
                <Button size="sm" variant="secondary" onClick={() => onDesignAll(m.design)}>Usar este diseño en todas las vistas</Button>
              </div>
            );
          })()}
          {!l.src && (
            <Switch checked={!!l.cutout} onChange={(v) => patch({ cutout: v, ...(v ? { fit: 'contain' as const } : {}) })} label="Producto recortado" description="Sin el fondo de su foto, grande y con sombra." />
          )}
          {!l.cutout && <RadioGroup variant="segmented" value={l.fit} onChange={(v) => patch({ fit: v })} options={[{ value: 'cover', label: 'Llenar' }, { value: 'contain', label: 'Completa' }]} />}
          <Range label="Zoom" value={l.zoom} min={0.5} max={3} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ zoom: v }, 'zoom')} />
          <Range label="Redondeo" value={Math.min(l.radius, 300)} min={0} max={300} step={2} format={(v) => (v >= 300 ? 'Círculo' : `${v} px`)} onChange={(v) => patch({ radius: v >= 300 ? 999 : v }, 'radius')} />
          <Switch checked={l.shadow} onChange={(v) => patch({ shadow: v })} label="Sombra" />
          <Range label="Difuminar bordes" value={Math.round((l.feather ?? 0) * 100)} min={0} max={50} step={2} format={(v) => (v ? `${v}%` : 'No')} onChange={(v) => patch({ feather: v / 100 }, 'feather')} />
          <PaintPicker label="Borde" value={l.border} onChange={(c) => patch({ border: c })} brand={brand} allowNone />
        </div>
      )}

      {l.type === 'shape' && (
        <div className="space-y-3">
          <RadioGroup variant="segmented" value={l.shape} onChange={(v) => patch({ shape: v })} options={[{ value: 'rect', label: 'Rectángulo' }, { value: 'ellipse', label: 'Círculo' }]} />
          <PaintPicker label="Relleno" value={l.fill} onChange={(c) => patch({ fill: c ?? 'primary' }, 'fill')} brand={brand} />
          <Range label="Opacidad del relleno" value={l.fillAlpha} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ fillAlpha: v }, 'fa')} />
          <PaintPicker label="Degradado hacia" value={l.fillTo} onChange={(c) => patch({ fillTo: c }, 'ft')} brand={brand} allowNone />
          {l.fillTo && <Range label="Opacidad al final" value={l.fillToAlpha} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ fillToAlpha: v }, 'fta')} />}
          {l.shape === 'rect' && <Range label="Redondeo" value={Math.min(l.radius, 300)} min={0} max={300} step={2} format={(v) => `${v} px`} onChange={(v) => patch({ radius: v }, 'radius')} />}
          <PaintPicker label="Borde" value={l.stroke} onChange={(c) => patch({ stroke: c })} brand={brand} allowNone />
          {l.stroke && <Switch checked={l.dashed} onChange={(v) => patch({ dashed: v })} label="Borde punteado" />}
        </div>
      )}

      {l.type === 'colors' && (
        <div className="space-y-3">
          <RadioGroup variant="segmented" value={l.style} onChange={(v) => patch({ style: v as 'prendas' | 'circulos' })} options={[{ value: 'prendas', label: 'Prendas' }, { value: 'circulos', label: 'Círculos' }]} />
          <Switch checked={l.label} onChange={(v) => patch({ label: v })} label='Texto "Disponible en N colores"' />
          <Switch checked={l.onDark} onChange={(v) => patch({ onDark: v })} label="Sobre fondo oscuro" description="El texto y los bordes en claro." />
          <p className="text-xs text-gray-500">Los colores se eligen en Productos → Colores disponibles. Ancho para una fila, alto para una columna.</p>
        </div>
      )}

      {l.type === 'pattern' && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Estilo del fondo</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BG_STYLES.map((st) => (
                <button key={st.value} type="button" title={st.hint} aria-pressed={l.style === st.value} onClick={() => patch({ style: st.value })}
                  className={`rounded-lg border px-2 py-1.5 text-xs text-left ${l.style === st.value ? 'border-app-600 bg-app-50 text-app-800 font-medium' : 'border-gray-200 text-gray-700 hover:border-app-300'}`}>
                  {st.label}
                </button>
              ))}
            </div>
          </div>
          <PaintPicker label="Color de fondo" value={l.base} onChange={(c) => patch({ base: c ?? 'primary' }, 'pbase')} brand={brand} />
          {l.style !== 'color' && l.style !== 'mosaicoDisenos' && (
            <PaintPicker label={l.style === 'malla' ? 'Color de las manchas' : l.style === 'mosaicoMarca' ? 'Color del texto (si no hay logo)' : 'Color del dibujo'} value={l.ink} onChange={(c) => patch({ ink: c ?? 'accent' }, 'pink')} brand={brand} />
          )}
          {l.style === 'malla' && <PaintPicker label="Segundo color de las manchas" value={l.accent} onChange={(c) => patch({ accent: c ?? 'accent' }, 'pacc')} brand={brand} />}
          {l.style !== 'color' && (
            <Range label="Intensidad" value={Math.round(l.density * 100)} min={0} max={100} step={1} format={(v) => `${v}%`} onChange={(v) => patch({ density: v / 100 }, 'pden')} />
          )}
          {(l.style === 'mosaicoMarca' || l.style === 'mosaicoDisenos' || l.style === 'rayas') && (
            <Range label={l.style === 'rayas' ? 'Separación' : 'Tamaño de cada pieza'} value={l.size} min={40} max={420} step={5} format={(v) => `${v} px`} onChange={(v) => patch({ size: v }, 'psize')} />
          )}
          {l.style !== 'color' && l.style !== 'malla' && (
            <Range label="Giro" value={l.angle} min={-90} max={90} step={1} format={(v) => `${v}°`} onChange={(v) => patch({ angle: v }, 'pang')} />
          )}
          <Switch checked={l.grain} onChange={(v) => patch({ grain: v })} label="Textura de grano" description="Un acabado de papel o película, muy actual." />
          {l.style === 'mosaicoDisenos' && (
            <div className="space-y-2 rounded-lg bg-gray-50 p-2.5">
              <Switch checked={l.useMockDesigns} onChange={(v) => patch({ useMockDesigns: v })} label="Usar los diseños de las prendas" description="Los que pusiste en las prendas personalizadas del post." />
              {l.designs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {l.designs.map((u) => (
                    <button key={u} type="button" title="Quitar del mosaico" aria-label="Quitar este diseño del mosaico" onClick={() => patch({ designs: l.designs.filter((x) => x !== u) })}
                      className="w-12 h-12 rounded-lg ring-1 ring-gray-200 bg-white p-1 hover:ring-red-300"><img src={u} alt="" className="w-full h-full object-contain" /></button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600">Agregar diseños al mosaico:</p>
              <DesignPicker idPrefix="bg" value={null} onChange={(d) => { if (d && !l.designs.includes(d.image)) patch({ designs: [...l.designs, d.image] }); }} />
            </div>
          )}
        </div>
      )}

      {l.type === 'logo' && (
        <div className="space-y-3">
          <RadioGroup variant="segmented" value={l.kind} onChange={(v) => patch({ kind: v })} options={[{ value: 'full', label: 'Completo' }, { value: 'wordmark', label: 'Nombre' }, { value: 'icon', label: 'Ícono' }]} />
          <RadioGroup variant="segmented" value={l.onDark ? 'dark' : 'light'} onChange={(v) => patch({ onDark: v === 'dark' })} options={[{ value: 'dark', label: 'Versión clara' }, { value: 'light', label: 'Versión oscura' }]} />
        </div>
      )}

      {/* Común a todas */}
      <div className="space-y-3 border-t border-gray-100 pt-3">
        <div className="grid grid-cols-4 gap-2">
          <Num label="X" value={l.x} onChange={(v) => patch({ x: v }, 'x')} />
          <Num label="Y" value={l.y} onChange={(v) => patch({ y: v }, 'y')} />
          <Num label="Ancho" value={l.w} onChange={(v) => patch({ w: Math.max(10, v) }, 'w')} />
          <Num label="Alto" value={l.h} onChange={(v) => patch({ h: Math.max(10, v) }, 'h')} />
        </div>
        <Range label="Giro" value={l.rotation ?? 0} min={-180} max={180} step={1} format={(v) => `${v}°`} onChange={(v) => patch({ rotation: v }, 'rot')} />
        <Range label="Opacidad" value={l.opacity} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch({ opacity: v }, 'op')} />
        <div>
          <p className="text-xs text-gray-500 mb-1">Alinear en el lienzo</p>
          <div className="flex flex-wrap gap-0.5">
            <IconButton title="A la izquierda" onClick={() => align('left')}><AlignStartVertical className="w-4 h-4" /></IconButton>
            <IconButton title="Al centro (horizontal)" onClick={() => align('hcenter')}><AlignCenterVertical className="w-4 h-4" /></IconButton>
            <IconButton title="A la derecha" onClick={() => align('right')}><AlignEndVertical className="w-4 h-4" /></IconButton>
            <IconButton title="Arriba" onClick={() => align('top')}><AlignStartHorizontal className="w-4 h-4" /></IconButton>
            <IconButton title="Al centro (vertical)" onClick={() => align('vcenter')}><AlignCenterHorizontal className="w-4 h-4" /></IconButton>
            <IconButton title="Abajo" onClick={() => align('bottom')}><AlignEndHorizontal className="w-4 h-4" /></IconButton>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Orden</p>
          <div className="flex flex-wrap gap-0.5">
            <IconButton title="Traer al frente" onClick={() => onArrange('front')}><ArrowUpToLine className="w-4 h-4" /></IconButton>
            <IconButton title="Subir una" onClick={() => onArrange('up')}><ArrowUp className="w-4 h-4" /></IconButton>
            <IconButton title="Bajar una" onClick={() => onArrange('down')}><ArrowDown className="w-4 h-4" /></IconButton>
            <IconButton title="Enviar al fondo" onClick={() => onArrange('back')}><ArrowDownToLine className="w-4 h-4" /></IconButton>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<Copy className="w-4 h-4" />} onClick={onDuplicate}>Duplicar</Button>
          <Button size="sm" variant="secondary" icon={<Trash2 className="w-4 h-4" />} onClick={onRemove}>Quitar</Button>
        </div>
      </div>
    </div>
  );
}
