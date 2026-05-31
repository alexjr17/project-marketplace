import { useState, useEffect, useCallback } from 'react';
import * as posService from '../../services/pos.service';
import type { PendingDebt } from '../../services/pos.service';
import { Clock, User, Phone, CheckCircle, Loader2, DollarSign, Smartphone } from 'lucide-react';

export default function DebtsPage() {
  const [debts, setDebts] = useState<PendingDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const [choosingId, setChoosingId] = useState<number | null>(null);
  const [abonoInput, setAbonoInput] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDebts(await posService.getDebts());
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Error al cargar los fiados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCollect = (d: PendingDebt) => {
    setChoosingId(d.id);
    setAbonoInput(String(d.remaining));
    setError('');
  };

  const handleCollect = async (id: number, method: 'cash' | 'transfer') => {
    const amount = parseFloat(abonoInput || '0');
    if (!amount || amount <= 0) {
      setError('Ingresa un monto válido');
      return;
    }
    setCollectingId(id);
    try {
      await posService.collectDebt(id, method, amount);
      setChoosingId(null);
      setAbonoInput('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo registrar el abono');
    } finally {
      setCollectingId(null);
    }
  };

  const totalPending = debts.reduce((sum, d) => sum + d.remaining, 0);

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-6 h-6 text-amber-600" />
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Fiados pendientes</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Ventas a crédito por cobrar. Al marcar como pagado, el monto se cobra con el método elegido.
      </p>

      {!loading && debts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex justify-between items-center">
          <span className="text-sm text-amber-800">Total por cobrar ({debts.length})</span>
          <span className="text-xl font-bold text-amber-700">${totalPending.toLocaleString()}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : debts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
          <p>No hay fiados pendientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map((d) => (
            <div key={d.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-gray-400" />
                    {d.customerName || 'Cliente'}
                  </p>
                  {d.customerPhone && (
                    <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5" /> {d.customerPhone}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {d.orderNumber} · {new Date(d.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="text-lg font-bold text-amber-700">${d.remaining.toLocaleString()}</p>
                  {d.paid > 0 && (
                    <p className="text-xs text-gray-400">
                      de ${d.total.toLocaleString()} · abonado ${d.paid.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                {choosingId === d.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 whitespace-nowrap">Abono:</span>
                      <input
                        type="number"
                        value={abonoInput}
                        onChange={(e) => setAbonoInput(e.target.value)}
                        min="0"
                        max={d.remaining}
                        className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setAbonoInput(String(d.remaining))}
                        className="text-xs text-amber-600 hover:text-amber-800"
                      >
                        Todo (${d.remaining.toLocaleString()})
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCollect(d.id, 'cash')}
                        disabled={collectingId === d.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <DollarSign className="w-4 h-4" /> Efectivo
                      </button>
                      <button
                        onClick={() => handleCollect(d.id, 'transfer')}
                        disabled={collectingId === d.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        <Smartphone className="w-4 h-4" /> Transfer
                      </button>
                      <button
                        onClick={() => setChoosingId(null)}
                        disabled={collectingId === d.id}
                        className="px-2 py-1.5 text-gray-500 text-sm hover:text-gray-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      onClick={() => openCollect(d)}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
                    >
                      <CheckCircle className="w-4 h-4" /> Registrar abono / pagar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
