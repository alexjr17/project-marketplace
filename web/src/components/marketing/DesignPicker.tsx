/**
 * Elegir el diseño que va sobre una prenda (3D o la foto de una plantilla): la biblioteca de diseños
 * con búsqueda, o una imagen subida en el momento (queda solo en este navegador).
 */
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Sparkles, Upload } from 'lucide-react';
import { AiImageDialog } from './AiImageDialog';
import { Button, SearchInput, Spinner, toast } from '../ui';
import { errorMessage } from '../../lib/http';
import { marketingService, type SourceDesign } from '../../services/marketing.service';
import type { SceneDesign } from './timeline';

/** Subidas compartidas entre los paneles mientras la página está abierta. */
let sessionUploads: SourceDesign[] = [];

export function DesignPicker({ value, onChange, idPrefix }: { value: SceneDesign | null; onChange: (d: SceneDesign | null) => void; idPrefix: string }) {
  const [q, setQ] = useState('');
  const [designs, setDesigns] = useState<SourceDesign[]>([]);
  const [uploads, setUploads] = useState<SourceDesign[]>(sessionUploads);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ai, setAi] = useState(false);
  const addUpload = (name: string, image: string) => {
    const d: SourceDesign = { id: -Date.now(), name, category: 'IA', image };
    sessionUploads = [d, ...sessionUploads];
    setUploads(sessionUploads);
    onChange({ id: d.id, name: d.name, image });
  };

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

  const onUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Elige una imagen (PNG, JPG, WEBP o SVG)'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('La imagen pesa más de 8 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const d: SourceDesign = { id: -Date.now(), name: file.name.replace(/\.[^.]+$/, ''), category: 'Subida', image: String(reader.result) };
      sessionUploads = [d, ...sessionUploads];
      setUploads(sessionUploads);
      onChange({ id: d.id, name: d.name, image: d.image! });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 min-w-0"><SearchInput value={q} onChange={setQ} placeholder="Buscar diseño…" /></div>
        <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>Subir</Button>
        <Button variant="secondary" icon={<Sparkles className="w-4 h-4" />} onClick={() => setAi(true)} aria-label="Crear diseño con IA" title="Crear diseño con IA">IA</Button>
        <input ref={fileRef} id={`${idPrefix}-upload`} type="file" accept="image/*" className="hidden" onChange={onUpload} aria-label="Subir imagen del diseño" />
      </div>
      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
        <button
          type="button" onClick={() => onChange(null)} aria-pressed={!value}
          className={`aspect-square rounded-lg border-2 grid place-items-center text-xs text-gray-500 ${!value ? 'border-app-600 bg-app-50' : 'border-gray-200 hover:border-app-300'}`}
        >
          Sin diseño
        </button>
        {loading && !designs.length && !uploads.length && <div className="col-span-3 grid place-items-center"><Spinner /></div>}
        {[...uploads, ...designs].map((d) => (
          <button
            key={d.id} type="button" title={d.name} aria-pressed={value?.id === d.id}
            onClick={() => onChange({ id: d.id, name: d.name, image: d.image! })}
            className={`aspect-square rounded-lg border-2 bg-gray-50 p-1 ${value?.id === d.id ? 'border-app-600' : 'border-gray-200 hover:border-app-300'}`}
          >
            <img src={d.image!} alt={d.name} className="w-full h-full object-contain" loading="lazy" />
          </button>
        ))}
      </div>
      {!loading && !designs.length && !uploads.length && <p className="text-xs text-gray-500">Aún no hay diseños en la biblioteca: sube una imagen o créala con IA.</p>}
      {ai && <AiImageDialog initialKind="diseno" onClose={() => setAi(false)} onUse={(img) => addUpload(img.name, img.url)} />}
    </div>
  );
}
