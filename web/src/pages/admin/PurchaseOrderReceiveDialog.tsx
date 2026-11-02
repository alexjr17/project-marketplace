import { Minus, Package, Plus } from 'lucide-react';
import { Alert, Badge, Button, Dialog } from '../../components/ui';
import type { PurchaseOrder } from '../../services/purchase-orders.service';

export type ReceiveLine = { itemId: number; quantityReceived: number };

type OrderItem = PurchaseOrder['items'][number];
type Entry = { item: OrderItem; index: number };

const qtyClass = (complete: boolean, partial: boolean) =>
  `h-9 rounded-lg border text-center text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500 ${
    complete ? 'border-green-300 bg-green-50 text-green-700' : partial ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-300 bg-white text-gray-900'
  }`;

/** Recibir mercancía: cantidades pre-cargadas con lo pendiente; matriz color × talla para productos con variantes. */
export function PurchaseOrderReceiveDialog({ open, onClose, order, lines, onChange, onConfirm, saving }: {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  lines: ReceiveLine[];
  onChange: (lines: ReceiveLine[]) => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  const setQty = (index: number, item: OrderItem, value: number) => {
    const pending = Number(item.quantity) - Number(item.quantityReceived);
    const next = [...lines];
    next[index] = { itemId: item.id, quantityReceived: Math.min(Math.max(0, value), pending) };
    onChange(next);
  };

  // Agrupar por producto / insumo
  const grouped = order.items.reduce((acc, item, index) => {
    let key: string;
    let name: string;
    if (item.variant?.product) { key = `product-${item.variant.product.id}`; name = item.variant.product.name; }
    else if (item.inputVariant?.input) { key = `input-${item.inputVariant.input.id}`; name = item.inputVariant.input.name; }
    else if (item.input) { key = `input-simple-${item.input.id}`; name = item.input.name; }
    else { key = `item-${item.id}`; name = item.description || 'Ítem'; }
    if (!acc[key]) acc[key] = { name, items: [], hasVariants: false };
    acc[key].items.push({ item, index });
    if (item.variant || item.inputVariant) acc[key].hasVariants = true;
    return acc;
  }, {} as Record<string, { name: string; items: Entry[]; hasVariants: boolean }>);

  const totalPending = order.items.reduce((sum, item) => sum + (Number(item.quantity) - Number(item.quantityReceived)), 0);
  const totalToReceive = lines.reduce((sum, l) => sum + l.quantityReceived, 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Recibir mercancía"
      description={`Orden ${order.orderNumber} · ${order.supplier?.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button isLoading={saving} icon={<Package className="w-4 h-4" />} onClick={onConfirm}>Confirmar recepción</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="info">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Las cantidades vienen con lo pendiente. Cámbialas solo si no llegó completo.</span>
            <span className="font-semibold tabular-nums">{totalToReceive} / {totalPending} pendientes</span>
          </div>
        </Alert>

        {Object.entries(grouped).map(([key, group]) => {
          if (group.items.length === 1 || !group.hasVariants) {
            return (
              <div key={key} className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {group.items.map(({ item, index }) => {
                  const pending = Number(item.quantity) - Number(item.quantityReceived);
                  const qty = lines[index]?.quantityReceived || 0;
                  const complete = qty === pending;
                  return (
                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {item.variant?.product.name || item.inputVariant?.input?.name || item.input?.name || item.description}
                        </p>
                        {(item.variant || item.inputVariant) && (
                          <p className="text-xs text-gray-500">
                            {item.variant?.color?.name || item.inputVariant?.color?.name} / {item.variant?.size?.abbreviation || item.inputVariant?.size?.abbreviation}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">
                          Pedido {Number(item.quantity)} · Ya recibido {Number(item.quantityReceived)} · Pendiente <span className="font-medium text-amber-700">{pending}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" title="Restar uno" disabled={qty === 0} onClick={() => setQty(index, item, qty - 1)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                          <Minus className="w-4 h-4" />
                        </button>
                        <input type="number" aria-label="Cantidad a recibir" value={qty} min="0" max={pending} onChange={(e) => setQty(index, item, Number(e.target.value))} className={`w-20 ${qtyClass(complete, qty > 0)}`} />
                        <button type="button" title="Sumar uno" disabled={qty >= pending} onClick={() => setQty(index, item, qty + 1)} className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          // Matriz color × talla
          const colors = new Map<number, { id: number; name: string; hexCode?: string }>();
          const sizes = new Map<number, { id: number; name: string; abbreviation?: string }>();
          group.items.forEach(({ item }) => {
            const color = item.variant?.color || item.inputVariant?.color;
            const size = item.variant?.size || item.inputVariant?.size;
            if (color) colors.set(color.id, color);
            if (size) sizes.set(size.id, size);
          });
          const colorsArr = Array.from(colors.values());
          const sizesArr = Array.from(sizes.values());
          const find = (colorId: number | null, sizeId: number | null) => group.items.find(({ item }) => {
            const c = item.variant?.color || item.inputVariant?.color;
            const s = item.variant?.size || item.inputVariant?.size;
            return (c?.id || null) === colorId && (s?.id || null) === sizeId;
          });
          const groupPending = group.items.reduce((sum, { item }) => sum + (Number(item.quantity) - Number(item.quantityReceived)), 0);
          const groupToReceive = group.items.reduce((sum, { index }) => sum + (lines[index]?.quantityReceived || 0), 0);

          return (
            <div key={key} className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-200">
                <span className="font-medium text-gray-900">{group.name}</span>
                <span className="flex items-center gap-2 text-xs text-gray-500 tabular-nums">
                  {groupToReceive} / {groupPending} unidades
                  {groupToReceive === groupPending && <Badge tone="green">Completo</Badge>}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color / talla</th>
                      {sizesArr.map((s) => <th key={s.id} className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[92px]">{s.abbreviation || s.name}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {colorsArr.map((color) => (
                      <tr key={color.id}>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hexCode }} />
                            <span className="font-medium text-gray-800">{color.name}</span>
                          </span>
                        </td>
                        {sizesArr.map((size) => {
                          const f = find(color.id, size.id);
                          if (!f) return <td key={size.id} className="px-3 py-2 text-center text-gray-300">—</td>;
                          const pending = Number(f.item.quantity) - Number(f.item.quantityReceived);
                          const qty = lines[f.index]?.quantityReceived || 0;
                          return (
                            <td key={size.id} className="px-3 py-2 text-center">
                              <span className="block text-[11px] text-gray-500 mb-1">Pend. <b className={pending > 0 ? 'text-amber-700' : 'text-gray-400'}>{pending}</b></span>
                              <input type="number" aria-label={`Recibir ${color.name} ${size.abbreviation || size.name}`} value={qty} min="0" max={pending}
                                onChange={(e) => setQty(f.index, f.item, Number(e.target.value))} className={`w-16 ${qtyClass(qty === pending, qty > 0)}`} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
