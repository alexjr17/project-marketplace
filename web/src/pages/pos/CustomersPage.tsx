import { useState, useEffect, useCallback } from 'react';
import * as posService from '../../services/pos.service';
import type { POSCustomerListItem, POSCustomerDetail } from '../../services/pos.service';
import { Users, Search, User, Phone, Loader2, X, ShoppingBag, Clock, CheckCircle } from 'lucide-react';

function statusInfo(status: string): { label: string; cls: string } {
  switch (status) {
    case 'PAID': return { label: 'Pagado', cls: 'bg-green-100 text-green-700' };
    case 'PENDING': return { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' };
    case 'CANCELLED': return { label: 'Cancelado', cls: 'bg-red-100 text-red-700' };
    default: return { label: status || '—', cls: 'bg-gray-100 text-gray-700' };
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

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Clientes</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">Historial de compras y deuda de cada cliente.</p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, cédula o teléfono..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No hay clientes{query ? ' que coincidan' : ' registrados'}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => openDetail(c.id)}
              className="w-full text-left bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-gray-400" /> {c.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.cedula ? `CC/NIT ${c.cedula}` : 'Sin cédula'}
                    {c.phone ? ` · ${c.phone}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {c.totalPurchases} compras · {money(c.totalSpent)} gastado
                  </p>
                </div>
                {c.debt > 0 ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
                    Debe {money(c.debt)}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
                    Sin deuda
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detalle del cliente */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="p-12 flex justify-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{detail.name}</h2>
                    <p className="text-xs text-gray-500">
                      {detail.cedula ? `CC/NIT ${detail.cedula}` : 'Sin cédula'}{detail.phone ? ` · ${detail.phone}` : ''}
                    </p>
                  </div>
                  <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-5 grid grid-cols-3 gap-3 border-b border-gray-100">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Compras</p>
                    <p className="text-lg font-bold text-gray-900">{detail.totalPurchases}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Gastado</p>
                    <p className="text-lg font-bold text-gray-900">{money(detail.totalSpent)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Deuda</p>
                    <p className={`text-lg font-bold ${detail.debt > 0 ? 'text-amber-600' : 'text-green-600'}`}>{money(detail.debt)}</p>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4" /> Historial de compras
                  </h3>
                  {detail.orders.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">Sin compras registradas.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.orders.map((o) => {
                        const s = statusInfo(o.status);
                        return (
                          <div key={o.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg p-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-mono text-gray-700">{o.orderNumber}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(o.createdAt).toLocaleString()} · {o.itemsCount} prod.
                                {o.paymentMethod === 'debe' && o.remaining > 0 && (
                                  <span className="text-amber-600"> · saldo {money(o.remaining)}</span>
                                )}
                              </p>
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <p className="text-sm font-semibold text-gray-900">{money(o.total)}</p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${s.cls}`}>
                                {o.status === 'PENDING' ? <Clock className="w-2.5 h-2.5" /> : o.status === 'PAID' ? <CheckCircle className="w-2.5 h-2.5" /> : null}
                                {s.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
