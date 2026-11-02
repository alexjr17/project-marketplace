import type { ReactNode } from 'react';

export interface MatrixSize { id: number; label: string }
export interface MatrixColor { id: number; name: string; hex?: string }

/**
 * Matriz de cantidades talla × color (solo lectura), con totales opcionales.
 * Se usa en Inventario, Pedidos, Despachos y Órdenes. Números a la derecha y tabulares.
 * `cell` permite pintar algo distinto a la cantidad (ej. "3 / 5").
 */
export default function QtyMatrix({ sizes, colors, get, totals = false, cell, corner = 'Talla \\ Color' }: {
  sizes: MatrixSize[];
  colors: MatrixColor[];
  get: (sizeId: number, colorId: number) => number;
  totals?: boolean;
  cell?: (sizeId: number, colorId: number, qty: number) => ReactNode;
  corner?: ReactNode;
}) {
  const rowTotal = (sid: number) => colors.reduce((t, c) => t + get(sid, c.id), 0);
  const colTotal = (cid: number) => sizes.reduce((t, s) => t + get(s.id, cid), 0);
  const grand = sizes.reduce((t, s) => t + rowTotal(s.id), 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap">{corner}</th>
            {colors.map((c) => (
              <th key={c.id} className="px-3 py-2 text-right text-xs font-medium text-gray-700 min-w-[80px] whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">{c.hex && <span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />}{c.name}</span>
              </th>
            ))}
            {totals && <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Total</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sizes.map((s) => (
            <tr key={s.id}>
              <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-gray-900">{s.label}</td>
              {colors.map((c) => {
                const q = get(s.id, c.id);
                return <td key={c.id} className={`px-3 py-2 text-right tabular-nums ${q ? 'text-gray-700' : 'text-gray-300'}`}>{cell ? cell(s.id, c.id, q) : (q || '—')}</td>;
              })}
              {totals && <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 bg-gray-50">{rowTotal(s.id)}</td>}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot className="border-t border-gray-200 bg-gray-50">
            <tr>
              <td className="sticky left-0 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Total</td>
              {colors.map((c) => <td key={c.id} className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{colTotal(c.id)}</td>)}
              <td className="px-3 py-2 text-right font-bold tabular-nums text-gray-900">{grand}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
