import { useEffect, useMemo, useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import type { PosVariant } from '../../services/pos.service';
import { Badge, Button, Dialog } from '../ui';

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

  // Cuando se elige una combinación completa con stock, se agrega solo (rápido).
  const colorReady = !hasColors || color !== null;
  const sizeReady = !hasSizes || size !== null;
  useEffect(() => {
    if (colorReady && sizeReady && match && match.stock > 0) {
      onSelect(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, size]);

  // Stock disponible por talla según el color elegido (para deshabilitar).
  const stockFor = (sz: string) =>
    variants.find((v) => (v.colorHex || '') === (color || '') && (v.size || '') === sz)?.stock ?? 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={productName}
      description="Elige la variante para agregarla al carrito"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={onClose}>Cancelar</Button>
          <Button size="lg" icon={<ShoppingCart className="w-4 h-4" />} onClick={() => match && onSelect(match)} disabled={!match || match.stock <= 0}>
            Agregar al carrito
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {hasColors && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Color {color && <span className="font-normal text-gray-500">· {colors.find((c) => c.hex === color)?.name}</span>}
            </p>
            <div className="flex flex-wrap gap-2.5">
              {colors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  aria-label={c.name}
                  className={`relative w-11 h-11 rounded-full border border-gray-300 transition-shadow ${
                    color === c.hex ? 'ring-2 ring-offset-2 ring-app-600' : 'hover:ring-2 hover:ring-offset-1 hover:ring-gray-300'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {color === c.hex && <Check className="absolute inset-0 m-auto w-4 h-4 text-white mix-blend-difference" />}
                </button>
              ))}
            </div>
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
                    className={`min-w-[3rem] h-11 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      size === s
                        ? 'border-app-600 bg-app-600 text-white'
                        : disabled
                          ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-app-400 hover:bg-app-50'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          {match
            ? <Badge tone={match.stock > 0 ? 'green' : 'red'}>{match.stock > 0 ? `Stock: ${match.stock}` : 'Sin stock'}</Badge>
            : <span className="text-sm text-gray-500">Elige una combinación</span>}
          {match && <span className="text-lg font-bold text-gray-900">${match.price.toLocaleString()}</span>}
        </div>
      </div>
    </Dialog>
  );
}
