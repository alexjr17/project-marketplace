/**
 * Personalizador → texto del cliente: lo que dice, estilos rápidos, fuente, color, forma (recto, arco,
 * puente, círculo, onda), espaciado y contorno. Sin sombras: en DTF no imprimen bien. Solo pinta; los cambios van a useCustomizer.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, CaseUpper, Italic } from 'lucide-react';
import { Switch } from '../ui';
import { TEXT_FONTS, TEXT_SHAPES, TEXT_STYLES, fontOf, loadAllTextFonts, type TextFont, type TextShape, type TextSpec } from '../../lib/textArt';
import type { CustomizerApi } from './useCustomizer';
import type { StudioDesign } from './customizerModel';

const COLORS = ['#111111', '#FFFFFF', '#C62828', '#2E7D32', '#1565C0', '#F9A825', '#EF6C00', '#6A1B9A', '#D81B60', '#00838F', '#8D6E63', '#B8860B'];

const GROUPS: TextFont['group'][] = ['Impacto', 'Clásicas', 'Elegantes', 'Manuscritas', 'Navidad', 'Divertidas', 'Deportivas'];

/** Dibujito de cada forma. */
function ShapeIcon({ shape }: { shape: TextShape }) {
  const d: Record<TextShape, ReactNode> = {
    recto: <path d="M4 14h24" />,
    arco: <path d="M4 18 Q16 2 28 18" />,
    puente: <path d="M4 8 Q16 24 28 8" />,
    circulo: <circle cx="16" cy="13" r="8" />,
    onda: <path d="M3 13 Q8 5 12 13 T21 13 T29 13" />,
  };
  return <svg viewBox="0 0 32 24" className="w-8 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">{d[shape]}</svg>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Range({ label, value, min, max, step = 1, suffix = '', onStart, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onStart: () => void; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-gray-600 mb-1">
        {label}<span className="font-medium text-gray-900 tabular-nums">{Math.round(value)}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onPointerDown={onStart} onKeyDown={onStart} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--app-600))] cursor-pointer" />
    </label>
  );
}

function ColorPick({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  const custom = !COLORS.includes(value.toUpperCase());
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
      {COLORS.map((c) => {
        const on = value.toUpperCase() === c;
        return (
          <button key={c} type="button" role="radio" aria-checked={on} aria-label={`${label} ${c}`} onClick={() => onChange(c)}
            className={`w-7 h-7 rounded-full ring-1 ring-black/15 ${on ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_rgb(var(--app-600))]' : ''}`} style={{ backgroundColor: c }} />
        );
      })}
      <label className={`relative w-7 h-7 rounded-full ring-1 ring-black/15 overflow-hidden cursor-pointer ${custom ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_rgb(var(--app-600))]' : ''}`}
        style={{ background: custom ? value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} title="Otro color">
        <input type="color" aria-label={`${label}: otro color`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
    </div>
  );
}

export function TextTools({ api, design }: { api: CustomizerApi; design: StudioDesign }) {
  const spec = design.text!;
  const begin = () => api.dispatch({ type: 'begin' });
  const set = (p: Partial<TextSpec>, record = true) => { void api.setText(design.id, p, record); };
  const sample = useMemo(() => (spec.text.split('\n')[0].trim() || 'Tu texto').slice(0, 14), [spec.text]);
  const multiLine = spec.text.includes('\n');

  return (
    <div className="rounded-xl border border-app-200 bg-white p-3 space-y-4" aria-label="Texto">
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Tu texto</span>
        <textarea
          value={spec.text} rows={2} maxLength={80} aria-label="Tu texto"
          onFocus={begin} onChange={(e) => set({ text: e.target.value }, false)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-400 resize-none"
          placeholder="Escribe un nombre, una frase…"
        />
        <span className="text-[11px] text-gray-500">{spec.shape === 'recto' ? 'Enter para otra línea.' : 'Las formas curvas van en una sola línea.'}</span>
      </label>

      <Row label="Estilos rápidos">
        <div className="flex flex-wrap gap-1.5">
          {TEXT_STYLES.map((st) => (
            <button key={st.label} type="button" onClick={() => set(st.spec)}
              className="h-8 px-2.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:border-app-400 hover:bg-app-50">
              {st.label}
            </button>
          ))}
        </div>
      </Row>

      <TextStyleEditor spec={spec} sample={sample} onBegin={begin} onChange={set} multiLine={multiLine} />
    </div>
  );
}

/** Estilo del texto (fuente, color, forma, espaciado, contorno). Lo usan el cliente y el admin. */
export function TextStyleEditor({ spec, sample, onChange, onBegin, multiLine = false }: {
  spec: TextSpec; sample: string; onChange: (p: Partial<TextSpec>, record?: boolean) => void; onBegin: () => void; multiLine?: boolean;
}) {
  const set = onChange;
  const begin = onBegin;
  const font = fontOf(spec.font);
  // La pestaña de fuentes sigue a la fuente elegida, salvo que se abra otra a mano.
  const [pick, setPick] = useState<{ font: string; group: TextFont['group'] } | null>(null);
  const group = pick && pick.font === spec.font ? pick.group : font.group;
  const setGroup = (g: TextFont['group']) => setPick({ font: spec.font, group: g });
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => { let alive = true; loadAllTextFonts().then(() => alive && setFontsReady(true)); return () => { alive = false; }; }, []);
  const curved = spec.shape === 'arco' || spec.shape === 'puente' || spec.shape === 'onda';
  return (
    <>
      <Row label="Fuente">
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Tipo de fuente">
          {GROUPS.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={group === g} onClick={() => setGroup(g)}
              className={`h-7 px-2.5 rounded-full text-xs whitespace-nowrap ${group === g ? 'bg-app-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {g}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Fuente">
          {TEXT_FONTS.filter((f) => f.group === group).map((f) => {
            const on = f.family === spec.font;
            return (
              <button key={f.family} type="button" role="radio" aria-checked={on} aria-label={f.family} title={f.family}
                onClick={() => set({ font: f.family, weight: f.weights.includes(spec.weight) ? spec.weight : f.weights[f.weights.length - 1], ...(f.group === 'Manuscritas' ? { upper: false } : {}) })}
                className={`h-12 px-2 rounded-lg border text-left overflow-hidden ${on ? 'border-app-600 bg-app-50' : 'border-gray-200 hover:border-gray-400'}`}>
                <span className={`block truncate text-lg leading-tight text-gray-900 transition-opacity ${fontsReady ? '' : 'opacity-40'}`}
                  style={{ fontFamily: `"${f.family}"`, fontWeight: f.weights[f.weights.length - 1] }}>{sample}</span>
                <span className="block text-[10px] text-gray-500 truncate">{f.family}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {font.weights.length > 1 && (
            <button type="button" aria-pressed={spec.weight >= 700} title="Negrita" aria-label="Negrita" onClick={() => set({ weight: spec.weight >= 700 ? font.weights[0] : font.weights[font.weights.length - 1] })}
              className={`grid place-items-center w-9 h-9 rounded-lg border ${spec.weight >= 700 ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 text-gray-700'}`}><Bold className="w-4 h-4" /></button>
          )}
          {font.italic && (
            <button type="button" aria-pressed={spec.italic} title="Cursiva" aria-label="Cursiva" onClick={() => set({ italic: !spec.italic })}
              className={`grid place-items-center w-9 h-9 rounded-lg border ${spec.italic ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 text-gray-700'}`}><Italic className="w-4 h-4" /></button>
          )}
          <button type="button" aria-pressed={spec.upper} title="Mayúsculas" aria-label="Mayúsculas" onClick={() => set({ upper: !spec.upper })}
            className={`grid place-items-center w-9 h-9 rounded-lg border ${spec.upper ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 text-gray-700'}`}><CaseUpper className="w-4 h-4" /></button>
          {spec.shape === 'recto' && multiLine && (['left', 'center', 'right'] as const).map((a) => {
            const Icon = a === 'left' ? AlignLeft : a === 'right' ? AlignRight : AlignCenter;
            return (
              <button key={a} type="button" aria-pressed={spec.align === a} title={a === 'left' ? 'A la izquierda' : a === 'right' ? 'A la derecha' : 'Centrado'} aria-label={a === 'left' ? 'A la izquierda' : a === 'right' ? 'A la derecha' : 'Centrado'}
                onClick={() => set({ align: a })}
                className={`grid place-items-center w-9 h-9 rounded-lg border ${spec.align === a ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-300 text-gray-700'}`}><Icon className="w-4 h-4" /></button>
            );
          })}
        </div>
      </Row>

      <Row label="Color">
        <ColorPick label="Color del texto" value={spec.color} onChange={(c) => set({ color: c })} />
      </Row>

      <Row label="Forma">
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Forma del texto">
          {TEXT_SHAPES.map((sh) => {
            const on = spec.shape === sh.value;
            return (
              <button key={sh.value} type="button" role="radio" aria-checked={on} onClick={() => set({ shape: sh.value })}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[11px] ${on ? 'border-app-600 bg-app-50 text-app-700' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                <ShapeIcon shape={sh.value} />{sh.label}
              </button>
            );
          })}
        </div>
        {curved && (
          <div className="mt-2">
            <Range label={spec.shape === 'onda' ? 'Altura de la onda' : 'Curva'} value={spec.curve} min={5} max={100} suffix="%" onStart={begin} onChange={(v) => set({ curve: v }, false)} />
          </div>
        )}
      </Row>

      <div className="grid grid-cols-2 gap-3">
        <Range label="Espacio entre letras" value={spec.spacing} min={-10} max={60} onStart={begin} onChange={(v) => set({ spacing: v }, false)} />
        {spec.shape === 'recto' && multiLine && (
          <Range label="Espacio entre líneas" value={spec.lineHeight * 100} min={70} max={180} suffix="%" onStart={begin} onChange={(v) => set({ lineHeight: v / 100 }, false)} />
        )}
      </div>

      <div className="space-y-2">
        <Switch checked={!!spec.outline} onChange={(v) => set({ outline: v ? { color: spec.color.toUpperCase() === '#FFFFFF' ? '#111111' : '#FFFFFF', width: 6 } : null })} label="Contorno" />
        {spec.outline && (
          <div className="pl-1 space-y-2">
            <ColorPick label="Color del contorno" value={spec.outline.color} onChange={(c) => set({ outline: { ...spec.outline!, color: c } })} />
            <Range label="Grosor del contorno" value={spec.outline.width} min={1} max={20} onStart={begin} onChange={(v) => set({ outline: { ...spec.outline!, width: v } }, false)} />
          </div>
        )}
      </div>

    </>
  );
}
