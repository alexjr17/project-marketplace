/**
 * Editor del video 3D por escenas: línea de tiempo (una tarjeta por escena con la transición entre
 * ellas y el cierre) y el panel de la escena elegida (diseño y zona, color de la prenda, movimiento de
 * cámara, duración, textos y transición a la siguiente).
 */
import { useEffect, useRef, useState, type ChangeEvent, type MutableRefObject } from 'react';
import { ArrowLeft, ArrowRight, Copy, Film, ImageOff, Plus, Trash2, Upload } from 'lucide-react';
import { Button, Card, CardTitle, ColorInput, Field, SearchInput, SelectInput, Spinner, Switch, TextInput } from '../ui';
import { errorMessage } from '../../lib/http';
import { toast } from '../ui';
import { marketingService, type SourceDesign, type SourceZone } from '../../services/marketing.service';
import { view3DOf } from '../mannequin/models';
import {
  clampSeconds, END_SECONDS, layout, MAX_SCENES, MOTIONS, newScene, SCENE_MAX, SCENE_MIN, TRANSITIONS, type Scene,
} from './timeline';
import { zoneOf } from './sceneArt';

const VIEW_LABEL: Record<string, string> = { front: 'Frente', back: 'Espalda', rightSleeve: 'Manga derecha', leftSleeve: 'Manga izquierda' };

export function SceneEditor({
  scenes, onChange, selectedId, onSelect, endCard, onEndCard, zones, colors, playheadRef, onPreview,
}: {
  scenes: Scene[];
  onChange: (s: Scene[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  endCard: boolean;
  onEndCard: (v: boolean) => void;
  zones: SourceZone[];
  /** Colores de la plantilla (los de la marca van aparte). */
  colors: string[];
  /** Línea que marca el segundo que se está viendo (la mueve la vista previa). */
  playheadRef: MutableRefObject<HTMLDivElement | null>;
  /** Ver la escena en la vista previa (pausa en su mitad). */
  onPreview: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [designs, setDesigns] = useState<SourceDesign[]>([]);
  const [loading, setLoading] = useState(false);
  /** Imágenes subidas aquí (no van a la biblioteca de diseños): se usan solo en este video. */
  const [uploads, setUploads] = useState<SourceDesign[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      setLoading(true);
      marketingService.sources<SourceDesign>('diseno', q)
        .then((r) => { if (alive) setDesigns(r.filter((d) => d.image)); })
        .catch((e) => { if (alive) toast.error(errorMessage(e, 'No se pudieron cargar los diseños')); })
        .finally(() => { if (alive) setLoading(false); });
    }, q ? 300 : 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, [q]);

  const { starts, total } = layout(scenes, endCard);
  const idx = Math.max(0, scenes.findIndex((s) => s.id === selectedId));
  const sc = scenes[idx];

  const patch = (p: Partial<Scene>) => onChange(scenes.map((s, i) => (i === idx ? { ...s, ...p } : s)));
  const add = () => {
    if (scenes.length >= MAX_SCENES) return;
    const last = scenes[scenes.length - 1];
    const n = newScene({ color: last?.color ?? colors[0] ?? '#FFFFFF', motion: 'revelar', zoneId: last?.zoneId ?? null });
    onChange([...scenes, n]);
    onSelect(n.id);
  };
  const duplicate = () => {
    if (scenes.length >= MAX_SCENES) return;
    const n = { ...sc, id: newScene().id };
    onChange([...scenes.slice(0, idx + 1), n, ...scenes.slice(idx + 1)]);
    onSelect(n.id);
  };
  const remove = () => {
    if (scenes.length <= 1) return;
    const next = scenes.filter((_, i) => i !== idx);
    onChange(next);
    onSelect(next[Math.max(0, idx - 1)].id);
  };
  const move = (d: -1 | 1) => {
    const j = idx + d;
    if (j < 0 || j >= scenes.length) return;
    const next = [...scenes];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  /** De espaldas se ve la espalda: si la plantilla tiene zona de espalda, el diseño pasa ahí (y al revés). */
  const setMotion = (motion: Scene['motion']) => {
    const want = motion === 'espalda' ? 'back' : motion === 'frente' || motion === 'acercar' ? 'front' : null;
    const cur = view3DOf(zoneOf(sc, zones).view);
    const z = want && cur !== want ? zones.find((x) => view3DOf(x.view) === want) : undefined;
    patch(z ? { motion, zoneId: z.id } : { motion });
  };

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Elige una imagen (PNG, JPG, WEBP o SVG)'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('La imagen pesa más de 8 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const d: SourceDesign = { id: -Date.now(), name: file.name.replace(/\.[^.]+$/, ''), category: 'Subida', image: String(reader.result) };
      setUploads((u) => [d, ...u]);
      patch({ design: { id: d.id, name: d.name, image: d.image! } });
    };
    reader.readAsDataURL(file);
  };

  const swatches = Array.from(new Set([...colors, '#FFFFFF', '#1F1D1E'].map((c) => c.toUpperCase())));
  const pct = (t: number) => `${total ? (t / total) * 100 : 0}%`;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <CardTitle>Escenas del video</CardTitle>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1 tabular-nums"><Film className="w-4 h-4" />{total.toFixed(1)} s</span>
          <Switch checked={endCard} onChange={onEndCard} label="Cierre con el logo" />
        </div>
      </div>

      {/* Línea de tiempo: el ancho de cada escena es su duración. */}
      <div className="relative">
        <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
          {scenes.map((s, i) => (
            <div key={s.id} className="flex items-stretch" style={{ flex: `${clampSeconds(s.seconds)} 0 0`, minWidth: 120 }}>
              <button
                type="button" onClick={() => { onSelect(s.id); onPreview(s.id); }} aria-pressed={s.id === sc?.id}
                className={`flex-1 min-w-0 rounded-xl border-2 p-2 text-left transition-colors ${s.id === sc?.id ? 'border-app-600 bg-app-50' : 'border-gray-200 bg-white hover:border-app-300'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0 grid place-items-center overflow-hidden" style={{ background: s.color }}>
                    {s.design ? <img src={s.design.image} alt="" className="w-8 h-8 object-contain" /> : <ImageOff className="w-4 h-4 text-gray-400" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 truncate">Escena {i + 1}</span>
                    <span className="block text-xs text-gray-500 truncate">{MOTIONS.find((m) => m.value === s.motion)?.label} · {clampSeconds(s.seconds)} s</span>
                  </span>
                </div>
                {s.title && <span className="mt-1 block text-xs text-gray-600 truncate">"{s.title}"</span>}
              </button>
              {i < scenes.length - 1 && (
                <span className="self-center mx-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 whitespace-nowrap" title="Transición a la siguiente">
                  {TRANSITIONS.find((t) => t.value === s.transition)?.label}
                </span>
              )}
            </div>
          ))}
          {endCard && (
            <div className="flex items-stretch ml-1" style={{ flex: `${END_SECONDS} 0 0`, minWidth: 90 }}>
              <div className="flex-1 rounded-xl border-2 border-dashed border-gray-200 p-2 text-sm text-gray-500 grid place-items-center">Cierre</div>
            </div>
          )}
          <Button variant="outline" size="sm" className="ml-2 self-center flex-shrink-0" icon={<Plus className="w-4 h-4" />} onClick={add} disabled={scenes.length >= MAX_SCENES}>
            Escena
          </Button>
        </div>
      </div>
      {/* Regla de tiempo: proporcional a los segundos, con el inicio de cada escena y lo que se está viendo. */}
      <div className="relative mt-1 h-7" aria-hidden="true">
        <div className="absolute inset-x-0 top-1 h-1.5 rounded-full bg-gray-100" />
        {starts.map((t, i) => (
          <span key={i} className="absolute top-0 flex flex-col items-start" style={{ left: pct(t) }}>
            <span className="w-px h-3.5 bg-gray-300" />
            <span className="text-[11px] text-gray-400 tabular-nums">{t.toFixed(1)}s</span>
          </span>
        ))}
        <div ref={playheadRef} className="absolute top-0 w-3 h-3.5 -ml-1.5 rounded-full bg-app-600 ring-2 ring-white" style={{ left: 0, opacity: 0 }} />
      </div>

      {sc && (
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-5 border-t border-gray-100 pt-4">
          {/* Diseño */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">Diseño de la escena {idx + 1}</p>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0"><SearchInput value={q} onChange={setQ} placeholder="Buscar diseño…" /></div>
              <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>Subir</Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} aria-label="Subir imagen del diseño" />
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
              <button
                type="button" onClick={() => patch({ design: null })} aria-pressed={!sc.design}
                className={`aspect-square rounded-lg border-2 grid place-items-center text-xs text-gray-500 ${!sc.design ? 'border-app-600 bg-app-50' : 'border-gray-200 hover:border-app-300'}`}
              >
                Sin diseño
              </button>
              {loading && !designs.length && !uploads.length && <div className="col-span-3 grid place-items-center"><Spinner /></div>}
              {[...uploads, ...designs].map((d) => (
                <button
                  key={d.id} type="button" title={d.name} aria-pressed={sc.design?.id === d.id}
                  onClick={() => patch({ design: { id: d.id, name: d.name, image: d.image! } })}
                  className={`aspect-square rounded-lg border-2 bg-gray-50 p-1 ${sc.design?.id === d.id ? 'border-app-600' : 'border-gray-200 hover:border-app-300'}`}
                >
                  <img src={d.image!} alt={d.name} className="w-full h-full object-contain" loading="lazy" />
                </button>
              ))}
            </div>
            {!loading && !designs.length && !uploads.length && (
              <p className="text-xs text-gray-500">Aún no hay diseños en la biblioteca: sube una imagen para esta escena.</p>
            )}
            {sc.design && (
              <>
                <Field label="Dónde va" htmlFor="sc-zone">
                  <SelectInput id="sc-zone" value={zoneOf(sc, zones).id} onChange={(e) => patch({ zoneId: Number(e.target.value) })} disabled={!zones.length}>
                    {zones.length
                      ? zones.map((z) => <option key={z.id} value={z.id}>{z.name} ({VIEW_LABEL[view3DOf(z.view)]})</option>)
                      : <option value={0}>Pecho</option>}
                  </SelectInput>
                </Field>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor="sc-size" className="text-sm font-medium text-gray-700">Tamaño en la zona</label>
                    <span className="text-sm tabular-nums text-gray-900">{Math.round(sc.size * 100)}%</span>
                  </div>
                  <input id="sc-size" type="range" min={30} max={100} step={5} value={Math.round(sc.size * 100)} onChange={(e) => patch({ size: Number(e.target.value) / 100 })} className="w-full accent-app-600" />
                </div>
              </>
            )}
          </div>

          {/* Prenda y cámara */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">Prenda y cámara</p>
            <div>
              <p className="text-sm text-gray-700 mb-1.5">Color de la prenda</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {swatches.map((c) => (
                  <button
                    key={c} type="button" title={c} aria-label={`Color ${c}`} aria-pressed={sc.color.toUpperCase() === c} onClick={() => patch({ color: c })}
                    className={`w-8 h-8 rounded-full border-2 ${sc.color.toUpperCase() === c ? 'border-app-600 ring-2 ring-app-200' : 'border-gray-200'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <ColorInput value={sc.color} onChange={(c) => patch({ color: c })} />
            </div>
            <Field label="Movimiento" htmlFor="sc-motion" hint={MOTIONS.find((m) => m.value === sc.motion)?.hint}>
              <SelectInput id="sc-motion" value={sc.motion} onChange={(e) => setMotion(e.target.value as Scene['motion'])}>
                {MOTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </SelectInput>
            </Field>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="sc-secs" className="text-sm font-medium text-gray-700">Duración</label>
                <span className="text-sm tabular-nums text-gray-900">{clampSeconds(sc.seconds)} s</span>
              </div>
              <input id="sc-secs" type="range" min={SCENE_MIN} max={SCENE_MAX} step={0.5} value={clampSeconds(sc.seconds)} onChange={(e) => patch({ seconds: Number(e.target.value) })} className="w-full accent-app-600" />
            </div>
          </div>

          {/* Textos y transición */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">Textos y transición</p>
            <Field label="Título de la escena" htmlFor="sc-title" hint="Vacío: la escena va sin texto.">
              <TextInput id="sc-title" value={sc.title} maxLength={40} onChange={(e) => patch({ title: e.target.value })} placeholder="Ej.: Nueva colección" />
            </Field>
            <Field label="Subtítulo" htmlFor="sc-sub">
              <TextInput id="sc-sub" value={sc.subtitle} maxLength={60} onChange={(e) => patch({ subtitle: e.target.value })} />
            </Field>
            <Field label="Transición a la siguiente" htmlFor="sc-tr" hint={idx === scenes.length - 1 ? (endCard ? 'La última escena pasa al cierre con un fundido.' : 'Es la última escena.') : undefined}>
              <SelectInput id="sc-tr" value={sc.transition} onChange={(e) => patch({ transition: e.target.value as Scene['transition'] })} disabled={idx === scenes.length - 1}>
                {TRANSITIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </SelectInput>
            </Field>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => move(-1)} disabled={idx === 0} aria-label="Mover antes" />
              <Button size="sm" variant="secondary" icon={<ArrowRight className="w-4 h-4" />} onClick={() => move(1)} disabled={idx === scenes.length - 1} aria-label="Mover después" />
              <Button size="sm" variant="secondary" icon={<Copy className="w-4 h-4" />} onClick={duplicate} disabled={scenes.length >= MAX_SCENES}>Duplicar</Button>
              <Button size="sm" variant="secondary" icon={<Trash2 className="w-4 h-4" />} onClick={remove} disabled={scenes.length <= 1}>Quitar</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
