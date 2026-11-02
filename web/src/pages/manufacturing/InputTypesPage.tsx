import { useEffect, useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgInputType } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Dialog, Field, TextInput, TextArea, RadioGroup, Switch, Checkbox, Badge, useConfirm,
} from '../../components/ui';
import { ActiveBadge, RowActions, matchText } from '../../components/manufacturing/mfgUi';

const empty = { name: '', classification: 'PRODUCTO' as const, consumesByColor: false, description: '', isActive: true };
const CLASS_LABEL: Record<string, string> = { PRODUCTO: 'Producto', SERVICIO: 'Servicio' };

export default function InputTypesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgInputType[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgInputType | null>(null);
  const [form, setForm] = useState<Partial<MfgInputType>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getInputTypes()); }
    catch { toast.error('No se pudieron cargar los tipos de insumo'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (t: MfgInputType) => { setEditing(t); setForm({ ...t }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateInputType(editing.id, form); toast.success('Tipo de insumo actualizado'); }
      else { await manufacturingService.createInputType(form); toast.success('Tipo de insumo creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (t: MfgInputType) => {
    if (!(await confirm({ title: `¿Eliminar el tipo de insumo "${t.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteInputType(t.id); toast.success('Tipo de insumo eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((t) => matchText(q, t.name, t.description));

  return (
    <Page>
      <PageHeader
        icon={Layers}
        title="Tipos de insumo"
        subtitle="Clasifican los insumos: Producto (material) o Servicio (mano de obra)."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo tipo</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar tipo de insumo…" />
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Nombre</Th><Th align="center">Clasificación</Th><Th align="center">Por color</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={5}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={5}>{items.length ? 'Sin resultados para la búsqueda.' : 'Sin tipos de insumo. Crea el primero.'}</TableMessage>
              : rows.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-medium text-gray-900">{t.name}{t.description && <span className="block text-xs font-normal text-gray-500 truncate max-w-xs">{t.description}</span>}</Td>
                  <Td align="center"><Badge tone={t.classification === 'SERVICIO' ? 'purple' : 'blue'}>{CLASS_LABEL[t.classification] ?? 'Producto'}</Badge></Td>
                  <Td align="center">{t.classification !== 'SERVICIO' && t.consumesByColor ? 'Sí' : <span className="text-gray-400">—</span>}</Td>
                  <Td align="center"><ActiveBadge active={t.isActive} /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(t)} onDelete={() => remove(t)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar tipo de insumo' : 'Nuevo tipo de insumo'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Telas, Hilos, Servicios…" autoFocus /></Field>
          <Field label="Clasificación">
            <RadioGroup
              variant="cards"
              value={form.classification ?? 'PRODUCTO'}
              onChange={(v) => setForm({ ...form, classification: v as MfgInputType['classification'] })}
              options={[
                { value: 'PRODUCTO', label: 'Producto', description: 'Se consume en inventario' },
                { value: 'SERVICIO', label: 'Servicio', description: 'Mano de obra, no se consume' },
              ]}
            />
          </Field>
          {form.classification !== 'SERVICIO' && (
            <Checkbox label="Se consume por color" description="Como las telas: el consumo se registra por cada color." checked={form.consumesByColor ?? false} onChange={(e) => setForm({ ...form, consumesByColor: e.target.checked })} />
          )}
          <Field label="Descripción"><TextArea rows={2} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Switch label="Activo" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </Dialog>
    </Page>
  );
}
