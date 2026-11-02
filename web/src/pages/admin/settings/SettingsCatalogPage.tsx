import { useState, useEffect } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import type { CatalogSettings, CatalogFilterConfig } from '../../../types/settings';
import { PRODUCT_CATEGORIES, PRODUCT_TYPES } from '../../../types/settings';
import { Filter, Save } from 'lucide-react';
import {
  Button, Field, FormActions, NumberInput, Page, PageHeader, SettingsSection, Switch, toast,
} from '../../../components/ui';

const FILTER_OPTIONS: { key: keyof CatalogFilterConfig; label: string; description: string }[] = [
  { key: 'showCategoryFilter', label: 'Filtro por categoría', description: 'Filtrar productos por categoría (Ropa, Accesorios…).' },
  { key: 'showTypeFilter', label: 'Filtro por tipo', description: 'Filtrar por tipo específico (Camisetas, Tazas…).' },
  { key: 'showPriceFilter', label: 'Filtro por precio', description: 'Rango de precio mínimo y máximo.' },
  { key: 'showStockFilter', label: 'Filtro de disponibilidad', description: 'Mostrar solo productos en stock.' },
  { key: 'showFeaturedFilter', label: 'Filtro de destacados', description: 'Mostrar solo productos destacados.' },
];

/** Chip seleccionable (categorías y tipos que aparecen en el filtro). */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`px-3 h-8 rounded-full border text-sm transition-colors ${active ? 'border-app-500 bg-app-50 text-app-700 font-medium' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
      {children}
    </button>
  );
}

/** Filtros y opciones del catálogo de la tienda. */
export const SettingsCatalogPage = () => {
  const { settings, updateCatalogSettings } = useSettings();
  const [form, setForm] = useState<CatalogSettings>(settings.catalog);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(settings.catalog); }, [settings.catalog]);

  const save = async () => {
    setSaving(true);
    try {
      await updateCatalogSettings(form);
      toast.success('Configuración del catálogo guardada');
    } catch {
      toast.error('No se pudo guardar la configuración del catálogo');
    } finally {
      setSaving(false);
    }
  };

  const setFilter = (key: keyof CatalogFilterConfig, value: boolean) => {
    if (typeof form.filters[key] !== 'boolean') return;
    setForm({ ...form, filters: { ...form.filters, [key]: value } });
  };

  const toggleIn = (list: 'enabledCategories' | 'enabledProductTypes', id: string) => {
    const current = form.filters[list];
    const updated = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    setForm({ ...form, filters: { ...form.filters, [list]: updated } });
  };

  return (
    <Page>
      <PageHeader icon={Filter} title="Catálogo" subtitle="Filtros y opciones del catálogo de productos de la tienda" />

      <div>
        <SettingsSection title="Filtros del catálogo" description="Qué filtros pueden usar los clientes al recorrer el catálogo.">
          {FILTER_OPTIONS.map((o) => (
            <Switch key={o.key} checked={form.filters[o.key] as boolean} onChange={(v) => setFilter(o.key, v)} label={o.label} description={o.description} />
          ))}
        </SettingsSection>

        {form.filters.showCategoryFilter && (
          <SettingsSection title="Categorías disponibles" description="Categorías que aparecen en el filtro. Toca para activar o quitar.">
            <div className="flex flex-wrap gap-2">
              {PRODUCT_CATEGORIES.map((c) => (
                <Chip key={c.id} active={form.filters.enabledCategories.includes(c.id)} onClick={() => toggleIn('enabledCategories', c.id)}>{c.label}</Chip>
              ))}
            </div>
          </SettingsSection>
        )}

        {form.filters.showTypeFilter && (
          <SettingsSection title="Tipos de producto disponibles" description="Tipos que aparecen en el filtro, agrupados por categoría.">
            {PRODUCT_CATEGORIES.map((category) => {
              const types = PRODUCT_TYPES.filter((t) => t.category === category.id);
              if (types.length === 0) return null;
              return (
                <div key={category.id}>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{category.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {types.map((t) => (
                      <Chip key={t.id} active={form.filters.enabledProductTypes.includes(t.id)} onClick={() => toggleIn('enabledProductTypes', t.id)}>{t.label}</Chip>
                    ))}
                  </div>
                </div>
              );
            })}
          </SettingsSection>
        )}

        <SettingsSection title="Opciones generales" description="Cómo se presenta la lista de productos.">
          <Field label="Productos por página" htmlFor="cat-per-page" hint="Cantidad inicial de productos a mostrar (4 a 48).">
            <NumberInput id="cat-per-page" min="4" max="48" step="4" className="max-w-[10rem]" value={form.defaultProductsPerPage}
              onChange={(e) => setForm({ ...form, defaultProductsPerPage: parseInt(e.target.value) || 12 })} />
          </Field>
          <Switch checked={form.showSortOptions} onChange={(v) => setForm({ ...form, showSortOptions: v })} label="Selector de ordenamiento" description="Permite ordenar por precio, nombre o novedad." />
        </SettingsSection>
      </div>

      <FormActions sticky>
        <Button variant="secondary" onClick={() => setForm(settings.catalog)} disabled={saving}>Descartar cambios</Button>
        <Button icon={<Save className="w-4 h-4" />} isLoading={saving} onClick={save}>Guardar cambios</Button>
      </FormActions>
    </Page>
  );
};
