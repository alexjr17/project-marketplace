/**
 * Fondo de una escena de video, con la misma libertad que en los posts: color, degradado, malla, rayas,
 * mosaico de la marca o de los diseños (colores, densidad, tamaño, giro, grano, movimiento), o una foto
 * (de tus archivos o creada con IA) que se puede oscurecer para que se lean los textos.
 */
import { ImagePlus, Sparkles, Wand2 } from 'lucide-react';
import { Button, ColorInput, RadioGroup, Switch } from '../ui';
import { BG_STYLES, XMAS_COLORS } from './backgrounds';
import { DesignPicker } from './DesignPicker';
import type { SceneBg } from './timeline';

const STYLE_LABEL: Record<SceneBg['style'], string> = {
  ...Object.fromEntries(BG_STYLES.map((s) => [s.value, s.label])) as Record<Exclude<SceneBg['style'], 'foto'>, string>,
  foto: 'Foto',
};

function Range({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm text-gray-700"><span>{label}</span><span className="tabular-nums text-gray-900">{format(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-app-600" />
    </label>
  );
}

function Swatches({ label, value, palette, onChange }: { label: string; value: string; palette: { label: string; hex: string }[]; onChange: (hex: string) => void }) {
  return (
    <div>
      <p className="text-sm text-gray-700 mb-1">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {palette.map((p) => (
          <button key={p.hex + p.label} type="button" title={p.label} aria-label={`${label}: ${p.label}`} aria-pressed={value.toUpperCase() === p.hex.toUpperCase()} onClick={() => onChange(p.hex.toUpperCase())}
            className={`w-7 h-7 rounded-full border-2 ${value.toUpperCase() === p.hex.toUpperCase() ? 'border-app-600 ring-2 ring-app-200' : 'border-gray-200'}`} style={{ background: p.hex }} />
        ))}
        <div className="w-28"><ColorInput value={value} onChange={(c) => onChange(c.toUpperCase())} /></div>
      </div>
    </div>
  );
}

export function SceneBgEditor({ value, onChange, palette, photos, defaults, onAi, onApplyAll, onUpload }: {
  value: SceneBg | null;
  onChange: (bg: SceneBg | null, merge?: string) => void;
  /** Colores de la marca para elegir rápido. */
  palette: { label: string; hex: string }[];
  /** Fotos para el fondo (tus archivos y las creadas con IA). */
  photos: { name: string; url: string }[];
  /** Fondo propio con el que se empieza (colores de la marca). */
  defaults: SceneBg;
  onAi: () => void;
  onApplyAll: () => void;
  onUpload: (file: File) => void;
}) {
  const g = value;
  const set = (p: Partial<SceneBg>, merge?: string) => onChange({ ...(g ?? defaults), ...p }, merge);
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-2.5">
      <p className="text-sm font-medium text-gray-800">Fondo de la escena</p>
      <RadioGroup
        variant="segmented" value={g ? 'propio' : 'plantilla'} onChange={(v) => onChange(v === 'propio' ? { ...defaults } : null)}
        options={[{ value: 'plantilla', label: 'El de la plantilla' }, { value: 'propio', label: 'Propio' }]}
      />
      {g && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(STYLE_LABEL) as SceneBg['style'][]).map((st) => (
              <button key={st} type="button" aria-pressed={g.style === st} onClick={() => { const x = st !== 'foto' ? XMAS_COLORS[st] : undefined; set(x ? { style: st, ...x } : { style: st }); }}
                className={`rounded-lg border px-2 py-1.5 text-xs text-left ${g.style === st ? 'border-app-600 bg-app-50 text-app-800 font-medium' : 'border-gray-200 text-gray-700 hover:border-app-300'}`}>
                {STYLE_LABEL[st]}
              </button>
            ))}
          </div>

          {g.style === 'foto' ? (
            <>
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {photos.map((p) => (
                  <button key={p.url} type="button" title={p.name} aria-label={`Usar ${p.name} de fondo`} aria-pressed={g.image === p.url} onClick={() => set({ image: p.url })}
                    className={`aspect-square rounded-lg overflow-hidden border-2 ${g.image === p.url ? 'border-app-600' : 'border-gray-200'}`}>
                    <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 grid place-items-center text-gray-500 cursor-pointer hover:border-app-400" title="Subir una foto">
                  <ImagePlus className="w-5 h-5" />
                  <input type="file" accept="image/*" className="sr-only" aria-label="Subir una foto de fondo" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
                </label>
              </div>
              <Button size="sm" variant="outline" className="w-full" icon={<Sparkles className="w-4 h-4" />} onClick={onAi}>Fondo profesional con IA</Button>
              <Range label="Oscurecer (para que se lean los textos)" value={Math.round(g.dim * 100)} min={0} max={70} step={5} format={(v) => (v ? `${v}%` : 'No')} onChange={(v) => set({ dim: v / 100 }, 'bgdim')} />
              <Switch checked={g.move} onChange={(v) => set({ move: v })} label="Acercar despacio" description="La foto se mueve un poco durante la escena." />
            </>
          ) : (
            <>
              <Swatches label="Color de fondo" value={g.base} palette={palette} onChange={(c) => set({ base: c }, 'bgbase')} />
              {g.style !== 'color' && g.style !== 'mosaicoDisenos' && (
                <Swatches label={g.style === 'degradado' ? 'Hacia el color' : g.style === 'malla' ? 'Color de las manchas' : g.style === 'mosaicoMarca' ? 'Color del texto (si no hay logo)' : 'Color del dibujo'} value={g.ink} palette={palette} onChange={(c) => set({ ink: c }, 'bgink')} />
              )}
              {g.style === 'malla' && <Swatches label="Tercer color" value={g.accent} palette={palette} onChange={(c) => set({ accent: c }, 'bgacc')} />}
              {g.style !== 'color' && g.style !== 'degradado' && (
                <Range label="Cuánto se nota" value={Math.round(g.density * 100)} min={2} max={100} step={1} format={(v) => `${v}%`} onChange={(v) => set({ density: v / 100 }, 'bgden')} />
              )}
              {(g.style === 'rayas' || g.style === 'mosaicoMarca' || g.style === 'mosaicoDisenos') && (
                <Range label="Tamaño" value={g.size} min={40} max={400} step={5} format={(v) => `${v} px`} onChange={(v) => set({ size: v }, 'bgsize')} />
              )}
              {g.style !== 'color' && g.style !== 'malla' && (
                <Range label="Giro" value={g.angle} min={-90} max={90} step={1} format={(v) => `${v}°`} onChange={(v) => set({ angle: v }, 'bgang')} />
              )}
              <Switch checked={g.grain} onChange={(v) => set({ grain: v })} label="Grano de película" />
              <Switch checked={g.move} onChange={(v) => set({ move: v })} label="Movimiento suave" description="El dibujo gira despacio durante la escena." />
              {g.style === 'mosaicoDisenos' && (
                <div className="space-y-2 rounded-lg bg-gray-50 p-2.5">
                  <Switch checked={g.useSceneDesigns !== false} onChange={(v) => set({ useSceneDesigns: v })} label="Usar los diseños de las prendas" description="Los de las escenas de la prenda del video (y los del post)." />
                  {(g.designs ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {g.designs.map((u) => (
                        <button key={u} type="button" title="Quitar del mosaico" aria-label="Quitar este diseño del mosaico" onClick={() => set({ designs: g.designs.filter((x) => x !== u) })}
                          className="w-12 h-12 rounded-lg ring-1 ring-gray-200 bg-white p-1 hover:ring-red-300"><img src={u} alt="" className="w-full h-full object-contain" /></button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-600">Agregar diseños al mosaico:</p>
                  <DesignPicker idPrefix="scbg" value={null} onChange={(d) => { if (d && !(g.designs ?? []).includes(d.image)) set({ designs: [...(g.designs ?? []), d.image] }); }} />
                </div>
              )}
            </>
          )}
          <Button size="sm" variant="secondary" className="w-full" icon={<Wand2 className="w-4 h-4" />} onClick={onApplyAll}>Usar este fondo en todas las escenas</Button>
        </>
      )}
    </div>
  );
}
