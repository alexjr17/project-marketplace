/**
 * Admin → Personalizador → Modelos 3D. Modelos generados con IA (Hugging Face): cada tipo (prenda de
 * arriba, gorra, pantalón, objeto) va en su maniquí grafito estándar. Todo se genera desde el chat de cada
 * modelo (MannequinModelDetailPage): se define la foto, se aprueban las 4 vistas y recién ahí el 3D.
 * Aquí se crea el modelo con su primer mensaje y se ve la cuota de GPU de cada cuenta.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Eye, MessageSquare, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardTitle, Dialog, Field, FormActions, IconButton, ImageInput, Page, PageHeader,
  RadioGroup, TableCard, Table, TBody, Td, TextArea, TextInput, Th, THead, TableMessage, Thumb, Tr, toast, useConfirm,
} from '../../components/ui';
import { errorMessage } from '../../lib/http';
import { MODELS_3D, SYSTEM_MODELS_3D, type ModelKind } from '../../components/mannequin/models';
import { mannequinModelsService, type HfAccounts, type MannequinModel } from '../../services/mannequinModels.service';
import { duration, KIND_LABEL, KINDS, shrinkImage, STATUS } from './mannequinUi';

const PLACEHOLDER: Record<ModelKind, string> = {
  maniqui: 'Buso oversize con capucha, bolsillo canguro, puños y pretina acanalados, hombro caído',
  cabeza: 'Gorra de 6 paneles, visera curva, botón arriba y cierre de broche atrás, sin logos',
  piernas: 'Jogger de algodón, pretina con cordón, bolsillos laterales y puño en el tobillo',
  objeto: 'Bolso tote de lona con asas largas y base cuadrada',
};

const EMPTY = { name: '', kind: 'maniqui' as ModelKind, prompt: '', image: '' };

export default function MannequinModelsPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [models, setModels] = useState<MannequinModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<HfAccounts | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      setModels(await mannequinModelsService.list());
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudieron cargar los modelos 3D'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async (fresh = false) => {
    setLoadingAccounts(true);
    try {
      setAccounts(await mannequinModelsService.accounts(fresh));
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo consultar la cuota de Hugging Face'));
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => { load(); loadAccounts(); }, [load, loadAccounts]);

  // Mientras alguno genera su 3D: se revisa cada 5 s y el reloj avanza.
  const generating = models.some((m) => m.status === 'generando');
  useEffect(() => {
    if (!generating) return;
    const poll = window.setInterval(() => { load(); }, 5000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, [generating, load]);
  const [wasGenerating, setWasGenerating] = useState(false);
  useEffect(() => {
    if (wasGenerating && !generating) loadAccounts(true);
    setWasGenerating(generating);
  }, [generating, wasGenerating, loadAccounts]);

  // El primer mensaje: con foto se edita (Kontext); solo texto, se crea la foto.
  const need = accounts ? (form.image ? accounts.needs.edit : accounts.needs.text) : 0;
  const bestLeft = useMemo(() => Math.max(0, ...(accounts?.accounts ?? []).filter((a) => a.runsLeft > 0).map((a) => a.left)), [accounts]);
  const canSend = !accounts || bestLeft >= need;

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Ponle un nombre al modelo'); return; }
    if (!form.prompt.trim() && !form.image) { toast.error('Escribe la descripción o sube una foto de referencia'); return; }
    setSaving(true);
    try {
      const created = await mannequinModelsService.create({
        name: form.name.trim(), kind: form.kind,
        prompt: form.prompt.trim() || undefined,
        image: form.image ? await shrinkImage(form.image) : undefined,
      });
      setOpen(false);
      setForm(EMPTY);
      toast.success('Armando la primera foto. Sigue en el chat del modelo.');
      navigate(`/admin-panel/models-3d/${created.id}`);
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo crear el modelo'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: MannequinModel) => {
    const ok = await confirm({ title: `¿Eliminar "${m.name}"?`, message: 'Se borran el modelo 3D, el chat y sus fotos. No se puede deshacer.', confirmText: 'Eliminar', tone: 'danger' });
    if (!ok) return;
    try {
      await mannequinModelsService.remove(m.id);
      setModels((prev) => prev.filter((x) => x.id !== m.id));
      toast.success('Modelo 3D eliminado');
    } catch (e) {
      toast.error(errorMessage(e, 'No se pudo eliminar'));
    }
  };

  const elapsed = (m: MannequinModel) => (m.startedAt ? Math.round((now - new Date(m.startedAt).getTime()) / 1000) : 0);
  const needs = accounts?.needs;

  return (
    <Page>
      <PageHeader
        icon={Box}
        title="Modelos 3D"
        subtitle="Modelos 3D para el personalizador. Se definen en un chat con la IA y se generan cuando las fotos están aprobadas."
        actions={<Button icon={<Sparkles className="w-4 h-4" />} onClick={() => setOpen(true)}>Nuevo modelo</Button>}
      />

      <Card>
        <CardTitle
          icon={Sparkles}
          actions={<IconButton title="Consultar de nuevo" onClick={() => loadAccounts(true)} disabled={loadingAccounts}><RefreshCw className={`w-4 h-4 ${loadingAccounts ? 'animate-spin' : ''}`} /></IconButton>}
        >
          Cuota de GPU por cuenta
        </CardTitle>
        <p className="text-sm text-gray-500 mb-3">
          Cada cuenta gratis de Hugging Face tiene su tiempo de GPU por día; se usa la primera que tenga tiempo.
          Cada foto del chat gasta cerca de {duration(needs?.edit ?? 90)}, armar la espalda y los lados {duration((needs?.edit ?? 90) * 3)} y el 3D {duration(needs?.views ?? 270)}.
        </p>
        {!loadingAccounts && accounts && accounts.accounts.length === 0 && (
          <Alert tone="warning" title="Sin cuentas">Agrega los tokens HF_TOKEN, HF_TOKEN_2… en el archivo .env de la API.</Alert>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {(accounts?.accounts ?? []).map((a) => {
            const pct = a.base ? Math.round((a.left / a.base) * 100) : 0;
            const enough = a.left >= (needs?.edit ?? 90) && a.runsLeft > 0;
            return (
              <div key={a.account} className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">Cuenta {a.account}{a.user ? ` · ${a.user}` : ''}</p>
                  <Badge tone={!a.ok ? 'red' : enough ? 'green' : 'gray'}>{!a.ok ? 'Sin conexión' : enough ? 'Disponible' : 'Sin tiempo hoy'}</Badge>
                </div>
                <p className="mt-2 text-xl font-semibold text-gray-900 tabular-nums">{duration(a.left)} <span className="text-sm font-normal text-gray-500">de {duration(a.base)}</span></p>
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={a.base} aria-valuenow={a.left} aria-label={`Tiempo de GPU de la cuenta ${a.account}`}>
                  <div className="h-full rounded-full bg-app-600" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {a.runsLeft} de {a.runsLimit} usos
                  {a.resetsAt ? ` · se renueva ${new Date(a.resetsAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}` : a.left < a.base ? ' · se renueva en 24 h' : ''}
                </p>
              </div>
            );
          })}
          {loadingAccounts && !accounts && [1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />)}
        </div>
      </Card>

      <TableCard>
        <Table>
          <THead>
            <tr><Th>Modelo</Th><Th>Tipo</Th><Th align="center">Estado</Th><Th align="right">Plantillas</Th><Th>Creado</Th><Th align="right">Acciones</Th></tr>
          </THead>
          <TBody>
            {SYSTEM_MODELS_3D.map((k) => (
              <Tr key={k}>
                <Td><div className="flex items-center gap-3"><Thumb src={MODELS_3D[k].poster} alt="" /><span className="font-medium text-gray-900">{MODELS_3D[k].label}</span></div></Td>
                <Td className="text-gray-500">Prenda de arriba · del sistema</Td>
                <Td align="center"><Badge tone="green">Publicado</Badge></Td>
                <Td align="right" className="text-gray-400">—</Td>
                <Td className="text-gray-400">—</Td>
                <Td align="right" className="text-xs text-gray-400">Ajustado a mano</Td>
              </Tr>
            ))}
            {loading ? <TableMessage colSpan={6}>Cargando…</TableMessage>
              : models.length === 0 ? <TableMessage colSpan={6}>Todavía no hay modelos. Usa "Nuevo modelo" para crear el primero.</TableMessage>
                : models.map((m) => (
                  <Tr key={m.id} onClick={() => navigate(`/admin-panel/models-3d/${m.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Thumb src={m.poster || m.inputImages.front || null} alt="" />
                        <span className="font-medium text-gray-900">{m.name}</span>
                      </div>
                    </Td>
                    <Td className="text-gray-500">{KIND_LABEL[m.config.kind ?? 'maniqui']}</Td>
                    <Td align="center">
                      <Badge tone={STATUS[m.status].tone}>
                        {m.status === 'generando' && <RefreshCw className="w-3 h-3 animate-spin" />}
                        {STATUS[m.status].label}{m.status === 'generando' ? ` · ${duration(elapsed(m))}` : ''}
                      </Badge>
                    </Td>
                    <Td align="right" className="tabular-nums">{m.templates}</Td>
                    <Td className="text-gray-500">{new Date(m.createdAt).toLocaleDateString('es-CO')}</Td>
                    <Td align="right">
                      <div className="inline-flex" onClick={(e) => e.stopPropagation()}>
                        <IconButton title={m.status === 'borrador' ? 'Abrir el chat' : 'Revisar'} tone="app" onClick={() => navigate(`/admin-panel/models-3d/${m.id}`)}>
                          {m.status === 'borrador' ? <MessageSquare className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </IconButton>
                        {m.status !== 'generando' && <IconButton title="Eliminar" tone="danger" onClick={() => remove(m)}><Trash2 className="w-4 h-4" /></IconButton>}
                      </div>
                    </Td>
                  </Tr>
                ))}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Nuevo modelo 3D"
        description="Se abre un chat con la IA: primero defines la foto del producto en su maniquí estándar y, cuando la apruebes, se arman las 4 vistas y el 3D. Nada se genera sin que lo pidas."
        size="lg"
        footer={(
          <FormActions>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button icon={<MessageSquare className="w-4 h-4" />} isLoading={saving} disabled={!canSend} onClick={submit}>Crear y abrir el chat</Button>
          </FormActions>
        )}
      >
        <div className="space-y-4">
          <Field label="Nombre" required htmlFor="mm-name" hint="Así aparece en Modelo 3D de las plantillas.">
            <TextInput id="mm-name" value={form.name} maxLength={80} placeholder="Buso oversize" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Qué es" hint="Cada tipo va en su maniquí grafito estándar y la prenda sale blanca (en la tienda se pinta del color que elija el cliente).">
            <RadioGroup variant="cards" value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={KINDS} />
          </Field>
          <Field label="Primer mensaje" required htmlFor="mm-prompt" hint="Describe con detalle: forma, largo, cuello, mangas, material, costuras, cierres… Puedes escribir en español.">
            <TextArea id="mm-prompt" rows={4} maxLength={1000} value={form.prompt} placeholder={PLACEHOLDER[form.kind]} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
          </Field>
          <Field label="Foto de referencia" hint="Opcional. El producto entero, con buena luz: la IA lo pasa al maniquí estándar con lo que describas. Más fotos las puedes mandar en el chat.">
            <ImageInput value={form.image} onChange={(v) => setForm({ ...form, image: v })} maxSizeMB={10} allowUrl={false} className="max-w-[12rem]" />
          </Field>
          {accounts && (
            canSend
              ? <p className="text-sm text-gray-500">Esta primera foto gasta cerca de {duration(need)} de GPU. La cuenta con más tiempo tiene {duration(bestLeft)}.</p>
              : <Alert tone="warning" title="Sin tiempo de GPU hoy">La primera foto pide {duration(need)} y ninguna cuenta tiene tanto. La cuota se renueva cada día.</Alert>
          )}
        </div>
      </Dialog>
    </Page>
  );
}
