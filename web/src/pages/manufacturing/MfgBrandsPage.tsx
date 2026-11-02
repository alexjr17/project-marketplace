import { useEffect, useState } from 'react';
import { Plus, BadgeCheck } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgBrand } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Dialog, Field, TextInput, Switch, useConfirm,
} from '../../components/ui';
import { ActiveBadge, RowActions, matchText } from '../../components/manufacturing/mfgUi';

const empty = { name: '', code: '', isActive: true };

export default function MfgBrandsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgBrand | null>(null);
  const [form, setForm] = useState<Partial<MfgBrand>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getBrands()); }
    catch { toast.error('No se pudieron cargar las marcas'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (b: MfgBrand) => { setEditing(b); setForm({ ...b }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateBrand(editing.id, form); toast.success('Marca actualizada'); }
      else { await manufacturingService.createBrand(form); toast.success('Marca creada'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (b: MfgBrand) => {
    if (!(await confirm({ title: `¿Eliminar la marca "${b.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteBrand(b.id); toast.success('Marca eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((b) => matchText(q, b.name, b.code));

  return (
    <Page>
      <PageHeader
        icon={BadgeCheck}
        title="Marcas"
        subtitle="Marcas de las prendas. El tipo de prenda define su marca."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nueva marca</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o código…" />
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Nombre</Th><Th>Código</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={4}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={4}>{items.length ? 'Sin resultados para la búsqueda.' : 'Sin marcas. Crea la primera.'}</TableMessage>
              : rows.map((b) => (
                <Tr key={b.id}>
                  <Td className="font-medium text-gray-900">{b.name}</Td>
                  <Td className="font-mono text-gray-600">{b.code || '—'}</Td>
                  <Td align="center"><ActiveBadge active={b.isActive} female /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(b)} onDelete={() => remove(b)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar marca' : 'Nueva marca'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
          <Field label="Código"><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Switch label="Activa" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </Dialog>
    </Page>
  );
}
