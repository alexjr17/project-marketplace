import { useEffect, useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgGarmentType, MfgSize, MfgBrand } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Drawer, Field, TextInput, MoneyInput, NumberInput, SelectInput, Switch, Badge, CardTitle, useConfirm,
} from '../../components/ui';
import { ActiveBadge, MarketBadge, RowActions, matchText } from '../../components/manufacturing/mfgUi';

const empty = { code: '', name: '', composition: 'SUPERIOR' as const, brandId: null as number | null, fixedCost: 0, factor: 1, factorExport: 1, isActive: true };

const COMPOSITION_LABEL: Record<string, string> = { SUPERIOR: 'Superior', INFERIOR: 'Inferior', SET: 'Conjunto' };

export default function GarmentTypesPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgGarmentType[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgGarmentType | null>(null);
  const [form, setForm] = useState<Partial<MfgGarmentType>>(empty);
  const [nationalIds, setNationalIds] = useState<number[]>([]);
  const [exportIds, setExportIds] = useState<number[]>([]);
  const [allSizes, setAllSizes] = useState<MfgSize[]>([]);
  const [brands, setBrands] = useState<MfgBrand[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getGarmentTypes()); }
    catch { toast.error('No se pudieron cargar los tipos de prenda'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); manufacturingService.getSizes().then(setAllSizes).catch(() => {}); manufacturingService.getBrands().then(setBrands).catch(() => {}); }, []);

  const sortedSizes = [...allSizes].sort((a, b) => a.sortOrder - b.sortOrder);
  const toggle = (list: number[], set: (v: number[]) => void, id: number) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const openNew = () => { setEditing(null); setForm(empty); setNationalIds([]); setExportIds([]); setModal(true); };
  const openEdit = (g: MfgGarmentType) => {
    setEditing(g); setForm({ ...g });
    setNationalIds(g.sizes?.filter((s) => s.pivot?.market !== 'EXPORT').map((s) => s.id) ?? []);
    setExportIds(g.sizes?.filter((s) => s.pivot?.market === 'EXPORT').map((s) => s.id) ?? []);
    setModal(true);
  };

  const save = async () => {
    if (!form.code?.trim()) { toast.error('El código es obligatorio'); return; }
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    const payload = { ...form, nationalSizeIds: nationalIds, exportSizeIds: exportIds };
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateGarmentType(editing.id, payload); toast.success('Tipo de prenda actualizado'); }
      else { await manufacturingService.createGarmentType(payload); toast.success('Tipo de prenda creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (g: MfgGarmentType) => {
    if (!(await confirm({ title: `¿Eliminar el tipo de prenda "${g.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteGarmentType(g.id); toast.success('Tipo de prenda eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((g) => matchText(q, g.code, g.name, g.brand?.name));
  const nationalSizes = sortedSizes.filter((s) => s.market !== 'EXPORT');
  const exportSizes = sortedSizes.filter((s) => s.market === 'EXPORT');
  const fmtFactor = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : `${Number(v).toLocaleString('es-CO', { maximumFractionDigits: 4 })}x`);

  const sizeChips = (list: MfgSize[], selected: number[], onToggle: (id: number) => void, emptyText: string) => (
    <div className="flex flex-wrap gap-1.5">
      {list.map((s) => (
        <button key={s.id} type="button" aria-pressed={selected.includes(s.id)} onClick={() => onToggle(s.id)}
          className={`min-w-[2.5rem] h-8 px-2.5 rounded-lg border text-sm font-medium transition-colors ${selected.includes(s.id) ? 'border-app-500 bg-app-50 text-app-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{s.abbreviation}</button>
      ))}
      {list.length === 0 && <span className="text-xs text-gray-400">{emptyText}</span>}
    </div>
  );

  return (
    <Page>
      <PageHeader
        icon={Tag}
        title="Tipos de prenda"
        subtitle="Su código prefija el de la referencia (ej. CAM → CAM-0001)."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo tipo</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar tipo de prenda…" />
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Código</Th><Th>Nombre</Th><Th align="center">Composición</Th><Th>Marca</Th><Th align="right">Factor nac.</Th><Th align="right">Factor exp.</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={8}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={8}>{items.length ? 'Sin resultados para la búsqueda.' : 'Sin tipos de prenda. Crea el primero.'}</TableMessage>
              : rows.map((g) => (
                <Tr key={g.id}>
                  <Td className="font-mono font-semibold text-gray-900">{g.code}</Td>
                  <Td className="font-medium text-gray-900">{g.name}</Td>
                  <Td align="center"><Badge tone={g.composition === 'SET' ? 'purple' : 'gray'}>{COMPOSITION_LABEL[g.composition] ?? 'Superior'}</Badge></Td>
                  <Td>{g.brand?.name || '—'}</Td>
                  <Td align="right" className="tabular-nums">{fmtFactor(g.factor)}</Td>
                  <Td align="right" className="tabular-nums">{fmtFactor(g.factorExport)}</Td>
                  <Td align="center"><ActiveBadge active={g.isActive} /></Td>
                  <Td align="right"><RowActions onEdit={() => openEdit(g)} onDelete={() => remove(g)} /></Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      <Drawer
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar tipo de prenda' : 'Nuevo tipo de prenda'}
        width="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Código" required><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={10} className="font-mono uppercase" placeholder="CAM" autoFocus /></Field>
              <Field label="Nombre" required className="sm:col-span-2"><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Camiseta" /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Composición" hint="Define qué componentes lleva la referencia de este tipo.">
                <SelectInput value={form.composition ?? 'SUPERIOR'} onChange={(e) => setForm({ ...form, composition: e.target.value as MfgGarmentType['composition'] })}>
                  <option value="SUPERIOR">Superior (individual)</option>
                  <option value="INFERIOR">Inferior (individual)</option>
                  <option value="SET">Conjunto (superior + inferior)</option>
                </SelectInput>
              </Field>
              <Field label="Marca" hint="La referencia de este tipo hereda esta marca.">
                <SelectInput value={form.brandId ?? ''} onChange={(e) => setForm({ ...form, brandId: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">— Sin marca —</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </SelectInput>
              </Field>
            </div>
            <Switch label="Activo" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
          </section>

          <section className="border-t border-gray-100 pt-5">
            <CardTitle>Costo y factores sugeridos</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Costo fijo"><MoneyInput value={form.fixedCost ?? 0} onChange={(e) => setForm({ ...form, fixedCost: e.target.value === '' ? 0 : Number(e.target.value) })} /></Field>
              <Field label="Factor nacional"><NumberInput step="0.0001" min="0" suffix="x" value={form.factor ?? 1} onChange={(e) => setForm({ ...form, factor: e.target.value === '' ? 1 : Number(e.target.value) })} /></Field>
              <Field label="Factor exportación"><NumberInput step="0.0001" min="0" suffix="x" value={form.factorExport ?? 1} onChange={(e) => setForm({ ...form, factorExport: e.target.value === '' ? 1 : Number(e.target.value) })} /></Field>
            </div>
            <p className="text-xs text-gray-500 mt-2">Se sugieren al crear la referencia y sus grupos de precio por mercado.</p>
          </section>

          <section className="border-t border-gray-100 pt-5">
            <CardTitle>Tallas del tipo</CardTitle>
            <p className="text-xs text-gray-500 -mt-2 mb-3">Se traen a la referencia según el mercado.</p>
            {sortedSizes.length === 0 ? <p className="text-sm text-gray-400">Crea tallas en Catálogos → Tallas.</p> : (
              <div className="space-y-4">
                <div className="space-y-2"><MarketBadge market="NATIONAL" />{sizeChips(nationalSizes, nationalIds, (id) => toggle(nationalIds, setNationalIds, id), 'Sin tallas nacionales.')}</div>
                <div className="space-y-2"><MarketBadge market="EXPORT" />{sizeChips(exportSizes, exportIds, (id) => toggle(exportIds, setExportIds, id), 'Sin tallas de exportación.')}</div>
              </div>
            )}
          </section>
        </div>
      </Drawer>
    </Page>
  );
}
