/**
 * Chat para definir un modelo 3D. Todo lo que gasta GPU sale de aquí y a pedido:
 * 1. Mensajes con texto y/o foto de referencia: la IA arma o cambia la foto del producto en su maniquí
 *    estándar.
 * 2. "Aprobar y armar las 4 vistas": con la foto aprobada como frente se arman la espalda y los lados
 *    (se pueden rehacer una por una).
 * 3. "Generar 3D con las 4 vistas": el 3D multivista, fiel también atrás y a los lados.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Camera, Check, CornerDownRight, ImageIcon, ImagePlus, RefreshCw, RotateCcw, Send, X } from 'lucide-react';
import { Badge, Button, Card, CardTitle, Dialog, FormActions, ImageInput, TextArea, TextInput, toast, useConfirm } from '../../components/ui';
import { errorMessage } from '../../lib/http';
import type { ModelKind } from '../../components/mannequin/models';
import { mannequinModelsService, type MannequinEdit, type MannequinModel } from '../../services/mannequinModels.service';
import { duration, shrinkImage, viewLabels } from './mannequinUi';

/** Ideas de cambios por tipo (se puede escribir cualquier cosa). */
const IDEAS: Record<ModelKind, string[]> = {
  maniqui: ['Más ancha y suelta', 'Manga larga', 'Sin arrugas, tela lisa', 'Cuello más alto', 'Hombro caído'],
  cabeza: ['Visera plana', 'Visera más curva', 'Corona más alta', 'Cabeza lisa, sin rasgos', 'Cierre de broche atrás'],
  piernas: ['Más anchos', 'Más cortos, a la rodilla', 'Puño en el tobillo', 'Sin bolsillos traseros', 'Tela lisa'],
  objeto: ['Vista más de frente', 'Sin sombras', 'Más simple, sin detalles', 'Asas más largas', 'Base más ancha'],
};

const VIEW_IDS = ['back', 'left', 'right'] as const;
type ViewId = (typeof VIEW_IDS)[number];

export function MannequinChat({ model, onModel }: { model: MannequinModel; onModel: (m: MannequinModel) => void }) {
  const confirm = useConfirm();
  const [edits, setEdits] = useState<MannequinEdit[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [attach, setAttach] = useState(false);
  const [from, setFrom] = useState<MannequinEdit | null>(null);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [redoText, setRedoText] = useState<Partial<Record<ViewId, string>>>({});
  const [now, setNow] = useState(Date.now());
  const end = useRef<HTMLDivElement>(null);
  // Fotos reales como las 4 vistas.
  const [realOpen, setRealOpen] = useState(false);
  const [real, setReal] = useState<Partial<Record<'front' | 'back' | 'left' | 'right', string>>>({});

  const load = useCallback(async () => {
    try {
      setEdits(await mannequinModelsService.edits(model.id));
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo cargar el chat'));
    }
  }, [model.id]);
  useEffect(() => { load(); }, [load]);

  const working = edits.some((e) => e.status === 'procesando');
  useEffect(() => {
    if (!working) return;
    const poll = window.setInterval(load, 4000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [working, load]);

  const chat = edits.filter((e) => e.mode !== 'view');
  const views = edits.filter((e) => e.mode === 'view');
  const count = chat.length;
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [count]);

  const kind = model.config.kind ?? 'maniqui';
  const labels = viewLabels(kind);
  const locked = model.status === 'publicado' || model.status === 'generando';
  const lockReason = model.status === 'publicado' ? 'Está publicado: despublícalo para cambiarlo' : 'Se está generando el 3D';
  const lastDone = [...chat].reverse().find((e) => e.status === 'listo');
  const canSend = !working && !locked && !sending;

  const send = async (prompt = text) => {
    const p = prompt.trim();
    if (!p && !image) return;
    setSending(true);
    try {
      const e = await mannequinModelsService.addEdit(model.id, { prompt: p || undefined, image: image ? await shrinkImage(image) : undefined, fromEditId: image ? undefined : from?.id });
      setEdits((prev) => [...prev, e]);
      setText(''); setImage(''); setAttach(false); setFrom(null);
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo enviar'));
    } finally {
      setSending(false);
    }
  };

  const approve = async (e: MannequinEdit) => {
    const ok = await confirm({
      title: '¿Aprobar esta foto como frente?',
      message: 'Se arman la espalda y los dos lados del mismo producto (cerca de 4 min 30 s de GPU en total). Después las revisas y, si están bien, generas el 3D con las 4 vistas: así sale fiel también atrás y a los lados.',
      confirmText: 'Aprobar y armar vistas',
    });
    if (!ok) return;
    setActing(`approve-${e.id}`);
    try {
      setEdits(await mannequinModelsService.approve(model.id, e.id));
      toast.success('Armando la espalda y los lados');
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo aprobar la foto'));
    } finally {
      setActing(null);
    }
  };

  const onlyPhoto = async (e: MannequinEdit) => {
    const ok = await confirm({
      title: '¿Generar el 3D solo con esta foto?',
      message: 'Gasta cerca de 4 min 30 s de GPU. Con una sola foto la IA inventa la espalda y los lados, así que el resultado puede no parecerse. Lo recomendado es aprobarla y armar las 4 vistas.',
      confirmText: 'Generar con una foto',
    });
    if (!ok) return;
    setActing(`apply-${e.id}`);
    try {
      onModel(await mannequinModelsService.applyEdit(model.id, e.id));
      toast.success('Generando el modelo 3D. Tarda entre 2 y 5 minutos.');
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo generar el 3D'));
    } finally {
      setActing(null);
    }
  };

  const redo = async (view: ViewId) => {
    setActing(`redo-${view}`);
    try {
      const e = await mannequinModelsService.redoView(model.id, view, redoText[view]?.trim() || undefined);
      setEdits((prev) => [...prev, e]);
      setRedoText((r) => ({ ...r, [view]: '' }));
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo rehacer la vista'));
    } finally {
      setActing(null);
    }
  };

  const generate = async () => {
    const ok = await confirm({
      title: '¿Generar el 3D con las 4 vistas?',
      message: 'Gasta cerca de 4 min 30 s de GPU de una cuenta y tarda entre 2 y 5 minutos.',
      confirmText: 'Generar 3D',
    });
    if (!ok) return;
    setActing('generate');
    try {
      onModel(await mannequinModelsService.generateFromViews(model.id));
      toast.success('Generando el modelo 3D con las 4 vistas');
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo generar el 3D'));
    } finally {
      setActing(null);
    }
  };

  const uploadReal = async () => {
    const order = ['front', 'back', 'left', 'right'] as const;
    if (order.some((v) => !real[v])) { toast.error('Sube las 4 fotos'); return; }
    setActing('real');
    try {
      const images = Object.fromEntries(await Promise.all(order.map(async (v) => [v, await shrinkImage(real[v]!)]))) as Record<(typeof order)[number], string>;
      setEdits(await mannequinModelsService.uploadViews(model.id, images));
      setRealOpen(false);
      setReal({});
      toast.success('Fotos cargadas como vistas. Revísalas y genera el 3D.');
      onModel({ ...model, inputImages: { front: images.front } });
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudieron cargar las fotos'));
    } finally {
      setActing(null);
    }
  };

  const elapsed = (e: MannequinEdit) => Math.max(0, Math.round((now - new Date(e.createdAt).getTime()) / 1000));
  const latestView = (v: ViewId) => [...views].reverse().find((e) => e.view === v) ?? null;
  const viewsReady = views.length > 0 && VIEW_IDS.every((v) => latestView(v)?.status === 'listo');

  const pending = (e: MannequinEdit, label: string) => (
    <p className="text-sm text-gray-600 inline-flex items-center gap-2 px-1 py-1">
      <RefreshCw className="w-4 h-4 animate-spin text-app-600" />{label} · {duration(elapsed(e))}
    </p>
  );

  return (
    <div className="space-y-5">
      {views.length > 0 && (
        <Card>
          <CardTitle icon={Box}>Vistas para el 3D</CardTitle>
          <p className="text-sm text-gray-500 mb-4">
            Revisa que la espalda y los lados sean el mismo producto, a la misma escala y en el mismo maniquí. Rehaz la que no quede bien (puedes decir qué corregir) y genera el 3D.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">{labels.front}</p>
              {model.inputImages.front && <img src={model.inputImages.front} alt={labels.front} className="w-full aspect-square object-contain rounded-xl bg-gray-50 ring-1 ring-gray-200" />}
              <p className="mt-1 text-xs text-green-700 inline-flex items-center gap-1"><Check className="w-3 h-3" />Aprobada</p>
            </div>
            {VIEW_IDS.map((v) => {
              const e = latestView(v);
              const label = v === 'back' ? labels.back : v === 'left' ? labels.leftSleeve : labels.rightSleeve;
              return (
                <div key={v} className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-700">{label}</p>
                  <div className="w-full aspect-square rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center overflow-hidden">
                    {e?.status === 'listo' && e.image
                      ? <a href={e.image} target="_blank" rel="noreferrer" title="Ver en grande" className="w-full h-full"><img src={e.image} alt={label} className="w-full h-full object-contain" /></a>
                      : e?.status === 'procesando' ? <RefreshCw className="w-6 h-6 animate-spin text-app-600" aria-label="Armando" />
                        : <p className="text-xs text-red-600 p-2 text-center">{e?.error || 'No se pudo armar'}</p>}
                  </div>
                  {e?.status !== 'procesando' && !locked && (
                    <div className="flex gap-1">
                      <TextInput
                        aria-label={`Qué corregir en ${label}`} placeholder="Qué corregir (opcional)" value={redoText[v] ?? ''}
                        onChange={(ev) => setRedoText((r) => ({ ...r, [v]: ev.target.value }))} className="text-xs"
                      />
                      <Button size="sm" variant="secondary" icon={<RotateCcw className="w-3.5 h-3.5" />} disabled={working || acting !== null} isLoading={acting === `redo-${v}`} onClick={() => redo(v)} title="Rehacer (cerca de 1 min 30 s de GPU)">Rehacer</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {working && <p className="text-sm text-gray-500">Armando las vistas una tras otra…</p>}
            <Button icon={<Box className="w-4 h-4" />} disabled={!viewsReady || locked || working || acting !== null} isLoading={acting === 'generate'} onClick={generate} title={locked ? lockReason : undefined}>
              Generar 3D con las 4 vistas
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle
          icon={ImageIcon}
          actions={<Button size="sm" variant="outline" icon={<Camera className="w-4 h-4" />} disabled={locked || working} onClick={() => setRealOpen(true)}>Subir mis 4 fotos</Button>}
        >
          Chat para definir el modelo
        </CardTitle>
        <p className="text-sm text-gray-500 mb-4">
          Pide cambios con detalle, en español, o adjunta fotos de referencia: la IA arma la foto del producto en su maniquí estándar. Cuando quede como lo quieres, apruébala para armar las 4 vistas.
          Cada foto gasta cerca de 1 min 30 s de GPU.
        </p>

        <div className="space-y-4 max-h-[640px] overflow-y-auto pr-1" aria-live="polite">
          {chat.length === 0 && (
            <p className="text-sm text-gray-500">Escribe cómo es el producto o adjunta una foto de referencia para empezar.</p>
          )}
          {chat.map((e, i) => (
            <div key={e.id} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-app-50 px-4 py-2.5 text-sm text-gray-900">
                  <p className="whitespace-pre-wrap">{e.prompt}</p>
                  {e.mode === 'base' && e.base && <img src={e.base} alt="Foto de referencia" className="mt-2 w-24 h-24 object-contain rounded-lg bg-white ring-1 ring-gray-200" />}
                  {e.mode === 'edit' && e.base && i > 0 && chat[i - 1]?.image !== e.base && (
                    <p className="mt-1 text-xs text-gray-500 inline-flex items-center gap-1"><CornerDownRight className="w-3 h-3" />Sobre una foto anterior</p>
                  )}
                </div>
              </div>
              <div className="flex">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-gray-200 bg-white p-3">
                  {e.status === 'procesando' && pending(e, e.mode === 'edit' ? 'Aplicando el cambio' : 'Armando la foto')}
                  {e.status === 'error' && (
                    <div className="space-y-2 px-1">
                      <p className="text-sm text-red-600">{e.error || 'No se pudo hacer.'}</p>
                      {e.mode !== 'base' && <Button size="sm" variant="secondary" disabled={!canSend} onClick={() => send(e.prompt)}>Intentar de nuevo</Button>}
                    </div>
                  )}
                  {e.status === 'listo' && e.image && (
                    <div className="space-y-2">
                      <a href={e.image} target="_blank" rel="noreferrer" title="Ver en grande">
                        <img src={e.image} alt={`Resultado: ${e.prompt}`} className="w-72 max-w-full aspect-square object-contain rounded-xl bg-gray-50" />
                      </a>
                      <div className="flex flex-wrap items-center gap-2">
                        {model.inputImages.front === e.image && views.length > 0 && <Badge tone="green">Aprobada como frente</Badge>}
                        {e.applied && <Badge tone="green">Usada para el 3D</Badge>}
                        <Button
                          size="sm" variant={e.id === lastDone?.id ? 'primary' : 'outline'} icon={<Check className="w-4 h-4" />}
                          isLoading={acting === `approve-${e.id}`} disabled={locked || working || acting !== null}
                          title={locked ? lockReason : undefined} onClick={() => approve(e)}
                        >
                          Aprobar y armar las 4 vistas
                        </Button>
                        <Button size="sm" variant="ghost" disabled={locked || working || acting !== null} isLoading={acting === `apply-${e.id}`} onClick={() => onlyPhoto(e)}>
                          3D solo con esta foto
                        </Button>
                        {e.id !== lastDone?.id && <Button size="sm" variant="ghost" disabled={locked} onClick={() => setFrom(e)}>Seguir desde esta</Button>}
                      </div>
                      {e.seconds ? <p className="text-xs text-gray-400">{duration(e.seconds)} · cuenta {e.account}</p> : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
          {locked && <p className="text-sm text-gray-500">{lockReason}.</p>}
          <div className="flex flex-wrap gap-1.5">
            {IDEAS[kind].map((idea) => (
              <button
                key={idea} type="button" disabled={!canSend}
                onClick={() => setText((t) => (t.trim() ? `${t.trim()}, ${idea.toLowerCase()}` : idea))}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-app-300 hover:text-app-700 disabled:opacity-40"
              >
                {idea}
              </button>
            ))}
          </div>
          {from && !image && (
            <p className="text-xs text-gray-600 inline-flex items-center gap-2">
              {from.image && <img src={from.image} alt="" className="w-8 h-8 rounded object-contain bg-gray-50" />}
              El próximo cambio se hace sobre esta foto.
              <button type="button" title="Quitar" aria-label="Quitar" className="p-1 rounded hover:bg-gray-100" onClick={() => setFrom(null)}><X className="w-3.5 h-3.5" /></button>
            </p>
          )}
          {attach && (
            <div className="flex items-end gap-3">
              <ImageInput value={image} onChange={setImage} maxSizeMB={10} allowUrl={false} className="w-32" />
              <p className="text-xs text-gray-500 max-w-xs">Foto de referencia: la IA pasa ese producto al maniquí estándar con lo que escribas. Úsala para mostrar un detalle, una forma o el producto real.</p>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <Button variant="secondary" icon={<ImagePlus className="w-4 h-4" />} disabled={!canSend} onClick={() => { setAttach((a) => !a); if (attach) setImage(''); }} title="Adjuntar foto de referencia">
              Foto
            </Button>
            <TextArea
              rows={2} maxLength={1000} value={text} disabled={!canSend}
              aria-label="Mensaje para la IA"
              placeholder={locked ? '' : working ? 'Espera a que termine la foto actual…' : 'Ej.: visera plana, corona más alta y tela de algodón grueso'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSend) send(); } }}
            />
            <Button icon={<Send className="w-4 h-4" />} isLoading={sending} disabled={!canSend || (!text.trim() && !image)} onClick={() => send()}>Enviar</Button>
          </div>
          <p className="text-xs text-gray-400">Enter envía · Shift+Enter hace un salto de línea</p>
        </div>
      </Card>

      <Dialog
        open={realOpen}
        onClose={() => acting !== 'real' && setRealOpen(false)}
        title="Subir mis 4 fotos"
        description="Fotos reales del producto: dan el 3D más detallado, porque la IA ve cómo es por todos lados y no inventa la parte de atrás. No gastan GPU; el 3D se genera después, cuando lo pidas."
        size="lg"
        footer={(
          <FormActions>
            <Button variant="secondary" onClick={() => setRealOpen(false)} disabled={acting === 'real'}>Cancelar</Button>
            <Button icon={<Check className="w-4 h-4" />} isLoading={acting === 'real'} onClick={uploadReal}>Usar estas fotos</Button>
          </FormActions>
        )}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([['front', labels.front], ['back', labels.back], ['left', labels.leftSleeve], ['right', labels.rightSleeve]] as const).map(([v, label]) => (
              <div key={v}>
                <p className="text-xs font-medium text-gray-700 mb-1">{label}</p>
                <ImageInput value={real[v]} onChange={(val) => setReal((r) => ({ ...r, [v]: val }))} maxSizeMB={10} allowUrl={false} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Cómo tomarlas: el producto entero y centrado, fondo liso, buena luz pareja, la cámara a la misma distancia y altura en las 4.
            De frente, de atrás y de perfil exacto por cada lado (izquierdo y derecho del producto). En blanco sale mejor, pero cualquier color sirve: la tienda lo pinta.
          </p>
        </div>
      </Dialog>
    </div>
  );
}
