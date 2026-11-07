import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ClipboardCheck, Trash2, Send, CheckCircle, XCircle, Plus, Package, TrendingUp, TrendingDown, Minus, Hourglass, Save,
} from 'lucide-react';
import {
  Page, PageHeader, Button, Badge, Card, StatCard, DescriptionList, Field, DateInput, TextArea, RadioGroup, SearchInput,
  Checkbox, FormActions, Alert, Spinner, EmptyState, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage,
  useConfirm, toast,
} from '../../components/ui';
import * as inventoryCountsService from '../../services/inventory-counts.service';
import { inputsService } from '../../services/inputs.service';
import type { InventoryCount, InventoryCountType } from '../../services/inventory-counts.service';
import { CountStatusBadge, fmtDate } from './InventoryCountShared';
import { StepCard } from './InventoryStepCard';
import { errorMessage } from '../../lib/http';

const LIST = '/admin-panel/inventory-counts';
const money = (n: number) => '$' + Math.round(Math.abs(Number(n || 0))).toLocaleString('es-CO');
const qty = (n: number) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });

export default function InventoryCountDetailPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const isCreating = id === 'new';

  const [count, setCount] = useState<InventoryCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [inputSearch, setInputSearch] = useState('');

  // Formulario de creación
  const [formData, setFormData] = useState<{
    countType: InventoryCountType;
    countDate: string;
    notes: string;
    selectedInputIds: number[];
  }>({
    countType: 'FULL',
    countDate: new Date().toISOString().split('T')[0],
    notes: '',
    selectedInputIds: [],
  });

  // Cantidades contadas que se están editando
  const [countItems, setCountItems] = useState<Record<number, { countedQuantity: number; notes: string }>>({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (isCreating) {
        // Insumos para el conteo parcial
        const inputsData = await inputsService.getAll({});
        setInputs(inputsData.map((i) => ({ id: i.id, code: i.code, name: i.name })));
      } else {
        const countData = await inventoryCountsService.getInventoryCountById(Number(id));
        setCount(countData);

        const items: Record<number, { countedQuantity: number; notes: string }> = {};
        countData.items.forEach((item) => {
          items[item.id] = {
            countedQuantity: item.countedQuantity ?? item.systemQuantity,
            notes: item.notes || '',
          };
        });
        setCountItems(items);
      }
    } catch {
      toast.error('Error al cargar datos');
      navigate(LIST);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (formData.countType === 'PARTIAL' && formData.selectedInputIds.length === 0) {
      toast.error('Selecciona al menos un insumo para el conteo parcial');
      return;
    }

    try {
      setSaving(true);
      const newCount = await inventoryCountsService.createInventoryCount({
        countType: formData.countType,
        countDate: formData.countDate,
        notes: formData.notes || undefined,
        inputIds: formData.countType === 'PARTIAL' ? formData.selectedInputIds : undefined,
      });
      toast.success('Conteo de inventario creado');
      navigate(`${LIST}/${newCount.id}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Error al crear conteo'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateItem = async (itemId: number) => {
    if (!count) return;
    const itemData = countItems[itemId];
    if (itemData === undefined) return;

    try {
      await inventoryCountsService.updateItemCount(count.id, itemId, {
        countedQuantity: itemData.countedQuantity,
        notes: itemData.notes || undefined,
      });
      toast.success('Cantidad actualizada');
      loadData();
    } catch (error) {
      toast.error(errorMessage(error, 'Error al actualizar'));
    }
  };

  const handleSubmit = async () => {
    if (!count) return;
    try {
      setSaving(true);
      await inventoryCountsService.submitForApproval(count.id);
      toast.success('Conteo enviado a aprobación');
      loadData();
    } catch (error) {
      toast.error(errorMessage(error, 'Error al enviar'));
    } finally {
      setSaving(false);
    }
  };

  const toggleInputSelection = (inputId: number) => {
    setFormData((prev) => ({
      ...prev,
      selectedInputIds: prev.selectedInputIds.includes(inputId)
        ? prev.selectedInputIds.filter((iid) => iid !== inputId)
        : [...prev.selectedInputIds, inputId],
    }));
  };

  // Indicadores del conteo
  const stats = useMemo(() => {
    if (!count) return null;
    const countedItems = count.items.filter((i) => i.isCounted);
    const positives = count.items.filter((i) => i.difference !== null && i.difference > 0);
    const negatives = count.items.filter((i) => i.difference !== null && i.difference < 0);
    return {
      total: count.items.length,
      counted: countedItems.length,
      pending: count.items.length - countedItems.length,
      progress: count.items.length > 0 ? Math.round((countedItems.length / count.items.length) * 100) : 0,
      positive: positives.length,
      negative: negatives.length,
      totalPositiveValue: positives.reduce((sum, i) => sum + (i.differenceValue || 0), 0),
      totalNegativeValue: negatives.reduce((sum, i) => sum + Math.abs(i.differenceValue || 0), 0),
    };
  }, [count]);

  const handleApprove = async () => {
    if (!count) return;
    const ok = await confirm({
      title: '¿Aprobar el conteo?',
      message: (
        <div className="space-y-2">
          <p>Se aplicarán automáticamente los ajustes de inventario. Esta acción no se puede deshacer.</p>
          {stats && stats.positive > 0 && <p className="text-green-700">+{stats.positive} ítem(s) con sobrante (+{money(stats.totalPositiveValue)})</p>}
          {stats && stats.negative > 0 && <p className="text-red-700">{stats.negative} ítem(s) con faltante (−{money(stats.totalNegativeValue)})</p>}
        </div>
      ),
      confirmText: 'Aprobar y aplicar',
    });
    if (!ok) return;
    try {
      setSaving(true);
      await inventoryCountsService.approveCount(count.id);
      toast.success('Conteo aprobado y ajustes aplicados');
      loadData();
    } catch (error) {
      toast.error(errorMessage(error, 'Error al aprobar'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!count) return;
    const ok = await confirm({
      title: `¿Cancelar el conteo ${count.countNumber}?`,
      message: 'No se aplicarán ajustes al inventario.',
      tone: 'danger',
      confirmText: 'Cancelar conteo',
      cancelText: 'Volver',
    });
    if (!ok) return;
    try {
      setSaving(true);
      await inventoryCountsService.cancelCount(count.id);
      toast.success('Conteo cancelado');
      loadData();
    } catch (error) {
      toast.error(errorMessage(error, 'Error al cancelar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!count) return;
    const ok = await confirm({
      title: `¿Eliminar el conteo ${count.countNumber}?`,
      message: 'Esta acción no se puede deshacer.',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      setSaving(true);
      await inventoryCountsService.deleteInventoryCount(count.id);
      toast.success('Conteo eliminado');
      navigate(LIST);
    } catch (error) {
      toast.error(errorMessage(error, 'Error al eliminar'));
    } finally {
      setSaving(false);
    }
  };

  const canEdit = !!count && (count.status === 'DRAFT' || count.status === 'IN_PROGRESS');

  const filteredInputs = useMemo(() => {
    const t = inputSearch.trim().toLowerCase();
    return t ? inputs.filter((i) => i.name.toLowerCase().includes(t) || i.code.toLowerCase().includes(t)) : inputs;
  }, [inputs, inputSearch]);

  if (loading) {
    return <Page><Spinner label="Cargando…" /></Page>;
  }

  // ───────────── Crear ─────────────
  if (isCreating) {
    const isPartial = formData.countType === 'PARTIAL';
    const allFilteredSelected = filteredInputs.length > 0 && filteredInputs.every((i) => formData.selectedInputIds.includes(i.id));
    return (
      <Page>
        <PageHeader icon={ClipboardCheck} backTo={LIST} title="Nuevo conteo" subtitle="Crea un conteo físico de insumos" />

        <div className="max-w-3xl space-y-4">
          <StepCard step={1} done title="Qué vas a contar" description="Un conteo completo incluye todos los insumos activos.">
            <RadioGroup
              variant="cards"
              value={formData.countType}
              onChange={(v) => setFormData({ ...formData, countType: v, selectedInputIds: v === 'FULL' ? [] : formData.selectedInputIds })}
              options={[
                { value: 'FULL', label: 'Conteo completo', description: 'Cuenta todos los insumos activos del inventario' },
                { value: 'PARTIAL', label: 'Conteo parcial', description: 'Selecciona insumos específicos para contar' },
              ]}
            />
          </StepCard>

          {isPartial && (
            <StepCard
              step={2}
              done={formData.selectedInputIds.length > 0}
              title="Insumos a contar"
              description="Marca los insumos que vas a revisar."
              actions={<Badge tone={formData.selectedInputIds.length > 0 ? 'app' : 'gray'}>{formData.selectedInputIds.length} seleccionados</Badge>}
            >
              {inputs.length === 0 ? (
                <EmptyState icon={Package} title="No hay insumos disponibles" />
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <SearchInput className="flex-1" value={inputSearch} onChange={setInputSearch} placeholder="Buscar insumo por nombre o código…" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData((prev) => ({
                        ...prev,
                        selectedInputIds: allFilteredSelected
                          ? prev.selectedInputIds.filter((sid) => !filteredInputs.some((i) => i.id === sid))
                          : Array.from(new Set([...prev.selectedInputIds, ...filteredInputs.map((i) => i.id)])),
                      }))}
                    >
                      {allFilteredSelected ? 'Quitar todos' : 'Marcar todos'}
                    </Button>
                  </div>
                  <div className="rounded-lg border border-gray-200 max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {filteredInputs.length === 0 ? (
                      <p className="p-4 text-center text-sm text-gray-400">Sin resultados</p>
                    ) : filteredInputs.map((input) => (
                      <div key={input.id} className="px-3 py-2.5 hover:bg-gray-50">
                        <Checkbox
                          className="w-full"
                          checked={formData.selectedInputIds.includes(input.id)}
                          onChange={() => toggleInputSelection(input.id)}
                          label={<span className="font-medium text-gray-900">{input.name}</span>}
                          description={<span className="font-mono">{input.code}</span>}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </StepCard>
          )}

          <StepCard step={isPartial ? 3 : 2} title="Fecha y notas">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Fecha del conteo" required>
                <DateInput value={formData.countDate} onChange={(e) => setFormData({ ...formData, countDate: e.target.value })} />
              </Field>
              <Field label="Notas" className="md:col-span-2">
                <TextArea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Notas sobre este conteo (opcional)…" />
              </Field>
            </div>
          </StepCard>
        </div>

        <FormActions sticky>
          <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
          <Button icon={<Plus className="w-4 h-4" />} isLoading={saving} onClick={handleCreate}>Crear conteo</Button>
        </FormActions>
      </Page>
    );
  }

  // ───────────── Detalle ─────────────
  if (!count) return null;

  const itemStatus = (difference: number | null, isCounted: boolean) =>
    !isCounted ? <Badge tone="yellow">Sin contar</Badge>
      : difference === 0 ? <Badge tone="green">Cuadra</Badge>
      : (difference ?? 0) > 0 ? <Badge tone="blue">Sobrante</Badge>
      : <Badge tone="red">Faltante</Badge>;

  const diffView = (d: number | null) => {
    if (d === null) return <span className="text-gray-400">—</span>;
    const cls = d === 0 ? 'text-gray-500' : d > 0 ? 'text-green-700' : 'text-red-700';
    const Icon = d === 0 ? Minus : d > 0 ? TrendingUp : TrendingDown;
    return <span className={`inline-flex items-center gap-1 tabular-nums ${cls}`}><Icon className="w-3.5 h-3.5" />{d > 0 ? '+' : ''}{qty(d)}</span>;
  };
  const valueView = (v: number | null) => {
    if (v === null || v === 0) return <span className="text-gray-400">—</span>;
    return <span className={`tabular-nums ${v > 0 ? 'text-green-700' : 'text-red-700'}`}>{v > 0 ? '+' : '−'}{money(v)}</span>;
  };

  return (
    <Page>
      <PageHeader
        icon={ClipboardCheck}
        backTo={LIST}
        title={
          <span className="flex items-center gap-3">
            {count.countNumber}
            <CountStatusBadge status={count.status} />
          </span>
        }
        subtitle={`Conteo ${inventoryCountsService.TYPE_LABELS[count.countType].toLowerCase()} · ${fmtDate(count.countDate)}`}
        actions={
          <>
            {['DRAFT', 'CANCELLED'].includes(count.status) && (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete} disabled={saving}>
                Eliminar
              </Button>
            )}
            {!['APPROVED', 'CANCELLED'].includes(count.status) && (
              <Button variant="secondary" icon={<XCircle className="w-4 h-4" />} onClick={handleCancel} disabled={saving}>
                Cancelar conteo
              </Button>
            )}
            {count.status === 'IN_PROGRESS' && stats?.pending === 0 && (
              <Button icon={<Send className="w-4 h-4" />} onClick={handleSubmit} isLoading={saving}>
                Enviar a aprobación
              </Button>
            )}
            {count.status === 'PENDING_APPROVAL' && (
              <Button variant="success" icon={<CheckCircle className="w-4 h-4" />} onClick={handleApprove} disabled={saving}>
                Aprobar
              </Button>
            )}
          </>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={ClipboardCheck} label="Progreso" value={`${stats.progress}%`} hint={`${stats.counted} de ${stats.total} contados`} />
          <StatCard icon={Hourglass} tone={stats.pending > 0 ? 'yellow' : 'gray'} label="Sin contar" value={stats.pending} hint={stats.pending > 0 ? 'Cuenta todos para enviar' : 'Todo contado'} hintTone={stats.pending > 0 ? 'yellow' : 'gray'} />
          <StatCard icon={TrendingUp} tone="green" label="Sobrantes" value={stats.positive} hint={`+${money(stats.totalPositiveValue)}`} hintTone="green" />
          <StatCard icon={TrendingDown} tone="red" label="Faltantes" value={stats.negative} hint={`−${money(stats.totalNegativeValue)}`} hintTone="red" />
        </div>
      )}

      {count.status === 'IN_PROGRESS' && stats && stats.pending > 0 && (
        <Alert tone="info">Guarda la cantidad contada de cada insumo. Cuando no quede ninguno sin contar podrás enviarlo a aprobación.</Alert>
      )}

      <Card>
        <DescriptionList
          cols={3}
          items={[
            { label: 'Tipo', value: inventoryCountsService.TYPE_LABELS[count.countType] },
            { label: 'Fecha del conteo', value: fmtDate(count.countDate) },
            { label: 'Contado por', value: count.countedByName },
            ...(count.approvedByName ? [{ label: 'Aprobado por', value: `${count.approvedByName}${count.approvedAt ? ' · ' + fmtDate(count.approvedAt) : ''}` }] : []),
            ...(count.notes ? [{ label: 'Notas', value: count.notes, full: true }] : []),
          ]}
        />
      </Card>

      <TableCard>
        <Table>
          <THead>
            <tr>
              <Th>Insumo</Th>
              <Th align="center">Estado</Th>
              <Th align="right">Sistema</Th>
              <Th align="right">Contado</Th>
              <Th align="right">Diferencia</Th>
              <Th align="right">Valor dif.</Th>
              {canEdit && <Th align="right" aria-label="Acciones" />}
            </tr>
          </THead>
          <TBody>
            {count.items.length === 0 ? (
              <TableMessage colSpan={canEdit ? 7 : 6}>No hay ítems en este conteo.</TableMessage>
            ) : count.items.map((item) => {
              const current = countItems[item.id]?.countedQuantity ?? item.systemQuantity;
              const tempDiff = current - item.systemQuantity;
              return (
                <Tr key={item.id}>
                  <Td className="min-w-[200px]">
                    <p className="font-medium text-gray-900">{item.inputName}</p>
                    <p className="text-xs text-gray-500"><span className="font-mono">{item.inputCode}</span> · {item.unitOfMeasure}</p>
                  </Td>
                  <Td align="center">{itemStatus(item.difference, item.isCounted)}</Td>
                  <Td align="right" className="tabular-nums">{qty(item.systemQuantity)}</Td>
                  <Td align="right">
                    {canEdit ? (
                      <input
                        type="number"
                        aria-label={`Cantidad contada de ${item.inputName}`}
                        value={current}
                        min="0"
                        step="0.01"
                        onChange={(e) => setCountItems({ ...countItems, [item.id]: { ...countItems[item.id], countedQuantity: Number(e.target.value) } })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateItem(item.id); }}
                        className="w-24 h-9 rounded-lg border border-gray-300 px-2 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
                      />
                    ) : (
                      <span className={`tabular-nums ${item.isCounted ? 'text-gray-900' : 'text-gray-400'}`}>{item.countedQuantity !== null ? qty(item.countedQuantity) : '—'}</span>
                    )}
                  </Td>
                  <Td align="right" className="whitespace-nowrap">{canEdit ? diffView(tempDiff) : diffView(item.difference)}</Td>
                  <Td align="right" className="whitespace-nowrap">{canEdit ? valueView(tempDiff * item.unitCost) : valueView(item.differenceValue)}</Td>
                  {canEdit && (
                    <Td align="right">
                      <Button size="sm" variant="outline" icon={<Save className="w-3.5 h-3.5" />} onClick={() => handleUpdateItem(item.id)}>Guardar</Button>
                    </Td>
                  )}
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
