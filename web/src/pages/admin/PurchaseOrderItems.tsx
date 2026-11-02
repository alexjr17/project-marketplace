import { Package, Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, Card, EmptyState, IconButton, NumberInput, MoneyInput, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui';
import type { PurchaseItem } from '../../components/admin/PurchaseItemSelector';
import type { PurchaseOrder } from '../../services/purchase-orders.service';
import { money } from './PurchaseOrderStatus';

interface Props {
  items: PurchaseItem[];
  order: PurchaseOrder | null;
  canEdit: boolean;
  /** Mostrar recibido / pendiente (orden confirmada, parcial o recibida). */
  showReception: boolean;
  onAdd: () => void;
  onQuantity: (index: number, quantity: number) => void;
  onCost: (index: number, unitCost: number) => void;
  onRemove: (index: number) => void;
  onRemoveGroup: (indices: number[]) => void;
}

type Entry = { item: PurchaseItem; index: number };

/** Ítems de la orden: los productos con varias variantes en matriz color × talla; el resto en una tabla. */
export function PurchaseOrderItems({ items, order, canEdit, showReception, onAdd, onQuantity, onCost, onRemove, onRemoveGroup }: Props) {
  const received = (index: number) => {
    const orderItem = order?.items?.[index];
    return orderItem ? Number(orderItem.quantityReceived) : 0;
  };

  // Agrupar por producto / insumo
  const grouped = items.reduce((acc, item, index) => {
    const key = item.productName;
    if (!acc[key]) acc[key] = { name: item.productName, items: [], unitCost: item.unitCost };
    acc[key].items.push({ item, index });
    return acc;
  }, {} as Record<string, { name: string; items: Entry[]; unitCost: number }>);

  const groups = Object.entries(grouped);
  const isMatrix = (g: { items: Entry[] }) => g.items.length > 1 && g.items.some(({ item }) => item.variantInfo);
  const simple = groups.filter(([, g]) => !isMatrix(g)).flatMap(([, g]) => g.items);
  const matrices = groups.filter(([, g]) => isMatrix(g));
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-app-600" />
          Productos e insumos
          {items.length > 0 && <Badge>{items.length}</Badge>}
        </h2>
        {canEdit && items.length > 0 && (
          <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={onAdd}>Agregar ítems</Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="La orden aún no tiene ítems"
            description={canEdit ? 'Agrega los productos o insumos que vas a comprar.' : undefined}
            action={canEdit ? <Button icon={<Plus className="w-4 h-4" />} variant="outline" onClick={onAdd}>Agregar productos o insumos</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          {simple.length > 0 && (
            <TableCard>
              <Table>
                <THead>
                  <tr>
                    <Th>Ítem</Th>
                    <Th align="right">Cantidad</Th>
                    {showReception && <Th align="right">Recibido</Th>}
                    {showReception && <Th align="right">Pendiente</Th>}
                    <Th align="right">Costo unit.</Th>
                    <Th align="right">Subtotal</Th>
                    {canEdit && <Th align="right" aria-label="Acciones" />}
                  </tr>
                </THead>
                <TBody>
                  {simple.map(({ item, index }) => {
                    const rec = received(index);
                    const pending = item.quantity - rec;
                    return (
                      <Tr key={index}>
                        <Td className="min-w-[180px]">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.variantInfo && <p className="text-xs text-gray-500">{item.variantInfo}</p>}
                          {item.sku && <p className="text-xs text-gray-400 font-mono">{item.sku}</p>}
                        </Td>
                        <Td align="right">
                          {canEdit ? (
                            <div className="w-24 ml-auto">
                              <NumberInput aria-label="Cantidad" className="text-right" value={item.quantity} min="1" onChange={(e) => onQuantity(index, Number(e.target.value))} />
                            </div>
                          ) : <span className="font-medium text-gray-900">{item.quantity.toLocaleString('es-CO')}</span>}
                        </Td>
                        {showReception && <Td align="right"><Badge tone={rec > 0 ? 'green' : 'gray'}>{rec}</Badge></Td>}
                        {showReception && <Td align="right"><Badge tone={pending > 0 ? 'yellow' : 'gray'}>{pending}</Badge></Td>}
                        <Td align="right">
                          {canEdit ? (
                            <div className="w-32 ml-auto">
                              <MoneyInput aria-label="Costo unitario" value={item.unitCost} onChange={(e) => onCost(index, Number(e.target.value))} />
                            </div>
                          ) : <span className="whitespace-nowrap">{money(item.unitCost)}</span>}
                        </Td>
                        <Td align="right" className="font-semibold text-gray-900 whitespace-nowrap">{money(item.quantity * item.unitCost)}</Td>
                        {canEdit && (
                          <Td align="right">
                            <IconButton title="Quitar ítem" tone="danger" onClick={() => onRemove(index)}><X className="w-4 h-4" /></IconButton>
                          </Td>
                        )}
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableCard>
          )}

          {matrices.map(([key, group]) => (
            <MatrixGroup
              key={key}
              group={group}
              canEdit={canEdit}
              showReception={showReception}
              received={received}
              onQuantity={onQuantity}
              onRemoveGroup={onRemoveGroup}
            />
          ))}

          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <span className="text-sm text-gray-500">{units.toLocaleString('es-CO')} unidades</span>
            <span className="text-sm text-gray-600">
              Total <span className="ml-2 text-xl font-bold text-gray-900">{money(total)}</span>
            </span>
          </div>
        </>
      )}
    </section>
  );
}

/** Producto o insumo con varias variantes: matriz color × talla. */
function MatrixGroup({ group, canEdit, showReception, received, onQuantity, onRemoveGroup }: {
  group: { name: string; items: Entry[]; unitCost: number };
  canEdit: boolean;
  showReception: boolean;
  received: (index: number) => number;
  onQuantity: (index: number, quantity: number) => void;
  onRemoveGroup: (indices: number[]) => void;
}) {
  // Colores y tallas a partir de variantInfo ("Color / Talla" o "Color - Talla")
  const split = (info?: string) => (info ? info.split(/ \/ | - /).map((p) => p.trim()) : []);
  const colors = new Set<string>();
  const sizes = new Set<string>();
  group.items.forEach(({ item }) => {
    const [c, s] = split(item.variantInfo);
    if (c) colors.add(c);
    if (s) sizes.add(s);
  });
  const colorsArr = Array.from(colors);
  const sizesArr = Array.from(sizes);
  const find = (c: string, s: string) => group.items.find(({ item }) => {
    const [ic, is] = split(item.variantInfo);
    return item.variantInfo && ic === c && is === s;
  });

  const groupTotal = group.items.reduce((sum, { item }) => sum + item.quantity * item.unitCost, 0);
  const groupQty = group.items.reduce((sum, { item }) => sum + item.quantity, 0);
  const groupReceived = group.items.reduce((sum, { index }) => sum + received(index), 0);
  const groupPending = groupQty - groupReceived;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{group.name}</p>
          <p className="text-xs text-gray-500">{groupQty.toLocaleString('es-CO')} unidades · {money(group.unitCost)} c/u</p>
        </div>
        <div className="flex items-center gap-2">
          {showReception && (
            groupPending === 0
              ? <Badge tone="green">Completo</Badge>
              : <><Badge tone="green">Recibido {groupReceived}</Badge><Badge tone="yellow">Pendiente {groupPending}</Badge></>
          )}
          <span className="font-semibold text-gray-900 whitespace-nowrap">{money(groupTotal)}</span>
          {canEdit && (
            <IconButton title="Quitar todo el grupo" tone="danger" onClick={() => onRemoveGroup(group.items.map(({ index }) => index))}>
              <Trash2 className="w-4 h-4" />
            </IconButton>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Color / talla</th>
              {sizesArr.map((s) => <th key={s} className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[88px]">{s}</th>)}
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {colorsArr.map((c) => {
              const rowTotal = sizesArr.reduce((sum, s) => sum + (find(c, s)?.item.quantity ?? 0), 0);
              const rowReceived = sizesArr.reduce((sum, s) => {
                const f = find(c, s);
                return sum + (f ? received(f.index) : 0);
              }, 0);
              return (
                <tr key={c}>
                  <td className="px-4 py-2 font-medium text-gray-800 sticky left-0 bg-white whitespace-nowrap">{c}</td>
                  {sizesArr.map((s) => {
                    const f = find(c, s);
                    if (!f) return <td key={s} className="px-3 py-2 text-center text-gray-300">—</td>;
                    const rec = received(f.index);
                    const pending = f.item.quantity - rec;
                    return (
                      <td key={s} className={`px-3 py-2 text-center ${showReception && pending === 0 ? 'bg-green-50' : ''}`}>
                        {canEdit ? (
                          <div className="w-20 mx-auto">
                            <NumberInput aria-label={`Cantidad ${c} ${s}`} className="text-center" value={f.item.quantity} min="1" onChange={(e) => onQuantity(f.index, Number(e.target.value))} />
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold text-gray-900">{f.item.quantity}</span>
                            {showReception && (
                              <span className="block text-[11px] leading-tight">
                                {pending === 0
                                  ? <span className="text-green-600">recibido</span>
                                  : <><span className="text-green-600">{rec}</span><span className="text-gray-400"> / </span><span className="text-amber-600">faltan {pending}</span></>}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right">
                    <span className="font-semibold text-gray-900">{rowTotal}</span>
                    {showReception && rowReceived > 0 && <span className="block text-xs text-green-600">{rowReceived} rec.</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">Total por talla</td>
              {sizesArr.map((s) => (
                <td key={s} className="px-3 py-2.5 text-center font-semibold text-gray-800">
                  {colorsArr.reduce((sum, c) => sum + (find(c, s)?.item.quantity ?? 0), 0)}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right font-bold text-gray-900">{groupQty}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
