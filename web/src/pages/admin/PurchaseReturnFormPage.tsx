import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Save } from 'lucide-react';
import {
  Page, PageHeader, Button, Combobox, Field, TextInput, FormActions, Spinner, EmptyState, useConfirm, toast,
} from '../../components/ui';
import * as returnsService from '../../services/purchase-returns.service';
import type { ReturnableOrder, ReturnableItem } from '../../services/purchase-returns.service';
import * as purchaseOrdersService from '../../services/purchase-orders.service';
import type { PurchaseOrder } from '../../services/purchase-orders.service';
import { StepCard } from './InventoryStepCard';

const LIST = '/admin-panel/purchase-returns';
const money = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO');

/** Ítems devolubles agrupados por insumo/producto para la vista matriz. */
interface ItemGroup {
  name: string;
  items: ReturnableItem[];
  isMatrix: boolean;
  colors: string[];
  sizes: string[];
}

const qtyInput = 'h-9 rounded-lg border border-gray-300 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500';

export default function PurchaseReturnFormPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | ''>('');
  const [returnable, setReturnable] = useState<ReturnableOrder | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const all = await purchaseOrdersService.getPurchaseOrders();
        setOrders(all.filter((o) => ['RECEIVED', 'PARTIAL'].includes(o.status)));
      } catch (error: any) {
        toast.error(error.message || 'Error al cargar órdenes');
      }
    })();
  }, []);

  const onSelectOrder = async (id: number) => {
    setSelectedOrderId(id || '');
    setReturnable(null);
    setQuantities({});
    if (!id) return;
    setLoadingItems(true);
    try {
      const data = await returnsService.getReturnable(id);
      setReturnable(data);
      setQuantities(Object.fromEntries(data.items.map((i) => [i.purchaseOrderItemId, 0])));
    } catch (error: any) {
      toast.error(error.message || 'Error al cargar ítems devolubles');
    } finally {
      setLoadingItems(false);
    }
  };

  // Agrupar por insumo/producto. Si tienen color y talla → matriz.
  const groups = useMemo<ItemGroup[]>(() => {
    if (!returnable) return [];
    const map = new Map<string, ReturnableItem[]>();
    for (const it of returnable.items) {
      if (!map.has(it.groupName)) map.set(it.groupName, []);
      map.get(it.groupName)!.push(it);
    }
    return Array.from(map.entries()).map(([name, items]) => {
      const isMatrix = items.some((i) => i.colorName && i.sizeName);
      const colors: string[] = [];
      const sizes: string[] = [];
      for (const i of items) {
        if (i.colorName && !colors.includes(i.colorName)) colors.push(i.colorName);
        if (i.sizeName && !sizes.includes(i.sizeName)) sizes.push(i.sizeName);
      }
      return { name, items, isMatrix, colors, sizes };
    });
  }, [returnable]);

  const setQty = (poItemId: number, value: number, max: number) => {
    const q = Math.max(0, Math.min(value || 0, max));
    setQuantities((prev) => ({ ...prev, [poItemId]: q }));
  };

  const fillAll = () => {
    if (!returnable) return;
    setQuantities(Object.fromEntries(returnable.items.map((i) => [i.purchaseOrderItemId, i.returnable])));
  };

  const clearAll = () => {
    if (!returnable) return;
    setQuantities(Object.fromEntries(returnable.items.map((i) => [i.purchaseOrderItemId, 0])));
  };

  const totalToReturn = useMemo(
    () => (returnable?.items ?? []).reduce((sum, i) => sum + (quantities[i.purchaseOrderItemId] || 0) * i.unitCost, 0),
    [returnable, quantities]
  );
  const unitsToReturn = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);

  const submit = async () => {
    if (!selectedOrderId) {
      toast.error('Selecciona una orden de compra');
      return;
    }
    if (!reason.trim()) {
      toast.error('Indica el motivo de la devolución');
      return;
    }
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([poItemId, q]) => ({ purchaseOrderItemId: Number(poItemId), quantity: q }));
    if (items.length === 0) {
      toast.error('Indica al menos una cantidad a devolver');
      return;
    }

    const ok = await confirm({
      title: '¿Registrar la devolución?',
      message: `Se devolverán ${unitsToReturn} unidades (${money(totalToReturn)}) y se descontarán del stock.`,
      confirmText: 'Registrar',
    });
    if (!ok) return;

    setSaving(true);
    try {
      await returnsService.createReturn({
        purchaseOrderId: Number(selectedOrderId),
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        items,
      });
      toast.success('Devolución registrada y stock revertido');
      navigate(LIST);
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar la devolución');
    } finally {
      setSaving(false);
    }
  };

  const orderOptions = orders.map((o) => ({ value: o.id, label: o.orderNumber, hint: o.supplier?.name ?? '' }));

  return (
    <Page>
      <PageHeader icon={RotateCcw} backTo={LIST} title="Nueva devolución" subtitle="Devuelve al proveedor el stock recibido en una orden de compra" />

      <div className="space-y-4">
        <StepCard step={1} done={!!selectedOrderId} title="Orden de compra" description="Solo aparecen las órdenes recibidas total o parcialmente.">
          <div className="max-w-md">
            <Combobox
              options={orderOptions}
              value={selectedOrderId === '' ? null : selectedOrderId}
              onChange={(v) => onSelectOrder(Number(v || 0))}
              placeholder="Selecciona una orden recibida…"
              emptyText="No hay órdenes recibidas"
            />
          </div>
        </StepCard>

        <StepCard
          step={2}
          done={unitsToReturn > 0}
          disabled={!selectedOrderId}
          title="Qué devolver"
          description="Indica cuánto devolver de cada ítem: puede ser total o parcial."
          actions={returnable && groups.length > 0 ? (
            <div className="flex gap-1">
              {unitsToReturn > 0 && <Button size="sm" variant="ghost" onClick={clearAll}>Limpiar</Button>}
              <Button size="sm" variant="outline" onClick={fillAll}>Devolver todo</Button>
            </div>
          ) : undefined}
        >
          {loadingItems ? (
            <Spinner label="Cargando ítems…" />
          ) : returnable && groups.length === 0 ? (
            <EmptyState title="Esta orden no tiene ítems devolubles" />
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.name} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 font-medium text-gray-900">{group.name}</div>
                  {group.isMatrix ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Color / talla</th>
                            {group.sizes.map((size) => <th key={size} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[84px]">{size}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {group.colors.map((color) => (
                            <tr key={color}>
                              <td className="px-4 py-2 font-medium text-gray-800 sticky left-0 bg-white whitespace-nowrap">{color}</td>
                              {group.sizes.map((size) => {
                                const item = group.items.find((i) => i.colorName === color && i.sizeName === size);
                                if (!item || item.returnable <= 0) return <td key={size} className="px-2 py-2 text-center text-gray-300">—</td>;
                                return (
                                  <td key={size} className="px-2 py-2 text-center">
                                    <input
                                      type="number" min={0} max={item.returnable}
                                      aria-label={`Devolver ${color} ${size}`}
                                      value={quantities[item.purchaseOrderItemId] ?? 0}
                                      onChange={(e) => setQty(item.purchaseOrderItemId, Number(e.target.value), item.returnable)}
                                      className={`w-16 ${qtyInput}`}
                                    />
                                    <span className="block text-[11px] text-gray-400 mt-0.5">de {item.returnable}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {group.items.map((item) => (
                        <div key={item.purchaseOrderItemId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <span className="text-sm text-gray-600">Recibido {item.quantityReceived} · Devolvible {item.returnable}</span>
                          <label className="flex items-center gap-2 text-sm text-gray-500">
                            Devolver
                            <input
                              type="number" min={0} max={item.returnable}
                              value={quantities[item.purchaseOrderItemId] ?? 0}
                              onChange={(e) => setQty(item.purchaseOrderItemId, Number(e.target.value), item.returnable)}
                              className={`w-24 ${qtyInput}`}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </StepCard>

        <StepCard step={3} done={!!reason.trim()} title="Motivo">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Motivo" required>
              <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Mercancía defectuosa, error en el pedido…" />
            </Field>
            <Field label="Notas">
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </StepCard>
      </div>

      <FormActions sticky>
        <span className="sm:mr-auto self-center text-sm text-gray-500">
          Total a devolver <b className="ml-1 text-base text-gray-900 tabular-nums">{money(totalToReturn)}</b>
          {unitsToReturn > 0 && <span className="ml-2">· {unitsToReturn} unid.</span>}
        </span>
        <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
        <Button icon={<Save className="w-4 h-4" />} isLoading={saving} onClick={submit}>Registrar devolución</Button>
      </FormActions>
    </Page>
  );
}
