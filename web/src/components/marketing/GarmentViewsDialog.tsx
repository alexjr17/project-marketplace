/**
 * Prenda en 4 vistas con IA: UN solo producto que se ve igual desde todos los lados.
 * 1. Foto maestra del frente (con o sin maniquí).
 * 2. Espalda y manga izquierda: giros de ESA foto (la IA conserva tela, costuras, proporciones y maniquí).
 * 3. Cada vista en PNG con fondo transparente; la manga derecha es el espejo exacto de la izquierda.
 * Después: descargar los PNG, usarlos en el diseño o crear con ellos una plantilla personalizable
 * con sus zonas de diseño ya puestas (se afinan en Administración → Plantillas).
 */
import { useState } from 'react';
import { Check, Download, RefreshCw, Shirt, Sparkles } from 'lucide-react';
import { Button, Dialog, Field, FormActions, MoneyInput, RadioGroup, Spinner, Switch, TextArea, TextInput, toast } from '../ui';
import { errorMessage } from '../../lib/http';
import { marketingService } from '../../services/marketing.service';
import { DictateButton } from './DictateButton';
import { appendText } from './dictation';
import { loadImage } from './media';

export type GarmentView = 'front' | 'back' | 'left' | 'right';
const VIEWS: { value: GarmentView; label: string; slug: string }[] = [
  { value: 'front', label: 'Frente', slug: 'frente' },
  { value: 'back', label: 'Espalda', slug: 'espalda' },
  { value: 'left', label: 'Manga izquierda', slug: 'manga-izquierda' },
  { value: 'right', label: 'Manga derecha', slug: 'manga-derecha' },
];

interface Shot { photo?: { url: string; path: string }; png?: { url: string; path: string } }
type Status = Partial<Record<GarmentView, 'trabajando' | 'listo' | 'error'>>;

/** Caja de la prenda dentro del PNG (en %), para ubicar las zonas de diseño. */
async function garmentBox(url: string) {
  const img = await loadImage(url);
  if (!img) return { x: 20, y: 10, w: 60, h: 80 };
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round((256 * img.naturalHeight) / img.naturalWidth);
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let k = 0; k < c.width; k++) if (d[(y * c.width + k) * 4 + 3] > 40) { x0 = Math.min(x0, k); x1 = Math.max(x1, k); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 <= x0) return { x: 20, y: 10, w: 60, h: 80 };
  return { x: (x0 / c.width) * 100, y: (y0 / c.height) * 100, w: ((x1 - x0) / c.width) * 100, h: ((y1 - y0) / c.height) * 100 };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function GarmentViewsDialog({ onClose, onUse, onTemplateCreated }: {
  onClose: () => void;
  /** Usar las 4 vistas (PNG) en el diseño. */
  onUse?: (views: { label: string; url: string }[]) => void;
  onTemplateCreated?: (id: number) => void;
}) {
  const [idea, setIdea] = useState('Camiseta oversize blanca de algodón pesado, cuello redondo grueso, mangas caídas');
  const [mannequin, setMannequin] = useState(true);
  const [background, setBackground] = useState<'oscuro' | 'claro'>('oscuro');
  const [shots, setShots] = useState<Partial<Record<GarmentView, Shot>>>({});
  const [status, setStatus] = useState<Status>({});
  const [busy, setBusy] = useState(false);
  const [showBg, setShowBg] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(60000);
  const [creating, setCreating] = useState(false);
  const mark = (v: GarmentView, s: Status[GarmentView]) => setStatus((x) => ({ ...x, [v]: s }));
  const save = (v: GarmentView, s: Shot) => setShots((x) => ({ ...x, [v]: { ...x[v], ...s } }));

  /** Una vista: la foto (frente nueva o giro de la maestra) y su PNG. La derecha sale del espejo de la izquierda. */
  const makeView = async (v: GarmentView, master: string, left?: { url: string; path: string }) => {
    mark(v, 'trabajando');
    try {
      if (v === 'right') {
        if (!left) throw new Error('Primero la manga izquierda');
        save(v, { png: await marketingService.garmentMirror(left.path) });
      } else {
        const photo = v === 'front' ? (await marketingService.garmentFront({ idea, mannequin, background })) : await marketingService.garmentView({ path: master, view: v, mannequin });
        save(v, { photo });
        const png = await marketingService.garmentCutout(photo.path);
        save(v, { png });
        mark(v, 'listo');
        return { photo, png };
      }
      mark(v, 'listo');
      return null;
    } catch (e) {
      mark(v, 'error');
      throw e;
    }
  };

  const createAll = async () => {
    if (idea.trim().length < 3) { toast.error('Describe la prenda'); return; }
    setBusy(true);
    setShots({});
    setStatus({});
    try {
      const front = await makeView('front', '');
      const master = front!.photo.path;
      await makeView('back', master);
      const left = await makeView('left', master);
      await makeView('right', master, left!.png);
      toast.success('Las 4 vistas están listas');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo crear la prenda'));
    } finally {
      setBusy(false);
    }
  };

  const redo = async (v: GarmentView) => {
    const master = shots.front?.photo?.path;
    if (!master) return;
    setBusy(true);
    try {
      const r = await makeView(v, master, shots.left?.png);
      // Si se rehízo la manga izquierda, la derecha (su espejo) también.
      if (v === 'left' && r) await makeView('right', master, r.png);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo rehacer la vista'));
    } finally {
      setBusy(false);
    }
  };

  const ready = VIEWS.every((v) => shots[v.value]?.png);

  /** Plantilla personalizable con las 4 vistas (PNG) y una zona de diseño en cada una. */
  const createTemplate = async () => {
    if (!ready) return;
    if (name.trim().length < 3) { toast.error('Ponle nombre a la plantilla'); return; }
    setCreating(true);
    try {
      const url = (v: GarmentView) => shots[v]!.png!.url;
      const tpl = await marketingService.createTemplate({
        name: name.trim(), description: `${idea.trim()}. Lista para personalizar en frente, espalda y mangas.`, basePrice: price,
        images: { front: url('front'), back: url('back'), side: url('right') },
        zoneTypeImages: Object.fromEntries(VIEWS.map((v) => [v.slug, url(v.value)])),
        tags: ['personalizable', 'ia'],
      });
      const types = await marketingService.zoneTypes();
      const typeId = (slug: string) => types.find((t) => t.slug === slug)?.id;
      const [bf, bb, bl] = await Promise.all([garmentBox(url('front')), garmentBox(url('back')), garmentBox(url('left'))]);
      // Zonas a partir de la silueta de la prenda en cada foto.
      const zones = [
        { slug: 'frente', name: 'Frente', x: bf.x + bf.w * 0.25, y: bf.y + bf.h * 0.22, w: bf.w * 0.5, h: bf.h * 0.4 },
        { slug: 'frente', name: 'Pecho izquierdo', x: bf.x + bf.w * 0.58, y: bf.y + bf.h * 0.24, w: bf.w * 0.16, h: bf.h * 0.12 },
        { slug: 'espalda', name: 'Espalda', x: bb.x + bb.w * 0.24, y: bb.y + bb.h * 0.18, w: bb.w * 0.52, h: bb.h * 0.48 },
        { slug: 'manga-izquierda', name: 'Manga izquierda', x: bl.x + bl.w * 0.5, y: bl.y + bl.h * 0.28, w: bl.w * 0.42, h: bl.h * 0.16 },
        // La derecha es el espejo de la izquierda.
        { slug: 'manga-derecha', name: 'Manga derecha', x: 100 - (bl.x + bl.w * 0.5) - bl.w * 0.42, y: bl.y + bl.h * 0.28, w: bl.w * 0.42, h: bl.h * 0.16 },
      ];
      let order = 1;
      for (const z of zones) {
        const id = typeId(z.slug);
        if (!id) continue;
        await marketingService.createZone(tpl.id, { zoneTypeId: id, name: z.name, positionX: r1(z.x), positionY: r1(z.y), maxWidth: r1(z.w), maxHeight: r1(z.h), shape: 'rect', sortOrder: order++, isEditable: true });
      }
      toast.success('Plantilla creada. Agrega sus colores y tallas en Administración → Plantillas.');
      onTemplateCreated?.(tpl.id);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo crear la plantilla (necesitas permiso para administrar plantillas)'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open onClose={() => !busy && !creating && onClose()} size="xl" title="Prenda en 4 vistas con IA"
      description="Un solo producto que se ve igual de frente, de espalda y de cada manga, en PNG con fondo transparente."
      footer={(
        <FormActions>
          <Button variant="secondary" onClick={onClose} disabled={busy || creating}>Cerrar</Button>
          {onUse && <Button variant="outline" disabled={!ready || busy} onClick={() => { onUse(VIEWS.map((v) => ({ label: v.label, url: shots[v.value]!.png!.url }))); onClose(); }}>Usar en el diseño</Button>}
        </FormActions>
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5">
        <div className="space-y-3">
          <Field label="La prenda" htmlFor="gv-idea" hint="Descríbela lisa: el diseño se pone después en sus zonas.">
            <div className="flex gap-1 items-start">
              <TextArea id="gv-idea" rows={4} maxLength={400} value={idea} onChange={(e) => setIdea(e.target.value)} />
              <DictateButton label="Dictar la prenda" onText={(t) => setIdea((x) => appendText(x, t).slice(0, 400))} />
            </div>
          </Field>
          <Switch checked={mannequin} onChange={setMannequin} label="Con maniquí" description={mannequin ? 'El mismo maniquí en todas las vistas.' : 'Efecto fantasma: la prenda sola, sin cuerpo.'} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Fondo de las fotos</p>
            <RadioGroup variant="segmented" value={background} onChange={setBackground} options={[{ value: 'oscuro', label: 'Oscuro' }, { value: 'claro', label: 'Claro' }]} />
          </div>
          <Button className="w-full" icon={<Sparkles className="w-4 h-4" />} onClick={createAll} isLoading={busy && !shots.front} disabled={busy}>
            {Object.keys(shots).length ? 'Crear de nuevo' : 'Crear las 4 vistas'}
          </Button>
          <p className="text-xs text-gray-500">Tarda 2 a 3 minutos: el frente, los giros de la misma prenda y el recorte de cada vista. Usa la cuota diaria de IA.</p>

          {ready && (
            <div className="rounded-xl border border-gray-200 p-3 space-y-2">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><Shirt className="w-4 h-4" />Crear plantilla personalizable</p>
              <TextInput aria-label="Nombre de la plantilla" placeholder="Ej.: Camiseta Oversize Premium" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
              <MoneyInput aria-label="Precio base" type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} />
              <Button className="w-full" onClick={createTemplate} isLoading={creating}>Crear la plantilla con sus zonas</Button>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-900">Vistas</p>
            <Switch checked={showBg} onChange={setShowBg} label="Ver con fondo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {VIEWS.map((v) => {
              const s = shots[v.value];
              const st = status[v.value];
              const src = showBg ? s?.photo?.url ?? s?.png?.url : s?.png?.url ?? s?.photo?.url;
              return (
                <div key={v.value} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="aspect-square grid place-items-center" style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 50% / 18px 18px' }}>
                    {st === 'trabajando' && !src ? <Spinner label={v.value === 'front' ? 'Creando el frente…' : v.value === 'right' ? 'Espejo de la manga…' : 'Girando la prenda…'} /> : src ? <img src={src} alt={v.label} className="w-full h-full object-contain" /> : <p className="text-xs text-gray-400">{st === 'error' ? 'No se pudo' : 'Pendiente'}</p>}
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1.5 border-t border-gray-100">
                    <span className="flex-1 text-sm text-gray-800 flex items-center gap-1">{st === 'listo' && <Check className="w-3.5 h-3.5 text-emerald-600" />}{v.label}</span>
                    {s?.png && <a href={s.png.url} download={`${v.slug}.png`} className="p-1.5 rounded-md text-gray-500 hover:text-app-700 hover:bg-app-50" title="Descargar PNG" aria-label={`Descargar PNG de ${v.label}`}><Download className="w-4 h-4" /></a>}
                    {v.value !== 'front' && v.value !== 'right' && shots.front?.photo && (
                      <button type="button" disabled={busy} onClick={() => redo(v.value)} className="p-1.5 rounded-md text-gray-500 hover:text-app-700 hover:bg-app-50 disabled:opacity-40" title="Rehacer esta vista" aria-label={`Rehacer ${v.label}`}><RefreshCw className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
