import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, ChevronRight, Clock, DollarSign, FileText, PackageX, Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ordersService, { type ApiOrder } from '../../services/orders.service';
import api from '../../services/api.service';
import type { PaymentStats } from '../../services/payments.service';
import * as inventoryService from '../../services/inventory.service';
import type { InventoryStats, LowStockVariant } from '../../services/inventory.service';
import type { OrderStatus } from '../../types/order';
import { ORDER_STATUS_LABELS } from '../../types/order';
import { ORDER_TONE, money } from './orderUi';
import { ADMIN_NAV, canSee, entryPath } from '../../components/admin/adminNav';
import {
  Page, PageHeader, Card, CardTitle, StatCard, Badge, EmptyState, Spinner,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, type Tone,
} from '../../components/ui';


interface OrderCounts { total: number; pending: number; toShip: number }

/** Resumen del panel: indicadores, pendientes del día, últimos pedidos y accesos rápidos. */
export const DashboardPage = () => {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const canOrders = hasPermission('orders.view');
  const canShip = hasPermission('shipping.dispatch');
  const canPayments = hasPermission('payments.view');
  const canStock = hasPermission('inventory_movements.view');

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<OrderCounts | null>(null);
  const [recent, setRecent] = useState<ApiOrder[]>([]);
  const [payStats, setPayStats] = useState<PaymentStats | null>(null);
  const [invStats, setInvStats] = useState<InventoryStats | null>(null);
  const [lowStock, setLowStock] = useState<LowStockVariant[]>([]);

  useEffect(() => {
    let alive = true;
    const total = (s?: string) =>
      ordersService.getAll({ limit: 1, ...(s ? { status: s as OrderStatus } : {}) }).then((r) => r.pagination?.total ?? 0);

    const jobs: Promise<unknown>[] = [];
    if (canOrders || canShip) {
      jobs.push(
        Promise.all([total(), total('PENDING'), total('PAID'), total('PROCESSING')])
          .then(([t, p, paid, proc]) => alive && setCounts({ total: t, pending: p, toShip: paid + proc }))
          .catch(() => {}),
      );
    }
    if (canOrders) {
      jobs.push(
        ordersService.getAll({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })
          .then((r) => alive && setRecent(r.data)).catch(() => {}),
      );
    }
    // Se lee /payments/stats directo: paymentsService.getPaymentStats() devuelve undefined (lee response.data.data).
    if (canPayments) jobs.push(api.get<PaymentStats>('/payments/stats').then((r) => alive && r.data && setPayStats(r.data)).catch(() => {}));
    if (canStock) {
      jobs.push(inventoryService.getStats().then((s) => alive && setInvStats(s)).catch(() => {}));
      jobs.push(inventoryService.getLowStock().then((l) => alive && setLowStock(l)).catch(() => {}));
    }
    Promise.all(jobs).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [canOrders, canShip, canPayments, canStock]);

  // Pendientes: solo los bloques con permiso.
  const pendings = [
    (canShip || canOrders) && counts && {
      key: 'ship', icon: Truck, tone: 'app' as Tone, label: 'Pedidos por despachar', hint: 'Pagados o en preparación',
      count: counts.toShip, to: canShip ? '/admin-panel/orders/shipping' : '/admin-panel/orders',
    },
    canOrders && counts && {
      key: 'unpaid', icon: Clock, tone: 'yellow' as Tone, label: 'Pedidos sin pagar', hint: 'Esperando el pago del cliente',
      count: counts.pending, to: '/admin-panel/orders',
    },
    canPayments && payStats && {
      key: 'pay', icon: DollarSign, tone: 'yellow' as Tone, label: 'Pagos por verificar', hint: 'Pagos en estado pendiente',
      count: payStats.pending, to: '/admin-panel/payments',
    },
    canStock && invStats && {
      key: 'stock', icon: AlertTriangle, tone: 'red' as Tone, label: 'Variantes con stock bajo o agotadas', hint: `${invStats.lowStock} con stock bajo · ${invStats.outOfStock} agotadas`,
      count: invStats.lowStock + invStats.outOfStock, to: '/admin-panel/inventory-movements',
    },
  ].filter(Boolean) as { key: string; icon: typeof Truck; tone: Tone; label: string; hint: string; count: number; to: string }[];

  const quickLinks = ADMIN_NAV.slice(1).flatMap((s) => s.items).filter((i) => canSee(i, hasPermission));
  const hasKpis = canOrders || canShip || canPayments || canStock;

  return (
    <Page>
      <PageHeader icon={BarChart3} title="Resumen" subtitle={`Hola${user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Así va tu tienda hoy.`} />

      {loading ? <Spinner label="Cargando resumen…" /> : (
        <>
          {hasKpis && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {canOrders && counts && (
                <StatCard icon={FileText} label="Pedidos" value={counts.total.toLocaleString('es-CO')} to="/admin-panel/orders"
                  hint={counts.pending > 0 ? `${counts.pending} sin pagar` : 'Todos al día'} hintTone={counts.pending > 0 ? 'yellow' : 'gray'} />
              )}
              {(canShip || canOrders) && counts && (
                <StatCard icon={Truck} tone={counts.toShip > 0 ? 'yellow' : 'green'} label="Por despachar" value={counts.toShip}
                  to={canShip ? '/admin-panel/orders/shipping' : undefined} hint="Pagados o en preparación" />
              )}
              {canPayments && payStats && (
                <StatCard icon={DollarSign} tone="green" label="Ingresos netos" value={money(payStats.revenue.net)} to="/admin-panel/payments"
                  hint={payStats.revenue.refunded > 0 ? `${money(payStats.revenue.refunded)} reembolsado` : `${payStats.total} pagos registrados`}
                  hintTone={payStats.revenue.refunded > 0 ? 'red' : 'gray'} />
              )}
              {canStock && invStats && (
                <StatCard icon={PackageX} tone={invStats.lowStock + invStats.outOfStock > 0 ? 'red' : 'green'} label="Stock bajo" value={invStats.lowStock}
                  to="/admin-panel/inventory-movements" hint={`${invStats.outOfStock} agotadas`} hintTone={invStats.outOfStock > 0 ? 'red' : 'gray'} />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              {pendings.length > 0 && (
                <Card padded={false}>
                  <div className="px-4 md:px-5 pt-4 md:pt-5"><CardTitle icon={Clock}>Pendientes</CardTitle></div>
                  <ul className="divide-y divide-gray-100 border-t border-gray-100">
                    {pendings.map((p) => {
                      const Icon = p.icon;
                      return (
                        <li key={p.key}>
                          <Link to={p.to} className="group flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-gray-50">
                            <Icon className={`w-5 h-5 flex-shrink-0 ${p.count > 0 ? 'text-app-600' : 'text-gray-300'}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-gray-900">{p.label}</span>
                              <span className="block text-xs text-gray-500">{p.hint}</span>
                            </span>
                            <Badge tone={p.count > 0 ? p.tone : 'gray'}>{p.count}</Badge>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-app-600" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}

              {canOrders && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Últimos pedidos</h2>
                    <Link to="/admin-panel/orders" className="text-sm text-app-700 hover:underline">Ver todos</Link>
                  </div>
                  <TableCard>
                    <Table>
                      <THead><tr><Th>Pedido</Th><Th>Cliente</Th><Th align="center">Estado</Th><Th align="right">Total</Th></tr></THead>
                      <TBody>
                        {recent.length === 0 ? <TableMessage colSpan={4}>Aún no hay pedidos.</TableMessage> : recent.map((o) => {
                          const st = String(o.status).toLowerCase() as OrderStatus;
                          return (
                            <Tr key={o.id} onClick={() => navigate(`/admin-panel/orders/${o.id}`)}>
                              <Td>
                                <span className="font-medium text-gray-900 whitespace-nowrap">{o.orderNumber}</span>
                                <span className="block text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                              </Td>
                              <Td>{o.user?.name || o.shipping?.name || o.shipping?.recipientName || '—'}</Td>
                              <Td align="center"><Badge tone={ORDER_TONE[st] ?? 'gray'}>{ORDER_STATUS_LABELS[st] ?? o.status}</Badge></Td>
                              <Td align="right" className="font-medium text-gray-900">{money(o.total)}</Td>
                            </Tr>
                          );
                        })}
                      </TBody>
                    </Table>
                  </TableCard>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {canStock && (
                <Card>
                  <CardTitle icon={AlertTriangle} actions={<Link to="/admin-panel/variants" className="text-sm text-app-700 hover:underline">Variantes</Link>}>Stock bajo</CardTitle>
                  {lowStock.length === 0 ? (
                    <p className="text-sm text-gray-500">Ninguna variante por debajo del mínimo.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 -my-2">
                      {lowStock.slice(0, 6).map((v) => (
                        <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0">
                            <span className="block text-sm text-gray-900 truncate">{v.product?.name}</span>
                            <span className="block text-xs text-gray-500 truncate">{[v.color?.name, v.size?.name].filter(Boolean).join(' · ') || v.sku}</span>
                          </span>
                          <Badge tone={v.stock <= 0 ? 'red' : 'yellow'}>{v.stock} / {v.minStock}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  {lowStock.length > 6 && <p className="text-xs text-gray-400 mt-3">y {lowStock.length - 6} más</p>}
                </Card>
              )}

              <Card>
                <CardTitle>Accesos rápidos</CardTitle>
                {quickLinks.length === 0 ? (
                  <EmptyState title="Sin módulos disponibles" description="Pide a un administrador los permisos que necesitas." />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {quickLinks.map((i) => {
                      const Icon = i.icon;
                      return (
                        <Link key={i.label} to={entryPath(i, hasPermission)} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-app-300 hover:text-app-700">
                          <Icon className="w-4 h-4 flex-shrink-0 text-gray-400" /><span className="truncate">{i.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </Page>
  );
};
