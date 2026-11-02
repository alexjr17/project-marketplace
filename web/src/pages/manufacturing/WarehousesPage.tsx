import { useEffect, useState } from 'react';
import { Plus, Warehouse } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgWarehouse } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Dialog, Field, TextInput, Switch, useConfirm,
} from '../../components/ui';
import { ActiveBadge, RowActions } from '../../components/manufacturing/mfgUi';

const empty = { name: '', code: '', address: '', isActive: true };

export default function WarehousesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgWarehouse | null>(null);
  const [form, setForm] = useState<Partial<MfgWarehouse>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getWarehouses()); }
    catch { toast.error('No se pudieron cargar las bodegas'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (w: MfgWarehouse) => { setEditing(w); setForm({ ...w }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateWarehouse(editing.id, form); toast.success('Bodega actualizada'); }
      else { await manufacturingService.createWarehouse(form); toast.success('Bodega creada'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (w: MfgWarehouse) => {
    if (!(await confirm({ title: `¿Eliminar la bodega "${w.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteWarehouse(w.id); toast.success('Bodega eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <Page>
      <PageHeader
        icon={Warehouse}
        title="Bodegas"
        subtitle="Almacenes donde queda el producto terminado."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nueva bodega</Button>}
      />

      <TableCard>
        <Table>
          <THead><tr><Th>Nombre</Th><Th>Código</Th><Th>Dirección</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={5}>Cargando…</TableMessage>
              : items.length === 0 ? <TableMessage colSpan={5}>Sin bodegas. Crea la primera.</TableMessage>
              : items.map((w) => (
                <Tr key={w.id}>
                  <Td className="font-medium text-gray-900">{w.name}</Td>
                  <Td className="font-mono">{w.code || '—'}</Td>
                  <Td>{w.address || '—'}</Td>
                  <Td align="center"><ActiveBadge active={w.isActive} female /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(w)} onDelete={() => remove(w)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar bodega' : 'Nueva bodega'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
          <Field label="Código"><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Dirección"><TextInput value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Switch label="Activa" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </Dialog>
    </Page>
  );
}
