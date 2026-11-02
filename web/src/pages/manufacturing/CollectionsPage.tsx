import { useEffect, useState } from 'react';
import { Plus, CalendarRange } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgCollection } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Dialog, Field, TextInput, NumberInput, SelectInput, Switch, FormGrid, useConfirm,
} from '../../components/ui';
import { ActiveBadge, RowActions, matchText } from '../../components/manufacturing/mfgUi';

const empty = { name: '', year: undefined as number | undefined, semester: '', isActive: true };

export default function CollectionsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgCollection | null>(null);
  const [form, setForm] = useState<Partial<MfgCollection>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getCollections()); }
    catch { toast.error('No se pudieron cargar las colecciones'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: MfgCollection) => { setEditing(c); setForm({ ...c, semester: c.semester ?? '' }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    const payload = { ...form, semester: form.semester || null, year: form.year || null };
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateCollection(editing.id, payload); toast.success('Colección actualizada'); }
      else { await manufacturingService.createCollection(payload); toast.success('Colección creada'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (c: MfgCollection) => {
    if (!(await confirm({ title: `¿Eliminar la colección "${c.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteCollection(c.id); toast.success('Colección eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((c) => matchText(q, c.name, c.year, c.semester));

  return (
    <Page>
      <PageHeader
        icon={CalendarRange}
        title="Colecciones"
        subtitle="Año y semestre a los que pertenece cada referencia."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nueva colección</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o año…" />
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Nombre</Th><Th align="right">Año</Th><Th align="center">Semestre</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={5}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={5}>{items.length ? 'Sin resultados para la búsqueda.' : 'Sin colecciones. Crea la primera.'}</TableMessage>
              : rows.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium text-gray-900">{c.name}</Td>
                  <Td align="right">{c.year || '—'}</Td>
                  <Td align="center">{c.semester || '—'}</Td>
                  <Td align="center"><ActiveBadge active={c.isActive} female /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(c)} onDelete={() => remove(c)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar colección' : 'Nueva colección'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Verano 2026" autoFocus /></Field>
          <FormGrid>
            <Field label="Año"><NumberInput value={form.year ?? ''} onChange={(e) => setForm({ ...form, year: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="2026" /></Field>
            <Field label="Semestre">
              <SelectInput value={form.semester ?? ''} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">—</option><option value="I">I</option><option value="II">II</option>
              </SelectInput>
            </Field>
          </FormGrid>
          <Switch label="Activa" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </Dialog>
    </Page>
  );
}
