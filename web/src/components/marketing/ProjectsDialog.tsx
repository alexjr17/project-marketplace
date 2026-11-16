/**
 * Estudio → Proyectos: el trabajo guardado (posts y videos) para volver a abrirlo, duplicarlo o
 * eliminarlo, y el botón para empezar un proyecto nuevo.
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy, Film, FilePlus2, FolderOpen, Image as ImageIcon, Trash2 } from 'lucide-react';
import { Badge, Button, Dialog, EmptyState, IconButton, SearchInput, Spinner, toast, useConfirm } from '../ui';
import { errorMessage } from '../../lib/http';
import { marketingService, type StudioProjectSummary } from '../../services/marketing.service';
import { ago } from './projectStore';

type Filter = 'todos' | 'post' | 'video';
const FILTERS: { value: Filter; label: string }[] = [{ value: 'todos', label: 'Todos' }, { value: 'post', label: 'Posts' }, { value: 'video', label: 'Videos' }];

export function ProjectsDialog({ currentId, onOpen, onNew, onClose }: {
  currentId: number | null;
  onOpen: (p: StudioProjectSummary) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const [list, setList] = useState<StudioProjectSummary[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    marketingService.projects()
      .then((r) => { if (alive) setList(r); })
      .catch((e) => { if (alive) { setList([]); toast.error(errorMessage(e, 'No se pudieron cargar los proyectos')); } });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => (list ?? []).filter((p) => (filter === 'todos' || (filter === 'post' ? p.format === 'post' : p.format !== 'post'))
    && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))), [list, q, filter]);

  const duplicate = async (p: StudioProjectSummary) => {
    setBusy(p.id);
    try {
      const copy = await marketingService.duplicateProject(p.id);
      setList((l) => [copy, ...(l ?? [])]);
      toast.success('Proyecto duplicado');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo duplicar'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: StudioProjectSummary) => {
    if (!(await confirm({ title: `¿Eliminar "${p.name}"?`, message: 'Se borra el proyecto. Las piezas ya guardadas en la biblioteca y lo publicado no se tocan.', confirmText: 'Eliminar', tone: 'danger' }))) return;
    setBusy(p.id);
    try {
      await marketingService.deleteProject(p.id);
      setList((l) => (l ?? []).filter((x) => x.id !== p.id));
      toast.success('Proyecto eliminado');
      if (p.id === currentId) onNew();
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo eliminar'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onClose={onClose} size="xl" title="Proyectos" description="Tu trabajo se guarda solo mientras editas. Abre uno para seguirlo o empieza otro.">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div role="radiogroup" aria-label="Tipo de proyecto" className="inline-flex rounded-lg bg-gray-100 p-0.5">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-sm ${filter === f.value ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-600 hover:text-gray-900'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre…" className="flex-1 min-w-[180px]" />
        <Button onClick={onNew}><FilePlus2 className="w-4 h-4" />Nuevo proyecto</Button>
      </div>
      {list === null ? (
        <div className="py-12 grid place-items-center"><Spinner /></div>
      ) : !shown.length ? (
        <EmptyState icon={FolderOpen} title={list.length ? 'Ningún proyecto coincide' : 'Aún no tienes proyectos'}
          description={list.length ? 'Prueba con otro nombre o tipo.' : 'Empieza uno: se guarda solo apenas eliges qué mostrar.'}
          action={!list.length ? <Button onClick={onNew}><FilePlus2 className="w-4 h-4" />Nuevo proyecto</Button> : undefined} />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {shown.map((p) => {
            const video = p.format !== 'post';
            const current = p.id === currentId;
            return (
              <li key={p.id} className={`group relative rounded-xl border bg-white overflow-hidden ${current ? 'border-app-500 ring-2 ring-app-200' : 'border-gray-200 hover:border-app-300'}`}>
                <button type="button" onClick={() => onOpen(p)} disabled={busy === p.id} aria-label={`Abrir ${p.name}`} className="block w-full text-left">
                  <span className="block aspect-square bg-gray-100 overflow-hidden">
                    {p.thumb
                      ? <img src={p.thumb} alt="" className="w-full h-full object-contain" loading="lazy" />
                      : <span className="w-full h-full grid place-items-center text-gray-300">{video ? <Film className="w-10 h-10" /> : <ImageIcon className="w-10 h-10" />}</span>}
                  </span>
                  <span className="block px-2.5 pt-2 pb-2.5">
                    <span className="block text-sm font-medium text-gray-900 truncate" title={p.name}>{p.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                      <Badge tone={video ? 'app' : 'gray'}>{video ? 'Video' : 'Post'}</Badge>
                      {current ? <span className="text-app-700 font-medium">Abierto</span> : <span className="truncate" title={p.updatedBy ?? undefined}>{ago(p.updatedAt)}</span>}
                    </span>
                  </span>
                </button>
                <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <IconButton title="Duplicar" onClick={() => duplicate(p)} className="bg-white/95 shadow-sm"><Copy className="w-4 h-4" /></IconButton>
                  <IconButton title="Eliminar" tone="danger" onClick={() => remove(p)} className="bg-white/95 shadow-sm"><Trash2 className="w-4 h-4" /></IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
