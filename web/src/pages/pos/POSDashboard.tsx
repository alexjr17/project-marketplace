import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import OpenSessionPrompt from '../../components/pos/OpenSessionPrompt';
import * as posService from '../../services/pos.service';
import type { PosStats } from '../../services/pos.service';
import {
  ShoppingCart,
  Clock,
  DollarSign,
  TrendingUp,
  Package,
  Download,
  Loader2,
  BarChart3,
} from 'lucide-react';

type Range = 'today' | '7d' | '30d';

const RANGE_LABELS: Record<Range, string> = {
  today: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mixed: 'Mixto',
  debe: 'Fiado',
};

const METHOD_COLORS: Record<string, string> = {
  cash: 'bg-green-500',
  card: 'bg-blue-500',
  transfer: 'bg-purple-500',
  mixed: 'bg-orange-500',
  debe: 'bg-amber-500',
};

export default function POSDashboard() {
  const navigate = useNavigate();
  const { currentSession, isLoadingSession } = usePOS();
  const [range, setRange] = useState<Range>('today');
  const [stats, setStats] = useState<PosStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    posService.getPosStats(range)
      .then((s) => { if (active) setStats(s); })
      .catch(() => { if (active) setStats(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range]);

  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Validando sesión de caja…</p>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <OpenSessionPrompt
        title="Sin Sesion Activa"
        message="Debes abrir una sesion de caja para comenzar a realizar ventas"
      />
    );
  }

  const sessionDuration = currentSession.openedAt
    ? Math.floor((new Date().getTime() - new Date(currentSession.openedAt).getTime()) / (1000 * 60))
    : 0;

  const totals = stats?.totals;
  const maxMethodTotal = Math.max(1, ...(stats?.byMethod || []).map((m) => m.total));
  const activeHours = (stats?.byHour || []).filter((h) => h.count > 0);
  const maxHourTotal = Math.max(1, ...activeHours.map((h) => h.total));
  const maxProductQty = Math.max(1, ...(stats?.topProducts || []).map((p) => p.qty));

  // Exportar el reporte actual a CSV (resumen + métodos + más vendidos).
  const exportCsv = () => {
    if (!stats) return;
    const lines: string[] = [];
    lines.push(`Reporte POS;${RANGE_LABELS[range]}`);
    lines.push('');
    lines.push('Resumen;Valor');
    lines.push(`Ventas;${stats.totals.salesCount}`);
    lines.push(`Total vendido;${stats.totals.totalSold}`);
    lines.push(`Ticket promedio;${stats.totals.avgTicket}`);
    lines.push(`Productos vendidos;${stats.totals.itemsSold}`);
    lines.push('');
    lines.push('Metodo;Ventas;Total');
    stats.byMethod.forEach((m) => lines.push(`${METHOD_LABELS[m.method] || m.method};${m.count};${m.total}`));
    lines.push('');
    lines.push('Producto;Cantidad;Total');
    stats.topProducts.forEach((p) => lines.push(`${p.name};${p.qty};${p.total}`));

    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-pos-${range}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard POS</h1>
          <p className="text-gray-600">Reportes de ventas y resumen de tu caja</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['today', '7d', '30d'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  range === r ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <button
            onClick={exportCsv}
            disabled={!stats || stats.totals.salesCount === 0}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Exportar a CSV"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* KPIs del reporte */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Ventas', value: totals?.salesCount ?? 0, icon: ShoppingCart, iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
          { label: 'Total vendido', value: `$${(totals?.totalSold ?? 0).toLocaleString()}`, icon: DollarSign, iconBg: 'bg-green-100', iconText: 'text-green-600' },
          { label: 'Ticket promedio', value: `$${(totals?.avgTicket ?? 0).toLocaleString()}`, icon: TrendingUp, iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
          { label: 'Productos vendidos', value: totals?.itemsSold ?? 0, icon: Package, iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500">{kpi.label}</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900 mt-1 truncate">
                    {loading ? '—' : kpi.value}
                  </p>
                </div>
                <div className={`w-10 h-10 ${kpi.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${kpi.iconText}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Por método de pago */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" /> Ventas por método
            </h3>
            {(stats?.byMethod.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400">Sin ventas en este periodo.</p>
            ) : (
              <div className="space-y-3">
                {stats!.byMethod.map((m) => (
                  <div key={m.method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{METHOD_LABELS[m.method] || m.method} <span className="text-gray-400">({m.count})</span></span>
                      <span className="font-medium text-gray-900">${m.total.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${METHOD_COLORS[m.method] || 'bg-gray-400'}`} style={{ width: `${(m.total / maxMethodTotal) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Más vendidos */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" /> Más vendidos
            </h3>
            {(stats?.topProducts.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400">Sin productos vendidos.</p>
            ) : (
              <div className="space-y-2.5">
                {stats!.topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-gray-400">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 truncate">{p.name}</span>
                        <span className="font-medium text-gray-900 ml-2 whitespace-nowrap">{p.qty} u · ${p.total.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(p.qty / maxProductQty) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ventas por hora */}
          <div className="bg-white rounded-lg shadow-sm p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-400" /> Ventas por hora
            </h3>
            {activeHours.length === 0 ? (
              <p className="text-sm text-gray-400">Sin ventas en este periodo.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-40">
                {activeHours.map((h) => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center justify-end gap-1 group" title={`${h.hour}:00 — $${h.total.toLocaleString()} (${h.count})`}>
                    <div className="w-full bg-indigo-500 rounded-t group-hover:bg-indigo-600 transition-colors" style={{ height: `${Math.max(4, (h.total / maxHourTotal) * 100)}%` }} />
                    <span className="text-[10px] text-gray-400">{h.hour}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sesión actual + accesos rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500">Tiempo de caja abierta</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {Math.floor(sessionDuration / 60)}h {sessionDuration % 60}m
            </p>
          </div>
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
        </div>

        <button onClick={() => navigate('/pos/sale')} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow text-left flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-indigo-600" /></div>
          <span className="font-semibold text-gray-900">Nueva Venta</span>
        </button>
        <button onClick={() => navigate('/pos/history')} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow text-left flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><Clock className="w-5 h-5 text-blue-600" /></div>
          <span className="font-semibold text-gray-900">Historial</span>
        </button>
        <button onClick={() => navigate('/pos/cash')} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow text-left flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-green-600" /></div>
          <span className="font-semibold text-gray-900">Gestión de Caja</span>
        </button>
      </div>
    </div>
  );
}
