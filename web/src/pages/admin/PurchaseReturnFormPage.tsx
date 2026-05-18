import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, RotateCcw } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { useToast } from '../../context/ToastContext';
import * as returnsService from '../../services/purchase-returns.service';
import type { ReturnableOrder, ReturnableItem } from '../../services/purchase-returns.service';
import * as purchaseOrdersService from '../../services/purchase-orders.service';
import type { PurchaseOrder } from '../../services/purchase-orders.service';

const money = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO');

/** Agrupa los ítems devolubles por insumo/producto para la vista matriz. */
interface ItemGroup {
  name: string;
  items: ReturnableItem[];
  isMatrix: boolean;
  colors: string[];
  sizes: string[];
}

export default function PurchaseReturnFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

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
        showToast(error.message || 'Error al cargar órdenes', 'error');
      }
    })();
  }, []);

  const onSelectOrder = async (id: number) => {
    setSelectedOrderId(id);
    setReturnable(null);
    setQuantities({});
    if (!id) return;
    setLoadingItems(true);
    try {
      const data = await returnsService.getReturnable(id);
      setReturnable(data);
      setQuantities(Object.fromEntries(data.items.map((i) => [i.purchaseOrderItemId, 0])));
    } catch (error: any) {
      showToast(error.message || 'Error al cargar ítems devolubles', 'error');
    } finally {
      setLoadingItems(false);
    }
  };

  // Agrupar ítems por insumo/producto. Si tienen color y talla → matriz.
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

  const totalToReturn = useMemo(
    () =>
      (returnable?.items ?? []).reduce(
        (sum, i) => sum + (quantities[i.purchaseOrderItemId] || 0) * i.unitCost,
        0
      ),
    [returnable, quantities]
  );

  const submit = async () => {
    if (!selectedOrderId) {
      showToast('Selecciona una orden de compra', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Indica el motivo de la devolución', 'error');
      return;
    }
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([poItemId, q]) => ({ purchaseOrderItemId: Number(poItemId), quantity: q }));
    if (items.length === 0) {
      showToast('Indica al menos una cantidad a devolver', 'error');
      return;
    }

    setSaving(true);
    try {
      await returnsService.createReturn({
        purchaseOrderId: Number(selectedOrderId),
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        items,
      });
      showToast('Devolución registrada y stock revertido', 'success');
      navigate('/admin-panel/purchase-returns');
    } catch (error: any) {
      showToast(error.message || 'Error al registrar la devolución', 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Celda de la matriz: input de cantidad a devolver para un color × talla. */
  const matrixCell = (group: ItemGroup, color: string, size: string) => {
    const item = group.items.find((i) => i.colorName === color && i.sizeName === size);
    if (!item || item.returnable <= 0) {
      return (
        <td key={size} className="p-2 text-center border-b border-gray-100">
          <span className="text-gray-300">—</span>
        </td>
      );
    }
    return (
      <td key={size} className="p-2 border-b border-gray-100">
        <div className="flex flex-col items-center gap-0.5">
          <input
            type="number"
            min={0}
            max={item.returnable}
            value={quantities[item.purchaseOrderItemId] ?? 0}
            onChange={(e) => setQty(item.purchaseOrderItemId, Number(e.target.value), item.returnable)}
            className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm"
          />
          <span className="text-[10px] text-gray-400">de {item.returnable}</span>
        </div>
      </td>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <RotateCcw className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nueva Devolución</h1>
            <p className="text-gray-600 text-sm">Devuelve al proveedor el stock recibido en una orden de compra</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin-panel/purchase-returns')}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* Orden de compra */}
        <div className="max-w-xl">
          <label className="block text-sm font-medium text-gray-700 mb-1">Orden de compra *</label>
          <select
            value={selectedOrderId}
            onChange={(e) => onSelectOrder(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Selecciona una orden recibida...</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — {o.supplier?.name ?? ''}
              </option>
            ))}
          </select>
        </div>

        {loadingItems && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
          </div>
        )}

        {/* Matriz de ítems devolubles */}
        {returnable && !loadingItems && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Indica cuánto devolver de cada ítem — puede ser total o parcial.
              </p>
              <button type="button" onClick={fillAll} className="text-sm text-orange-600 hover:underline">
                Devolver todo
              </button>
            </div>

            {groups.length === 0 && (
              <p className="text-sm text-gray-500">Esta orden no tiene ítems devolubles.</p>
            )}

            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.name} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <span className="font-medium text-gray-900">{group.name}</span>
                  </div>

                  {group.isMatrix ? (
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="p-3 text-left text-xs font-semibold text-gray-700 bg-gray-100 sticky left-0 border-b-2 border-gray-200">
                              Color / Talla
                            </th>
                            {group.sizes.map((size) => (
                              <th
                                key={size}
                                className="p-3 text-center text-xs font-semibold text-gray-700 bg-gray-100 min-w-[90px] border-b-2 border-gray-200"
                              >
                                {size}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.colors.map((color, idx) => (
                            <tr key={color} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="p-3 border-b border-gray-100 sticky left-0 bg-inherit font-medium text-gray-800">
                                {color}
                              </td>
                              {group.sizes.map((size) => matrixCell(group, color, size))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // Ítem sin variantes (consumible): fila simple
                    <div className="p-4">
                      {group.items.map((item) => (
                        <div key={item.purchaseOrderItemId} className="flex items-center justify-between gap-4">
                          <div className="text-sm text-gray-600">
                            Recibido: {item.quantityReceived} · Devolvible: {item.returnable}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Devolver:</span>
                            <input
                              type="number"
                              min={0}
                              max={item.returnable}
                              value={quantities[item.purchaseOrderItemId] ?? 0}
                              onChange={(e) =>
                                setQty(item.purchaseOrderItemId, Number(e.target.value), item.returnable)
                              }
                              className="w-24 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Motivo y notas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Mercancía defectuosa, error en el pedido..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-gray-600">
            Total a devolver: <strong className="text-gray-900">{money(totalToReturn)}</strong>
          </span>
          <div className="flex gap-3">
            <Button variant="admin-secondary" onClick={() => navigate('/admin-panel/purchase-returns')}>
              Cancelar
            </Button>
            <Button variant="admin-primary" onClick={submit} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Procesando...' : 'Registrar devolución'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
