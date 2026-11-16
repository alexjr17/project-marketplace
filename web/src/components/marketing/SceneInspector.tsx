/**
 * Panel de propiedades de la escena elegida, en pestañas: Escena (qué muestra: prenda 3D con su
 * diseño, foto de un producto, texto o un clip propio recortado; la cámara o el movimiento y la
 * duración), Texto (etiqueta, título y subtítulo con su animación y posición, precio) y Transición
 * (hacia la siguiente o al cierre, con su duración).
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Box, Clapperboard, Copy, Image as ImageIcon, Trash2, Type, Volume2, Wand2 } from 'lucide-react';
import { Button, ColorInput, Field, RadioGroup, SearchInput, SelectInput, Spinner, Switch, Tabs, TextInput, toast } from '../ui';
import { errorMessage } from '../../lib/http';
import { marketingService, type SourceProduct } from '../../services/marketing.service';
import { view3DOf } from '../mannequin/models';
import {
  clampSeconds, maxSeconds, MOTIONS, PHOTO_MOVES, SCENE_MIN, SPEED_MAX, SPEED_MIN, TEXT_ANIMS, TEXT_BGS, TEXT_POSITIONS,
  TRANSITION_MAX, TRANSITION_MIN, TRANSITIONS, type Scene, type SceneClip, type SceneKind, type SceneProduct,
} from './timeline';
import { zoneOf } from './sceneArt';
import { DesignPicker } from './DesignPicker';
import { SceneBgEditor } from './SceneBgEditor';
import { DictateButton } from './DictateButton';
import { appendText } from './dictation';
import { photoZones } from './mockup';
import { isSound, playSound, SOUNDS, TRANSITION_SOUNDS } from './sfx';

export type InspectorSection = 'escena' | 'texto' | 'transicion';

const VIEW_LABEL: Record<string, string> = { front: 'Frente', back: 'Espalda', rightSleeve: 'Manga derecha', leftSleeve: 'Manga izquierda' };
const GROUPS: { id: 'suave' | 'movimiento' | 'efecto'; label: string }[] = [
  { id: 'suave', label: 'Suaves' }, { id: 'movimiento', label: 'Con movimiento' }, { id: 'efecto', label: 'Efectos' },
];

const toProduct = (p: SourceProduct): SceneProduct => ({ id: p.id, name: p.name, image: p.image, price: p.price, listPrice: p.listPrice, discountPercent: p.discountPercent });

/** Deslizador con su valor a la derecha. */
function Range({ id, label, value, min, max, step, onChange, format }: {
  id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm tabular-nums text-gray-900">{format(value)}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-app-600" />
    </div>
  );
}

export function SceneInspector({
  scene: sc, index, count, endCard, patch, templates, defaultTemplate, photoTemplates, products, clips, canAdd, onMove, onDuplicate, onRemove, onApplyTransitionAll, onApplyDesignAll, bgPalette, bgPhotos, onBgAi, onBgApplyAll, onBgUpload,
  section, onSection,
}: {
  scene: Scene;
  index: number;
  count: number;
  endCard: boolean;
  patch: (p: Partial<Scene>, merge?: string) => void;
  /** Prendas personalizables con modelo 3D. */
  templates: SourceProduct[];
  defaultTemplate: SourceProduct | null;
  /** Plantillas personalizables con fotos y zonas (para montar diseños en 2D). */
  photoTemplates: SourceProduct[];
  /** Productos de lo que se eligió promocionar (atajo para las escenas de foto). */
  products: SceneProduct[];
  /** Clips de video subidos en el editor. */
  clips: SceneClip[];
  canAdd: boolean;
  section: InspectorSection;
  onSection: (s: InspectorSection) => void;
  onMove: (d: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onApplyTransitionAll: () => void;
  /** Pone el diseño de esta escena en todas las escenas de prenda. */
  onApplyDesignAll: () => void;
  /** Fondo propio de la escena: colores de la marca, fotos disponibles y acciones. */
  bgPalette: { label: string; hex: string }[];
  bgPhotos: { name: string; url: string }[];
  onBgAi: () => void;
  onBgApplyAll: () => void;
  onBgUpload: (file: File) => void;
}) {
  const template = templates.find((t) => t.id === sc.templateId) ?? defaultTemplate ?? templates[0] ?? null;
  const zones = template?.zones ?? [];

  // Búsqueda de productos (escenas de foto).
  const [pq, setPq] = useState('');
  const [found, setFound] = useState<SceneProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sc.kind !== 'foto') return;
    let alive = true;
    const t = window.setTimeout(() => {
      setLoading(true);
      marketingService.sources<SourceProduct>('producto', pq)
        .then((r) => { if (alive) setFound(r.filter((p) => p.image).map(toProduct)); })
        .catch((e) => { if (alive) toast.error(errorMessage(e, 'No se pudieron cargar los productos')); })
        .finally(() => { if (alive) setLoading(false); });
    }, pq ? 300 : 0);
    return () => { alive = false; window.clearTimeout(t); };
  }, [pq, sc.kind]);

  const setKind = (kind: SceneKind) => {
    const p: Partial<Scene> = { kind };
    if (kind === '3d' && sc.templateId == null && template) { p.templateId = template.id; p.color = template.colors?.[0] ?? sc.color; }
    if (kind === 'foto' && !sc.product && (products[0] ?? found[0])) { const pr = products[0] ?? found[0]; p.product = pr; if (!sc.title) p.title = pr.name; }
    if (kind === 'texto') { p.textPos = 'centro'; if (!sc.title) p.title = 'Tu mensaje'; }
    if (kind === 'clip' && !sc.clip && clips[0]) { p.clip = clips[0]; p.clipStart = 0; p.photoMove = 'quieta'; p.seconds = Math.min(clips[0].duration, 6); }
    if (kind !== 'texto' && sc.kind === 'texto') p.textPos = 'abajo';
    patch(p);
  };

  /** De espaldas se ve la espalda: si la plantilla tiene zona de espalda, el diseño pasa ahí (y al revés). */
  const setMotion = (motion: Scene['motion']) => {
    const want = motion === 'espalda' ? 'back' : motion === 'frente' || motion === 'acercar' || motion === 'detalle' ? 'front' : null;
    const cur = view3DOf(zoneOf(sc, zones).view);
    const z = want && cur !== want ? zones.find((x) => view3DOf(x.view) === want) : undefined;
    patch(z ? { motion, zoneId: z.id } : { motion });
  };

  const setTemplate = (id: number) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    // La zona y el color son de cada plantilla.
    const colorOk = (t.colors ?? []).some((c) => c.toUpperCase() === sc.color.toUpperCase());
    patch({ templateId: id, zoneId: null, color: colorOk ? sc.color : t.colors?.[0] ?? sc.color });
  };

  // Foto de plantilla: la elegida, la de la escena o la primera con fotos.
  const photoTpl = photoTemplates.find((t) => t.id === sc.templateId) ?? photoTemplates[0] ?? null;
  const pZones = photoTpl ? photoZones(photoTpl) : [];
  const setPhotoSource = (src: Scene['photoSource']) => {
    if (src === 'plantilla' && photoTpl) patch({ photoSource: src, templateId: photoTpl.id, zoneId: pZones[0]?.id ?? null, photoFit: 'tarjeta', title: sc.title || photoTpl.name });
    else patch({ photoSource: src });
  };

  const swatches = Array.from(new Set([...(template?.colors ?? []), '#FFFFFF', '#1F1D1E'].map((c) => c.toUpperCase())));
  const motionInfo = MOTIONS.find((m) => m.value === sc.motion);
  const isLast = index === count - 1;
  const trDisabled = isLast && !endCard;
  const productList = [...products, ...found.filter((f) => !products.some((p) => p.id === f.id))];

  const maxSec = maxSeconds(sc);

  return (
    <div>
      <Tabs<InspectorSection>
        value={section} onChange={onSection}
        tabs={[{ value: 'escena', label: `Escena ${index + 1}` }, { value: 'texto', label: 'Texto' }, { value: 'transicion', label: 'Transición' }]}
      />
      <div className="pt-4 space-y-3">
        {section === 'escena' && (
          <>
            <RadioGroup
              variant="segmented" value={sc.kind} onChange={setKind}
              options={[
                { value: '3d', label: <span className="inline-flex items-center gap-1" title="Prenda 3D"><Box className="w-4 h-4" />3D</span>, disabled: !templates.length },
                { value: 'foto', label: <span className="inline-flex items-center gap-1" title="Foto de producto"><ImageIcon className="w-4 h-4" />Foto</span> },
                { value: 'texto', label: <span className="inline-flex items-center gap-1" title="Pantalla de texto"><Type className="w-4 h-4" />Texto</span> },
                { value: 'clip', label: <span className="inline-flex items-center gap-1" title="Clip de video propio"><Clapperboard className="w-4 h-4" />Clip</span>, disabled: !clips.length && !sc.clip },
              ]}
            />

            {sc.kind === '3d' && (
              <>
                <Field label="Prenda" htmlFor="sc-tpl">
                  <SelectInput id="sc-tpl" value={template?.id ?? ''} onChange={(e) => setTemplate(Number(e.target.value))}>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </SelectInput>
                </Field>
                <div>
                  <p className="text-sm text-gray-700 mb-1.5">Color de la prenda</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {swatches.map((c) => (
                      <button
                        key={c} type="button" title={c} aria-label={`Color ${c}`} aria-pressed={sc.color.toUpperCase() === c} onClick={() => patch({ color: c })}
                        className={`w-7 h-7 rounded-full border-2 ${sc.color.toUpperCase() === c ? 'border-app-600 ring-2 ring-app-200' : 'border-gray-200'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <ColorInput value={sc.color} onChange={(c) => patch({ color: c }, 'color')} />
                </div>
                <Field label="Movimiento de cámara" htmlFor="sc-motion" hint={motionInfo?.hint}>
                  <SelectInput id="sc-motion" value={sc.motion} onChange={(e) => setMotion(e.target.value as Scene['motion'])}>
                    {MOTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </SelectInput>
                </Field>
                {motionInfo?.speed && (
                  <Range id="sc-speed" label="Velocidad" value={sc.speed} min={SPEED_MIN} max={SPEED_MAX} step={0.25} format={(v) => `${v}×`} onChange={(v) => patch({ speed: v }, 'speed')} />
                )}
                <div className="pt-1 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mt-2 mb-1.5">Diseño sobre la prenda</p>
                  <DesignPicker idPrefix="sc3d" value={sc.design} onChange={(d) => patch({ design: d })} />
                  {!sc.design && <p className="text-xs text-gray-500">Sin diseño propio, la escena usa el de esta zona en el post.</p>}
                  {sc.design && <Button size="sm" variant="secondary" onClick={onApplyDesignAll}>Usar este diseño en todas las escenas</Button>}
                </div>
                {sc.design && (
                  <>
                    <Field label="Dónde va" htmlFor="sc-zone">
                      <SelectInput id="sc-zone" value={zoneOf(sc, zones).id} onChange={(e) => patch({ zoneId: Number(e.target.value) })} disabled={!zones.length}>
                        {zones.length
                          ? zones.map((z) => <option key={z.id} value={z.id}>{z.name} ({VIEW_LABEL[view3DOf(z.view)]})</option>)
                          : <option value={0}>Pecho</option>}
                      </SelectInput>
                    </Field>
                    <Range id="sc-size" label="Tamaño en la zona" value={Math.round(sc.size * 100)} min={30} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => patch({ size: v / 100 }, 'size')} />
                  </>
                )}
              </>
            )}

            {sc.kind === 'foto' && photoTemplates.length > 0 && (
              <RadioGroup
                variant="segmented" value={sc.photoSource} onChange={setPhotoSource}
                options={[{ value: 'producto', label: 'Producto' }, { value: 'plantilla', label: 'Personalizable con diseño' }]}
              />
            )}
            {sc.kind === 'foto' && sc.photoSource === 'plantilla' && photoTpl && (
              <>
                <Field label="Plantilla" htmlFor="sc-ptpl">
                  <SelectInput id="sc-ptpl" value={photoTpl.id} onChange={(e) => { const t = photoTemplates.find((x) => x.id === Number(e.target.value)); if (t) patch({ templateId: t.id, zoneId: photoZones(t)[0]?.id ?? null }); }}>
                    {photoTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Zona del diseño" htmlFor="sc-pzone" hint="La foto de la escena es la de la vista de esta zona.">
                  <SelectInput id="sc-pzone" value={sc.zoneId ?? pZones[0]?.id ?? ''} onChange={(e) => patch({ zoneId: Number(e.target.value) })}>
                    {pZones.map((z) => <option key={z.id} value={z.id}>{z.name} ({z.view})</option>)}
                  </SelectInput>
                </Field>
                <div>
                  <p className="text-sm text-gray-700 mb-1.5">Color de la prenda</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set([...(photoTpl.colors ?? []), '#FFFFFF'].map((c) => c.toUpperCase()))).map((c) => {
                      const name = photoTpl.colorNames?.[(photoTpl.colors ?? []).findIndex((x) => x.toUpperCase() === c)] ?? c;
                      return (
                        <button key={c} type="button" title={name} aria-label={`Color ${name}`} aria-pressed={sc.color.toUpperCase() === c} onClick={() => patch({ color: c })}
                          className={`w-7 h-7 rounded-full border-2 ${sc.color.toUpperCase() === c ? 'border-app-600 ring-2 ring-app-200' : 'border-gray-200'}`} style={{ background: c }} />
                      );
                    })}
                  </div>
                </div>
                <DesignPicker idPrefix="sc2d" value={sc.design} onChange={(d) => patch({ design: d })} />
                {!sc.design && <p className="text-xs text-gray-500">Sin diseño propio, la escena usa el de esta zona en el post (Productos → Vistas y diseños de la prenda).</p>}
                {sc.design && <Button size="sm" variant="secondary" onClick={onApplyDesignAll}>Usar este diseño en todas las escenas</Button>}
                {sc.design && <Range id="sc-psize" label="Tamaño en la zona" value={Math.round(sc.size * 100)} min={30} max={200} step={5} format={(v) => `${v}%`} onChange={(v) => patch({ size: v / 100 }, 'size')} />}
                {sc.design && (
                  <>
                    <Range id="sc-poffx" label="Diseño a los lados" value={Math.round(sc.offsetX * 1000) / 10} min={-50} max={50} step={0.5} format={(v) => (v ? `${v > 0 ? '→' : '←'} ${Math.abs(v)}%` : 'Centrado')} onChange={(v) => patch({ offsetX: v / 100 }, 'offx')} />
                    <Range id="sc-poffy" label="Diseño arriba o abajo" value={Math.round(sc.offsetY * 1000) / 10} min={-50} max={50} step={0.5} format={(v) => (v ? `${v > 0 ? '↓' : '↑'} ${Math.abs(v)}%` : 'Centrado')} onChange={(v) => patch({ offsetY: v / 100 }, 'offy')} />
                  </>
                )}
                <RadioGroup
                  variant="segmented" value={sc.photoFit} onChange={(v) => patch({ photoFit: v })}
                  options={[{ value: 'tarjeta', label: 'Tarjeta' }, { value: 'completa', label: 'Pantalla completa' }]}
                />
              </>
            )}
            {sc.kind === 'foto' && sc.photoSource !== 'plantilla' && (
              <>
                <SearchInput value={pq} onChange={setPq} placeholder="Buscar producto de cualquier colección…" />
                <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                  {loading && !productList.length && <div className="col-span-3 grid place-items-center py-4"><Spinner /></div>}
                  {productList.map((p) => (
                    <button
                      key={p.id} type="button" title={p.name} aria-pressed={sc.product?.id === p.id}
                      onClick={() => patch({ product: p, title: !sc.title || sc.title === sc.product?.name ? p.name : sc.title, badge: !sc.badge || /^-\d+%$/.test(sc.badge) ? (p.discountPercent ? `-${p.discountPercent}%` : '') : sc.badge })}
                      className={`rounded-lg border-2 overflow-hidden text-left ${sc.product?.id === p.id ? 'border-app-600' : 'border-gray-200 hover:border-app-300'}`}
                    >
                      <span className="block aspect-square bg-gray-100">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" />}</span>
                      <span className="block px-1.5 py-1 text-[11px] text-gray-700 truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
                {!loading && !productList.length && <p className="text-xs text-gray-500">No hay productos con foto.</p>}
                <RadioGroup
                  variant="segmented" value={sc.photoFit} onChange={(v) => patch({ photoFit: v })}
                  options={[{ value: 'tarjeta', label: 'Tarjeta' }, { value: 'completa', label: 'Pantalla completa' }]}
                />
              </>
            )}

            {sc.kind === 'clip' && (
              <>
                <Field label="Clip" htmlFor="sc-clip" hint={sc.clip ? `Dura ${sc.clip.duration.toFixed(1)} s. Recórtalo aquí o arrastrando sus bordes en la línea de tiempo.` : undefined}>
                  <SelectInput id="sc-clip" value={sc.clip?.id ?? ''} onChange={(e) => { const c = clips.find((x) => x.id === e.target.value); if (c) patch({ clip: c, clipStart: 0, seconds: Math.min(c.duration, Math.max(SCENE_MIN, clampSeconds(sc.seconds))) }); }}>
                    {!sc.clip && <option value="">Elige un clip</option>}
                    {[...(sc.clip && !clips.some((c) => c.id === sc.clip!.id) ? [sc.clip] : []), ...clips].map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </SelectInput>
                </Field>
                {sc.clip && (
                  <Range
                    id="sc-cstart" label="Empieza en el segundo" value={Math.round(sc.clipStart * 10) / 10} min={0} max={Math.max(0, Math.round((sc.clip.duration - SCENE_MIN) * 10) / 10)} step={0.1} format={(v) => `${v.toFixed(1)} s`}
                    onChange={(v) => patch({ clipStart: v, seconds: Math.min(clampSeconds(sc.seconds), Math.max(SCENE_MIN, sc.clip!.duration - v)) }, 'cstart')}
                  />
                )}
              </>
            )}

            {(sc.kind === 'foto' || sc.kind === 'clip') && (
              <Field label="Movimiento" htmlFor="sc-pmove">
                <SelectInput id="sc-pmove" value={sc.photoMove} onChange={(e) => patch({ photoMove: e.target.value as Scene['photoMove'] })}>
                  {PHOTO_MOVES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </SelectInput>
              </Field>
            )}

            {sc.kind !== 'clip' && (
              <SceneBgEditor
                value={sc.bg} onChange={(bg, merge) => patch({ bg }, merge)} palette={bgPalette} photos={bgPhotos}
                defaults={{
                  style: 'malla', base: bgPalette[0]?.hex ?? '#1F1D1E', ink: bgPalette[1]?.hex ?? '#ABD04C', accent: bgPalette[2]?.hex ?? '#F3F3EE',
                  density: 0.5, size: 150, angle: -18, grain: true, move: true, image: null, dim: 0,
                }}
                onAi={onBgAi} onApplyAll={onBgApplyAll} onUpload={onBgUpload}
              />
            )}
            {sc.kind === 'texto' && !sc.bg && (
              <Field label="Fondo de la plantilla" htmlFor="sc-bg">
                <SelectInput id="sc-bg" value={sc.textBg} onChange={(e) => patch({ textBg: e.target.value as Scene['textBg'] })}>
                  {TEXT_BGS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </SelectInput>
              </Field>
            )}

            <Range id="sc-secs" label="Duración" value={Math.min(maxSec, clampSeconds(sc.seconds))} min={SCENE_MIN} max={Math.round(maxSec * 2) / 2 || SCENE_MIN} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(v) => patch({ seconds: v }, 'seconds')} />
          </>
        )}

        {section === 'texto' && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
              <Field label="Título" htmlFor="sc-title">
                <div className="flex gap-1">
                  <TextInput id="sc-title" value={sc.title} maxLength={sc.kind === 'texto' ? 60 : 40} onChange={(e) => patch({ title: e.target.value }, 'title')} placeholder="Vacío: sin texto" />
                  <DictateButton label="Dictar el título" onText={(t) => patch({ title: appendText(sc.title, t).slice(0, sc.kind === 'texto' ? 60 : 40) })} />
                </div>
              </Field>
              <Field label="Etiqueta" htmlFor="sc-badge">
                <TextInput id="sc-badge" value={sc.badge} maxLength={18} onChange={(e) => patch({ badge: e.target.value }, 'badge')} placeholder="NUEVO" />
              </Field>
            </div>
            <Field label="Subtítulo" htmlFor="sc-sub">
              <div className="flex gap-1">
                <TextInput id="sc-sub" value={sc.subtitle} maxLength={70} onChange={(e) => patch({ subtitle: e.target.value }, 'subtitle')} />
                <DictateButton label="Dictar el subtítulo" onText={(t) => patch({ subtitle: appendText(sc.subtitle, t).slice(0, 70) })} />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Animación" htmlFor="sc-anim">
                <SelectInput id="sc-anim" value={sc.textAnim} onChange={(e) => patch({ textAnim: e.target.value as Scene['textAnim'] })}>
                  {TEXT_ANIMS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="Posición" htmlFor="sc-pos">
                <SelectInput id="sc-pos" value={sc.textPos} onChange={(e) => patch({ textPos: e.target.value as Scene['textPos'] })}>
                  {TEXT_POSITIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </SelectInput>
              </Field>
            </div>
            {(sc.kind === '3d' || sc.kind === 'foto') && (
              <Switch checked={sc.showPrice} onChange={(v) => patch({ showPrice: v })} label="Mostrar precio" description={sc.kind === '3d' ? 'El "desde" de la prenda.' : 'Con la oferta vigente si la tiene.'} />
            )}
          </>
        )}

        {section === 'transicion' && (
          <>
            <Field label={isLast ? 'Transición al cierre' : 'Transición a la siguiente escena'} htmlFor="sc-tr" hint={trDisabled ? 'Es la última escena y el video no lleva cierre.' : undefined}>
              <SelectInput id="sc-tr" value={sc.transition} disabled={trDisabled} onChange={(e) => {
                const tr = e.target.value as Scene['transition'];
                // El sonido sigue a la transición, salvo que se haya quitado o le siga yendo bien.
                const keep = sc.sound === null || (isSound(sc.sound) && TRANSITION_SOUNDS[tr].includes(sc.sound));
                patch(keep ? { transition: tr } : { transition: tr, sound: TRANSITION_SOUNDS[tr][0] });
              }}>
                {GROUPS.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {TRANSITIONS.filter((t) => t.group === g.id).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>
                ))}
              </SelectInput>
            </Field>
            {!trDisabled && sc.transition !== 'corte' && (
              <Range id="sc-trs" label="Duración de la transición" value={sc.transitionSeconds} min={TRANSITION_MIN} max={TRANSITION_MAX} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={(v) => patch({ transitionSeconds: v }, 'trs')} />
            )}
            {!trDisabled && (
              <div>
                <label htmlFor="sc-sound" className="text-sm font-medium text-gray-700">Sonido de la transición</label>
                <div className="mt-1 flex gap-2">
                  <SelectInput id="sc-sound" value={sc.sound ?? ''} onChange={(e) => patch({ sound: e.target.value || null })}>
                    <option value="">Sin sonido</option>
                    <optgroup label="Le van a esta transición">
                      {TRANSITION_SOUNDS[sc.transition].map((id, k) => <option key={id} value={id}>{SOUNDS.find((x) => x.value === id)?.label}{k === 0 ? ' (recomendado)' : ''}</option>)}
                    </optgroup>
                    <optgroup label="Otros sonidos">
                      {SOUNDS.filter((x) => !TRANSITION_SOUNDS[sc.transition].includes(x.value)).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </optgroup>
                  </SelectInput>
                  <Button variant="secondary" icon={<Volume2 className="w-4 h-4" />} disabled={!isSound(sc.sound)} onClick={() => { if (isSound(sc.sound)) void playSound(sc.sound); }} aria-label="Escuchar el sonido" />
                </div>
                {isSound(sc.sound) && <p className="mt-1 text-xs text-gray-500">{SOUNDS.find((x) => x.value === sc.sound)?.hint}. Suena justo en el corte.</p>}
              </div>
            )}
            {count > 1 && (
              <Button size="sm" variant="secondary" icon={<Wand2 className="w-4 h-4" />} onClick={onApplyTransitionAll} disabled={trDisabled}>Usar esta transición y su sonido en todas</Button>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          <Button size="sm" variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => onMove(-1)} disabled={index === 0} aria-label="Mover antes" />
          <Button size="sm" variant="secondary" icon={<ArrowRight className="w-4 h-4" />} onClick={() => onMove(1)} disabled={isLast} aria-label="Mover después" />
          <Button size="sm" variant="secondary" icon={<Copy className="w-4 h-4" />} onClick={onDuplicate} disabled={!canAdd}>Duplicar</Button>
          <Button size="sm" variant="secondary" icon={<Trash2 className="w-4 h-4" />} onClick={onRemove} disabled={count <= 1}>Quitar</Button>
        </div>
      </div>
    </div>
  );
}
