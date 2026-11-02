import { useState, useEffect, useCallback } from 'react';
import * as posService from '../../services/pos.service';
import type { POSCustomerListItem, POSCustomerDetail } from '../../services/pos.service';
import { Users, ShoppingBag, Clock, CheckCircle, ChevronRight } from 'lucide-react';
import { Alert, Avatar, Badge, Drawer, EmptyState, FilterBar, Page, PageHeader, SearchInput, Spinner, StatCard, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, type Tone } from '../../components/ui';

function statusInfo(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'PAID': return { label: 'Pagado', tone: 'green' };
    case 'PENDING': return { label: 'Pendiente', tone: 'yellow' };
    case 'CANCELLED': return { label: 'Cancelado', tone: 'red' };
    default: return { label: status || '—', tone: 'gray' };
  }
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<POSCustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const [detail, setDetail] = useState<POSCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError('');
    try {
      setCustomers(await posService.listCustomers(q));
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Búsqueda con debounce
  useEffect(() => {
    const t = setTimeout(() => load(query.trim() || undefined), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      setDetail(await posService.getCustomerDetail(id));
    } catch {
      setError('No se pudo cargar el detalle del cliente');
    } finally {
      setDetailLoading(false);
    }
  };

  const money = (n: number) => `$${(n || 0).toLocaleString()}`;

  const closeDetail = () => { setDetail(null); setDetailLoading(false); };

  return (
    <Page>
      <PageHeader icon={Users} title="Clientes" subtitle="Historial de compras y deuda de cada cliente" />

      <FilterBar>
        <div className="sm:col-span-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar por nombre, cédula o teléfono…" />
        </div>
      </FilterBar>

      {error && <Alert tone="error">{error}</Alert>}

      <TableCard>
        <Table>
          <THead>
            <tr>
              <Th>Cliente</Th>
              <Th className="hidden md:table-cell">Teléfono</Th>
              <Th align="right" className="hidden sm:table-cell">Compras</Th>
              <Th align="right" className="hidden sm:table-cell">Gastado</Th>
              <Th align="center">Deuda</Th>
              <Th className="w-8"><span className="sr-only">Ver</span></Th>
            </tr>
          </THead>
          <TBody>
            {loading ? (
              <TableMessage colSpan={6}>Cargando…</TableMessage>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6}><EmptyState icon={Users} title={`No hay clientes${query ? ' que coincidan' : ' registrados'}`} /></td></tr>
            ) : customers.map((c) => (
              <Tr key={c.id} onClick={() => openDetail(c.id)}>
                <Td>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.cedula ? `CC/NIT ${c.cedula}` : 'Sin cédula'}<span className="md:hidden">{c.phone ? ` · ${c.phone}` : ''}</span></p>
                    </div>
                  </div>
                </Td>
                <Td className="hidden md:table-cell">{c.phone || <span className="text-gray-400">—</span>}</Td>
                <Td align="right" className="hidden sm:table-cell tabular-nums">{c.totalPurchases}</Td>
                <Td align="right" className="hidden sm:table-cell tabular-nums">{money(c.totalSpent)}</Td>
                <Td align="center">
                  {c.debt > 0 ? <Badge tone="yellow">Debe {money(c.debt)}</Badge> : <Badge tone="green">Sin deuda</Badge>}
                </Td>
                <Td align="right"><ChevronRight className="w-4 h-4 text-gray-300" /></Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>

      {/* Detalle del cliente */}
      <Drawer
        open={!!detail || detailLoading}
        onClose={closeDetail}
        title={detail?.name ?? 'Cliente'}
        description={detail ? `${detail.cedula ? `CC/NIT ${detail.cedula}` : 'Sin cédula'}${detail.phone ? ` · ${detail.phone}` : ''}` : undefined}
      >
        {detailLoading || !detail ? (
          <Spinner label="Cargando cliente…" />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Compras" value={detail.totalPurchases} />
              <StatCard label="Gastado" value={<span className="text-lg">{money(detail.totalSpent)}</span>} />
              <StatCard label="Deuda" value={<span className={`text-lg ${detail.debt > 0 ? 'text-amber-700' : 'text-green-700'}`}>{money(detail.debt)}</span>} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-app-600" /> Historial de compras
              </h3>
              {detail.orders.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="Sin compras registradas" />
              ) : (
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {detail.orders.map((o) => {
                    const st = statusInfo(o.status);
                    return (
                      <div key={o.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-mono text-gray-800">{o.orderNumber}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(o.createdAt).toLocaleString()} · {o.itemsCount} prod.
                            {o.paymentMethod === 'debe' && o.remaining > 0 && (
                              <span className="text-amber-700"> · saldo {money(o.remaining)}</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right whitespace-nowrap space-y-0.5">
                          <p className="text-sm font-semibold text-gray-900">{money(o.total)}</p>
                          <Badge tone={st.tone}>
                            {o.status === 'PENDING' ? <Clock className="w-3 h-3" /> : o.status === 'PAID' ? <CheckCircle className="w-3 h-3" /> : null}
                            {st.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </Page>
  );
}
