import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, FileText, ImagePlus, Link2, Star, Trash2, Upload, X } from 'lucide-react';
import { TextInput } from './Form';
import { Button } from './Button';

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Valida tipo y tamaño. Devuelve el mensaje de error o null. */
function validate(file: File, accept: string | undefined, maxSizeMB: number): string | null {
  if (accept) {
    const ok = accept.split(',').map((a) => a.trim()).some((a) =>
      a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : a.startsWith('.') ? file.name.toLowerCase().endsWith(a.toLowerCase()) : file.type === a);
    if (!ok) return `"${file.name}" no es un tipo de archivo permitido`;
  }
  if (file.size > maxSizeMB * 1024 * 1024) return `"${file.name}" pesa ${fmtSize(file.size)}; el máximo es ${maxSizeMB} MB`;
  return null;
}

/**
 * Zona para soltar o elegir archivos (Excel, PDF, imágenes…). Entrega los File validados.
 * Para imágenes que se guardan en el registro usar ImageInput / ImageGallery.
 */
export function FileDrop({ onFiles, accept, multiple = false, maxSizeMB = 10, title, hint, disabled, compact = false }: {
  onFiles: (files: File[]) => void; accept?: string; multiple?: boolean; maxSizeMB?: number;
  title?: ReactNode; hint?: ReactNode; disabled?: boolean; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, multiple ? undefined : 1);
    const bad = files.map((f) => validate(f, accept, maxSizeMB)).find(Boolean);
    setError(bad ?? null);
    const good = files.filter((f) => !validate(f, accept, maxSizeMB));
    if (good.length) onFiles(good);
    if (ref.current) ref.current.value = '';
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) handle(e.dataTransfer.files); }}
        className={`w-full rounded-xl border-2 border-dashed text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'px-4 py-3' : 'px-6 py-8'} ${drag ? 'border-app-500 bg-app-50' : 'border-gray-300 hover:border-app-400 hover:bg-gray-50'}`}
      >
        <Upload className={`mx-auto text-gray-400 ${compact ? 'w-5 h-5 mb-1' : 'w-8 h-8 mb-2'}`} />
        <p className="text-sm text-gray-700"><span className="font-medium text-app-700">{title ?? 'Elige un archivo'}</span> o arrástralo aquí</p>
        <p className="text-xs text-gray-500 mt-0.5">{hint ?? `${accept ? accept.replace(/,/g, ', ') + ' · ' : ''}máx. ${maxSizeMB} MB`}</p>
      </button>
      <input ref={ref} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => handle(e.target.files)} />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

/** Lista de archivos elegidos (antes de subirlos), con quitar. */
export function FileList({ files, onRemove }: { files: { name: string; size?: number }[]; onRemove?: (index: number) => void }) {
  if (!files.length) return null;
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="flex-1 min-w-0 truncate text-gray-700">{f.name}</span>
          {f.size !== undefined && <span className="text-xs text-gray-400">{fmtSize(f.size)}</span>}
          {onRemove && <button type="button" onClick={() => onRemove(i)} title="Quitar" className="p-1 text-gray-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
        </li>
      ))}
    </ul>
  );
}

const RATIO = { square: 'aspect-square', landscape: 'aspect-video', portrait: 'aspect-[3/4]' } as const;

/**
 * Una imagen del registro (logo, foto de producto, banner). El valor es una URL o un data URL
 * (el backend lo guarda en /uploads). Permite subir archivo o pegar enlace, reemplazar y quitar.
 */
export function ImageInput({ value, onChange, ratio = 'square', maxSizeMB = 5, allowUrl = true, disabled, className = '' }: {
  value: string | null | undefined; onChange: (v: string) => void;
  ratio?: keyof typeof RATIO; maxSizeMB?: number; allowUrl?: boolean; disabled?: boolean; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  const [drag, setDrag] = useState(false);

  const take = async (file?: File) => {
    if (!file) return;
    const err = validate(file, 'image/*', maxSizeMB);
    setError(err);
    if (!err) onChange(await readAsDataUrl(file));
    if (ref.current) ref.current.value = '';
  };

  return (
    <div className={className}>
      {value ? (
        <div className={`group relative ${RATIO[ratio]} w-full max-w-xs overflow-hidden rounded-xl border border-gray-200 bg-gray-50`}>
          <img src={value} alt="" className="h-full w-full object-contain" />
          {!disabled && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button size="sm" variant="secondary" onClick={() => ref.current?.click()} icon={<Upload className="w-4 h-4" />}>Cambiar</Button>
              <Button size="sm" variant="danger" onClick={() => onChange('')} icon={<Trash2 className="w-4 h-4" />}>Quitar</Button>
            </div>
          )}
        </div>
      ) : urlMode ? (
        <div className="flex gap-2 max-w-md">
          <TextInput autoFocus placeholder="https://…/imagen.jpg" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onChange((e.target as HTMLInputElement).value.trim()); } }}
            onBlur={(e) => { if (e.target.value.trim()) onChange(e.target.value.trim()); }} />
          <Button variant="ghost" onClick={() => setUrlMode(false)}>Cancelar</Button>
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}
          className={`${RATIO[ratio]} w-full max-w-xs flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-sm transition-colors disabled:opacity-50 ${drag ? 'border-app-500 bg-app-50' : 'border-gray-300 hover:border-app-400 hover:bg-gray-50'}`}>
          <ImagePlus className="w-8 h-8 text-gray-400" />
          <span className="font-medium text-app-700">Subir imagen</span>
          <span className="text-xs text-gray-500">o arrástrala · máx. {maxSizeMB} MB</span>
        </button>
      )}
      {!value && !urlMode && allowUrl && !disabled && (
        <button type="button" onClick={() => setUrlMode(true)} className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
          <Link2 className="w-3.5 h-3.5" /> Usar un enlace
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => take(e.target.files?.[0])} />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

/**
 * Varias imágenes (galería de producto). La primera es la portada.
 * Se puede agregar, quitar, mover y marcar como portada.
 */
export function ImageGallery({ value, onChange, max = 10, maxSizeMB = 5, disabled }: {
  value: string[]; onChange: (v: string[]) => void; max?: number; maxSizeMB?: number; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).slice(0, max - value.length);
    const bad = files.map((f) => validate(f, 'image/*', maxSizeMB)).find(Boolean);
    setError(bad ?? (list.length > files.length ? `Máximo ${max} imágenes` : null));
    const urls = await Promise.all(files.filter((f) => !validate(f, 'image/*', maxSizeMB)).map(readAsDataUrl));
    onChange([...value, ...urls]);
    if (ref.current) ref.current.value = '';
  };
  const move = (i: number, d: -1 | 1) => { const n = [...value]; [n[i], n[i + d]] = [n[i + d], n[i]]; onChange(n); };

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {value.map((src, i) => (
          <div key={`${i}-${src.slice(-24)}`} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <img src={src} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-app-600 px-1.5 py-0.5 text-[10px] font-medium text-white">Portada</span>}
            {!disabled && (
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {i > 0 && <button type="button" title="Mover a la izquierda" onClick={() => move(i, -1)} className="p-1 text-white hover:bg-white/20 rounded"><ArrowLeft className="w-3.5 h-3.5" /></button>}
                {i > 0 && <button type="button" title="Usar como portada" onClick={() => onChange([src, ...value.filter((_, j) => j !== i)])} className="p-1 text-white hover:bg-white/20 rounded"><Star className="w-3.5 h-3.5" /></button>}
                {i < value.length - 1 && <button type="button" title="Mover a la derecha" onClick={() => move(i, 1)} className="p-1 text-white hover:bg-white/20 rounded"><ArrowRight className="w-3.5 h-3.5" /></button>}
                <button type="button" title="Quitar" onClick={() => onChange(value.filter((_, j) => j !== i))} className="p-1 text-white hover:bg-red-500/80 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
        {value.length < max && !disabled && (
          <button type="button" onClick={() => ref.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}
            className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-500 hover:border-app-400 hover:bg-gray-50 hover:text-app-700">
            <ImagePlus className="w-6 h-6" /> Agregar
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      <p className="text-xs text-gray-500 mt-2">{value.length}/{max} imágenes · la primera es la portada · máx. {maxSizeMB} MB c/u</p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

/** Miniatura de imagen en tablas y listas (con respaldo si no hay imagen). */
export function Thumb({ src, alt = '', size = 'md' }: { src?: string | null; alt?: string; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' }[size];
  return src
    ? <img src={src} alt={alt} className={`${s} rounded-lg object-cover border border-gray-200 bg-gray-50 flex-shrink-0`} />
    : <div className={`${s} rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0`}><ImagePlus className="w-4 h-4 text-gray-300" /></div>;
}

/** Avatar de persona: foto o iniciales en el color de la app. */
export function Avatar({ name, src, size = 'md' }: { name?: string | null; src?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }[size];
  const initials = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return src
    ? <img src={src} alt={name ?? ''} className={`${s} rounded-full object-cover flex-shrink-0`} />
    : <span className={`${s} rounded-full bg-app-100 text-app-700 font-semibold inline-flex items-center justify-center flex-shrink-0`}>{initials || '?'}</span>;
}
