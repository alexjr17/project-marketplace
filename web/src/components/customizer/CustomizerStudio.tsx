/**
 * Distribución del estudio.
 * - Escritorio: lienzo grande a la izquierda (vistas arriba, colores abajo) y los 3 pasos a la derecha.
 * - Celular: lienzo arriba, pasos en pestañas debajo y una barra fija con el total y el botón.
 */
import { useEffect, useRef, useState } from 'react';
import { Redo2, Undo2 } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import { getSizeChart } from '../../data/sizeCharts';
import { SizeGuideModal } from './SizeGuideModal';
import { Stage } from './Stage';
import { ColorSwatches, DesignStep, OptionsStep, StockText, SubmitButton, SummaryStep } from './StudioPanels';
import { ACCEPTED_TYPES } from './designImage';
import { sizeChartType } from './customizerModel';
import type { CustomizerApi } from './useCustomizer';

type MobileTab = 'options' | 'design' | 'summary';

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Atajos: Ctrl+Z / Ctrl+Shift+Z (o Ctrl+Y), flechas para mover y Supr para quitar. */
function useShortcuts(api: CustomizerApi) {
  const ref = useRef(api);
  useEffect(() => { ref.current = api; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) && !(e.target instanceof HTMLInputElement && e.target.type === 'range')) return;
      const a = ref.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); a.dispatch({ type: e.shiftKey ? 'redo' : 'undo' }); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); a.dispatch({ type: 'redo' }); return; }
      const d = a.selected;
      if (!d || isTyping(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); a.dispatch({ type: 'remove', id: d.id }); return; }
      const step = e.shiftKey ? 2 : 0.5;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (delta) { e.preventDefault(); a.update(d.id, { position: { x: d.position.x + delta[0], y: d.position.y + delta[1] } }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function CustomizerStudio({ api }: { api: CustomizerApi }) {
  const { format } = useCurrency();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<MobileTab>('design');
  const [guide, setGuide] = useState(false);
  useShortcuts(api);

  const chart = api.template ? getSizeChart(sizeChartType(api.template.typeSlug, api.template.typeName)) : undefined;
  const designedViews = new Set(api.studio.designs.map((d) => d.viewSlug));
  const requestUpload = () => fileRef.current?.click();

  const tabs: Array<{ value: MobileTab; label: string; done: boolean }> = [
    { value: 'options', label: 'Talla', done: !!api.size },
    { value: 'design', label: 'Diseño', done: api.studio.designs.length > 0 },
    { value: 'summary', label: 'Resumen', done: api.canSubmit },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-6 pb-28 lg:pb-8">
      <input ref={fileRef} type="file" hidden accept={ACCEPTED_TYPES.join(',')} onChange={(e) => { api.addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 items-start">
        {/* Lienzo */}
        <section className="bg-white rounded-xl border border-gray-200 p-3 md:p-5 lg:sticky lg:top-[calc(var(--store-header-h,72px)+16px)]">
          <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Vistas">
              {api.views.map((v) => {
                const on = v.slug === api.view;
                return (
                  <button key={v.slug} type="button" role="tab" aria-selected={on} onClick={() => api.changeView(v.slug)}
                    className={`relative h-9 px-3.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${on ? 'bg-app-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {v.name}
                    {designedViews.has(v.slug) && <span className={`ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle ${on ? 'bg-white' : 'bg-app-500'}`} aria-label="con diseño" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button type="button" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" disabled={!api.studio.past.length} onClick={() => api.dispatch({ type: 'undo' })}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
              <button type="button" title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" disabled={!api.studio.future.length} onClick={() => api.dispatch({ type: 'redo' })}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"><Redo2 className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-b from-gray-50 to-gray-100/80 px-4 pt-9 pb-4 md:px-8 md:pt-10 md:pb-6">
            <div className="[--stage-h:44vh] lg:[--stage-h:60vh]"><Stage api={api} maxHeight="var(--stage-h)" onRequestUpload={requestUpload} /></div>
          </div>

          <div className="mt-3 md:mt-4"><ColorSwatches api={api} /></div>
        </section>

        {/* Pasos */}
        <div>
          <div className="lg:hidden sticky top-[var(--store-header-h,56px)] z-20 -mx-3 px-3 py-2 bg-gray-50/95 backdrop-blur mb-2">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-white border border-gray-200 p-1" role="tablist">
              {tabs.map((t) => (
                <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} onClick={() => setTab(t.value)}
                  className={`h-9 rounded-lg text-sm font-medium transition-colors ${tab === t.value ? 'bg-app-600 text-white' : 'text-gray-600'}`}>
                  {t.label}{t.done && tab !== t.value ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className={tab === 'options' ? '' : 'hidden lg:block'}><OptionsStep api={api} onSizeGuide={chart ? () => setGuide(true) : undefined} /></div>
            <div className={tab === 'design' ? '' : 'hidden lg:block'}><DesignStep api={api} /></div>
            <div className={tab === 'summary' ? '' : 'hidden lg:block'}><SummaryStep api={api} /></div>
          </div>
        </div>
      </div>

      {/* Barra fija (celular), encima de la navegación inferior */}
      <div className="lg:hidden fixed inset-x-0 bottom-[var(--store-bottom-nav)] z-40 bg-white border-t border-gray-200 px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-500 leading-tight">{api.quantity > 1 ? `${api.quantity} × ${format(api.quote.total)}` : 'Total'}</p>
            <p className="text-base font-bold text-gray-900 tabular-nums leading-tight">{format(api.quote.total * api.quantity)}</p>
            <StockText api={api} />
          </div>
          <div className="flex-1">
            <SubmitButton api={api} size="md" onBlocked={() => setTab(!api.size ? 'options' : !api.studio.designs.length ? 'design' : 'summary')} />
          </div>
        </div>
      </div>

      {chart && <SizeGuideModal isOpen={guide} onClose={() => setGuide(false)} sizeChart={chart} />}
    </div>
  );
}
