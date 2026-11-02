import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Barcode, Eye, LayoutGrid, Layers, Package, Palette, Printer, RefreshCw,
  ShoppingBag, Trash2, TrendingDown,
} from 'lucide-react';
import type { ProductVariant } from '../../services/variants.service';
import * as variantsService from '../../services/variants.service';
import * as barcodeService from '../../services/barcode.service';
import {
  Badge, Button, Checkbox, DescriptionList, Dialog, Drawer, EmptyState, FilterBar, IconButton, Page, PageHeader, Pager,
  SearchInput, StatCard, Table, TableCard, TableMessage, Tabs, TBody, Td, Th, THead, Thumb, Tr, toast, useConfirm,
} from '../../components/ui';

type TabType = 'products' | 'templates';
type SortKey = 'sku' | 'stock' | 'finalPrice';

const PAGE_SIZE = 10;
const money = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO');

// Debounce hook para busqueda
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/** Estado del stock de una variante. */
function StockBadge({ v }: { v: ProductVariant }) {
  const isOut = v.stock === 0;
  const isLow = v.stock <= v.minStock;
  return (
    <Badge tone={isOut ? 'red' : isLow ? 'yellow' : 'green'}>
      <span className="tabular-nums">{v.stock}</span>
      {isLow && !isOut && <AlertTriangle className="w-3 h-3" />}
    </Badge>
  );
}

export default function VariantsPage() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<TabType>('products');

  // Estado de datos
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [templateVariants, setTemplateVariants] = useState<ProductVariant[]>([]);

  // Estado de paginación del servidor
  const [productPagination, setProductPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [templatePagination, setTemplatePagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // Estado de carga
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  // Ventanas
  const [showBarcodeModal, setShowBarcodeModal] = useState<ProductVariant | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<ProductVariant | null>(null);
  const [barcodeImageUrl, setBarcodeImageUrl] = useState<string | null>(null);

  // Orden (de la página actual)
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [desc, setDesc] = useState(false);

  // Filtros
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Cargar variantes de productos
  const loadProductVariants = useCallback(async (page = 1, search = '') => {
    setLoadingProducts(true);
    try {
      const result = await variantsService.getProductVariants({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        lowStock: filterLowStock,
      });
      setProductVariants(result.data);
      setProductPagination({
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      });
    } catch (error: any) {
      toast.error('Error al cargar variantes de productos: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingProducts(false);
    }
  }, [filterLowStock]);

  // Cargar variantes de templates
  const loadTemplateVariants = useCallback(async (page = 1, search = '') => {
    setLoadingTemplates(true);
    try {
      const result = await variantsService.getTemplateVariants({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        lowStock: filterLowStock,
      });
      setTemplateVariants(result.data);
      setTemplatePagination({
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      });
      setTemplatesLoaded(true);
    } catch (error: any) {
      toast.error('Error al cargar variantes de plantillas: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoadingTemplates(false);
    }
  }, [filterLowStock]);

  // Cargar al iniciar
  useEffect(() => {
    loadProductVariants(1, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLowStock, debouncedSearch]);

  // Cargar templates cuando se cambia a ese tab
  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplateVariants(1, debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterLowStock, debouncedSearch]);

  // Cambio de página
  const handlePageChange = (newPage: number) => {
    if (activeTab === 'products') loadProductVariants(newPage, debouncedSearch);
    else loadTemplateVariants(newPage, debouncedSearch);
  };

  const handleRefresh = () => {
    if (activeTab === 'products') loadProductVariants(productPagination.page, debouncedSearch);
    else loadTemplateVariants(templatePagination.page, debouncedSearch);
  };

  // Generar codigo de barras para visualizacion
  const handleShowBarcode = async (variant: ProductVariant) => {
    if (!variant.barcode) {
      toast.error('Esta variante no tiene código de barras asignado');
      return;
    }
    try {
      const imageUrl = await barcodeService.getVariantBarcodeImage(variant.id);
      setBarcodeImageUrl(imageUrl);
      setShowBarcodeModal(variant);
    } catch (error: any) {
      toast.error('Error al generar código de barras');
    }
  };

  const closeBarcode = () => {
    setShowBarcodeModal(null);
    if (barcodeImageUrl) URL.revokeObjectURL(barcodeImageUrl);
    setBarcodeImageUrl(null);
  };

  // Asignar codigo de barras
  const handleAssignBarcode = async (variantId: number) => {
    try {
      await barcodeService.assignBarcode(variantId);
      toast.success('Código de barras asignado exitosamente');
      handleRefresh();
    } catch (error: any) {
      toast.error('Error al asignar código de barras: ' + (error.response?.data?.message || error.message));
    }
  };

  // Eliminar variante
  const handleDelete = async (variant: ProductVariant) => {
    if (!(await confirm({ title: '¿Eliminar esta variante?', message: `${variant.product.name} · ${variant.sku}. Esta acción no se puede deshacer.`, tone: 'danger' }))) return;
    try {
      await variantsService.deleteVariant(variant.id);
      toast.success('Variante eliminada exitosamente');
      setShowDetailModal(null);
      handleRefresh();
    } catch (error: any) {
      toast.error('Error al eliminar variante: ' + (error.response?.data?.message || error.message));
    }
  };

  // Datos actuales segun el tab
  const currentVariants = activeTab === 'products' ? productVariants : templateVariants;
  const currentPagination = activeTab === 'products' ? productPagination : templatePagination;
  const isLoading = activeTab === 'products' ? loadingProducts : loadingTemplates;

  // Indicadores: total del servidor; stock bajo y sin stock de la página actual
  const stats = useMemo(() => ({
    total: currentPagination.total,
    lowStock: currentVariants.filter(v => v.stock <= v.minStock).length,
    outOfStock: currentVariants.filter(v => v.stock === 0).length,
  }), [currentVariants, currentPagination.total]);

  const rows = useMemo(() => {
    if (!sortKey) return currentVariants;
    return [...currentVariants].sort((a, b) => {
      const r = sortKey === 'sku' ? a.sku.localeCompare(b.sku) : (a[sortKey] as number) - (b[sortKey] as number);
      return desc ? -r : r;
    });
  }, [currentVariants, sortKey, desc]);

  const toggleSort = (k: SortKey) => { if (sortKey === k) setDesc(d => !d); else { setSortKey(k); setDesc(false); } };
  const SortBtn = ({ k, children }: { k: SortKey; children: string }) => (
    <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 uppercase hover:text-gray-900 ${sortKey === k ? 'text-gray-900' : ''}`}>
      {children}
      {sortKey === k ? (desc ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
    </button>
  );

  const d = showDetailModal;

  return (
    <Page>
      <PageHeader
        icon={LayoutGrid}
        title="Variantes"
        subtitle="Combinaciones de color y talla con su código de barras y stock"
        actions={<Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={handleRefresh}>Actualizar</Button>}
      />

      <Tabs<TabType>
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'products', label: <span className="inline-flex items-center gap-1.5"><ShoppingBag className="w-4 h-4" />Productos</span>, count: productPagination.total },
          { value: 'templates', label: <span className="inline-flex items-center gap-1.5"><Palette className="w-4 h-4" />Plantillas</span>, count: templatesLoaded ? templatePagination.total : undefined },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={Layers} label="Total variantes" value={stats.total} />
        <StatCard icon={AlertTriangle} tone="yellow" label="Stock bajo" value={stats.lowStock} hint="En esta página" />
        <StatCard icon={TrendingDown} tone="red" label="Sin stock" value={stats.outOfStock} hint="En esta página" />
      </div>

      <FilterBar>
        <div className="sm:col-span-2 lg:col-span-3"><SearchInput value={searchInput} onChange={setSearchInput} placeholder="Buscar por SKU, producto, color…" /></div>
        <div className="flex items-center h-10">
          <Checkbox label="Solo stock bajo" checked={filterLowStock} onChange={(e) => setFilterLowStock(e.target.checked)} />
        </div>
      </FilterBar>

      <TableCard footer={currentPagination.total > 0 && (
        <Pager page={currentPagination.page} pageSize={PAGE_SIZE} total={currentPagination.total} onPage={handlePageChange} />
      )}>
        <Table>
          <THead>
            <tr>
              <Th><SortBtn k="sku">SKU</SortBtn></Th>
              <Th>{activeTab === 'products' ? 'Producto' : 'Plantilla'}</Th>
              <Th>Color</Th>
              <Th>Talla</Th>
              <Th>Código de barras</Th>
              <Th align="right"><SortBtn k="stock">Stock</SortBtn></Th>
              <Th align="right"><SortBtn k="finalPrice">Precio</SortBtn></Th>
              <Th align="right">Acciones</Th>
            </tr>
          </THead>
          <TBody>
            {isLoading ? <TableMessage colSpan={8}>Cargando {activeTab === 'products' ? 'productos' : 'plantillas'}…</TableMessage>
              : rows.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState
                    icon={Package}
                    title={searchInput ? 'No se encontraron variantes' : 'No hay variantes'}
                    description={searchInput
                      ? 'Intenta con otra búsqueda'
                      : filterLowStock
                        ? 'Desactiva el filtro de stock bajo para ver todas'
                        : activeTab === 'products'
                          ? 'Genera variantes desde el módulo de Productos (menú ⋮ de cada producto).'
                          : 'Crea plantillas, asocia insumos y genera sus variantes.'}
                  />
                </td></tr>
              ) : rows.map((v) => (
                <Tr key={v.id} onClick={() => setShowDetailModal(v)}>
                  <Td className="font-mono text-xs text-gray-900 whitespace-nowrap">{v.sku}</Td>
                  <Td>
                    <div className="flex items-center gap-3 min-w-[12rem]">
                      <Thumb src={v.product.images?.[0]} alt={v.product.name} />
                      <span className="font-medium text-gray-900 truncate">{v.product.name}</span>
                    </div>
                  </Td>
                  <Td>
                    {v.color ? (
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: v.color.hexCode }} />
                        {v.color.name}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </Td>
                  <Td>{v.size ? <Badge>{v.size.abbreviation}</Badge> : <span className="text-gray-400">—</span>}</Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    {v.barcode ? (
                      <button type="button" onClick={() => handleShowBarcode(v)} className="font-mono text-xs text-app-700 hover:underline">{v.barcode}</button>
                    ) : (
                      <Button size="sm" variant="ghost" icon={<Barcode className="w-4 h-4" />} onClick={() => handleAssignBarcode(v.id)}>Generar</Button>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="inline-flex items-center gap-1">
                      <StockBadge v={v} />
                      {v.product.isTemplate && <span title="Stock calculado desde el insumo"><Package className="w-3.5 h-3.5 text-gray-400" /></span>}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums font-medium text-gray-900 whitespace-nowrap">{money(v.finalPrice)}</Td>
                  <Td align="right" className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <IconButton title="Ver detalles" tone="app" onClick={() => setShowDetailModal(v)}><Eye className="w-4 h-4" /></IconButton>
                    <IconButton title="Eliminar" tone="danger" onClick={() => handleDelete(v)}><Trash2 className="w-4 h-4" /></IconButton>
                  </Td>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableCard>

      {/* Ver código de barras */}
      <Dialog
        open={!!showBarcodeModal}
        onClose={closeBarcode}
        title="Código de barras"
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={closeBarcode}>Cerrar</Button>
            <Button icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Imprimir</Button>
          </>
        )}
      >
        {showBarcodeModal && (
          <div className="space-y-4 text-center">
            <div>
              <p className="text-sm font-medium text-gray-900">{showBarcodeModal.product.name}</p>
              <p className="text-sm text-gray-500 flex items-center justify-center gap-2 mt-1">
                {showBarcodeModal.color && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full border border-gray-200" style={{ backgroundColor: showBarcodeModal.color.hexCode }} />
                    {showBarcodeModal.color.name}
                  </span>
                )}
                {showBarcodeModal.color && showBarcodeModal.size && <span className="text-gray-300">·</span>}
                {showBarcodeModal.size && <span>{showBarcodeModal.size.name}</span>}
              </p>
            </div>
            {barcodeImageUrl && (
              <div className="p-4 border border-gray-200 rounded-lg flex justify-center">
                <img src={barcodeImageUrl} alt="Código de barras" />
              </div>
            )}
            <p className="font-mono text-lg font-semibold text-gray-900">{showBarcodeModal.barcode}</p>
          </div>
        )}
      </Dialog>

      {/* Detalle de la variante */}
      <Drawer
        open={!!d}
        onClose={() => setShowDetailModal(null)}
        title="Detalle de la variante"
        description={d?.sku}
        footer={d && (
          <>
            <Button variant="danger" className="sm:mr-auto" icon={<Trash2 className="w-4 h-4" />} onClick={() => handleDelete(d)}>Eliminar</Button>
            <Button variant="secondary" onClick={() => setShowDetailModal(null)}>Cerrar</Button>
          </>
        )}
      >
        {d && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Thumb src={d.product.images?.[0]} alt={d.product.name} size="lg" />
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{d.product.name}</p>
                {d.product.isTemplate && <Badge tone="blue" className="mt-1"><Palette className="w-3 h-3" />Plantilla</Badge>}
              </div>
            </div>

            <DescriptionList items={[
              {
                label: 'Color',
                value: d.color ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: d.color.hexCode }} />{d.color.name}
                  </span>
                ) : null,
              },
              { label: 'Talla', value: d.size ? `${d.size.name} (${d.size.abbreviation})` : null },
              {
                label: 'Stock',
                value: (
                  <span className="inline-flex items-center gap-2">
                    <StockBadge v={d} /><span className="text-xs text-gray-500">mín. {d.minStock}</span>
                  </span>
                ),
              },
              { label: 'Precio', value: <span className="font-semibold">{money(d.finalPrice)}</span> },
              ...(d.product.isTemplate ? [{ label: 'Origen del stock', value: 'Calculado desde el insumo', full: true }] : []),
            ]} />

            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Código de barras</p>
              {d.barcode ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm text-gray-900">{d.barcode}</span>
                  <Button size="sm" variant="outline" icon={<Barcode className="w-4 h-4" />} onClick={() => { handleShowBarcode(d); setShowDetailModal(null); }}>Ver imagen</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-400">Sin código asignado</span>
                  <Button size="sm" variant="outline" icon={<Barcode className="w-4 h-4" />} onClick={() => { handleAssignBarcode(d.id); setShowDetailModal(null); }}>Generar</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </Page>
  );
}

// Export con nombre para compatibilidad
export { VariantsPage };
