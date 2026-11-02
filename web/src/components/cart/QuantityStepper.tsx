import { Minus, Plus } from 'lucide-react';

/** Control de cantidad (− n +) de la tienda: carrito, detalle de producto. */
export function QuantityStepper({ value, onDecrease, onIncrease, canDecrease = true, canIncrease = true, disabled = false, size = 'md' }: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease?: boolean;
  canIncrease?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const h = size === 'sm' ? 'h-8' : 'h-10';
  const btn = `${h} w-9 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`;
  return (
    <div className={`inline-flex items-center rounded-lg border border-gray-300 bg-white ${disabled ? 'opacity-50' : ''}`}>
      <button type="button" onClick={onDecrease} disabled={disabled || !canDecrease} className={`${btn} rounded-l-lg`} aria-label="Disminuir cantidad" title="Disminuir cantidad">
        <Minus className="w-4 h-4" />
      </button>
      <span className={`${h} min-w-[2.5rem] px-2 inline-flex items-center justify-center border-x border-gray-200 text-sm font-semibold text-gray-900 tabular-nums`}>
        {value}
      </span>
      <button type="button" onClick={onIncrease} disabled={disabled || !canIncrease} className={`${btn} rounded-r-lg`} aria-label="Aumentar cantidad" title="Aumentar cantidad">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
