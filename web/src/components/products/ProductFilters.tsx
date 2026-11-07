import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Checkbox, NumberInput } from '../ui';
import { useSettings } from '../../context/SettingsContext';
import { useCatalogs } from '../../context/CatalogsContext';
import type { ProductCategory, ProductTypeSlug } from '../../types/product';

export interface FilterValues {
  category?: ProductCategory;
  type?: ProductTypeSlug;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  bestsellers?: boolean;
  newArrivals?: boolean;
  /** Texto del buscador (?search=, lo escribe el buscador del encabezado). */
  search?: string;
  /** Solo ofertas (?onSale=1). */
  onSale?: boolean;
  /** Temática: etiqueta de los productos (?tag=anime). La pone la portada o el chip. */
  tag?: string;
}

interface ProductFiltersProps {
  /** Filtros actuales (los de la URL). */
  value: FilterValues;
  /** Nuevos filtros: la página los escribe en la URL. */
  onChange: (filters: FilterValues) => void;
}

/** Grupo plegable del panel de filtros. */
function FilterGroup({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-gray-100 last:border-b-0 py-3 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800"
      >
        {title}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </section>
  );
}

/** Opción de una lista de selección única (categoría, tipo). */
function OptionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors ${
        active ? 'bg-app-50 text-app-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="truncate">{children}</span>
      {active && <Check className="w-4 h-4 flex-shrink-0" />}
    </button>
  );
}

/** Rango de precio: se aplica al salir del campo, con Enter o tras una pausa al escribir. */
function PriceRange({ min, max, onApply }: { min?: number; max?: number; onApply: (min?: number, max?: number) => void }) {
  const [draft, setDraft] = useState({ min: min?.toString() ?? '', max: max?.toString() ?? '' });
  useEffect(() => setDraft({ min: min?.toString() ?? '', max: max?.toString() ?? '' }), [min, max]);

  const parse = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.round(Number(v))) || 0);
  const apply = () => {
    const nMin = parse(draft.min);
    const nMax = parse(draft.max);
    if (nMin !== min || nMax !== max) onApply(nMin, nMax);
  };

  useEffect(() => {
    const t = setTimeout(apply, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const onKey = (e: React.KeyboardEvent) => e.key === 'Enter' && apply();
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-gray-500">
        Mínimo
        <NumberInput min="0" placeholder="0" value={draft.min} onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))} onBlur={apply} onKeyDown={onKey} className="mt-1" />
      </label>
      <label className="text-xs text-gray-500">
        Máximo
        <NumberInput min="0" placeholder="Sin límite" value={draft.max} onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))} onBlur={apply} onKeyDown={onKey} className="mt-1" />
      </label>
    </div>
  );
}

/**
 * Panel de filtros del catálogo (controlado). Categorías y tipos salen del catálogo ya
 * cargado (CatalogsContext), sin pedirlos otra vez. Los tipos se acotan a la categoría
 * elegida. Lo usa el catálogo en la columna lateral (escritorio) y en un Drawer (celular).
 */
export const ProductFilters = ({ value, onChange }: ProductFiltersProps) => {
  const { settings } = useSettings();
  const { categories, productTypes } = useCatalogs();
  const config = settings.catalog?.filters;

  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const visibleTypes = useMemo(
    () => productTypes.filter((t) => t.isActive && (!value.category || !t.categorySlug || t.categorySlug === value.category)),
    [productTypes, value.category],
  );

  const set = (patch: Partial<FilterValues>) => {
    const next = { ...value, ...patch };
    (Object.keys(patch) as (keyof FilterValues)[]).forEach((k) => patch[k] === undefined && delete next[k]);
    onChange(next);
  };

  const pickCategory = (slug?: string) => {
    // El tipo elegido solo se conserva si pertenece a la nueva categoría.
    const type = productTypes.find((t) => t.slug === value.type);
    const keepType = !slug || !type?.categorySlug || type.categorySlug === slug;
    set({ category: slug as ProductCategory | undefined, type: keepType ? value.type : undefined });
  };

  return (
    <div>
      {config?.showCategoryFilter !== false && activeCategories.length > 0 && (
        <FilterGroup title="Categoría">
          <div className="space-y-0.5">
            <OptionButton active={!value.category} onClick={() => pickCategory(undefined)}>Todas</OptionButton>
            {activeCategories.map((c) => (
              <OptionButton key={c.id} active={value.category === c.slug} onClick={() => pickCategory(value.category === c.slug ? undefined : c.slug)}>
                {c.name}
              </OptionButton>
            ))}
          </div>
        </FilterGroup>
      )}

      {config?.showTypeFilter !== false && visibleTypes.length > 0 && (
        <FilterGroup title="Tipo de producto" defaultOpen={Boolean(value.category || value.type)}>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {visibleTypes.map((t) => (
              <OptionButton
                key={t.id}
                active={value.type === t.slug}
                onClick={() => set({ type: value.type === t.slug ? undefined : (t.slug as ProductTypeSlug) })}
              >
                {t.name}
              </OptionButton>
            ))}
          </div>
        </FilterGroup>
      )}

      {config?.showPriceFilter !== false && (
        <FilterGroup title="Precio">
          <PriceRange min={value.minPrice} max={value.maxPrice} onApply={(minPrice, maxPrice) => set({ minPrice, maxPrice })} />
        </FilterGroup>
      )}

      <FilterGroup title="Mostrar">
        <div className="flex flex-col items-start gap-2.5">
          <Checkbox label="En oferta" checked={!!value.onSale} onChange={(e) => set({ onSale: e.target.checked || undefined })} />
          {config?.showStockFilter !== false && (
            <Checkbox label="Solo disponibles" checked={!!value.inStock} onChange={(e) => set({ inStock: e.target.checked || undefined })} />
          )}
          {config?.showFeaturedFilter !== false && (
            <Checkbox label="Solo destacados" checked={!!value.featured} onChange={(e) => set({ featured: e.target.checked || undefined })} />
          )}
        </div>
      </FilterGroup>
    </div>
  );
};
