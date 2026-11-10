/**
 * Paneles del estudio (los 3 pasos): 1 Modelo, color y talla · 2 Tu diseño · 3 Resumen.
 * Solo pintan; los datos y acciones vienen de useCustomizer.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowUpToLine, Check, CheckCircle2, Copy, Crosshair, Download, Expand, ImagePlus,
  Loader2, Pencil, Ruler, ShoppingCart, Trash2,
} from 'lucide-react';
import { Alert, Badge, Button, FileDrop } from '../ui';
import { QuantityStepper } from '../cart/QuantityStepper';
import { useCurrency } from '../../hooks/useCurrency';
import { designImagesService, type DesignImage } from '../../services/design-images.service';
import { assetUrl } from '../../utils/assetUrl';
import { ACCEPTED_TYPES, MAX_INPUT_MB } from './designImage';
import { dpiLevel, estimateDpi, printSizeCm, printZonesOf, MIN_DESIGN_SIZE, type StudioDesign } from './customizerModel';
import type { CustomizerApi } from './useCustomizer';

export function StepCard({ n, title, done, action, children }: { n: number; title: string; done?: boolean; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
      <header className="flex items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2.5 text-base font-semibold text-gray-900">
          <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${done ? 'bg-emerald-600 text-white' : 'bg-app-50 text-app-700'}`}>
            {done ? <Check className="w-3.5 h-3.5" /> : n}
          </span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

// ─── Colores (bajo la prenda) ────────────────────────────────────────────────

export function ColorSwatches({ api }: { api: CustomizerApi }) {
  const colors = api.template?.colors || [];
  if (!colors.length) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-gray-500">Color: <span className="font-semibold text-gray-900">{api.color?.name || '—'}</span></p>
      <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Color de la prenda">
        {colors.map((c) => {
          const on = c.id === api.colorId;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={c.name}
              aria-label={c.name}
              onClick={() => api.setColorId(c.id)}
              className={`w-8 h-8 rounded-full ring-1 ring-black/10 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500 ${on ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_rgb(var(--app-600))]' : 'hover:shadow-[0_0_0_2px_#fff,0_0_0_4px_#d1d5db]'}`}
              style={{ backgroundColor: c.hexCode }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Paso 1 ──────────────────────────────────────────────────────────────────

export function OptionsStep({ api, onSizeGuide }: { api: CustomizerApi; onSizeGuide?: () => void }) {
  const { format } = useCurrency();
  const t = api.template!;
  return (
    <StepCard
      n={1}
      title="Modelo y talla"
      done={!!api.size}
      action={!api.isEditMode && <button type="button" onClick={() => api.selectTemplate(null)} className="text-sm font-medium text-app-700 hover:text-app-800">Cambiar</button>}
    >
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <p className="text-sm font-medium text-gray-900">{t.name.replace(/\s+personalizable$/i, '')}</p>
        <p className="text-sm text-gray-500 whitespace-nowrap">desde <span className="font-semibold text-gray-900">{format(api.quote.basePrice || t.basePrice)}</span></p>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Talla</span>
        {onSizeGuide && (
          <button type="button" onClick={onSizeGuide} className="inline-flex items-center gap-1 text-xs font-medium text-app-700 hover:text-app-800">
            <Ruler className="w-3.5 h-3.5" /> Guía de tallas
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Talla">
        {(t.sizes || []).map((s) => {
          const on = s.id === api.sizeId;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              title={s.name}
              onClick={() => api.setSizeId(s.id)}
              className={`min-w-[3rem] h-10 px-3 rounded-lg border text-sm font-semibold transition-colors ${on ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 text-gray-700 hover:border-gray-400'}`}
            >
              {s.abbreviation}
            </button>
          );
        })}
      </div>
      {!api.size && <p className="text-xs text-gray-500 mt-2">Elige tu talla para ver el stock disponible.</p>}
    </StepCard>
  );
}

// ─── Paso 2 ──────────────────────────────────────────────────────────────────

function DesignGallery({ onPick, disabled }: { onPick: (img: DesignImage) => void; disabled?: boolean }) {
  const [images, setImages] = useState<DesignImage[]>([]);
  const [all, setAll] = useState(false);
  useEffect(() => {
    let alive = true;
    designImagesService.getAll({ isActive: true }).then((r) => alive && setImages(r)).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!images.length) return null;
  const list = all ? images : images.slice(0, 8);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">O usa un diseño de la galería</p>
        {images.length > 8 && <button type="button" onClick={() => setAll((v) => !v)} className="text-xs font-medium text-app-700">{all ? 'Ver menos' : `Ver todos (${images.length})`}</button>}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {list.map((img) => (
          <button key={img.id} type="button" disabled={disabled} onClick={() => onPick(img)} title={img.name}
            className="aspect-square rounded-lg border border-gray-200 bg-gray-50 p-1.5 hover:border-app-400 hover:bg-app-50 transition-colors disabled:opacity-50">
            <img src={assetUrl(img.thumbnailUrl || img.fullUrl)} alt={img.name} loading="lazy" className="w-full h-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, suffix, onStart, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix: string; onStart: () => void; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-gray-600 mb-1">
        {label}
        <span className="font-medium text-gray-900 tabular-nums">{Math.round(value)}{suffix}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onPointerDown={onStart} onKeyDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--app-600))] cursor-pointer"
      />
    </label>
  );
}

const DPI_TEXT = {
  good: { tone: 'green' as const, text: 'Buena calidad de impresión' },
  fair: { tone: 'amber' as const, text: 'Calidad aceptable: no la agrandes más' },
  low: { tone: 'red' as const, text: 'Baja resolución: se verá borrosa' },
};

export function DesignTools({ api, design }: { api: CustomizerApi; design: StudioDesign }) {
  const zone = api.zones.find((z) => z.id === design.templateZoneId);
  const dpi = estimateDpi(design);
  const level = dpiLevel(dpi);
  const cm = printSizeCm(design, api.stageAspect);
  const otherViews = api.views.filter((v) => v.slug !== design.viewSlug && printZonesOf(api.zones, v.slug).length);
  const viewZones = printZonesOf(api.zones, design.viewSlug);
  const ratio = design.size.height / (design.size.width || 1);
  const maxW = zone ? Math.min(zone.width, zone.height / (ratio || 1)) : 100;
  const begin = () => api.dispatch({ type: 'begin' });

  return (
    <div className="rounded-xl border border-app-200 bg-app-50/40 p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-white ring-1 ring-gray-200 p-1 flex-shrink-0">
          <img src={assetUrl(design.imageData)} alt="" className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{design.originalFileName || 'Diseño'}</p>
          <p className="text-xs text-gray-500">{zone?.name || design.zoneName} · aprox. {cm.width} × {cm.height} cm</p>
        </div>
      </div>

      {level !== 'unknown' && (
        <p className={`flex items-center gap-1.5 text-xs font-medium ${level === 'good' ? 'text-emerald-700' : level === 'fair' ? 'text-amber-700' : 'text-red-600'}`}>
          {level === 'good' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {DPI_TEXT[level].text} ({dpi} dpi)
        </p>
      )}

      <Slider label="Tamaño" suffix="%" min={MIN_DESIGN_SIZE} max={Math.max(MIN_DESIGN_SIZE, Math.floor(maxW))} value={design.size.width}
        onStart={begin} onChange={(w) => api.update(design.id, { size: { width: w, height: w * ratio } }, false)} />
      <Slider label="Rotación" suffix="°" min={-180} max={180} value={design.rotation}
        onStart={begin} onChange={(r) => api.update(design.id, { rotation: r }, false)} />

      {viewZones.length > 1 && (
        <div>
          <p className="text-xs text-gray-600 mb-1">Zona</p>
          <div className="flex flex-wrap gap-1.5">
            {viewZones.map((z) => (
              <button key={z.id} type="button" onClick={() => api.moveToZone(design.id, z.id)}
                className={`h-8 px-2.5 rounded-lg border text-xs font-medium ${z.id === design.templateZoneId ? 'border-app-600 bg-white text-app-700' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}>
                {z.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 [&>button]:whitespace-nowrap">
        <Button size="sm" variant="secondary" icon={<Crosshair className="w-4 h-4" />} onClick={() => api.center(design.id)}>Centrar</Button>
        <Button size="sm" variant="secondary" icon={<Expand className="w-4 h-4" />} onClick={() => api.fitToZone(design.id)}>Ajustar</Button>
        <Button size="sm" variant="secondary" icon={<ArrowUpToLine className="w-4 h-4" />} onClick={() => api.dispatch({ type: 'toFront', id: design.id })}>Al frente</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {otherViews.map((v) => (
          <Button key={v.slug} size="sm" variant="ghost" icon={<Copy className="w-4 h-4" />} onClick={() => api.duplicateTo(design.id, v.slug)}>Copiar a {v.name.toLowerCase()}</Button>
        ))}
        <Button size="sm" variant="ghost" className="!text-red-600 hover:!bg-red-50 ml-auto" icon={<Trash2 className="w-4 h-4" />} onClick={() => api.dispatch({ type: 'remove', id: design.id })}>Quitar</Button>
      </div>
      <p className="hidden lg:block text-[11px] text-gray-500">Flechas: mover · Supr: quitar · Ctrl+Z: deshacer</p>
    </div>
  );
}

export function DesignStep({ api }: { api: CustomizerApi }) {
  const selected = api.selected;
  const others = api.studio.designs;
  return (
    <StepCard n={2} title="Tu diseño" done={others.length > 0}>
      <div className="space-y-4">
        {api.views.length > 0 && api.activeZone ? (
          <FileDrop
            compact={others.length > 0}
            accept={ACCEPTED_TYPES.join(',')}
            maxSizeMB={MAX_INPUT_MB}
            disabled={api.processing}
            onFiles={(files) => api.addFiles(files)}
            title={api.processing ? 'Preparando imagen…' : others.length ? `Agregar otra imagen en ${api.activeZone.name.toLowerCase()}` : `Sube tu imagen para ${api.activeZone.name.toLowerCase()}`}
            hint="PNG con fondo transparente se ve mejor · JPG, WEBP o SVG"
          />
        ) : (
          api.zonesReady && <Alert tone="warning">Este modelo aún no tiene zonas de diseño configuradas.</Alert>
        )}

        <DesignGallery onPick={(img) => api.addPreset(img)} disabled={api.processing || !api.activeZone} />

        {others.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">En tu prenda</p>
            <ul className="space-y-1.5">
              {others.map((d) => {
                const v = api.views.find((x) => x.slug === d.viewSlug);
                const on = selected?.id === d.id;
                return (
                  <li key={d.id}>
                    <button type="button" onClick={() => { if (api.view !== d.viewSlug) api.changeView(d.viewSlug); api.dispatch({ type: 'select', id: d.id }); }}
                      className={`w-full flex items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors ${on ? 'border-app-400 bg-app-50/60' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <img src={assetUrl(d.imageData)} alt="" className="w-9 h-9 rounded bg-gray-50 object-contain ring-1 ring-gray-200" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-gray-900 truncate">{d.originalFileName || 'Diseño'}</span>
                        <span className="block text-xs text-gray-500">{v?.name} · {d.zoneName}</span>
                      </span>
                      <Pencil className={`w-4 h-4 ${on ? 'text-app-600' : 'text-gray-400'}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {selected && <DesignTools api={api} design={selected} />}
        {!others.length && api.activeZone && (
          <p className="flex items-start gap-2 text-xs text-gray-500">
            <ImagePlus className="w-4 h-4 flex-shrink-0 text-gray-400" />
            Tu imagen aparece en la zona punteada. Arrástrala para moverla, usa la esquina para cambiar el tamaño y el círculo de arriba para girarla.
          </p>
        )}
      </div>
    </StepCard>
  );
}

// ─── Paso 3 ──────────────────────────────────────────────────────────────────

export function SummaryStep({ api }: { api: CustomizerApi }) {
  const { format } = useCurrency();
  const q = api.quote;
  const max = api.stock !== null ? Math.max(1, Math.min(99, api.stock)) : 99;

  return (
    <StepCard n={3} title="Resumen" done={api.canSubmit}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-600">Prenda</dt>
          <dd className="tabular-nums text-gray-900">
            {(q.listPrice ?? 0) > q.basePrice && <s className="text-gray-400 mr-1.5">{format(q.listPrice!)}</s>}
            {format(q.basePrice)}
          </dd>
        </div>
        {(q.listPrice ?? 0) > q.basePrice && (
          <p className="text-xs text-green-700 -mt-1 text-right">Oferta: ahorras {format(q.listPrice! - q.basePrice)} en la prenda</p>
        )}
        {q.zones.map((z) => (
          <div key={z.id} className="flex justify-between gap-3"><dt className="text-gray-600">Estampado {z.name.toLowerCase()}</dt><dd className="tabular-nums text-gray-900">{z.price > 0 ? `+${format(z.price)}` : 'Incluido'}</dd></div>
        ))}
        {!q.zones.length && <p className="text-xs text-gray-500">Cada zona que diseñes suma su precio de estampado.</p>}
        <div className="flex justify-between gap-3 pt-2 border-t border-gray-100">
          <dt className="font-medium text-gray-900">Precio por unidad</dt>
          <dd className="font-semibold text-gray-900 tabular-nums">{format(q.total)}</dd>
        </div>
        {q.estimated && q.zones.length > 0 && <p className="text-[11px] text-gray-500">Precio estimado; se confirma al agregar al carrito.</p>}
      </dl>

      <div className="flex items-center justify-between gap-3 mt-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Cantidad</p>
          <StockText api={api} />
        </div>
        <QuantityStepper
          value={api.quantity}
          onDecrease={() => api.setQuantity(Math.max(1, api.quantity - 1))}
          onIncrease={() => api.setQuantity(Math.min(max, api.quantity + 1))}
          canDecrease={api.quantity > 1}
          canIncrease={api.quantity < max}
        />
      </div>

      {api.blockers.length > 0 && (
        <ul className="mt-4 space-y-1">
          {api.blockers.map((b) => <li key={b} className="flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle className="w-3.5 h-3.5" />{b}</li>)}
        </ul>
      )}

      <div className="hidden lg:block mt-4 space-y-2">
        <SubmitButton api={api} />
        {api.studio.designs.length > 0 && (
          <Button variant="ghost" size="sm" fullWidth isLoading={api.exporting} icon={<Download className="w-4 h-4" />} onClick={api.exportZip}>Descargar mis diseños (ZIP)</Button>
        )}
      </div>
      <div className="lg:hidden mt-3">
        {api.studio.designs.length > 0 && (
          <Button variant="ghost" size="sm" fullWidth isLoading={api.exporting} icon={<Download className="w-4 h-4" />} onClick={api.exportZip}>Descargar mis diseños (ZIP)</Button>
        )}
      </div>
    </StepCard>
  );
}

export function StockText({ api }: { api: CustomizerApi }) {
  if (!api.size) return null;
  if (api.loadingStock) return <p className="text-xs text-gray-500 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Consultando stock…</p>;
  if (api.stock === null) return null;
  if (api.stock === 0) return <Badge tone="red">Sin stock</Badge>;
  return <p className={`text-xs ${api.stock <= 3 ? 'text-amber-700' : 'text-emerald-700'}`}>{api.stock <= 3 ? `¡Últimas ${api.stock}!` : `${api.stock} disponibles`}</p>;
}

/** Botón de compra. Con `onBlocked` no se deshabilita: al tocarlo avisa qué falta (celular). */
export function SubmitButton({ api, size = 'lg', onBlocked }: { api: CustomizerApi; size?: 'md' | 'lg'; onBlocked?: () => void }) {
  const blocked = !api.canSubmit;
  return (
    <Button
      size={size} fullWidth isLoading={api.saving} disabled={blocked && !onBlocked} className={blocked && onBlocked ? 'opacity-60' : ''}
      icon={<ShoppingCart className="w-5 h-5" />}
      onClick={() => { if (blocked) onBlocked?.(); api.submit(); }}
    >
      {api.saving ? 'Preparando tu diseño…' : api.isEditMode ? 'Guardar cambios' : 'Agregar al carrito'}
    </Button>
  );
}
