import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Factory, Ban, Package, ClipboardList, ShoppingCart, Shirt, CalendarDays, CheckCircle2 } from 'lucide-react';
import toast from '../../lib/toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgPurchaseOrder, MfgPurchaseOrderItem } from '../../types/manufacturing';
import { PED_STATUS_META } from './PurchaseOrdersPage';
import { Page, PageHeader, Button, Card, CardTitle, StatCard, Badge, DescriptionList, Thumb, Spinner, EmptyState, useConfirm } from '../../components/ui';
import QtyMatrix from '../../components/manufacturing/QtyMatrix';
import { MarketBadge } from '../../components/manufacturing/mfgUi';

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const ask = useConfirm();
  const orderId = Number(id);
  const [order, setOrder] = useState<MfgPurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setOrder(await manufacturingService.getPurchaseOrder(orderId)); }
    catch { toast.error('No se pudo cargar el pedido'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderId]);

  // Agrupa los ítems por referencia → matriz talla×color.
  const groups = useMemo(() => {
    if (!order) return [];
    const byRef = new Map<number, { ref: MfgPurchaseOrderItem['reference']; items: MfgPurchaseOrderItem[] }>();
    order.items.forEach((it) => {
      if (!byRef.has(it.referenceId)) byRef.set(it.referenceId, { ref: it.reference, items: [] });
      byRef.get(it.referenceId)!.items.push(it);
    });
    return [...byRef.values()].map(({ ref, items }) => {
      const colors = new Map<number, { name: string; hex: string }>();
      const sizes = new Map<number, { abbr: string; sort: number }>();
      const cell = new Map<string, number>();
      let produced = false;
      items.forEach((it) => {
        if (it.color) colors.set(it.colorId, { name: it.color.name, hex: it.color.hexCode });
        if (it.size) sizes.set(it.sizeId, { abbr: it.size.abbreviation, sort: it.size.sortOrder });
        cell.set(`${it.sizeId}-${it.colorId}`, it.quantity);
        if (it.productionOrderId) produced = true;
      });
      const S = [...sizes.entries()].sort((a, b) => a[1].sort - b[1].sort);
      const C = [...colors.entries()];
      const total = items.reduce((t, it) => t + it.quantity, 0);
      return { ref, S, C, cell, total, produced };
    });
  }, [order]);

  const generate = async () => {
    if (!(await ask({ title: '¿Generar las órdenes de producción?', message: 'Se creará una por cada referencia pendiente del pedido.', confirmText: 'Generar' }))) return;
    setBusy(true);
    try {
      const res = await manufacturingService.generateProduction(orderId);
      toast.success(`Se generaron ${res.created} orden(es) de producción`);
      setOrder(res.purchaseOrder);
    } catch (e: any) { toast.error(e?.message || 'No se pudo generar la producción'); }
    finally { setBusy(false); }
  };

  const cancelOrder = async () => {
    if (!(await ask({ title: `¿Cancelar el pedido ${order?.code ?? ''}?`, message: 'El pedido queda cancelado y no se podrá generar producción.', confirmText: 'Cancelar pedido', cancelText: 'Volver', tone: 'danger' }))) return;
    changeStatus('CANCELLED');
  };

  const changeStatus = async (status: MfgPurchaseOrder['status']) => {
    setBusy(true);
    try { setOrder(await manufacturingService.changePurchaseStatus(orderId, status)); toast.success('Estado actualizado'); }
    catch { toast.error('No se pudo actualizar'); }
    finally { setBusy(false); }
  };

  if (loading) return <Page><Spinner label="Cargando…" /></Page>;
  if (!order) return <Page><PageHeader icon={ShoppingCart} title="Pedido" backTo="/manufacturing/purchase-orders" /><Card><EmptyState title="Pedido no encontrado" /></Card></Page>;

  const totalQty = order.items.reduce((t, it) => t + it.quantity, 0);
  const pendingRefs = groups.filter((g) => !g.produced).length;
  const canCancel = order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && !order.productionOrders?.length;

  return (
    <Page>
      <PageHeader
        icon={ShoppingCart}
        backTo="/manufacturing/purchase-orders"
        title={<span className="inline-flex items-center gap-3"><span className="font-mono">{order.code}</span><Badge tone={PED_STATUS_META[order.status].tone}>{PED_STATUS_META[order.status].label}</Badge></span>}
        subtitle={`${order.client?.name ?? ''}${order.client?.city ? ` · ${order.client.city}` : ''}`}
        actions={<>
          {canCancel && <Button variant="secondary" icon={<Ban className="w-4 h-4" />} disabled={busy} onClick={cancelOrder}>Cancelar pedido</Button>}
          {order.status === 'IN_PRODUCTION' && <Button variant="success" icon={<CheckCircle2 className="w-4 h-4" />} disabled={busy} onClick={() => changeStatus('DELIVERED')}>Marcar entregado</Button>}
          <Button icon={<Factory className="w-4 h-4" />} isLoading={busy} disabled={pendingRefs === 0} onClick={generate}
            title={pendingRefs === 0 ? 'Todas las referencias ya están en producción' : undefined}>
            Generar producción{pendingRefs > 0 ? ` (${pendingRefs})` : ''}
          </Button>
        </>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Unidades" value={totalQty.toLocaleString('es-CO')} />
        <StatCard icon={Shirt} label="Referencias" value={groups.length} hint={pendingRefs > 0 ? `${pendingRefs} sin producción` : 'Todas en producción'} hintTone={pendingRefs > 0 ? 'yellow' : 'green'} />
        <StatCard icon={ClipboardList} tone="blue" label="Órdenes generadas" value={order.productionOrders?.length ?? 0} />
        <StatCard icon={CalendarDays} tone="gray" label="Entrega" value={order.deliveryDate?.slice(0, 10) ?? '—'} hint={order.dispatchStartDate ? `Despacho desde ${order.dispatchStartDate.slice(0, 10)}` : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          {groups.map((g) => (
            <Card key={g.ref?.id}>
              <div className="flex items-center gap-3 mb-4">
                <Thumb src={g.ref?.imagePath} alt={g.ref?.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate"><span className="font-mono text-gray-500 mr-1">{g.ref?.code}</span>{g.ref?.name}</p>
                  <p className="text-xs text-gray-500 tabular-nums">{g.total.toLocaleString('es-CO')} und</p>
                </div>
                <Badge tone={g.produced ? 'green' : 'yellow'}>{g.produced ? 'En producción' : 'Pendiente'}</Badge>
              </div>
              <QtyMatrix
                totals
                sizes={g.S.map(([sid, s]) => ({ id: sid, label: s.abbr }))}
                colors={g.C.map(([cid, c]) => ({ id: cid, name: c.name, hex: c.hex }))}
                get={(sid, cid) => g.cell.get(`${sid}-${cid}`) ?? 0}
              />
            </Card>
          ))}
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle>Datos del pedido</CardTitle>
            <DescriptionList cols={1} items={[
              { label: 'Cliente', value: order.client?.name },
              { label: 'Mercado', value: <MarketBadge market={order.market} /> },
              { label: 'Colección', value: order.collection?.name },
              { label: 'Ventana de entrega', value: (order.dispatchStartDate || order.deliveryDate) ? `${order.dispatchStartDate ?? '…'} → ${order.deliveryDate ?? '…'}` : null },
              ...(order.partialDates && order.partialDates.length > 0 ? [{ label: 'Entregas parciales', value: order.partialDates.join(' · ') }] : []),
              ...(order.notes ? [{ label: 'Notas', value: order.notes }] : []),
            ]} />
          </Card>

          <Card>
            <CardTitle icon={ClipboardList}>Producción generada</CardTitle>
            {order.productionOrders && order.productionOrders.length > 0 ? (
              <div className="divide-y divide-gray-100 -my-2">
                {order.productionOrders.map((p) => (
                  <Link key={p.id} to={`/manufacturing/orders/${p.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-app-700">
                    <span className="font-mono font-semibold text-gray-900">{p.code}</span>
                    <span className="text-gray-500 truncate">{p.reference?.code ?? ''}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Aún no se generan órdenes de producción.</p>}
          </Card>
        </div>
      </div>
    </Page>
  );
}
