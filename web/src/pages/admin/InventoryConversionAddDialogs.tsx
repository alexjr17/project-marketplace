import { Check } from 'lucide-react';
import { Button, Dialog, Field, NumberInput, SearchInput } from '../../components/ui';
import type { InputVariant } from '../../services/inputs.service';
import type { ProductVariant } from '../../services/variants.service';
import { formatCOP } from './InventoryConversionShared';

export interface InputBase {
  id: number;
  code: string;
  name: string;
  unitOfMeasure: string;
  hasVariants: boolean;
  variants?: InputVariant[];
}

export interface InputVariantOption {
  id: number; // id de la variante
  sku: string;
  colorName: string | null;
  sizeName: string | null;
  currentStock: number;
  unitCost: number;
}

/** Nombre, color y talla de una variante de producto (el API devuelve `product`, `color` y `size`). */
export const variantLabel = (v: ProductVariant) => {
  const legacy = v as ProductVariant & { productName?: string; colorName?: string | null; sizeName?: string | null };
  return {
    product: v.product?.name ?? legacy.productName ?? '',
    color: v.color?.name ?? legacy.colorName ?? null,
    size: v.size?.name ?? legacy.sizeName ?? null,
  };
};

const rowCls = (selected: boolean) =>
  `w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${selected ? 'bg-app-50' : 'hover:bg-gray-50'}`;

/** Agregar un insumo a consumir: buscar insumo → elegir variante → cantidad. */
export function AddInputDialog({ open, onClose, inputs, search, onSearch, base, onBase, variant, onVariant, quantity, onQuantity, showCost, saving, onConfirm }: {
  open: boolean; onClose: () => void;
  inputs: InputBase[]; search: string; onSearch: (v: string) => void;
  base: InputBase | null; onBase: (b: InputBase | null) => void;
  variant: InputVariantOption | null; onVariant: (v: InputVariantOption | null) => void;
  quantity: number; onQuantity: (n: number) => void;
  showCost: boolean; saving: boolean; onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Agregar insumo"
      description={base ? 'Elige la variante y la cantidad a consumir.' : 'Busca el insumo que se va a consumir.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button isLoading={saving} disabled={!variant || quantity <= 0} onClick={onConfirm}>Agregar</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!base && (
          <>
            <SearchInput value={search} onChange={onSearch} placeholder="Buscar por código o nombre…" />
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {inputs.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">No se encontraron insumos</p>
              ) : inputs.map((input) => (
                <button key={input.id} type="button" onClick={() => onBase(input)} className={rowCls(false)}>
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900">{input.name}</span>
                    <span className="block text-xs text-gray-500">{input.code} · {input.unitOfMeasure}{input.hasVariants && ' · con variantes'}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {base && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{base.name}</p>
              <p className="text-xs text-gray-500">{base.code} · {base.unitOfMeasure}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { onBase(null); onVariant(null); }}>Cambiar</Button>
          </div>
        )}

        {base && base.hasVariants && base.variants && base.variants.length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {base.variants.map((v) => {
              const selected = variant?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onVariant({
                    id: v.id,
                    sku: v.sku,
                    colorName: v.color?.name || null,
                    sizeName: v.size?.name || null,
                    currentStock: Number(v.currentStock),
                    unitCost: Number(v.unitCost),
                  })}
                  className={rowCls(selected)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-gray-900">{v.color?.name || 'Sin color'}{v.size?.name && ` · ${v.size.name}`}</span>
                    <span className="block text-xs text-gray-500">
                      {v.sku} · Stock {Number(v.currentStock)} {base.unitOfMeasure}
                      {showCost && ` · ${formatCOP(Number(v.unitCost))}/${base.unitOfMeasure}`}
                    </span>
                  </span>
                  {selected && <Check className="w-4 h-4 text-app-600" />}
                </button>
              );
            })}
          </div>
        )}

        {variant && (
          <Field label="Cantidad a consumir" hint={`Máximo ${variant.currentStock} ${base?.unitOfMeasure ?? ''}`}>
            <NumberInput value={quantity} onChange={(e) => onQuantity(Number(e.target.value))} min={0.01} max={variant.currentStock} step={0.01} suffix={base?.unitOfMeasure} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

/** Agregar un producto a generar: buscar variante → cantidad. */
export function AddOutputDialog({ open, onClose, variants, search, onSearch, selected, onSelect, quantity, onQuantity, saving, onConfirm }: {
  open: boolean; onClose: () => void;
  variants: ProductVariant[]; search: string; onSearch: (v: string) => void;
  selected: ProductVariant | null; onSelect: (v: ProductVariant) => void;
  quantity: number; onQuantity: (n: number) => void;
  saving: boolean; onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Agregar producto"
      description="Busca la variante del producto que se va a generar."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button isLoading={saving} disabled={!selected || quantity <= 0} onClick={onConfirm}>Agregar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <SearchInput value={search} onChange={onSearch} placeholder="Buscar por SKU, nombre, color o talla…" />
        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
          {variants.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 text-center">No se encontraron variantes</p>
          ) : variants.map((v) => {
            const l = variantLabel(v);
            const isSel = selected?.id === v.id;
            return (
              <button key={v.id} type="button" onClick={() => onSelect(v)} className={rowCls(isSel)}>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900">{l.product}</span>
                  <span className="block text-xs text-gray-500">
                    {v.sku}{l.color && ` · ${l.color}`}{l.size && ` · ${l.size}`} · Stock {v.stock}
                  </span>
                </span>
                {isSel && <Check className="w-4 h-4 text-app-600" />}
              </button>
            );
          })}
        </div>
        {selected && (
          <Field label="Cantidad a generar" hint={`${variantLabel(selected).product} (${selected.sku})`}>
            <NumberInput value={quantity} onChange={(e) => onQuantity(Number(e.target.value))} min={1} suffix="unid." />
          </Field>
        )}
      </div>
    </Dialog>
  );
}
