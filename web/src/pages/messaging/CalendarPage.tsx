/**
 * App Social → Calendario y biblioteca del estudio de contenido. El calendario muestra lo programado,
 * publicado o con error en Facebook e Instagram (cambiar fecha, cancelar, reintentar); la biblioteca,
 * las piezas guardadas para publicarlas, descargarlas o borrarlas.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronLeft, ChevronRight, Download, ExternalLink, Facebook, Film, Instagram, RotateCcw, Send, Trash2, Wand2 } from 'lucide-react';
import {
  Badge, Button, Card, Dialog, EmptyState, FormActions, IconButton, Page, PageHeader, Spinner, Tabs, TextInput, toast, useConfirm, type Tone,
} from '../../components/ui';
import { errorMessage, http } from '../../lib/http';
import { marketingService, type CalendarPost, type Creative } from '../../services/marketing.service';
import { PublishDialog } from './StudioPage';

const STATUS: Record<CalendarPost['status'], { label: string; tone: Tone }> = {
  draft: { label: 'Borrador', tone: 'gray' },
  scheduled: { label: 'Programada', tone: 'blue' },
  publishing: { label: 'Publicando', tone: 'yellow' },
  published: { label: 'Publicada', tone: 'green' },
  failed: { label: 'Con error', tone: 'red' },
};

const KIND: Record<Creative['kind'], string> = { post: 'Post', historia: 'Historia', reel: 'Reel', video360: 'Video 360°' };

const WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const dayKey = (d: Date) => `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export const CalendarPage = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'calendario' | 'biblioteca'>('calendario');
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<CalendarPost | null>(null);
  const [publishFor, setPublishFor] = useState<Creative | null>(null);
  const [newDate, setNewDate] = useState('');
  const [acting, setActing] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      setPosts(await marketingService.calendar(monthKey(month)));
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo cargar el calendario'));
    }
  }, [month]);
  const loadCreatives = useCallback(async () => {
    try {
      setCreatives(await marketingService.creatives());
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo cargar la biblioteca'));
    }
  }, []);
  useEffect(() => { setLoading(true); Promise.all([loadPosts(), loadCreatives()]).finally(() => setLoading(false)); }, [loadPosts, loadCreatives]);

  // Lo que se está publicando o está por salir se refresca solo.
  const pending = posts.some((p) => p.status === 'publishing' || (p.status === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt).getTime() - Date.now() < 120000));
  useEffect(() => {
    if (!pending) return;
    const t = window.setInterval(loadPosts, 20000);
    return () => window.clearInterval(t);
  }, [pending, loadPosts]);

  // Cuadrícula del mes (semanas de lunes a domingo).
  const days = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const byDay = useMemo(() => {
    const m: Record<string, CalendarPost[]> = {};
    for (const p of posts) if (p.date) (m[dayKey(new Date(p.date))] ??= []).push(p);
    return m;
  }, [posts]);
  const todayKey = dayKey(new Date());

  const shift = (n: number) => setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + n); return d; });

  const openPost = (p: CalendarPost) => { setOpen(p); setNewDate(p.scheduledAt ? toLocalInput(p.scheduledAt) : ''); };

  const reschedule = async () => {
    if (!open || !newDate) return;
    setActing(true);
    try {
      await marketingService.reschedule(open.id, new Date(newDate).toISOString());
      toast.success('Fecha cambiada');
      setOpen(null);
      loadPosts();
    } catch (e) { toast.error(errorMessage(e, 'No se pudo cambiar la fecha')); } finally { setActing(false); }
  };

  const cancel = async () => {
    if (!open || !(await confirm({ title: '¿Cancelar la publicación programada?', message: 'No se publicará. La pieza sigue en la biblioteca.', confirmText: 'Cancelar publicación', tone: 'danger' }))) return;
    setActing(true);
    try {
      await marketingService.cancel(open.id);
      toast.success('Publicación cancelada');
      setOpen(null);
      loadPosts();
    } catch (e) { toast.error(errorMessage(e, 'No se pudo cancelar')); } finally { setActing(false); }
  };

  const retry = async () => {
    if (!open) return;
    setActing(true);
    try {
      await http.post(`/messaging/posts/${open.id}/publish`);
      toast.success('Publicada');
      setOpen(null);
      loadPosts();
    } catch (e) { toast.error(errorMessage(e, 'No se pudo publicar')); } finally { setActing(false); }
  };

  const removeCreative = async (c: Creative) => {
    if (!(await confirm({ title: `¿Eliminar "${c.title}"?`, message: 'Se borra de la biblioteca. Lo que ya se publicó en redes no se toca.', tone: 'danger' }))) return;
    try {
      await marketingService.deleteCreative(c.id);
      setCreatives((prev) => prev.filter((x) => x.id !== c.id));
      toast.success('Pieza eliminada');
    } catch (e) { toast.error(errorMessage(e, 'No se pudo eliminar')); }
  };

  const PlatformIcon = ({ p }: { p: CalendarPost['platform'] }) => (p === 'instagram' ? <Instagram className="w-3.5 h-3.5" /> : <Facebook className="w-3.5 h-3.5" />);

  return (
    <Page className="max-w-7xl mx-auto">
      <PageHeader
        icon={CalendarClock}
        title="Calendario y biblioteca"
        subtitle="Lo que se publicó y lo que está programado en Facebook e Instagram, y tus piezas guardadas."
        actions={<Button icon={<Wand2 className="w-4 h-4" />} onClick={() => navigate('/messaging/studio')}>Nueva pieza</Button>}
      />
      <Tabs tabs={[{ value: 'calendario', label: 'Calendario' }, { value: 'biblioteca', label: 'Biblioteca', count: creatives.length }]} value={tab} onChange={setTab} />

      {loading && <Spinner label="Cargando…" />}

      {!loading && tab === 'calendario' && (
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1">
              <IconButton title="Mes anterior" onClick={() => shift(-1)}><ChevronLeft className="w-5 h-5" /></IconButton>
              <IconButton title="Mes siguiente" onClick={() => shift(1)}><ChevronRight className="w-5 h-5" /></IconButton>
              <h2 className="ml-2 text-lg font-semibold text-gray-900 capitalize">{month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); }}>Hoy</Button>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 min-w-[720px] border-t border-l border-gray-200">
              {WEEK.map((w) => <div key={w} className="px-2 py-1.5 text-xs font-medium text-gray-500 border-r border-b border-gray-200 bg-gray-50">{w}</div>)}
              {days.map((d) => {
                const key = dayKey(d);
                const inMonth = d.getMonth() === month.getMonth();
                const list = byDay[key] ?? [];
                return (
                  <div key={key} className={`min-h-[110px] p-1.5 border-r border-b border-gray-200 ${inMonth ? 'bg-white' : 'bg-gray-50/60'}`}>
                    <p className={`text-xs mb-1 ${key === todayKey ? 'inline-flex w-6 h-6 items-center justify-center rounded-full bg-app-600 text-white font-semibold' : inMonth ? 'text-gray-700' : 'text-gray-400'}`}>{d.getDate()}</p>
                    <div className="space-y-1">
                      {list.slice(0, 3).map((p) => (
                        <button key={p.id} type="button" onClick={() => openPost(p)} className="w-full flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-1 py-1 text-left hover:border-app-300">
                          <span className="w-7 h-7 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                            {p.thumb && (p.thumbType === 'video' ? <video src={`${p.thumb}#t=1.2`} className="w-full h-full object-cover" muted preload="metadata" /> : <img src={p.thumb} alt="" className="w-full h-full object-cover" />)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 text-[11px] text-gray-600"><PlatformIcon p={p.platform} />{p.date ? new Date(p.date).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                            <span className={`block text-[11px] truncate font-medium ${p.status === 'failed' ? 'text-red-600' : p.status === 'scheduled' ? 'text-blue-700' : 'text-gray-900'}`}>{p.title}</span>
                          </span>
                        </button>
                      ))}
                      {list.length > 3 && <p className="text-[11px] text-gray-500 px-1">+{list.length - 3} más</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {!posts.length && <p className="text-sm text-gray-500 mt-4">Este mes no hay publicaciones. Arma una en el estudio y prográmala.</p>}
        </Card>
      )}

      {!loading && tab === 'biblioteca' && (
        creatives.length === 0 ? (
          <Card><EmptyState icon={Wand2} title="Todavía no hay piezas" description="Arma tu primera pieza en el estudio de contenido." action={<Button onClick={() => navigate('/messaging/studio')}>Ir al estudio</Button>} /></Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {creatives.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="bg-gray-100 aspect-square flex items-center justify-center overflow-hidden">
                  {c.mediaType === 'video'
                    ? <video src={`${c.media}#t=1.2`} className="w-full h-full object-contain" muted loop playsInline preload="metadata" onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
                    : <img src={c.media} alt={c.title} className="w-full h-full object-contain" loading="lazy" />}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate" title={c.title}>{c.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    {c.mediaType === 'video' && <Film className="w-3 h-3" />}{KIND[c.kind]} · {new Date(c.createdAt).toLocaleDateString('es-CO')}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <Button size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={() => setPublishFor(c)}>Publicar</Button>
                    <div className="flex">
                      <a href={c.media} download title="Descargar" aria-label="Descargar" className="p-2 rounded-lg text-gray-500 hover:text-app-700 hover:bg-app-50"><Download className="w-4 h-4" /></a>
                      <IconButton title="Eliminar" tone="danger" onClick={() => removeCreative(c)}><Trash2 className="w-4 h-4" /></IconButton>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {open && (
        <Dialog
          open onClose={() => !acting && setOpen(null)} title={open.title}
          description={`${open.platform === 'instagram' ? 'Instagram' : 'Facebook'} · ${STATUS[open.status].label}`}
          footer={(
            <FormActions>
              <Button variant="secondary" onClick={() => setOpen(null)} disabled={acting}>Cerrar</Button>
              {open.status === 'failed' && <Button icon={<RotateCcw className="w-4 h-4" />} isLoading={acting} onClick={retry}>Reintentar</Button>}
              {open.status === 'scheduled' && <Button isLoading={acting} disabled={!newDate} onClick={reschedule}>Guardar fecha</Button>}
            </FormActions>
          )}
        >
          <div className="grid grid-cols-1 sm:grid-cols-[160px_minmax(0,1fr)] gap-4">
            <div className="rounded-xl overflow-hidden bg-gray-100">
              {open.thumb && (open.thumbType === 'video' ? <video src={open.thumb} className="w-full" muted autoPlay loop playsInline /> : <img src={open.thumb} alt="" className="w-full" />)}
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><Badge tone={STATUS[open.status].tone}>{STATUS[open.status].label}</Badge>{open.date && <span className="text-gray-600">{new Date(open.date).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</span>}</div>
              {open.error && <p className="text-red-600">{open.error}</p>}
              {open.content && <p className="whitespace-pre-wrap text-gray-700 max-h-40 overflow-y-auto">{open.content}</p>}
              {open.externalUrl && <a href={open.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-app-700 hover:underline"><ExternalLink className="w-4 h-4" />Ver en la red</a>}
              {open.status === 'scheduled' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <p className="font-medium text-gray-700">Cambiar fecha</p>
                  <TextInput type="datetime-local" aria-label="Nueva fecha" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={cancel} disabled={acting}>Cancelar la publicación</Button>
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}

      {publishFor && (
        <PublishDialog
          creative={publishFor} caption={publishFor.caption ?? ''} hashtags={publishFor.hashtags}
          onClose={() => setPublishFor(null)} onDone={() => { setPublishFor(null); setTab('calendario'); loadPosts(); }}
        />
      )}
    </Page>
  );
};
