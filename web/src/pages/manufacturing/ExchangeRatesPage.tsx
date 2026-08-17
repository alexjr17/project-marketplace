import { useEffect, useState } from 'react';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import manufacturingService from '../../services/manufacturing.service';
import type { MfgExchangeRate } from '../../types/manufacturing';

const money = (n: number) => '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

export default function ExchangeRatesPage() {
  const [items, setItems] = useState<MfgExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await manufacturingService.getExchangeRates()); }
    catch { toast.error('No se pudo cargar la tasa de cambio'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (rate === '' || Number(rate) <= 0) { toast.error('Ingresa la tasa (COP por USD)'); return; }
    setSaving(true);
    try {
      await manufacturingService.createExchangeRate({ rate: Number(rate), effectiveDate: date || null });
      toast.success('Tasa registrada'); setRate(''); setDate(''); load();
    } catch { toast.error('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const remove = async (r: MfgExchangeRate) => {
    if (!confirm('¿Eliminar esta tasa?')) return;
    try { await manufacturingService.deleteExchangeRate(r.id); toast.success('Eliminada'); load(); }
    catch { toast.error('No se pudo eliminar'); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-100 rounded-lg"><DollarSign className="w-6 h-6 text-orange-600" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasa de cambio</h1>
          <p className="text-sm text-gray-500">COP por USD. La activa se usa para los precios de exportación.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Tasa (COP por 1 USD) *</span>
          <input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className="mt-1 w-48 border border-gray-300 rounded-lg px-3 py-2" placeholder="4000" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Fecha</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 border border-gray-300 rounded-lg px-3 py-2" />
        </label>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-60"><Plus className="w-4 h-4" /> {saving ? 'Guardando…' : 'Registrar tasa'}</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Tasa (COP/USD)</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin tasas. Registra la primera.</td></tr>
            ) : items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-900">{money(Number(r.rate))}</td>
                <td className="px-4 py-3 text-gray-600">{r.effectiveDate ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.isActive ? 'Activa' : 'Histórica'}</span>
                </td>
                <td className="px-4 py-3 text-right"><button onClick={() => remove(r)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
