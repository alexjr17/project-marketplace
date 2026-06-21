import { useMemo, useState } from 'react';
import { X, Check } from 'lucide-react';
import type { PosVariant } from '../../services/pos.service';

/**
 * Modal para elegir color/talla de un producto con variantes en el POS.
 * Devuelve la variante elegida (con stock) vía onSelect.
 */
export function VariantSelectModal({
  productName,
  variants,
  onSelect,
  onClose,
}: {
  productName: string;
  variants: PosVariant[];
  onSelect: (v: PosVariant) => void;
  onClose: () => void;
}) {
  const hasColors = variants.some((v) => v.colorHex);
  const hasSizes = variants.some((v) => v.size);

  const colors = useMemo(() => {
    const seen = new Map<string, { hex: string; name: string }>();
    variants.forEach((v) => {
      if (v.colorHex && !seen.has(v.colorHex)) seen.set(v.colorHex, { hex: v.colorHex, name: v.colorName || '' });
    });
    return [...seen.values()];
  }, [variants]);

  const sizes = useMemo(() => {
    const seen = new Set<string>();
    variants.forEach((v) => { if (v.size) seen.add(v.size); });
    return [...seen];
  }, [variants]);

  const [color, setColor] = useState<string | null>(hasColors ? null : '');
  const [size, setSize] = useState<string | null>(hasSizes ? null : '');

  const match = variants.find(
    (v) => (v.colorHex || '') === (color || '') && (v.size || '') === (size || '')
  );

  // Stock disponible por talla según el color elegido (para deshabilitar).
  const stockFor = (sz: string) =>
    variants.find((v) => (v.colorHex || '') === (color || '') && (v.size || '') === sz)?.stock ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{productName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {hasColors && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    title={c.name}
                    className={`relative w-9 h-9 rounded-full border transition-all ${
                      color === c.hex ? 'ring-2 ring-offset-1 ring-gray-800' : 'border-gray-300 hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {color === c.hex && <Check className="absolute inset-0 m-auto w-4 h-4 text-white mix-blend-difference" />}
                  </button>
                ))}
              </div>
              {color && <p className="text-xs text-gray-500 mt-1">{colors.find((c) => c.hex === color)?.name}</p>}
            </div>
          )}

          {hasSizes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Talla</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const disabled = hasColors && !!color && stockFor(s) <= 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSize(s)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        size === s
                          ? 'bg-gray-900 text-white'
                          : disabled
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed line-through'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-gray-500">
              {match ? (match.stock > 0 ? `Stock: ${match.stock}` : 'Sin stock') : 'Elige una combinación'}
            </span>
            {match && (
              <span className="font-bold text-gray-900">${match.price.toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => match && onSelect(match)}
            disabled={!match || match.stock <= 0}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  );
}
