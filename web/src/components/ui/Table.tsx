import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/**
 * Tabla estándar. Se arma con estas piezas (sirven también con @tanstack/react-table):
 *   <TableCard><Table><THead><tr><Th>…</Th></tr></THead><TBody><Tr><Td>…</Td></Tr></TBody></Table></TableCard>
 * Números y dinero: align="right". Estados y acciones: align="center" / "right".
 */
export function TableCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
      {footer && <div className="border-t border-gray-200 px-4 py-3">{footer}</div>}
    </div>
  );
}

export const Table = ({ children }: { children: ReactNode }) => <table className="w-full text-sm">{children}</table>;
export const THead = ({ children }: { children: ReactNode }) => <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>;
export const TBody = ({ children }: { children: ReactNode }) => <tbody className="divide-y divide-gray-100">{children}</tbody>;

type Align = 'left' | 'center' | 'right';
const ALIGN: Record<Align, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };

export function Th({ align = 'left', className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return <th className={`relative px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${ALIGN[align]} ${className}`} {...props} />;
}

export function Tr({ className = '', onClick, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-gray-50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick} {...props} />;
}

export function Td({ align = 'left', className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return <td className={`px-4 py-3 text-gray-700 ${ALIGN[align]} ${className}`} {...props} />;
}

/** Fila de "cargando" o "sin datos" que ocupa todas las columnas. */
export function TableMessage({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-gray-400">{children}</td></tr>;
}
