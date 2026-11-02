import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, CheckCircle, ChevronRight, Clock, CreditCard, FileText, RefreshCw, ShoppingBag, Truck } from 'lucide-react';
import { useOrders } from '../../context/OrdersContext';
import type { Order, OrderStatus } from '../../types/order';
import { ORDER_STATUS_LABELS } from '../../types/order';
import {
  Page, PageHeader, Button, IconButton, StatCard, FilterBar, SearchInput, Field, SelectInput,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Badge, Pager, Alert, Spinner, EmptyState,
} from '../../components/ui';
import { ORDER_TONE, fmtDateTime, money } from './orderUi';

type SortKey = 'orderNumber' | 'total' | 'createdAt';

const STATUS_OPTIONS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'paid', label: 'Pagados' },
  { value: 'processing', label: 'En preparación' },
  { value: 'shipped', label: 'Enviados' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
];

/** Listado de pedidos de la tienda. Cada fila lleva al detalle. */
export const OrdersPage = () => {
  const navigate = useNavigate();
  const { orders, isLoading, error, refreshOrders, pagination } = useOrders();
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'createdAt', desc: true });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = orders.filter((o) =>
      (statusFilter === 'all' || o.status === statusFilter) &&
      (!t || [o.orderNumber, o.userName, o.userEmail, o.shipping?.city].some((v) => v?.toLowerCase().includes(t))));
    const val = (o: Order) => (sort.key === 'createdAt' ? new Date(o.createdAt).getTime() : sort.key === 'total' ? o.total : o.orderNumber);
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -r : r;
    });
  }, [orders, q, statusFilter, sort]);

  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  const toggleSort = (key: SortKey) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }));
  const filtered = q !== '' || statusFilter !== 'all';

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    processing: orders.filter((o) => o.status === 'paid' || o.status === 'processing').length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
  };

  const SortTh = ({ k, children, align }: { k: SortKey; children: string; align?: 'right' }) => (
    <Th align={align}>
      <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 uppercase hover:text-gray-900 ${sort.key === k ? 'text-gray-900' : ''}`}>
        {children}<ArrowUpDown className="w-3.5 h-3.5" />
      </button>
    </Th>
  );

  return (
    <Page>
      <PageHeader
        icon={FileText}
        title="Pedidos"
        subtitle="Pedidos de la tienda en línea"
        actions={<Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={refreshOrders} isLoading={isLoading}>Actualizar</Button>}
      />

      {error ? (
        <Alert tone="error" title="No se pudieron cargar los pedidos" action={<Button size="sm" variant="secondary" onClick={refreshOrders}>Reintentar</Button>}>{error}</Alert>
      ) : isLoading && orders.length === 0 ? (
        <Spinner label="Cargando pedidos…" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={ShoppingBag} label="Pedidos" value={stats.total} hint={pagination.total > orders.length ? `de ${pagination.total} en total` : undefined} />
            <StatCard icon={Clock} tone="yellow" label="Pendientes de pago" value={stats.pending} />
            <StatCard icon={CreditCard} tone="blue" label="Por despachar" value={stats.processing} hint="Pagados o en preparación" to="/admin-panel/orders/shipping" />
            <StatCard icon={Truck} tone="green" label="Enviados" value={stats.shipped} hint={`${stats.delivered} entregados`} hintTone="green" />
          </div>

          {pagination.total > orders.length && (
            <Alert tone="info">Se muestran los {orders.length} pedidos más recientes de {pagination.total}.</Alert>
          )}

          <FilterBar>
            <div className="sm:col-span-2"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por número, cliente, email o ciudad…" /></div>
            <Field>
              <SelectInput aria-label="Estado" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as OrderStatus | 'all'); setPage(1); }}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            </Field>
          </FilterBar>

          {orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200">
              <EmptyState icon={ShoppingBag} title="No hay pedidos" description="Los pedidos aparecerán aquí cuando los clientes compren." />
            </div>
          ) : (
            <TableCard footer={rows.length > 0 && <Pager page={page} pageSize={pageSize} total={rows.length} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />}>
              <Table>
                <THead>
                  <tr>
                    <SortTh k="orderNumber">Pedido</SortTh>
                    <Th>Cliente</Th>
                    <SortTh k="createdAt">Fecha</SortTh>
                    <Th align="center">Estado</Th>
                    <SortTh k="total" align="right">Total</SortTh>
                    <Th align="right" aria-label="Acciones" />
                  </tr>
                </THead>
                <TBody>
                  {visible.length === 0 ? (
                    <TableMessage colSpan={6}>{filtered ? 'Ningún pedido coincide con la búsqueda o el filtro.' : 'Sin pedidos.'}</TableMessage>
                  ) : visible.map((o) => (
                    <Tr key={o.id} onClick={() => navigate(`/admin-panel/orders/${o.id}`)}>
                      <Td>
                        <span className="font-medium text-gray-900 whitespace-nowrap">{o.orderNumber}</span>
                        <span className="block text-xs text-gray-500">{o.items.length} {o.items.length === 1 ? 'producto' : 'productos'}</span>
                      </Td>
                      <Td>
                        <span className="text-gray-900">{o.userName}</span>
                        <span className="block text-xs text-gray-500">{o.userEmail}</span>
                      </Td>
                      <Td className="whitespace-nowrap">{fmtDateTime(o.createdAt)}</Td>
                      <Td align="center"><Badge tone={ORDER_TONE[o.status]}>{o.status === 'delivered' && <CheckCircle className="w-3 h-3" />}{ORDER_STATUS_LABELS[o.status]}</Badge></Td>
                      <Td align="right" className="font-medium text-gray-900 whitespace-nowrap">{money(o.total)}</Td>
                      <Td align="right">
                        <IconButton title="Ver pedido" tone="app" onClick={(e) => { e.stopPropagation(); navigate(`/admin-panel/orders/${o.id}`); }}><ChevronRight className="w-4 h-4" /></IconButton>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableCard>
          )}
        </>
      )}
    </Page>
  );
};
