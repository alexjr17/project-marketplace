import { useEffect, useState } from 'react';
import { Plus, Building2 } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import MultiSelect from '../../components/manufacturing/MultiSelect';
import type { MfgWorkshop, MfgProcess } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Drawer, Field, TextInput, TextArea, RadioGroup, Switch, Badge, useConfirm,
} from '../../components/ui';
import { ActiveBadge, RowActions, matchText } from '../../components/manufacturing/mfgUi';

const empty = { name: '', code: '', type: 'EXTERNAL' as const, contactName: '', phone: '', notes: '', isActive: true };

export default function WorkshopsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgWorkshop[]>([]);
  const [allProcesses, setAllProcesses] = useState<MfgProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgWorkshop | null>(null);
  const [form, setForm] = useState<Partial<MfgWorkshop>>(empty);
  const [processIds, setProcessIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getWorkshops()); }
    catch { toast.error('No se pudieron cargar los talleres'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); manufacturingService.getProcesses().then(setAllProcesses).catch(() => {}); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setProcessIds([]); setModal(true); };
  const openEdit = (w: MfgWorkshop) => { setEditing(w); setForm({ ...w }); setProcessIds(w.processes?.map((p) => p.id) ?? []); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    const payload = { ...form, processIds };
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateWorkshop(editing.id, payload); toast.success('Taller actualizado'); }
      else { await manufacturingService.createWorkshop(payload); toast.success('Taller creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (w: MfgWorkshop) => {
    if (!(await confirm({ title: `¿Eliminar el taller "${w.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteWorkshop(w.id); toast.success('Taller eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((w) => matchText(q, w.name, w.code, w.contactName, w.phone, ...(w.processes ?? []).map((p) => p.name)));

  return (
    <Page>
      <PageHeader
        icon={Building2}
        title="Talleres"
        subtitle="Talleres internos y satélites (producción tercerizada)."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo taller</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar taller o proceso…" />
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Nombre</Th><Th align="center">Tipo</Th><Th>Procesos</Th><Th>Contacto</Th><Th>Teléfono</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={7}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={7}>{items.length ? 'Sin resultados para la búsqueda.' : 'Sin talleres. Crea el primero.'}</TableMessage>
              : rows.map((w) => (
                <Tr key={w.id}>
                  <Td className="font-medium text-gray-900">{w.name}{w.code && <span className="block text-xs font-normal font-mono text-gray-400">{w.code}</span>}</Td>
                  <Td align="center"><Badge tone={w.type === 'EXTERNAL' ? 'purple' : 'blue'}>{w.type === 'EXTERNAL' ? 'Satélite' : 'Interno'}</Badge></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {w.processes && w.processes.length > 0 ? w.processes.map((p) => <Badge key={p.id}>{p.name}</Badge>) : <span className="text-gray-400">—</span>}
                    </div>
                  </Td>
                  <Td>{w.contactName || '—'}</Td>
                  <Td className="whitespace-nowrap">{w.phone || '—'}</Td>
                  <Td align="center"><ActiveBadge active={w.isActive} /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(w)} onDelete={() => remove(w)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Drawer
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar taller' : 'Nuevo taller'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
          <Field label="Código"><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Tipo">
            <RadioGroup
              variant="cards"
              value={form.type ?? 'EXTERNAL'}
              onChange={(v) => setForm({ ...form, type: v as MfgWorkshop['type'] })}
              options={[
                { value: 'EXTERNAL', label: 'Satélite', description: 'Taller externo (tercerizado)' },
                { value: 'INTERNAL', label: 'Interno', description: 'Planta propia' },
              ]}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contacto"><TextInput value={form.contactName ?? ''} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label="Teléfono"><TextInput value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          </div>
          <Field label="Procesos que hace" hint="El taller aparecerá al asignar estos procesos en una orden.">
            <MultiSelect placeholder="Buscar procesos…" value={processIds} onChange={setProcessIds}
              options={allProcesses.map((p) => ({ id: p.id, label: p.name }))} />
          </Field>
          <Field label="Notas"><TextArea rows={2} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Switch label="Activo" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </Drawer>
    </Page>
  );
}
