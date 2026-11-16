/**
 * Fondo profesional con IA a partir de los diseños de la prenda: la IA mira los diseños (su tema y
 * sus tonos), propone una escenografía de estudio que combine y la genera, con espacio libre al
 * centro para el producto. Se elige un estilo y se puede sumar una idea (escrita o dictada).
 */
import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button, Dialog, Field, FormActions, Spinner, TextArea, toast } from '../ui';
import { errorMessage } from '../../lib/http';
import { marketingService } from '../../services/marketing.service';
import { DictateButton } from './DictateButton';
import { appendText } from './dictation';
import { loadImage } from './media';

type BackdropStyle = 'lujo' | 'marmol' | 'urbano' | 'naturaleza' | 'clasico' | 'minimal' | 'neon';
const STYLES: { value: BackdropStyle; label: string }[] = [
  { value: 'lujo', label: 'Estudio de lujo' }, { value: 'marmol', label: 'Mármol y dorado' }, { value: 'clasico', label: 'Arquitectura clásica' },
  { value: 'urbano', label: 'Urbano' }, { value: 'naturaleza', label: 'Naturaleza' }, { value: 'minimal', label: 'Minimal' }, { value: 'neon', label: 'Neón nocturno' },
];

/** Miniatura JPEG del diseño (para que la IA lo vea sin mandar archivos pesados). */
async function thumb(url: string): Promise<string | null> {
  const img = await loadImage(url);
  if (!img || !img.naturalWidth) return null;
  const k = Math.min(1, 384 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/** Colores principales de los diseños (sin el blanco del fondo). */
async function paletteOf(urls: string[], max = 5): Promise<string[]> {
  const counts = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (const u of urls) {
    const img = await loadImage(u);
    if (!img || !img.naturalWidth) continue;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (Math.min(r, g, b) > 232) continue; // fondo blanco
      const key = `${r >> 5},${g >> 5},${b >> 5}`;
      const e = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += r; e.g += g; e.b += b;
      counts.set(key, e);
    }
  }
  const out: [number, number, number][] = [];
  for (const e of [...counts.values()].sort((a, b) => b.n - a.n)) {
    const c: [number, number, number] = [e.r / e.n, e.g / e.n, e.b / e.n];
    if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 48)) out.push(c);
    if (out.length >= max) break;
  }
  return out.map((c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase());
}

export function AiBackdropDialog({ designUrls, ratio, onClose, onUse, generateWith }: {
  /** Diseños que lleva la prenda (para sacar el tema y los tonos). */
  designUrls: string[];
  ratio: '1:1' | '4:5' | '9:16' | '16:9';
  onClose: () => void;
  onUse: (img: { url: string; name: string }) => void;
  /** Quién genera (por defecto el estudio de marketing; la ficha del producto usa la suya). */
  generateWith?: (data: { style: string; idea?: string; palette: string[]; designs: string[]; ratio: string }) => Promise<{ url: string; concept: string }>;
}) {
  const [style, setStyle] = useState<BackdropStyle>('lujo');
  const [idea, setIdea] = useState('');
  const [palette, setPalette] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(() => designUrls.slice(0, 3));
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ url: string; concept: string }[]>([]);
  const [pick, setPick] = useState(0);

  useEffect(() => {
    let alive = true;
    paletteOf(picked).then((p) => { if (alive) setPalette(p); });
    return () => { alive = false; };
  }, [picked]);

  const generate = async () => {
    setBusy(true);
    try {
      const designs = (await Promise.all(picked.map(thumb))).filter((d): d is string => !!d);
      const r = await (generateWith ?? marketingService.aiBackdrop)({ style, idea: idea.trim() || undefined, palette, designs, ratio });
      setResults((x) => [{ url: r.url, concept: r.concept }, ...x]);
      setPick(0);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo crear el fondo'));
    } finally {
      setBusy(false);
    }
  };

  const current = results[pick];
  return (
    <Dialog
      open onClose={() => !busy && onClose()} size="xl" title="Fondo profesional con IA"
      description="Una escenografía que combina con los diseños de tu prenda: su tema, sus tonos y espacio al centro para el producto."
      footer={(
        <FormActions>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button icon={<Sparkles className="w-4 h-4" />} disabled={!current || busy} onClick={() => { onUse({ url: current!.url, name: STYLES.find((s) => s.value === style)!.label }); onClose(); }}>Usar como fondo</Button>
        </FormActions>
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Diseños de la prenda</p>
            {designUrls.length ? (
              <div className="flex flex-wrap gap-2">
                {designUrls.map((u) => {
                  const on = picked.includes(u);
                  return (
                    <button key={u} type="button" aria-pressed={on} title={on ? 'No usar este diseño' : 'Usar este diseño'}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== u) : [...p, u].slice(-3)))}
                      className={`w-16 h-16 rounded-lg border-2 bg-white p-1 ${on ? 'border-app-600' : 'border-gray-200 opacity-50'}`}>
                      <img src={u} alt="" className="w-full h-full object-contain" />
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-xs text-gray-500">Aún no hay diseños en la prenda: el fondo saldrá del estilo y tu idea.</p>}
            {palette.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Tonos:</span>
                {palette.map((c) => <span key={c} className="w-6 h-6 rounded-full ring-1 ring-black/10" style={{ background: c }} title={c} />)}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Escenografía</p>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button key={s.value} type="button" aria-pressed={style === s.value} onClick={() => setStyle(s.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${style === s.value ? 'border-app-600 bg-app-50 text-app-800 font-medium' : 'border-gray-200 text-gray-700 hover:border-app-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Tu idea (opcional)" htmlFor="bd-idea">
            <div className="flex gap-1 items-start">
              <TextArea id="bd-idea" rows={2} maxLength={300} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Ej.: un palacio romano al atardecer" />
              <DictateButton label="Dictar la idea" onText={(t) => setIdea((x) => appendText(x, t).slice(0, 300))} />
            </div>
          </Field>
          <Button icon={results.length ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />} onClick={generate} isLoading={busy} disabled={busy}>
            {results.length ? 'Crear otra versión' : 'Crear el fondo'}
          </Button>
          <p className="text-xs text-gray-500">La IA mira tus diseños, propone la escena y la crea. Tarda unos 20 a 40 segundos y usa la cuota diaria de IA.</p>
        </div>
        <div className="space-y-2">
          <div className="rounded-xl overflow-hidden ring-1 ring-gray-200 bg-gray-100 grid place-items-center" style={{ aspectRatio: ratio.replace(':', ' / ') }}>
            {busy ? <Spinner label="Creando el fondo…" /> : current ? <img src={current.url} alt="Fondo creado" className="w-full h-full object-cover" /> : <p className="text-sm text-gray-500 px-6 text-center">Aquí verás el fondo.</p>}
          </div>
          {current?.concept && <p className="text-sm text-gray-700">{current.concept}</p>}
          {results.length > 1 && (
            <div className="grid grid-cols-4 gap-1.5">
              {results.map((r, i) => (
                <button key={r.url} type="button" onClick={() => setPick(i)} aria-pressed={pick === i} aria-label={`Versión ${results.length - i}`}
                  className={`aspect-square rounded-lg overflow-hidden border-2 ${pick === i ? 'border-app-600' : 'border-gray-200'}`}>
                  <img src={r.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
