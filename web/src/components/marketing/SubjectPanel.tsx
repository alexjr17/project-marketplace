/**
 * "Qué se muestra": según lo elegido, el sistema sabe con qué trabaja y todas las plantillas se adaptan.
 * - Productos: qué fotos de cada uno se usan (con uno solo, cada foto ocupa un espacio de la plantilla).
 * - Personalizable: qué vistas o zonas se muestran y el diseño de cada zona.
 */
import { Box, Check, Copy, Images } from 'lucide-react';
import { Button, Switch } from '../ui';
import type { SourceProduct } from '../../services/marketing.service';
import { DesignPicker } from './DesignPicker';
import { viewImageOf } from './mockup';
import { allPhotosOf, photosOf, VIEW_LABEL, type GarmentPlan, type Subject, type ZoneChoice } from './pieces';
import type { SceneDesign } from './timeline';

function Range({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-gray-700"><span>{label}</span><span className="tabular-nums text-gray-900">{format(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-app-600" />
    </label>
  );
}

export function SubjectPanel({ subject, products, picks, onPicks, garment, plan, onZone, onAllDesigns, is3d, color, onColor, showcase, onShowcase, onShowcaseVideo, familyMode = false }: {
  subject: Subject;
  products: SourceProduct[];
  picks: Record<number, string[]>;
  onPicks: (productId: number, urls: string[]) => void;
  garment: SourceProduct | null;
  plan: GarmentPlan | null;
  onZone: (zoneId: number, patch: Partial<ZoneChoice>) => void;
  onAllDesigns: (d: SceneDesign | null) => void;
  /** La personalizable se muestra con su maniquí 3D (no tiene fotos por vista). */
  is3d: boolean;
  /** Color de la prenda para el contenido. */
  color: string | null;
  onColor: (c: string) => void;
  /** Colores disponibles que se muestran (null: no se muestran). */
  showcase: string[] | null;
  onShowcase: (colors: string[] | null) => void;
  /** Agrega ya el carrusel de colores al video (solo en el editor de video). */
  onShowcaseVideo?: () => void;
  /** Se muestra una familia: las zonas no se eligen aquí (cada integrante va en el frente). */
  familyMode?: boolean;
}) {
  if (subject.kind === 'productos') {
    return (
      <section className="mt-4 rounded-xl border border-gray-200 p-3" aria-label="Qué se muestra">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Images className="w-4 h-4 text-app-600" />Qué se muestra</h3>
        <p className="text-xs text-gray-500 mt-0.5 mb-2">
          {subject.single
            ? 'Un producto sin zonas: sale con su foto principal. Si marcas más fotos suyas, las plantillas de varios espacios las usan.'
            : 'Varios productos: va uno por espacio, cada uno con su foto principal.'}
        </p>
        <div className="space-y-2.5">
          {products.map((p) => {
            const all = allPhotosOf(p);
            const used = photosOf(p, picks[p.id]);
            return (
              <div key={p.id}>
                <p className="text-xs font-medium text-gray-700 truncate">{p.name}</p>
                {all.length > 1 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {all.map((u, i) => {
                      const on = used.includes(u);
                      return (
                        <button key={u} type="button" aria-pressed={on} aria-label={`${on ? 'Quitar' : 'Usar'} la foto ${i + 1} de ${p.name}`}
                          onClick={() => onPicks(p.id, on ? used.filter((x) => x !== u) : all.filter((x) => used.includes(x) || x === u))}
                          className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 bg-gray-50 ${on ? 'border-app-600' : 'border-gray-200 opacity-50'}`}>
                          <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
                          {on && <span className="absolute top-0.5 right-0.5 rounded-full bg-app-600 text-white p-0.5"><Check className="w-2.5 h-2.5" /></span>}
                        </button>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-gray-400">{all.length ? 'Tiene una sola foto.' : 'No tiene fotos.'}</p>}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const first = subject.pieces.find((x) => x.mock?.design)?.mock?.design ?? null;
  return (
    <section className="mt-4 rounded-xl border border-gray-200 p-3" aria-label="Qué se muestra">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Box className="w-4 h-4 text-app-600" />Vistas y diseños de la prenda</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-2">
        Elige las zonas que salen en el post y sube el diseño de cada una. La primera es la principal (va en grande); las demás salen como detalle. Todas las plantillas las usan.
        {is3d ? ' Se muestran con el maniquí 3D.' : ''}
      </p>
      <div className="mb-3">
        <p className="text-xs font-medium text-gray-700 mb-1">
          Color de la prenda{color ? `: ${garment?.colorNames?.[(garment.colors ?? []).findIndex((c) => c.toUpperCase() === color.toUpperCase())] ?? color}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {(garment?.colors?.length ? garment.colors : ['#FFFFFF']).map((c, i) => {
            const on = (color ?? '').toUpperCase() === c.toUpperCase();
            const name = garment?.colorNames?.[i] ?? c;
            return (
              <button key={c} type="button" title={name} aria-label={`Color ${name}`} aria-pressed={on} onClick={() => onColor(c)}
                className={`w-7 h-7 rounded-full border-2 ${on ? 'border-app-600 ring-2 ring-app-200' : 'border-gray-200'}`} style={{ background: c }} />
            );
          })}
          <label className="relative w-7 h-7 rounded-full border-2 border-dashed border-gray-300 grid place-items-center text-gray-500 text-xs cursor-pointer" title="Otro color">
            +
            <input type="color" aria-label="Otro color" className="absolute inset-0 opacity-0 cursor-pointer" value={/^#[0-9a-f]{6}$/i.test(color ?? '') ? color! : '#ffffff'} onChange={(e) => onColor(e.target.value.toUpperCase())} />
          </label>
        </div>
        {!garment?.colors?.length && <p className="text-xs text-gray-500 mt-1">Esta prenda no tiene colores cargados: elige uno con +.</p>}
      </div>
      {(garment?.colors?.length ?? 0) > 1 && (
        <div className="mb-3 rounded-lg bg-gray-50 p-2">
          <Switch
            checked={!!showcase} onChange={(v) => onShowcase(v ? [...(garment!.colors ?? [])] : null)}
            label="Mostrar los colores disponibles"
            description={onShowcaseVideo ? 'Al final del video, la prenda en cada color.' : 'La prenda en cada color con "Disponible en N colores" (se puede mover).'}
          />
          {showcase && (
            <>
              <p className="text-xs text-gray-500 mt-2 mb-1">Cuáles mostrar:</p>
              <div className="flex flex-wrap gap-1.5">
                {garment!.colors!.map((c, i) => {
                  const on = showcase.includes(c);
                  const name = garment!.colorNames?.[i] ?? c;
                  return (
                    <button key={c} type="button" title={name} aria-label={`${on ? 'Quitar' : 'Mostrar'} ${name}`} aria-pressed={on}
                      onClick={() => onShowcase(on ? showcase.filter((x) => x !== c) : garment!.colors!.filter((x) => showcase.includes(x) || x === c))}
                      className={`w-7 h-7 rounded-full border-2 grid place-items-center ${on ? 'border-app-600' : 'border-gray-200 opacity-40'}`} style={{ background: c }}>
                      {on && <Check className="w-3.5 h-3.5" style={{ color: parseInt(c.slice(1), 16) > 0x999999 ? '#1F1D1E' : '#FFFFFF' }} />}
                    </button>
                  );
                })}
              </div>
              {onShowcaseVideo && <Button size="sm" variant="secondary" className="mt-2" onClick={onShowcaseVideo}>Agregar el carrusel al video</Button>}
            </>
          )}
        </div>
      )}
      {first && !familyMode && (
        <Button size="sm" variant="secondary" className="mb-2" icon={<Copy className="w-4 h-4" />} onClick={() => onAllDesigns(first)}>Mismo diseño en todas las zonas</Button>
      )}
      {familyMode && <p className="text-xs text-gray-500">Con la familia, cada integrante lleva su diseño en el frente de la prenda.</p>}
      <ul className={`space-y-2 ${familyMode ? 'hidden' : ''}`}>
        {subject.zones.map((z) => {
          const c = plan?.[z.id] ?? { show: false, design: null };
          // Lugar de la zona en el post: Principal, 2, 3…
          const pos = subject.pieces.findIndex((x) => x.mock?.zoneId === z.id);
          const thumb = garment ? viewImageOf(garment, { view: z.slug ?? z.view }) : null;
          return (
            <li key={z.id} className={`rounded-lg border p-2 ${c.show ? 'border-app-300 bg-app-50/40' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <span className="w-10 h-10 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">{thumb && <img src={thumb} alt="" className="w-full h-full object-contain" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
                    {c.show && pos >= 0 && <span className={`inline-flex items-center rounded-full px-1.5 text-[10px] font-semibold ${pos === 0 ? 'bg-app-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{pos === 0 ? 'Principal' : pos + 1}</span>}
                    <span className="truncate">{z.name}</span>
                  </p>
                  <p className="text-xs text-gray-500">{z.view ? VIEW_LABEL[z.view] : 'Zona'}{c.design ? ` · ${c.design.name}` : ' · sin diseño'}</p>
                </div>
                <Switch checked={c.show} onChange={(v) => onZone(z.id, { show: v })} label="Mostrar" />
              </div>
              {c.show && pos > 0 && (
                <button type="button" className="mt-1 text-xs text-app-700 hover:underline" onClick={() => onZone(z.id, { order: Math.min(...Object.values(plan ?? {}).map((x) => x.order ?? 0)) - 1 })}>Hacer principal</button>
              )}
              {c.show && (
                <div className="mt-2">
                  <DesignPicker idPrefix={`zona-${z.id}`} value={c.design} onChange={(d) => onZone(z.id, { design: d })} />
                  {c.design && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-gray-500">También puedes arrastrar el diseño sobre la prenda en el lienzo.</p>
                      <Range label="Tamaño" value={Math.round((c.size ?? 0.85) * 100)} min={30} max={200} step={5} format={(v) => `${v}%`} onChange={(v) => onZone(z.id, { size: v / 100 })} />
                      <Range label="A los lados" value={Math.round((c.offset?.x ?? 0) * 1000) / 10} min={-50} max={50} step={0.5} format={(v) => (v ? `${v > 0 ? '→' : '←'} ${Math.abs(v)}%` : 'Centrado')} onChange={(v) => onZone(z.id, { offset: { x: v / 100, y: c.offset?.y ?? 0 } })} />
                      <Range label="Arriba o abajo" value={Math.round((c.offset?.y ?? 0) * 1000) / 10} min={-50} max={50} step={0.5} format={(v) => (v ? `${v > 0 ? '↓' : '↑'} ${Math.abs(v)}%` : 'Centrado')} onChange={(v) => onZone(z.id, { offset: { x: c.offset?.x ?? 0, y: v / 100 } })} />
                      {(c.offset?.x || c.offset?.y || c.size != null) ? <Button size="sm" variant="secondary" onClick={() => onZone(z.id, { offset: { x: 0, y: 0 }, size: undefined })}>Centrar y tamaño original</Button> : null}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
