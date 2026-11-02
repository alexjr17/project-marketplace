import { useState, useEffect, useCallback } from 'react';
import * as posService from '../../services/pos.service';
import type { PendingDebt } from '../../services/pos.service';
import { Clock, Phone, CheckCircle, DollarSign, Smartphone, Wallet } from 'lucide-react';
import { Alert, Avatar, Button, Card, EmptyState, MoneyInput, Page, PageHeader, Spinner, StatCard } from '../../components/ui';

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
      setError(e?.message || 'Error al cargar los fiados');
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
      setError(e?.message || 'No se pudo registrar el abono');
    } finally {
      setCollectingId(null);
    }
  };

  const totalPending = debts.reduce((sum, d) => sum + d.remaining, 0);

  return (
    <Page className="max-w-4xl mx-auto">
      <PageHeader
        icon={Clock}
        title="Fiados pendientes"
        subtitle="Ventas a crédito por cobrar. Al registrar el abono se cobra con el método elegido."
      />

      {!loading && debts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Wallet} tone="yellow" label="Total por cobrar" value={`$${totalPending.toLocaleString()}`} />
          <StatCard icon={Clock} tone="gray" label="Fiados abiertos" value={debts.length} />
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {loading ? (
        <Spinner label="Cargando fiados…" />
      ) : debts.length === 0 ? (
        <Card><EmptyState icon={CheckCircle} title="No hay fiados pendientes" description="Todas las ventas a crédito están pagadas." /></Card>
      ) : (
        <div className="space-y-3">
          {debts.map((d) => (
            <Card key={d.id}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar name={d.customerName || 'Cliente'} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{d.customerName || 'Cliente'}</p>
                    {d.customerPhone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5" /> {d.customerPhone}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      <span className="font-mono">{d.orderNumber}</span> · {new Date(d.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="text-xl font-bold text-amber-700">${d.remaining.toLocaleString()}</p>
                  {d.paid > 0 && (
                    <p className="text-xs text-gray-500">
                      de ${d.total.toLocaleString()} · abonado ${d.paid.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                {choosingId === d.id ? (
                  <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="md:w-56">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Abono</label>
                      <MoneyInput
                        value={abonoInput}
                        onChange={(e) => setAbonoInput(e.target.value)}
                        max={d.remaining}
                        autoFocus
                        className="h-11 font-semibold"
                      />
                      <button type="button" onClick={() => setAbonoInput(String(d.remaining))} className="mt-1 text-xs font-medium text-app-700 hover:underline">
                        Todo (${d.remaining.toLocaleString()})
                      </button>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2 md:mb-5">
                      <Button variant="secondary" size="lg" onClick={() => setChoosingId(null)} disabled={collectingId === d.id}>Cancelar</Button>
                      <Button variant="success" size="lg" icon={<DollarSign className="w-4 h-4" />} onClick={() => handleCollect(d.id, 'cash')} isLoading={collectingId === d.id}>Efectivo</Button>
                      <Button size="lg" icon={<Smartphone className="w-4 h-4" />} onClick={() => handleCollect(d.id, 'transfer')} disabled={collectingId === d.id}>Transfer</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button variant="outline" size="lg" icon={<CheckCircle className="w-4 h-4" />} onClick={() => openCollect(d)}>
                      Registrar abono / pagar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
