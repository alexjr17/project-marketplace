import { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgClient } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Drawer, Field, TextInput, NumberInput, SelectInput, Switch, FormGrid, CardTitle, useConfirm,
} from '../../components/ui';
import { ActiveBadge, RowActions, matchText } from '../../components/manufacturing/mfgUi';

const empty = { name: '', documentId: '', documentType: '', businessName: '', email: '', phone: '', city: '', invoiceAddress: '', dispatchAddress: '', creditDays: null as number | null, isActive: true };

export default function ClientsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgClient | null>(null);
  const [form, setForm] = useState<Partial<MfgClient>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getClients()); }
    catch { toast.error('No se pudieron cargar los clientes'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: MfgClient) => { setEditing(c); setForm({ ...c }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateClient(editing.id, form); toast.success('Cliente actualizado'); }
      else { await manufacturingService.createClient(form); toast.success('Cliente creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (c: MfgClient) => {
    if (!(await confirm({ title: `¿Eliminar el cliente "${c.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteClient(c.id); toast.success('Cliente eliminado'); load(); }
    catch (e: any) { toast.error(e?.message || 'No se pudo eliminar'); }
  };

  const set = (patch: Partial<MfgClient>) => setForm({ ...form, ...patch });
  const rows = items.filter((c) => matchText(q, c.name, c.businessName, c.documentId, c.city, c.phone));

  return (
    <Page>
      <PageHeader
        icon={Users}
        title="Clientes"
        subtitle="Clientes a los que se les hacen los pedidos de producción."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo cliente</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar cliente…" />
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Nombre</Th><Th>Negocio</Th><Th>Documento</Th><Th>Ciudad</Th><Th>Teléfono</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={7}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={7}>{items.length ? 'Sin resultados para la búsqueda.' : 'Sin clientes. Crea el primero.'}</TableMessage>
              : rows.map((c) => (
                <Tr key={c.id} onClick={() => openEdit(c)}>
                  <Td className="font-medium text-gray-900">{c.name}</Td>
                  <Td>{c.businessName || '—'}</Td>
                  <Td className="whitespace-nowrap">{c.documentType ? <span className="text-gray-400 mr-1">{c.documentType}</span> : null}{c.documentId || '—'}</Td>
                  <Td>{c.city || '—'}</Td>
                  <Td className="whitespace-nowrap">{c.phone || '—'}</Td>
                  <Td align="center"><ActiveBadge active={c.isActive} /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(c)} onDelete={() => remove(c)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Drawer
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        description={editing ? editing.name : 'Datos del cliente para pedidos y despachos.'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-6">
          <section className="space-y-4">
            <CardTitle>Identificación</CardTitle>
            <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => set({ name: e.target.value })} autoFocus /></Field>
            <Field label="Nombre del negocio / razón social"><TextInput value={form.businessName ?? ''} onChange={(e) => set({ businessName: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Tipo doc.">
                <SelectInput value={form.documentType ?? ''} onChange={(e) => set({ documentType: e.target.value })}>
                  <option value="">—</option><option value="C.C">C.C</option><option value="NIT">NIT</option><option value="Otro">Otro</option>
                </SelectInput>
              </Field>
              <Field label="Documento / NIT" className="col-span-2"><TextInput value={form.documentId ?? ''} onChange={(e) => set({ documentId: e.target.value })} /></Field>
            </div>
          </section>
          <section className="space-y-4">
            <CardTitle>Contacto y condiciones</CardTitle>
            <FormGrid>
              <Field label="Email"><TextInput type="email" value={form.email ?? ''} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Teléfono"><TextInput value={form.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} /></Field>
              <Field label="Ciudad"><TextInput value={form.city ?? ''} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="Plazo de crédito"><NumberInput min="0" suffix="días" value={form.creditDays ?? ''} onChange={(e) => set({ creditDays: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            </FormGrid>
            <Field label="Dirección de facturación"><TextInput value={form.invoiceAddress ?? ''} onChange={(e) => set({ invoiceAddress: e.target.value })} /></Field>
            <Field label="Dirección de despacho"><TextInput value={form.dispatchAddress ?? ''} onChange={(e) => set({ dispatchAddress: e.target.value })} /></Field>
            <Switch label="Activo" checked={form.isActive ?? true} onChange={(v) => set({ isActive: v })} />
          </section>
        </div>
      </Drawer>
    </Page>
  );
}
