import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Box, Coins } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgInput, MfgInputType, MfgInputBatch, MfgColor } from '../../types/manufacturing';
import {
  Page, PageHeader, Button, IconButton, ActionMenu, FilterBar, SearchInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  Dialog, Drawer, Field, TextInput, TextArea, NumberInput, MoneyInput, DateInput, SelectInput, RadioGroup, Switch, Badge, StatCard, CardTitle, useConfirm,
} from '../../components/ui';
import { ActiveBadge, matchText } from '../../components/manufacturing/mfgUi';

const money = (n: number) => '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

const empty = { code: '', name: '', inputTypeId: undefined as number | undefined, unitOfMeasure: 'und', scope: null as MfgInput['scope'], notes: '', isActive: true };

export default function MfgInputsPage() {
  const confirm = useConfirm();
  const [items, setItems] = useState<MfgInput[]>([]);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [types, setTypes] = useState<MfgInputType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MfgInput | null>(null);
  const [form, setForm] = useState<Partial<MfgInput>>(empty);
  const [saving, setSaving] = useState(false);

  // Lotes / precios del insumo.
  const [colors, setColors] = useState<MfgColor[]>([]);
  const [batchInput, setBatchInput] = useState<MfgInput | null>(null);
  const [batches, setBatches] = useState<MfgInputBatch[]>([]);
  const [batchAvg, setBatchAvg] = useState(0);
  const [batchForm, setBatchForm] = useState({ colorId: '' as number | '', unitCost: '', quantity: '', purchasedAt: '', reference: '' });

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getInputs()); }
    catch { toast.error('No se pudieron cargar los insumos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); manufacturingService.getInputTypes().then(setTypes).catch(() => {}); manufacturingService.getColors().then(setColors).catch(() => {}); }, []);

  const openBatches = async (i: MfgInput) => {
    setBatchInput(i); setBatchForm({ colorId: '', unitCost: '', quantity: '', purchasedAt: '', reference: '' });
    try { const d = await manufacturingService.getInputBatches(i.id); setBatches(d.batches); setBatchAvg(d.average); }
    catch { setBatches([]); setBatchAvg(0); }
  };
  const addBatch = async () => {
    if (!batchInput) return;
    if (batchForm.unitCost === '' || Number(batchForm.unitCost) <= 0) { toast.error('Ingresa el precio del lote'); return; }
    try {
      await manufacturingService.createInputBatch(batchInput.id, {
        colorId: batchForm.colorId === '' ? null : Number(batchForm.colorId),
        unitCost: Number(batchForm.unitCost), quantity: batchForm.quantity === '' ? null : Number(batchForm.quantity),
        purchasedAt: batchForm.purchasedAt || null, reference: batchForm.reference.trim() || null,
      });
      toast.success('Lote registrado');
      const d = await manufacturingService.getInputBatches(batchInput.id); setBatches(d.batches); setBatchAvg(d.average);
      setBatchForm({ colorId: '', unitCost: '', quantity: '', purchasedAt: '', reference: '' });
    } catch { toast.error('No se pudo registrar'); }
  };
  const removeBatch = async (b: MfgInputBatch) => {
    if (!batchInput) return;
    if (!(await confirm({ title: '¿Eliminar este lote?', message: `${money(Number(b.unitCost))}${b.purchasedAt ? ` del ${b.purchasedAt}` : ''}.`, tone: 'danger' }))) return;
    try { await manufacturingService.deleteInputBatch(batchInput.id, b.id); const d = await manufacturingService.getInputBatches(batchInput.id); setBatches(d.batches); setBatchAvg(d.average); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const selectedType = types.find((t) => t.id === form.inputTypeId);
  const isService = selectedType?.classification === 'SERVICIO';

  const openNew = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (i: MfgInput) => { setEditing(i); setForm({ ...i }); setModal(true); };

  const save = async () => {
    if (!form.code?.trim()) { toast.error('El código es obligatorio'); return; }
    if (!form.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (editing) { await manufacturingService.updateInput(editing.id, form); toast.success('Insumo actualizado'); }
      else { await manufacturingService.createInput(form); toast.success('Insumo creado'); }
      setModal(false); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (i: MfgInput) => {
    if (!(await confirm({ title: `¿Eliminar el insumo "${i.name}"?`, message: 'No se puede deshacer.', tone: 'danger' }))) return;
    try { await manufacturingService.deleteInput(i.id); toast.success('Insumo eliminado'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  const rows = items.filter((i) => (!typeFilter || String(i.inputTypeId ?? '') === typeFilter) && matchText(q, i.code, i.name, i.inputType?.name));

  return (
    <Page>
      <PageHeader
        icon={Box}
        title="Insumos"
        subtitle="Materiales y servicios propios de Fábrica para la ficha técnica."
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openNew}>Nuevo insumo</Button>}
      />

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por código o nombre…" />
        <SelectInput value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Tipo de insumo">
          <option value="">Todos los tipos</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </SelectInput>
      </FilterBar>

      <TableCard>
        <Table>
          <THead><tr><Th>Código</Th><Th>Nombre</Th><Th>Tipo</Th><Th>Unidad</Th><Th align="center">Estado</Th><Th align="right">Acciones</Th></tr></THead>
          <TBody>
            {loading ? <TableMessage colSpan={6}>Cargando…</TableMessage>
              : rows.length === 0 ? <TableMessage colSpan={6}>{items.length ? 'Sin resultados para el filtro.' : 'Sin insumos. Crea el primero.'}</TableMessage>
              : rows.map((i) => {
                const service = i.inputType?.classification === 'SERVICIO';
                return (
                  <Tr key={i.id}>
                    <Td className="font-mono text-gray-900">{i.code}</Td>
                    <Td className="font-medium text-gray-900">
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        {i.name}
                        {service && <Badge tone="purple">{i.scope === 'EXTERNAL' ? 'Servicio ext.' : i.scope === 'INTERNAL' ? 'Servicio int.' : 'Servicio'}</Badge>}
                      </span>
                    </Td>
                    <Td>{i.inputType?.name ?? '—'}</Td>
                    <Td>{i.unitOfMeasure}</Td>
                    <Td align="center"><ActiveBadge active={i.isActive} /></Td>
                    <Td align="right">
                      <ActionMenu items={[
                        { label: 'Lotes y precios', icon: <Coins className="w-4 h-4" />, onClick: () => openBatches(i), hidden: service },
                        { label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => openEdit(i) },
                        { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => remove(i), danger: true },
                      ]} />
                    </Td>
                  </Tr>
                );
              })}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar insumo' : 'Nuevo insumo'}
        footer={<>
          <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          <Button isLoading={saving} onClick={save}>Guardar</Button>
        </>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código" required><TextInput value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} className="font-mono" placeholder="TEL-01" autoFocus /></Field>
            <Field label="Unidad"><TextInput value={form.unitOfMeasure ?? ''} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })} placeholder="m, kg, und…" /></Field>
          </div>
          <Field label="Nombre" required><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tela algodón" /></Field>
          <Field label="Tipo de insumo">
            <SelectInput value={form.inputTypeId ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : Number(e.target.value); const t = types.find((x) => x.id === v); setForm({ ...form, inputTypeId: v, scope: t?.classification === 'SERVICIO' ? (form.scope ?? 'INTERNAL') : null }); }}>
              <option value="">— Sin tipo —</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.classification === 'SERVICIO' ? 'Servicio' : 'Producto'})</option>)}
            </SelectInput>
          </Field>
          {isService && (
            <Field label="Alcance del servicio">
              <RadioGroup
                variant="cards"
                value={form.scope ?? 'INTERNAL'}
                onChange={(v) => setForm({ ...form, scope: v as MfgInput['scope'] })}
                options={[
                  { value: 'INTERNAL', label: 'Interno', description: 'Mano de obra propia' },
                  { value: 'EXTERNAL', label: 'Externo', description: 'Taller / maquila' },
                ]}
              />
            </Field>
          )}
          <Field label="Notas"><TextArea rows={2} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <Switch label="Activo" checked={form.isActive ?? true} onChange={(v) => setForm({ ...form, isActive: v })} />
        </div>
      </Dialog>

      {/* Lotes / precios del insumo */}
      <Drawer
        open={!!batchInput}
        onClose={() => setBatchInput(null)}
        title="Lotes y precios"
        description={batchInput?.name}
        width="lg"
      >
        <div className="space-y-5">
          <StatCard icon={Coins} label="Precio promedio" value={"$" + Math.round(batchAvg).toLocaleString("es-CO")} hint="Promedio de los lotes registrados" />
          <p className="text-sm text-gray-500">Registra las compras del insumo con su precio. En la ficha técnica se traen para decidir el precio.</p>

          <section className="space-y-3">
            <CardTitle>Registrar lote</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Color">
                <SelectInput value={batchForm.colorId} onChange={(e) => setBatchForm({ ...batchForm, colorId: e.target.value === '' ? '' : Number(e.target.value) })}>
                  <option value="">—</option>{colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Precio unitario" required><MoneyInput value={batchForm.unitCost} onChange={(e) => setBatchForm({ ...batchForm, unitCost: e.target.value })} /></Field>
              <Field label="Cantidad"><NumberInput step="0.0001" min="0" suffix={batchInput?.unitOfMeasure || undefined} value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} /></Field>
              <Field label="Fecha de compra"><DateInput value={batchForm.purchasedAt} onChange={(e) => setBatchForm({ ...batchForm, purchasedAt: e.target.value })} /></Field>
              <Field label="Referencia" hint="Factura o proveedor (opcional)." className="sm:col-span-2"><TextInput value={batchForm.reference} onChange={(e) => setBatchForm({ ...batchForm, reference: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end"><Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={addBatch}>Agregar lote</Button></div>
          </section>

          <section>
            <CardTitle>Lotes registrados</CardTitle>
            <TableCard>
              <Table>
                <THead><tr><Th>Color</Th><Th>Fecha</Th><Th align="right">Precio</Th><Th align="right">Cant.</Th><Th align="right"><span className="sr-only">Acciones</span></Th></tr></THead>
                <TBody>
                  {batches.length === 0 ? <TableMessage colSpan={5}>Sin lotes registrados.</TableMessage> : batches.map((b) => (
                    <Tr key={b.id}>
                      <Td>{b.color ? <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: b.color.hexCode }} />{b.color.name}</span> : '—'}</Td>
                      <Td className="whitespace-nowrap">{b.purchasedAt?.slice(0, 10) ?? '—'}</Td>
                      <Td align="right" className="font-medium text-gray-900 tabular-nums">{money(Number(b.unitCost))}</Td>
                      <Td align="right" className="tabular-nums">{b.quantity ?? '—'}</Td>
                      <Td align="right"><IconButton title="Eliminar lote" tone="danger" onClick={() => removeBatch(b)}><Trash2 className="w-4 h-4" /></IconButton></Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableCard>
          </section>
        </div>
      </Drawer>
    </Page>
  );
}
