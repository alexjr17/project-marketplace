/**
 * Pestaña Voz del editor de video: el guion del narrador (una línea por escena, escrita por la IA,
 * dictada por voz o pegada) y quién lo lee: una voz IA en español, tu propia voz grabada mientras el
 * video se reproduce (con el texto en pantalla, como un teleprompter) o un audio que ya tengas.
 */
import { useRef, type ChangeEvent } from 'react';
import { AlertTriangle, Check, Mic, Play, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';
import { Button, Field, IconButton, RadioGroup, SelectInput, Switch, TextArea } from '../ui';
import { DictateButton } from './DictateButton';
import { appendText, canDictate } from './dictation';
import { clampSeconds, type Scene } from './timeline';

export interface NarratorSettings {
  mode: 'ia' | 'mia' | 'ninguno';
  voice: string;
  /** -30..30 (% más lento o más rápido). */
  rate: number;
  volume: number;
  /** Baja la música mientras habla el narrador. */
  duck: boolean;
}

export interface NarrationControls {
  settings: NarratorSettings;
  onSettings: (s: NarratorSettings) => void;
  voices: { id: string; name: string }[];
  /** Duración de la voz IA ya generada de cada escena (si está al día con su texto). */
  voiceOf: (sceneId: string) => number | null;
  myVoice: { name: string; duration: number } | null;
  busy: null | 'script' | 'voices' | 'record';
  progress: string;
  onWriteScript: () => void;
  onGenerate: () => void;
  onPlayLine: (sceneId: string) => void;
  onRecord: () => void;
  onUpload: (file: File) => void;
  onClearMine: () => void;
}

/** Palabras que se alcanzan a decir por segundo. */
const WPS = 2.5;
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

export function NarrationPanel({ scenes, onChange, n, total }: {
  scenes: Scene[];
  onChange: (s: Scene[], merge?: string) => void;
  n: NarrationControls;
  total: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const s = n.settings;
  const set = (p: Partial<NarratorSettings>) => n.onSettings({ ...s, ...p });
  const setLine = (i: number, text: string, merge = true) => onChange(scenes.map((x, j) => (j === i ? { ...x, narration: text } : x)), merge ? `${scenes[i].id}:narr` : undefined);
  const lines = scenes.filter((x) => x.narration.trim()).length;
  const pending = scenes.filter((x) => x.narration.trim() && n.voiceOf(x.id) == null).length;
  const tooLong = scenes.filter((x) => { const d = n.voiceOf(x.id); return d != null && d > clampSeconds(x.seconds) + 0.3; });
  const fitScenes = () => onChange(scenes.map((x) => { const d = n.voiceOf(x.id); return d != null && d > clampSeconds(x.seconds) ? { ...x, seconds: Math.ceil((d + 0.5) * 2) / 2 } : x; }));
  const onFile = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) n.onUpload(f); };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900">Guion del narrador</p>
          <Button size="sm" variant="secondary" icon={<Sparkles className="w-4 h-4" />} isLoading={n.busy === 'script'} disabled={!!n.busy} onClick={n.onWriteScript}>Escribir con IA</Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Una línea por escena. Escríbela, pégala{canDictate() ? ' o díctala con el micrófono' : ''}; la IA la escribe con lo que muestra cada escena.</p>
      </div>
      <ol className="space-y-2">
        {scenes.map((x, i) => {
          const max = Math.floor(clampSeconds(x.seconds) * WPS);
          const w = words(x.narration);
          const dur = n.voiceOf(x.id);
          return (
            <li key={x.id} className="rounded-lg border border-gray-200 p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700">Escena {i + 1} · {clampSeconds(x.seconds)} s</span>
                <span className="flex items-center gap-0.5">
                  <span className={`text-[11px] tabular-nums ${w > max ? 'text-amber-600' : 'text-gray-400'}`} title="Palabras que caben en la escena">{w}/{max}</span>
                  <DictateButton onText={(t) => setLine(i, appendText(x.narration, t), false)} />
                  {s.mode === 'ia' && dur != null && <IconButton title="Escuchar" onClick={() => n.onPlayLine(x.id)}><Play className="w-4 h-4" /></IconButton>}
                </span>
              </div>
              <TextArea aria-label={`Narración de la escena ${i + 1}`} rows={2} maxLength={300} value={x.narration} placeholder="Sin voz en esta escena" onChange={(e) => setLine(i, e.target.value)} />
              {s.mode === 'ia' && x.narration.trim() && (
                <p className={`mt-1 text-[11px] flex items-center gap-1 ${dur == null ? 'text-gray-400' : dur > clampSeconds(x.seconds) + 0.3 ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {dur == null ? 'Voz sin generar' : dur > clampSeconds(x.seconds) + 0.3 ? <><AlertTriangle className="w-3 h-3" />La voz dura {dur.toFixed(1)} s: más que la escena</> : <><Check className="w-3 h-3" />Voz lista · {dur.toFixed(1)} s</>}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="border-t border-gray-100 pt-3 space-y-3">
        <p className="text-sm font-medium text-gray-900">Quién narra</p>
        <RadioGroup variant="segmented" value={s.mode} onChange={(v) => set({ mode: v })} options={[{ value: 'ia', label: 'Voz IA' }, { value: 'mia', label: 'Mi voz' }, { value: 'ninguno', label: 'Sin voz' }]} />

        {s.mode === 'ia' && (
          <>
            <Field label="Voz" htmlFor="nr-voice">
              <SelectInput id="nr-voice" value={s.voice} onChange={(e) => set({ voice: e.target.value })}>
                {n.voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </SelectInput>
            </Field>
            <label className="block text-sm text-gray-700">
              <span className="flex justify-between"><span>Velocidad</span><span className="tabular-nums">{s.rate > 0 ? '+' : ''}{s.rate}%</span></span>
              <input type="range" min={-30} max={30} step={5} value={s.rate} onChange={(e) => set({ rate: Number(e.target.value) })} className="w-full accent-app-600" aria-label="Velocidad de la voz" />
            </label>
            <Button className="w-full" icon={<Wand2 className="w-4 h-4" />} isLoading={n.busy === 'voices'} disabled={!!n.busy || !lines} onClick={n.onGenerate}>
              {pending ? `Generar la voz (${pending} ${pending === 1 ? 'línea' : 'líneas'})` : 'Voz al día'}
            </Button>
            {n.busy === 'voices' && <p className="text-xs text-gray-500">{n.progress}</p>}
            {tooLong.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 space-y-1.5">
                <p>{tooLong.length === 1 ? 'Una línea dura' : `${tooLong.length} líneas duran`} más que su escena: se cortaría con la siguiente.</p>
                <Button size="sm" variant="secondary" onClick={fitScenes}>Alargar esas escenas a la voz</Button>
              </div>
            )}
          </>
        )}

        {s.mode === 'mia' && (
          <>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={onFile} aria-label="Subir audio de voz" />
            {n.myVoice ? (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
                <Mic className="w-4 h-4 text-app-600" />
                <span className="flex-1 text-sm text-gray-800 truncate">{n.myVoice.name} · {n.myVoice.duration.toFixed(1)} s</span>
                <IconButton title="Quitar mi voz" tone="danger" onClick={n.onClearMine}><Trash2 className="w-4 h-4" /></IconButton>
              </div>
            ) : <p className="text-xs text-gray-500">Graba mientras el video se reproduce: verás tu guion en pantalla, escena por escena. Usa audífonos para que no se grabe la música.</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button icon={<Mic className="w-4 h-4" />} isLoading={n.busy === 'record'} disabled={!!n.busy} onClick={n.onRecord}>{n.myVoice ? 'Grabar de nuevo' : 'Grabar mi voz'}</Button>
              <Button variant="secondary" icon={<Upload className="w-4 h-4" />} disabled={!!n.busy} onClick={() => fileRef.current?.click()}>Subir audio</Button>
            </div>
            <p className="text-[11px] text-gray-500">Dura lo mismo que el video ({total.toFixed(1)} s) y empieza con él.</p>
          </>
        )}

        {s.mode !== 'ninguno' && (
          <>
            <label className="block text-sm text-gray-700">
              <span className="flex justify-between"><span>Volumen de la voz</span><span className="tabular-nums">{Math.round(s.volume * 100)}%</span></span>
              <input type="range" min={0} max={1.5} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} className="w-full accent-app-600" aria-label="Volumen de la voz" />
            </label>
            <Switch checked={s.duck} onChange={(v) => set({ duck: v })} label="Bajar la música cuando habla" description="La música baja sola mientras suena la voz." />
          </>
        )}
      </div>
    </div>
  );
}
