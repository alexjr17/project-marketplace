import { useEffect, useState } from 'react';
import { Plus, Ruler } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgSize } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, FilterBar, SearchInput, SelectInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Dialog, Field, TextInput, NumberInput, RadioGroup, Switch, useConfirm,
} from '../../components/ui';
import { ActiveBadge, MarketBadge, RowActions, matchText } from '../../components/manufacturing/mfgUi';

const empty = { name: '', abbreviation: '', market: 'NATIONAL' as const, sortOrder: 0, isActive: true };

export default function MfgSizesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [market, setMarket] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgSize | null>(null);
  const [form, setForm] = useState<Partial<MfgSize>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getSizes()); }
    catch { toast.error('No se pudieron cargar las tallas'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty, sortOrder: items.length + 1 }); setModal(true); };
  const openEdit = (s: MfgSize) => { setEditing(s); setForm({ ...s }); setModal(true); };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!form.abbreviation?.trim()) { toast.error('La abreviatura es obligatoria'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateSize(editing.id, form); toast.success('Talla actualizada'); }
      else { await manufacturingService.createSize(form); toast.success('Talla creada'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (s: MfgSize) => {
    if (!(await confirm({ title: `¿Eliminar la talla "${s.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteSize(s.id); toast.success('Talla eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((s) => (!market || s.market === market) && matchText(q, s.name, s.abbreviation));

  return (
    <Page>
      <PageHeader
        icon={Ruler}
        title="Tallas"
        subtitle="Tallas propias de Fábrica, por mercado."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nueva talla</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar talla…" />
        <SelectInput value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Mercado">
          <option value="">Todos los mercados</option>
          <option value="NATIONAL">Nacional</option>
          <option value="EXPORT">Exportación</option>
        </SelectInput>
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th align="right" className="w-20">Orden</Th><Th>Abrev.</Th><Th>Nombre</Th><Th align="center">Mercado</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={6}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={6}>{items.length ? 'Sin resultados para el filtro.' : 'Sin tallas. Crea la primera.'}</TableMessage>
              : rows.map((s) => (
                <Tr key={s.id}>
                  <Td align="right" className="tabular-nums text-gray-500">{s.sortOrder}</Td>
                  <Td className="font-semibold text-gray-900">{s.abbreviation}</Td>
                  <Td>{s.name}</Td>
                  <Td align="center"><MarketBadge market={s.market} /></Td>
                  <Td align="center"><ActiveBadge active={s.isActive} female /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(s)} onDelete={() => remove(s)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar talla' : 'Nueva talla'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Abreviatura" required><TextInput value={form.abbreviation ?? ''} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} maxLength={10} placeholder="M" autoFocus /></Field>
            <Field label="Orden"><NumberInput value={form.sortOrder ?? 0} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Medium" /></Field>
          <Field label="Mercado">
            <RadioGroup
              variant="segmented"
              value={form.market ?? 'NATIONAL'}
              onChange={(v) => setForm({ ...form, market: v as MfgSize['market'] })}
              options={[{ value: 'NATIONAL', label: 'Nacional' }, { value: 'EXPORT', label: 'Exportación' }]}
            />
          </Field>
          <Switch label="Activa" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </Dialog>
    </Page>
  );
}
