import { useEffect, useState } from 'react';
import { Plus, Trash2, Workflow } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgProcess, MfgInputType, MfgInput } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Drawer, Field, TextInput, NumberInput, SelectInput, RadioGroup, Switch, Badge, CardTitle, useConfirm,
} from '../../components/ui';
import { ActiveBadge, RowActions } from '../../components/manufacturing/mfgUi';

const empty = { name: '', code: '', sequence: 0, type: 'INTERNAL' as const, isActive: true };
interface ConsRow { kind: 'TYPE' | 'INPUT'; inputTypeId: number | ''; inputId: number | ''; }

export default function ProcessesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgProcess[]>([]);
  const [inputTypes, setInputTypes] = useState<MfgInputType[]>([]);
  const [inputs, setInputs] = useState<MfgInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgProcess | null>(null);
  const [form, setForm] = useState<Partial<MfgProcess>>(empty);
  const [cons, setCons] = useState<ConsRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getProcesses()); }
    catch { toast.error('No se pudieron cargar los procesos'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    manufacturingService.getInputTypes().then(setInputTypes).catch(() => {});
    manufacturingService.getInputs().then(setInputs).catch(() => {});
  }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty, sequence: items.length + 1 }); setCons([]); setModal(true); };
  const openEdit = (p: MfgProcess) => {
    setEditing(p); setForm({ ...p });
    setCons((p.consumptions ?? []).map((c) => ({ kind: c.kind, inputTypeId: c.inputTypeId ?? '', inputId: c.inputId ?? '' })));
    setModal(true);
  };
  const addCons = () => setCons([...cons, { kind: 'TYPE', inputTypeId: '', inputId: '' }]);
  const patchCons = (i: number, patch: Partial<ConsRow>) => setCons(cons.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    const consumptions = cons
      .filter((c) => (c.kind === 'TYPE' ? c.inputTypeId !== '' : c.inputId !== ''))
      .map((c) => ({ kind: c.kind, inputTypeId: c.kind === 'TYPE' ? Number(c.inputTypeId) : null, inputId: c.kind === 'INPUT' ? Number(c.inputId) : null }));
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateProcess(editing.id, { ...form, consumptions }); toast.success('Proceso actualizado'); }
      else { await manufacturingService.createProcess({ ...form, consumptions }); toast.success('Proceso creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (p: MfgProcess) => {
    if (!(await confirm({ title: `¿Eliminar el proceso "${p.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteProcess(p.id); toast.success('Proceso eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <Page>
      <PageHeader
        icon={Workflow}
        title="Procesos"
        subtitle="Estaciones o etapas de producción. El orden define la ruta por defecto."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo proceso</Button>}
      />

      <TableCard>
        <Table>
          <THead><tr><Th align="right" className="w-20">Orden</Th><Th>Nombre</Th><Th>Código</Th><Th align="center">Tipo</Th><Th align="right">Consumos</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={7}>Cargando…</TableMessage>
              : items.length === 0 ? <TableMessage colSpan={7}>Sin procesos. Crea el primero.</TableMessage>
              : items.map((p) => (
                <Tr key={p.id}>
                  <Td align="right" className="tabular-nums text-gray-500">{p.sequence}</Td>
                  <Td className="font-medium text-gray-900">{p.name}</Td>
                  <Td className="font-mono">{p.code || '—'}</Td>
                  <Td align="center"><Badge tone={p.type === 'EXTERNAL' ? 'purple' : 'blue'}>{p.type === 'EXTERNAL' ? 'Externo' : 'Interno'}</Badge></Td>
                  <Td align="right" className="tabular-nums">{p.consumptions?.length || <span className="text-gray-400">—</span>}</Td>
                  <Td align="center"><ActiveBadge active={p.isActive} /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Drawer
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar proceso' : 'Nuevo proceso'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-6">
          <section className="space-y-4">
            <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Corte, Confección…" autoFocus /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código"><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Orden"><NumberInput value={form.sequence ?? 0} onChange={(e) => setForm({ ...form, sequence: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Tipo">
              <RadioGroup
                variant="segmented"
                value={form.type ?? 'INTERNAL'}
                onChange={(v) => setForm({ ...form, type: v as MfgProcess['type'] })}
                options={[{ value: 'INTERNAL', label: 'Interno' }, { value: 'EXTERNAL', label: 'Externo (satélite)' }]}
              />
            </Field>
            <Switch label="Activo" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
          </section>

          <section className="border-t border-gray-100 pt-5">
            <CardTitle actions={<Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={addCons}>Agregar</Button>}>Consumo del proceso</CardTitle>
            <p className="text-xs text-gray-500 -mt-2 mb-3">Qué insumos consume: por tipo (categoría) o un insumo específico.</p>
            {cons.length === 0 ? <p className="text-sm text-gray-400">Sin consumo configurado.</p> : (
              <div className="space-y-2">
                {cons.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-32 flex-shrink-0"><SelectInput value={c.kind} onChange={(e) => patchCons(i, { kind: e.target.value as ConsRow['kind'] })} aria-label="Clase de consumo">
                      <option value="TYPE">Por tipo</option>
                      <option value="INPUT">Insumo</option>
                    </SelectInput></div>
                    {c.kind === 'TYPE' ? (
                      <SelectInput value={c.inputTypeId} onChange={(e) => patchCons(i, { inputTypeId: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Tipo de insumo">
                        <option value="">— Tipo de insumo —</option>
                        {inputTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </SelectInput>
                    ) : (
                      <SelectInput value={c.inputId} onChange={(e) => patchCons(i, { inputId: e.target.value === '' ? '' : Number(e.target.value) })} aria-label="Insumo">
                        <option value="">— Insumo —</option>
                        {inputs.map((inp) => <option key={inp.id} value={inp.id}>{inp.code} · {inp.name}</option>)}
                      </SelectInput>
                    )}
                    <IconButton title="Quitar consumo" tone="danger" onClick={() => setCons(cons.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></IconButton>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </Drawer>
    </Page>
  );
}
