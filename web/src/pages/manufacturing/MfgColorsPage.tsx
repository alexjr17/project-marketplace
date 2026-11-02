import { useEffect, useState } from 'react';
import { Plus, Palette } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgColor } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Dialog, Field, TextInput, ColorInput, Switch, useConfirm,
} from '../../components/ui';
import { ActiveBadge, RowActions, matchText } from '../../components/manufacturing/mfgUi';

const empty = { name: '', hexCode: '#3B82F6', code: '', isActive: true };

export default function MfgColorsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgColor | null>(null);
  const [form, setForm] = useState<Partial<MfgColor>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getColors()); }
    catch { toast.error('No se pudieron cargar los colores'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: MfgColor) => { setEditing(c); setForm({ ...c }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateColor(editing.id, form); toast.success('Color actualizado'); }
      else { await manufacturingService.createColor(form); toast.success('Color creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (c: MfgColor) => {
    if (!(await confirm({ title: `¿Eliminar el color "${c.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteColor(c.id); toast.success('Color eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((c) => matchText(q, c.name, c.code, c.hexCode));

  return (
    <Page>
      <PageHeader
        icon={Palette}
        title="Colores"
        subtitle="Colores propios de Fábrica. El código (2 díg.) se usa en el código de barras."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo color</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o código…" />
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th className="w-16">Color</Th><Th>Nombre</Th><Th>Código</Th><Th>Hex</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={6}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={6}>{items.length ? 'Sin resultados para la búsqueda.' : 'Sin colores. Crea el primero.'}</TableMessage>
              : rows.map((c) => (
                <Tr key={c.id}>
                  <Td><span className="w-6 h-6 rounded-full border border-gray-200 inline-block align-middle" style={{ backgroundColor: c.hexCode }} /></Td>
                  <Td className="font-medium text-gray-900">{c.name}</Td>
                  <Td className="font-mono">{c.code || '—'}</Td>
                  <Td className="font-mono text-xs uppercase text-gray-500">{c.hexCode}</Td>
                  <Td align="center"><ActiveBadge active={c.isActive} /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(c)} onDelete={() => remove(c)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar color' : 'Nuevo color'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Azul Marino" autoFocus /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Color"><ColorInput value={form.hexCode ?? ''} onChange={(hex) => setForm({ ...form, hexCode: hex })} /></Field>
            <Field label="Código (barcode)" hint="2 dígitos, ej. 01"><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={10} className="font-mono" placeholder="01" /></Field>
          </div>
          <Switch label="Activo" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </Dialog>
    </Page>
  );
}
