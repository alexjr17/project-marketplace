import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Plus, Loader2, PackageX, DollarSign } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { useToast } from '../../context/ToastContext';
import * as returnsService from '../../services/purchase-returns.service';
import type { PurchaseReturn, PurchaseReturnStats } from '../../services/purchase-returns.service';

const money = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO');
const fmtDate = (s: string) => new Date(s).toLocaleDateString('es-CO');

export default function PurchaseReturnsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [stats, setStats] = useState<PurchaseReturnStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([returnsService.getReturns(), returnsService.getStats()]);
      setReturns(list);
      setStats(st);
    } catch (error: any) {
      showToast(error.message || 'Error al cargar devoluciones', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <RotateCcw className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Devoluciones de Compra</h1>
            <p className="text-gray-600 text-sm">Devuelve al proveedor el stock recibido en una orden de compra</p>
          </div>
        </div>
        <Button variant="admin-primary" onClick={() => navigate('/admin-panel/purchase-returns/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Devolución
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <PackageX className="w-8 h-8 text-orange-500" />
          <div>
            <p className="text-sm text-gray-500">Devoluciones</p>
            <p className="text-xl font-bold text-gray-900">{stats?.total ?? 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-green-500" />
          <div>
            <p className="text-sm text-gray-500">Valor devuelto</p>
            <p className="text-xl font-bold text-gray-900">{money(stats?.totalValue ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <PackageX className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No hay devoluciones registradas</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3"># Devolución</th>
                <th className="text-left px-4 py-3">Orden de Compra</th>
                <th className="text-left px-4 py-3">Proveedor</th>
                <th className="text-left px-4 py-3">Motivo</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.returnNumber}</td>
                  <td className="px-4 py-3">{r.purchaseOrder?.orderNumber ?? '—'}</td>
                  <td className="px-4 py-3">{r.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.reason}</td>
                  <td className="px-4 py-3 text-right font-medium">{money(r.total)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
