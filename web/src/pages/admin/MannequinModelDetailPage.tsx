/**
 * Admin → Modelos 3D → detalle. Primero el chat arma y pule la foto del producto en su maniquí
 * estándar; con la foto que quede bien se genera el 3D. Luego se revisa en el visor (girar, vistas,
 * color), se ajusta dónde está la tela según el tipo y se publica. Al guardar se toma la foto de carga
 * desde el visor. El chat sigue disponible para volver a pulir el modelo.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Download, RefreshCw, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardTitle, DescriptionList, Field, FormActions, Page, PageHeader, RadioGroup, Spinner,
  Switch, TextInput, toast, useConfirm,
} from '../../components/ui';
import { errorMessage } from '../../lib/http';
import { generatedConfig, VIEWS_3D, type GeneratedModelConfig, type ModelKind, type View3D } from '../../components/mannequin/models';
import type { Mannequin3DHandle } from '../../components/mannequin/Mannequin3D';
import { loadModels3D } from '../../components/mannequin/useModels3D';
import { mannequinModelsService, type MannequinModel } from '../../services/mannequinModels.service';
import { duration, KIND_LABEL, KINDS, SOURCE, STATUS, viewLabels } from './mannequinUi';
import { MannequinChat } from './MannequinChat';

const Mannequin3D = lazy(() => import('../../components/mannequin/Mannequin3D'));
const NO_ART = {};
const COLORS = [{ hex: '#FFFFFF', name: 'Blanco' }, { hex: '#1F1D1E', name: 'Negro' }, { hex: '#9CA3AF', name: 'Gris' }, { hex: '#B91C1C', name: 'Rojo' }];

/** Ajustes de la tela, de arriba hacia abajo. Todo en % del alto del modelo (0 = abajo). */
const SLIDERS: { key: Exclude<keyof GeneratedModelConfig, 'kind' | 'split'>; label: string; hint: string }[] = [
  { key: 'headFrom', label: 'Inicio de la cabeza', hint: 'Por encima todo es maniquí.' },
  { key: 'collarBack', label: 'Escote atrás', hint: 'Borde del cuello en la espalda.' },
  { key: 'collarFront', label: 'Escote adelante', hint: 'Borde del cuello en el pecho.' },
  { key: 'bodyTop', label: 'Fin del cuello', hint: 'Por debajo todo es tela.' },
  { key: 'sleeveY', label: 'Altura de las mangas', hint: 'Centro de la manga, para las vistas de lado.' },
  { key: 'hem', label: 'Ruedo', hint: 'Borde de abajo de la prenda; debajo va la base.' },
  { key: 'cut', label: 'Recorte de abajo', hint: 'Quita lo que asome bajo el ruedo (piernas). 0 = sin recorte.' },
];

const sameConfig = (a: GeneratedModelConfig, b: GeneratedModelConfig) => (Object.keys(a) as (keyof GeneratedModelConfig)[]).every((k) => a[k] === b[k]);

/** Ayuda del ajuste de tela según el tipo. */
const CLOTH_HINT: Record<Exclude<ModelKind, 'maniqui' | 'objeto'>, string> = {
  cabeza: 'Por encima de esta línea es la gorra (tela); por debajo, la cabeza del maniquí.',
  piernas: 'Por encima de esta línea es el pantalón (tela); por debajo, los pies y la base.',
};

export default function MannequinModelDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [m, setM] = useState<MannequinModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<GeneratedModelConfig | null>(null);
  // Config con la que se pinta el visor (se aplica 300 ms después de mover un ajuste).
  const [shown, setShown] = useState<GeneratedModelConfig | null>(null);
  const [view, setView] = useState<View3D>('front');
  const [color, setColor] = useState('#FFFFFF');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const handle = useRef<Mannequin3DHandle | null>(null);

  const apply = useCallback((r: MannequinModel) => {
    setM(r);
    setName(r.name);
    setConfig(r.config);
    setShown(r.config);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await mannequinModelsService.get(Number(id)));
    } catch (e) {
      toast.error(errorMessage(e, 'No se encontró el modelo 3D'));
      navigate('/admin-panel/models-3d');
    } finally {
      setLoading(false);
    }
  }, [id, apply, navigate]);
  useEffect(() => { load(); }, [load]);

  const generating = m?.status === 'generando';
  useEffect(() => {
    if (!generating) return;
    const poll = window.setInterval(async () => {
      try {
        const r = await mannequinModelsService.get(Number(id));
        if (r.status !== 'generando') apply(r);
      } catch { /* se reintenta en el siguiente */ }
    }, 5000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [generating, id, apply]);

  useEffect(() => {
    if (!config) return;
    const t = window.setTimeout(() => setShown(config), 300);
    return () => window.clearTimeout(t);
  }, [config]);

  // El visor pinta con los ajustes sin guardar (se rearma al cambiar un ajuste).
  const preview = useMemo(
    () => (m?.model && shown ? generatedConfig(m.name, m.model, m.poster, shown) : null),
    [m?.model, m?.name, m?.poster, shown],
  );
  const viewerKey = preview && shown ? Object.values(shown).join(',') : '';

  const dirty = !!m && !!config && (name.trim() !== m.name || !sameConfig(config, m.config));

  const save = async (published?: boolean) => {
    if (!m || !config) return;
    if (!name.trim()) { toast.error('Ponle un nombre al modelo'); return; }
    setSaving(true);
    try {
      // Foto de carga desde el visor, de frente y en blanco (como las del sistema).
      let poster: string | undefined;
      if (handle.current && (!m.poster || !sameConfig(config, m.config) || published)) {
        if (color !== '#FFFFFF') {
          setColor('#FFFFFF');
          await new Promise((r) => window.setTimeout(r, 200));
        }
        poster = handle.current.capture('front', { type: 'image/webp', quality: 0.9 }) ?? undefined;
      }
      const r = await mannequinModelsService.update(m.id, { name: name.trim(), config, poster, published });
      apply(r);
      await loadModels3D(true);
      toast.success(published === true ? 'Publicado: ya se puede elegir en las plantillas' : published === false ? 'Quedó sin publicar' : 'Modelo 3D guardado');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const retry = async () => {
    if (!m) return;
    if (m.status === 'revision' && !(await confirm({ title: '¿Generar de nuevo?', message: 'Se reemplaza el modelo actual por uno nuevo y se gasta tiempo de GPU de una cuenta.', confirmText: 'Generar de nuevo' }))) return;
    try {
      apply(await mannequinModelsService.retry(m.id));
      toast.success('Generando de nuevo');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo volver a generar'));
    }
  };

  const remove = async () => {
    if (!m) return;
    if (!(await confirm({ title: `¿Eliminar "${m.name}"?`, message: 'Se borran el modelo 3D y sus fotos. No se puede deshacer.', tone: 'danger' }))) return;
    try {
      await mannequinModelsService.remove(m.id);
      toast.success('Modelo 3D eliminado');
      navigate('/admin-panel/models-3d');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo eliminar'));
    }
  };

  if (loading || !m || !config) return <Page><Spinner label="Cargando modelo…" /></Page>;

  const elapsed = m.startedAt ? Math.round((now - new Date(m.startedAt).getTime()) / 1000) : 0;
  const ready = m.status === 'revision' || m.status === 'publicado';
  const pct = (v: number) => `${Math.round(v * 1000) / 10} %`;
  const kind: ModelKind = config.kind ?? 'maniqui';
  const labels = viewLabels(kind);

  return (
    <Page>
      <PageHeader
        icon={Box}
        backTo="/admin-panel/models-3d"
        title={m.name}
        subtitle={<span className="inline-flex items-center gap-2"><Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>{KIND_LABEL[kind]} · {SOURCE[m.source]}</span>}
        actions={ready ? (
          <>
            <Button variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={remove} disabled={saving || m.templates > 0} title={m.templates > 0 ? 'Lo usan plantillas' : undefined}>Eliminar</Button>
            <Button variant="secondary" icon={<RotateCcw className="w-4 h-4" />} onClick={retry} disabled={saving || m.status === 'publicado'}>Generar de nuevo</Button>
            <Button isLoading={saving} disabled={!dirty} onClick={() => save()}>Guardar</Button>
          </>
        ) : m.status === 'error' ? (
          <>
            <Button variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={remove}>Eliminar</Button>
            {m.inputImages.front && <Button icon={<RotateCcw className="w-4 h-4" />} onClick={retry}>Volver a generar</Button>}
          </>
        ) : m.status === 'borrador' ? (
          <Button variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={remove}>Eliminar</Button>
        ) : undefined}
      />

      {m.status === 'borrador' && (
        <Alert tone="info" title="Primero la foto">
          La IA arma la foto del producto en su maniquí estándar. Pídele cambios en el chat hasta que quede como la quieres y luego usa "Generar 3D con esta foto".
        </Alert>
      )}

      {generating && (
        <Card>
          <div className="flex flex-col sm:flex-row gap-6 items-center">
            <div className="flex-1 text-center sm:text-left">
              <p className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900"><RefreshCw className="w-5 h-5 animate-spin text-app-600" />Generando el modelo 3D · {duration(elapsed)}</p>
              <p className="text-sm text-gray-500 mt-1">
                Suele tardar entre 2 y 5 minutos. Puedes salir de esta pantalla: la generación sigue.
              </p>
            </div>
            <div className="flex gap-2">
              {Object.entries(m.inputImages).map(([v, src]) => <img key={v} src={src} alt="" className="w-24 h-24 object-contain rounded-lg bg-gray-50 ring-1 ring-gray-200" />)}
            </div>
          </div>
        </Card>
      )}

      {m.status === 'error' && (
        <Alert tone="error" title="No se pudo generar">{m.error || 'El servicio falló.'} Vuelve a intentarlo o pule la foto en el chat y genera el 3D con ella.</Alert>
      )}

      {!(ready && m.model) && <MannequinChat model={m} onModel={apply} />}

      {ready && m.model && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <RadioGroup variant="segmented" value={view} onChange={setView} options={VIEWS_3D.map((v) => ({ value: v.id, label: labels[v.id] }))} />
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color de prueba">
                {COLORS.map((c) => (
                  <button
                    key={c.hex} type="button" role="radio" aria-checked={color === c.hex} title={c.name} aria-label={c.name}
                    onClick={() => setColor(c.hex)}
                    className={`w-7 h-7 rounded-full ring-1 ring-gray-300 ${color === c.hex ? 'outline outline-2 outline-offset-2 outline-app-600' : ''}`}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </div>
            <div className="aspect-square w-full max-w-[640px] mx-auto rounded-xl bg-gray-50">
              <Suspense fallback={<Spinner label="Cargando 3D…" className="h-full" />}>
                {preview && <Mannequin3D key={viewerKey} model={`m${m.id}`} config={preview} color={color} art={NO_ART} focus={view} still handleRef={handle} />}
              </Suspense>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Arrastra para girarlo. La tela toma el color elegido y el maniquí queda grafito.</p>
          </Card>
          <MannequinChat model={m} onModel={apply} />
          </div>

          <div className="space-y-5">
            <Card>
              <CardTitle>Publicación</CardTitle>
              <div className="space-y-4">
                <Field label="Nombre" required htmlFor="mm-d-name">
                  <TextInput id="mm-d-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Switch
                  checked={m.status === 'publicado'}
                  disabled={saving || (m.status === 'publicado' && m.templates > 0)}
                  onChange={(v) => save(v)}
                  label="Publicado"
                  description={m.status === 'publicado'
                    ? (m.templates > 0 ? `Lo usan ${m.templates} plantilla(s): para despublicarlo cámbialas primero.` : 'Se puede elegir en Modelo 3D de las plantillas.')
                    : 'Al publicarlo aparece en Modelo 3D de las plantillas. Se guarda con la foto de frente del visor.'}
                />
              </div>
            </Card>

            <Card>
              <CardTitle icon={SlidersHorizontal} actions={<Button size="sm" variant="ghost" onClick={() => setConfig(m.config)} disabled={sameConfig(config, m.config)}>Deshacer</Button>}>Tela y maniquí</CardTitle>
              <Field label="Tipo">
                <RadioGroup variant="cards" value={kind} onChange={(v) => setConfig({ ...config, kind: v })} options={KINDS} />
              </Field>
              <p className="text-sm text-gray-500 my-4">
                {kind === 'objeto' ? 'Todo el modelo es tela: el estampado se puede poner en cualquier lado.' : 'Marca dónde termina el maniquí y empieza la tela; el estampado solo se pinta en la tela. Medidas en % del alto, desde abajo.'}
              </p>
              {(kind === 'cabeza' || kind === 'piernas') && (
                <div className="space-y-3">
                  <Field label="Separar la tela del maniquí">
                    <RadioGroup
                      variant="segmented" value={config.split ?? 'color'}
                      onChange={(v) => setConfig({ ...config, split: v })}
                      options={[{ value: 'color', label: 'Por color' }, { value: 'altura', label: 'Por altura' }]}
                    />
                  </Field>
                  {(config.split ?? 'color') === 'color' ? (
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <label htmlFor="mm-lightFrom" className="text-sm font-medium text-gray-700">Qué tan claro es tela</label>
                        <span className="text-sm tabular-nums text-gray-900">{pct(config.lightFrom ?? 0.62)}</span>
                      </div>
                      <input
                        id="mm-lightFrom" type="range" min={0.2} max={0.95} step={0.005} value={config.lightFrom ?? 0.62}
                        onChange={(e) => setConfig({ ...config, lightFrom: Number(e.target.value) })}
                        className="w-full accent-app-600"
                      />
                      <p className="text-xs text-gray-500">La prenda sale blanca y el maniquí grafito: lo más claro que este valor es tela. Súbelo si partes del maniquí salen como tela; bájalo si partes de la prenda salen grises.</p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <label htmlFor="mm-clothFrom" className="text-sm font-medium text-gray-700">La tela empieza en</label>
                        <span className="text-sm tabular-nums text-gray-900">{pct(config.clothFrom)}</span>
                      </div>
                      <input
                        id="mm-clothFrom" type="range" min={0} max={1} step={0.001} value={config.clothFrom}
                        onChange={(e) => setConfig({ ...config, clothFrom: Number(e.target.value) })}
                        className="w-full accent-app-600"
                      />
                      <p className="text-xs text-gray-500">{CLOTH_HINT[kind]}</p>
                    </div>
                  )}
                </div>
              )}
              {kind === 'maniqui' && (
              <div className="space-y-4">
                {SLIDERS.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor={`mm-${s.key}`} className="text-sm font-medium text-gray-700">{s.label}</label>
                      <span className="text-sm tabular-nums text-gray-900">{pct(config[s.key])}</span>
                    </div>
                    <input
                      id={`mm-${s.key}`} type="range" min={0} max={1} step={0.001} value={config[s.key]}
                      onChange={(e) => setConfig({ ...config, [s.key]: Number(e.target.value) })}
                      className="w-full accent-app-600"
                    />
                    <p className="text-xs text-gray-500">{s.hint}</p>
                  </div>
                ))}
                <Field label="Forma del escote">
                  <RadioGroup
                    variant="segmented" value={String(config.collarCurve) as '1' | '2'}
                    onChange={(v) => setConfig({ ...config, collarCurve: Number(v) })}
                    options={[{ value: '1', label: 'Baja parejo' }, { value: '2', label: 'Solo adelante' }]}
                  />
                </Field>
              </div>
              )}
              <FormActions>
                <Button variant="secondary" onClick={() => setConfig(m.config)} disabled={saving || !dirty}>Cancelar</Button>
                <Button isLoading={saving} disabled={!dirty} onClick={() => save()}>Guardar</Button>
              </FormActions>
            </Card>

            <Card>
              <CardTitle>Detalles</CardTitle>
              <DescriptionList cols={1} items={[
                { label: 'Generado', value: m.finishedAt ? `${new Date(m.finishedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}${m.seconds ? ` · tardó ${duration(m.seconds)}` : ''}` : '—' },
                { label: 'Cuenta usada', value: m.account ? `Cuenta ${m.account}` : '—' },
                { label: 'Calidad', value: m.quality === 'alta' ? 'Alta' : 'Normal' },
                ...(m.prompt ? [{ label: 'Descripción', value: m.prompt }] : []),
                { label: 'Plantillas que lo usan', value: String(m.templates) },
              ]} />
              <div className="flex flex-wrap gap-2 mt-4">
                {Object.entries(m.inputImages).map(([v, src]) => <img key={v} src={src} alt={`Foto de entrada (${v})`} className="w-16 h-16 object-contain rounded-lg bg-gray-50 ring-1 ring-gray-200" />)}
              </div>
              <a href={m.model} download className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-app-700 hover:underline">
                <Download className="w-4 h-4" />Descargar .glb (para Blender u otro programa)
              </a>
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}
