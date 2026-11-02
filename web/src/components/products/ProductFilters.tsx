import { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button, Checkbox, Field, NumberInput } from '../ui';
import { useSettings } from '../../context/SettingsContext';
import { productsService } from '../../services/products.service';
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
  /** Texto del buscador (?search=). Lo maneja CatalogPage, no el panel de filtros. */
  search?: string;
  /** Solo ofertas (?onSale=1). Lo maneja CatalogPage. */
  onSale?: boolean;
}

interface ProductFiltersProps {
  onFilterChange: (filters: FilterValues) => void;
  initialFilters?: FilterValues;
}

export const ProductFilters = ({ onFilterChange, initialFilters = {} }: ProductFiltersProps) => {
  const { settings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});
  const [dbCategories, setDbCategories] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [dbTypes, setDbTypes] = useState<Array<{ id: number; name: string; slug: string; categoryId: number | null; categorySlug: string | null }>>([]);

  const catalogConfig = settings.catalog?.filters;

  // Cargar categorías y tipos desde la base de datos
  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const [categories, types] = await Promise.all([
          productsService.getCategories(),
          productsService.getTypes(),
        ]);
        setDbCategories(categories);
        setDbTypes(types);
      } catch (error) {
        console.error('Error loading filter data:', error);
      }
    };

    loadFiltersData();
  }, []);

  // Filtrar categorías habilitadas (usar las de la BD)
  const enabledCategories = useMemo(() => {
    if (!catalogConfig?.showCategoryFilter) return [];
    if (dbCategories.length === 0) return [];

    // Mostrar todas las categorías activas de la BD
    return dbCategories.map(cat => ({
      id: cat.slug, // Usar el slug como id para filtrar
      label: cat.name, // Usar el nombre de la BD
    }));
  }, [catalogConfig, dbCategories]);

  // Filtrar tipos habilitados (usar los de la BD)
  const enabledTypes = useMemo(() => {
    if (!catalogConfig?.showTypeFilter) return [];
    if (dbTypes.length === 0) return [];

    // Mostrar todos los tipos activos de la BD
    return dbTypes.map(type => ({
      id: type.slug, // Usar el slug como id para filtrar
      label: type.name, // Usar el nombre de la BD
    }));
  }, [catalogConfig, dbTypes]);

  // Actualizar filtros cuando cambien los initialFilters (desde URL)
  useEffect(() => {
    // Solo actualizar si los filtros realmente cambiaron
    const filtersChanged = JSON.stringify(filters) !== JSON.stringify(initialFilters);
    if (filtersChanged) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const handleFilterChange = (key: keyof FilterValues, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilter = (key: keyof FilterValues) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  const activeFiltersCount = Object.keys(filters).length;

  // Verificar si hay algún filtro habilitado
  const hasAnyFilter =
    catalogConfig?.showCategoryFilter ||
    catalogConfig?.showTypeFilter ||
    catalogConfig?.showPriceFilter ||
    catalogConfig?.showStockFilter ||
    catalogConfig?.showFeaturedFilter;

  if (!hasAnyFilter) {
    return null;
  }

  const optionClass = (active: boolean) =>
    `flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm cursor-pointer transition-colors ${
      active ? 'bg-app-50 text-app-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:sticky lg:top-24">
      {/* Encabezado (en celular abre y cierra los filtros) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full lg:cursor-default flex items-center justify-between px-4 py-3 border-b border-gray-100"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <SlidersHorizontal className="w-4 h-4 text-gray-500" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="bg-app-600 text-white text-xs font-semibold min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </span>
        <span className="text-xs text-gray-500 lg:hidden">{isOpen ? 'Ocultar' : 'Mostrar'}</span>
      </button>

      <div className={`p-4 space-y-5 ${isOpen ? 'block' : 'hidden'} lg:block`}>
        {/* Categoría */}
        {catalogConfig?.showCategoryFilter && enabledCategories.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Categoría</p>
              {filters.category && (
                <button type="button" onClick={() => clearFilter('category')} className="text-xs text-app-700 hover:underline">
                  Limpiar
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {enabledCategories.map((category) => (
                <label key={category.id} className={optionClass(filters.category === category.id)}>
                  <input
                    type="radio"
                    name="category"
                    value={category.id}
                    checked={filters.category === category.id}
                    onChange={(e) => handleFilterChange('category', e.target.value as ProductCategory)}
                    className="w-4 h-4 border-gray-300 text-app-600 focus:ring-app-500"
                  />
                  {category.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Tipo de producto */}
        {catalogConfig?.showTypeFilter && enabledTypes.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tipo de producto</p>
            <div className="space-y-0.5">
              {enabledTypes.map((type) => (
                <label key={type.id} className={optionClass(filters.type === type.id)}>
                  <input
                    type="checkbox"
                    checked={filters.type === type.id}
                    onChange={(e) => handleFilterChange('type', e.target.checked ? (type.id as ProductTypeSlug) : undefined)}
                    className="w-4 h-4 rounded border-gray-300 text-app-600 focus:ring-app-500"
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Rango de precio */}
        {catalogConfig?.showPriceFilter && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Precio</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label={<span className="text-xs text-gray-500 font-normal">Mínimo</span>}>
                <NumberInput
                  min="0"
                  placeholder="0"
                  value={filters.minPrice || ''}
                  onChange={(e) => handleFilterChange('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                />
              </Field>
              <Field label={<span className="text-xs text-gray-500 font-normal">Máximo</span>}>
                <NumberInput
                  min="0"
                  placeholder="Sin límite"
                  value={filters.maxPrice || ''}
                  onChange={(e) => handleFilterChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Disponibilidad y destacados */}
        {(catalogConfig?.showStockFilter || catalogConfig?.showFeaturedFilter) && (
          <div className="space-y-2">
            {catalogConfig?.showStockFilter && (
              <Checkbox
                label="Solo productos en stock"
                checked={filters.inStock || false}
                onChange={(e) => handleFilterChange('inStock', e.target.checked || undefined)}
              />
            )}
            {catalogConfig?.showFeaturedFilter && (
              <div>
                <Checkbox
                  label="Solo destacados"
                  checked={filters.featured || false}
                  onChange={(e) => handleFilterChange('featured', e.target.checked || undefined)}
                />
              </div>
            )}
          </div>
        )}

        {activeFiltersCount > 0 && (
          <Button variant="secondary" fullWidth icon={<X className="w-4 h-4" />} onClick={clearAllFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
};
