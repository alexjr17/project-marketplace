import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, DollarSign, Eye, Receipt, RotateCcw, Wallet } from 'lucide-react';
import { usePayments } from '../../context/PaymentsContext';
import api from '../../services/api.service';
import type { Payment, PaymentStats, PaymentStatus } from '../../services/payments.service';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../../types/order';
import {
  Page, PageHeader, Button, IconButton, StatCard, FilterBar, SearchInput, Field, SelectInput,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Badge, Pager, Drawer, DescriptionList, Alert, type Tone,
} from '../../components/ui';
import { fmtDateTime, money } from './orderUi';

const STATUS_CONFIG: Record<PaymentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pendiente', tone: 'yellow' },
  PROCESSING: { label: 'Procesando', tone: 'blue' },
  APPROVED: { label: 'Aprobado', tone: 'green' },
  DECLINED: { label: 'Rechazado', tone: 'red' },
  FAILED: { label: 'Fallido', tone: 'red' },
  CANCELLED: { label: 'Cancelado', tone: 'gray' },
  EXPIRED: { label: 'Expirado', tone: 'gray' },
  REFUNDED: { label: 'Reembolsado', tone: 'purple' },
  PARTIAL_REFUND: { label: 'Reembolso parcial', tone: 'purple' },
};

const METHOD_OPTIONS = [
  { value: 'wompi', label: 'Wompi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
];

const methodLabel = (m: string) => PAYMENT_METHOD_LABELS[m as PaymentMethod] ?? METHOD_OPTIONS.find((o) => o.value === m)?.label ?? m;
const StatusBadge = ({ status }: { status: PaymentStatus }) => {
  const c = STATUS_CONFIG[status] ?? { label: status, tone: 'gray' as Tone };
  return <Badge tone={c.tone}>{c.label}</Badge>;
};

/** Pagos e intentos de pago de los pedidos. El detalle se abre en un panel lateral. */
export function PaymentsPage() {
  const { payments, isLoading, pagination, listPayments, setPage, setFilters } = usePayments();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [methodFilter, setMethodFilter] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [stats, setStats] = useState<PaymentStats | null>(null);

  // Carga al montar y cada vez que cambian los filtros (listPayments depende de ellos).
  useEffect(() => { listPayments(); }, [listPayments]);
  // Se lee /payments/stats directo: paymentsService.getPaymentStats() devuelve undefined (lee response.data.data).
  useEffect(() => { api.get<PaymentStats>('/payments/stats').then((r) => r.data && setStats(r.data)).catch(() => {}); }, []);

  const handleApplyFilters = () => {
    setFilters({ search: search || undefined, status: statusFilter || undefined, paymentMethod: methodFilter || undefined });
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setMethodFilter('');
    setFilters({ search: undefined, status: undefined, paymentMethod: undefined });
  };

  // Cambiar de página: se pide la página explícitamente para no depender del estado aún no aplicado.
  const goToPage = (p: number) => { setPage(p); listPayments({ page: p }); };

  const p = selectedPayment;

  return (
    <Page>
      <PageHeader icon={DollarSign} title="Pagos" subtitle="Pagos e intentos de pago de los pedidos" />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Receipt} label="Pagos registrados" value={stats.total.toLocaleString('es-CO')} />
          <StatCard icon={Clock} tone={stats.pending > 0 ? 'yellow' : 'green'} label="Pendientes" value={stats.pending} hint={stats.pending > 0 ? 'Por verificar' : 'Nada por verificar'} hintTone={stats.pending > 0 ? 'yellow' : 'gray'} />
          <StatCard icon={Wallet} tone="green" label="Ingresos netos" value={money(stats.revenue.net)} hint={`${money(stats.revenue.total)} aprobados`} />
          <StatCard icon={RotateCcw} tone="gray" label="Reembolsado" value={money(stats.revenue.refunded)} />
        </div>
      )}

      <FilterBar
        actions={
          <>
            <Button variant="secondary" onClick={handleClearFilters}>Limpiar</Button>
            <Button onClick={handleApplyFilters}>Aplicar</Button>
          </>
        }
      >
        <div className="sm:col-span-2">
          <form onSubmit={(e) => { e.preventDefault(); handleApplyFilters(); }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Pedido, transacción, email…" />
          </form>
        </div>
        <Field>
          <SelectInput aria-label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | '')}>
            <option value="">Todos los estados</option>
            {(Object.keys(STATUS_CONFIG) as PaymentStatus[]).map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </SelectInput>
        </Field>
        <Field>
          <SelectInput aria-label="Método" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
            <option value="">Todos los métodos</option>
            {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectInput>
        </Field>
      </FilterBar>

      <TableCard
        footer={pagination && pagination.total > 0 && (
          <Pager page={pagination.page} pageSize={pagination.limit} total={pagination.total} onPage={goToPage} />
        )}
      >
        <Table>
          <THead>
            <tr>
              <Th>Pago</Th><Th>Pedido</Th><Th align="center">Estado</Th><Th>Método</Th><Th>Pagador</Th><Th>Fecha</Th>
              <Th align="right">Monto</Th><Th align="right" aria-label="Acciones" />
            </tr>
          </THead>
          <TBody>
            {isLoading ? <TableMessage colSpan={8}>Cargando pagos…</TableMessage>
              : !payments || payments.length === 0 ? <TableMessage colSpan={8}>No hay pagos registrados.</TableMessage>
                : payments.map((pay) => (
                  <Tr key={pay.id} onClick={() => setSelectedPayment(pay)}>
                    <Td>
                      <span className="font-medium text-gray-900">#{pay.id}</span>
                      {pay.transactionId && <span className="block text-xs text-gray-400 font-mono truncate max-w-[10rem]">{pay.transactionId}</span>}
                    </Td>
                    <Td>
                      {pay.orderNumber
                        ? <Link to={`/admin-panel/orders/${pay.orderId}`} onClick={(e) => e.stopPropagation()} className="text-app-700 hover:underline">{pay.orderNumber}</Link>
                        : <span className="text-gray-400">—</span>}
                    </Td>
                    <Td align="center"><StatusBadge status={pay.status} /></Td>
                    <Td>{methodLabel(pay.paymentMethod)}</Td>
                    <Td>
                      <span className="text-gray-900">{pay.payerName || '—'}</span>
                      {pay.payerEmail && <span className="block text-xs text-gray-500">{pay.payerEmail}</span>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {fmtDateTime(pay.initiatedAt)}
                      {pay.paidAt && <span className="block text-xs text-green-700">Pagado: {fmtDateTime(pay.paidAt)}</span>}
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      <span className="font-medium text-gray-900">{money(pay.amount)}</span>
                      {pay.refundedAmount > 0 && <span className="block text-xs text-gray-500">Reemb.: {money(pay.refundedAmount)}</span>}
                    </Td>
                    <Td align="right">
                      <IconButton title="Ver detalle" tone="app" onClick={(e) => { e.stopPropagation(); setSelectedPayment(pay); }}><Eye className="w-4 h-4" /></IconButton>
                    </Td>
                  </Tr>
                ))}
          </TBody>
        </Table>
      </TableCard>

      <Drawer
        open={!!p}
        onClose={() => setSelectedPayment(null)}
        title={p ? `Pago #${p.id}` : ''}
        description={p?.orderNumber ? `Pedido ${p.orderNumber}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedPayment(null)}>Cerrar</Button>
            {p?.orderId && <Link to={`/admin-panel/orders/${p.orderId}`} className="inline-flex"><Button fullWidth>Ver pedido</Button></Link>}
          </>
        }
      >
        {p && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <StatusBadge status={p.status} />
              <span className="text-2xl font-bold text-gray-900">{money(p.amount)}</span>
            </div>
            {p.failureReason && <Alert tone="error" title="Razón del fallo">{p.failureReason}{p.failureCode ? ` (${p.failureCode})` : ''}</Alert>}
            <DescriptionList items={[
              { label: 'Método', value: methodLabel(p.paymentMethod) },
              { label: 'Moneda', value: p.currency || null },
              { label: 'ID de transacción', value: p.transactionId ? <span className="font-mono">{p.transactionId}</span> : null, full: true },
              { label: 'Pagador', value: p.payerName || null },
              { label: 'Email', value: p.payerEmail || null },
              { label: 'Teléfono', value: p.payerPhone || null },
              { label: 'Documento', value: p.payerDocument || null },
              { label: 'Iniciado', value: fmtDateTime(p.initiatedAt) },
              { label: 'Pagado', value: p.paidAt ? fmtDateTime(p.paidAt) : null },
              { label: 'Verificado por', value: p.verifiedByName || null },
              { label: 'Verificado', value: p.verifiedAt ? fmtDateTime(p.verifiedAt) : null },
              ...(p.refundedAmount > 0 ? [
                { label: 'Reembolsado', value: money(p.refundedAmount) },
                { label: 'Motivo del reembolso', value: p.refundReason || null },
              ] : []),
              { label: 'Notas', value: p.notes || null, full: true },
            ]} />
            {p.receiptUrl && (
              <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-gray-200 overflow-hidden hover:border-app-300">
                <img src={p.receiptUrl} alt="Comprobante" className="w-full max-h-72 object-contain bg-gray-50" />
                <span className="block px-3 py-2 text-sm text-app-700">Abrir comprobante</span>
              </a>
            )}
          </div>
        )}
      </Drawer>
    </Page>
  );
}
