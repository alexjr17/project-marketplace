/**
 * Crear una imagen con IA (FLUX): un diseño para estampar (con el fondo blanco quitado, listo para la
 * prenda), un fondo para posts y videos o una foto de estilo de vida. La idea se escribe o se dicta en
 * español; se puede pedir otra versión y elegir entre las que se crearon.
 */
import { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button, Dialog, Field, FormActions, RadioGroup, SelectInput, Spinner, Switch, TextArea, toast } from '../ui';
import { errorMessage } from '../../lib/http';
import { marketingService } from '../../services/marketing.service';
import { DictateButton } from './DictateButton';
import { appendText } from './dictation';
import { loadImage } from './media';
import { knockoutWhite } from './mockup';

export type AiKind = 'diseno' | 'fondo' | 'foto';

const KINDS: { value: AiKind; label: string; hint: string; ideas: string[] }[] = [
  {
    value: 'diseno', label: 'Diseño para estampar', hint: 'Un gráfico para poner en la prenda.',
    ideas: ['Corona de laurel dorada estilo romano', 'León geométrico en líneas finas', 'Ola japonesa en tinta', 'Calavera floral estilo tattoo', 'Águila imperial dorada'],
  },
  {
    value: 'fondo', label: 'Fondo', hint: 'Para poner detrás de tus productos en posts y videos.',
    ideas: ['Estudio oscuro con luz cálida y humo suave', 'Mármol blanco con sombras de hojas', 'Degradado lima y negro con textura de grano', 'Pared de concreto urbana al atardecer'],
  },
  {
    value: 'foto', label: 'Foto de estilo de vida', hint: 'Un ambiente o escena para tus redes.',
    ideas: ['Calle de Medellín de noche con luces de neón', 'Café minimalista con luz de mañana', 'Azotea con atardecer y ciudad de fondo'],
  },
];

/** Quita el fondo blanco del diseño generado (ver knockoutWhite). */
async function removeWhite(url: string): Promise<string> {
  const img = await loadImage(url);
  if (!img) throw new Error('No se pudo leer la imagen');
  return knockoutWhite(img).toDataURL('image/png');
}

export function AiImageDialog({ initialKind = 'diseno', onClose, onUse }: {
  initialKind?: AiKind;
  onClose: () => void;
  /** Imagen elegida: nombre y dirección (o la imagen sin fondo, como data URL). */
  onUse: (img: { name: string; url: string }) => void;
}) {
  const [kind, setKind] = useState<AiKind>(initialKind);
  const [idea, setIdea] = useState('');
  const [ratio, setRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>(initialKind === 'diseno' ? '1:1' : '4:5');
  const [noBg, setNoBg] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ url: string; idea: string }[]>([]);
  const [pick, setPick] = useState(0);
  const [using, setUsing] = useState(false);
  const info = KINDS.find((k) => k.value === kind)!;

  const generate = async () => {
    if (idea.trim().length < 3) { toast.error('Describe la imagen que quieres'); return; }
    setBusy(true);
    try {
      const r = await marketingService.aiImage({ prompt: idea.trim(), kind, ratio: kind === 'diseno' ? '1:1' : ratio });
      setResults((x) => [{ url: r.url, idea: idea.trim() }, ...x]);
      setPick(0);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo crear la imagen'));
    } finally {
      setBusy(false);
    }
  };

  const use = async () => {
    const r = results[pick];
    if (!r) return;
    setUsing(true);
    try {
      const url = kind === 'diseno' && noBg ? await removeWhite(r.url) : r.url;
      onUse({ name: r.idea.slice(0, 40), url });
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo preparar la imagen'));
    } finally {
      setUsing(false);
    }
  };

  const current = results[pick];
  return (
    <Dialog
      open onClose={() => !busy && onClose()} size="lg" title="Crear imagen con IA" description="Describe lo que quieres en español. Tarda entre 10 y 30 segundos."
      footer={(
        <FormActions>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button icon={<Sparkles className="w-4 h-4" />} onClick={use} disabled={!current || busy} isLoading={using}>Usar esta imagen</Button>
        </FormActions>
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="space-y-3">
          <RadioGroup variant="segmented" value={kind} onChange={(v) => setKind(v)} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
          <p className="text-xs text-gray-500">{info.hint}</p>
          <Field label="Tu idea" htmlFor="ai-idea">
            <div className="flex gap-1 items-start">
              <TextArea id="ai-idea" rows={3} maxLength={500} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Ej.: corona de laurel dorada estilo romano" />
              <DictateButton label="Dictar la idea" onText={(t) => setIdea((x) => appendText(x, t).slice(0, 500))} />
            </div>
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {info.ideas.map((s) => (
              <button key={s} type="button" onClick={() => setIdea(s)} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:border-app-300 hover:bg-app-50">{s}</button>
            ))}
          </div>
          {kind === 'diseno' ? (
            <Switch checked={noBg} onChange={setNoBg} label="Quitar el fondo blanco" description="El diseño queda con fondo transparente, listo para la prenda." />
          ) : (
            <Field label="Formato" htmlFor="ai-ratio">
              <SelectInput id="ai-ratio" value={ratio} onChange={(e) => setRatio(e.target.value as typeof ratio)}>
                <option value="4:5">Vertical 4:5 (post)</option>
                <option value="9:16">Vertical 9:16 (historia, reel)</option>
                <option value="1:1">Cuadrado 1:1</option>
                <option value="16:9">Horizontal 16:9</option>
              </SelectInput>
            </Field>
          )}
          <Button icon={results.length ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />} onClick={generate} isLoading={busy} disabled={busy}>
            {results.length ? 'Crear otra versión' : 'Crear imagen'}
          </Button>
        </div>
        <div className="space-y-2">
          <div className="aspect-square rounded-xl overflow-hidden ring-1 ring-gray-200 grid place-items-center"
            style={{ background: 'repeating-conic-gradient(#f3f4f6 0% 25%, #ffffff 0% 50%) 50% / 20px 20px' }}>
            {busy ? <Spinner label="Creando la imagen…" /> : current ? <img src={current.url} alt={current.idea} className="w-full h-full object-contain" /> : <p className="text-sm text-gray-500 px-6 text-center">Aquí verás la imagen.</p>}
          </div>
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
