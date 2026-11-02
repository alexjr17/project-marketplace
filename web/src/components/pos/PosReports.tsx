import { useEffect, useState } from 'react';
import * as posService from '../../services/pos.service';
import type { PosStats } from '../../services/pos.service';
import { DollarSign, TrendingUp, Package, Download, BarChart3, ShoppingCart } from 'lucide-react';
import { Button, Card, CardTitle, RadioGroup, Spinner, StatCard } from '../ui';

type Range = 'today' | '7d' | '30d';

const RANGE_LABELS: Record<Range, string> = { today: 'Hoy', '7d': '7 días', '30d': '30 días' };
const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mixed: 'Mixto', debe: 'Fiado',
};
const METHOD_COLORS: Record<string, string> = {
  cash: 'bg-green-500', card: 'bg-blue-500', transfer: 'bg-cyan-500', mixed: 'bg-gray-500', debe: 'bg-amber-500',
};

/** Bloque de gráficas y reporte del POS (se usa dentro de la vista de Caja). */
export default function PosReports() {
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

  const totals = stats?.totals;
  const maxMethodTotal = Math.max(1, ...(stats?.byMethod || []).map((m) => m.total));
  const activeHours = (stats?.byHour || []).filter((h) => h.count > 0);
  const maxHourTotal = Math.max(1, ...activeHours.map((h) => h.total));
  const maxProductQty = Math.max(1, ...(stats?.topProducts || []).map((p) => p.qty));

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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-app-600" /> Reportes de ventas
        </h2>
        <div className="flex items-center gap-2">
          <RadioGroup
            variant="segmented"
            value={range}
            onChange={setRange}
            options={(['today', '7d', '30d'] as Range[]).map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
          />
          <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={exportCsv} disabled={!stats || stats.totals.salesCount === 0} title="Exportar a CSV">
            CSV
          </Button>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ShoppingCart} label="Ventas" value={loading ? '—' : totals?.salesCount ?? 0} />
        <StatCard icon={DollarSign} tone="green" label="Total vendido" value={loading ? '—' : `$${(totals?.totalSold ?? 0).toLocaleString()}`} />
        <StatCard icon={TrendingUp} tone="blue" label="Ticket promedio" value={loading ? '—' : `$${(totals?.avgTicket ?? 0).toLocaleString()}`} />
        <StatCard icon={Package} tone="gray" label="Productos vendidos" value={loading ? '—' : totals?.itemsSold ?? 0} />
      </div>

      {loading ? (
        <Spinner label="Cargando reporte…" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Por método */}
          <Card>
            <CardTitle icon={DollarSign}>Ventas por método</CardTitle>
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
          </Card>

          {/* Más vendidos */}
          <Card>
            <CardTitle icon={Package}>Más vendidos</CardTitle>
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
                        <div className="h-full bg-app-500 rounded-full" style={{ width: `${(p.qty / maxProductQty) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Por hora */}
          <div className="lg:col-span-2">
            <Card>
              <CardTitle icon={BarChart3}>Ventas por hora</CardTitle>
              {activeHours.length === 0 ? (
                <p className="text-sm text-gray-400">Sin ventas en este periodo.</p>
              ) : (
                <div className="flex items-end gap-1.5 h-40">
                  {activeHours.map((h) => (
                    <div key={h.hour} className="flex-1 h-full flex flex-col items-center justify-end gap-1 group" title={`${h.hour}:00 — $${h.total.toLocaleString()} (${h.count})`}>
                      <div className="w-full bg-app-500 rounded-t group-hover:bg-app-600 transition-colors" style={{ height: `${Math.max(4, (h.total / maxHourTotal) * 100)}%` }} />
                      <span className="text-[10px] text-gray-400">{h.hour}h</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
