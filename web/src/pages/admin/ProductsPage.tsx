import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Grid3x3, Package, PackageX, Pencil, Plus, Printer, Star, Trash2 } from 'lucide-react';
import { useProducts } from '../../context/ProductsContext';
import { ProductForm } from '../../components/admin/ProductForm';
import {
  ActionMenu, Badge, Button, Dialog, EmptyState, FilterBar, IconButton, Page, PageHeader, Pager, SearchInput,
  SelectInput, StatCard, Table, TableCard, TableMessage, TBody, Td, Th, THead, Thumb, Tr, toast, useConfirm,
} from '../../components/ui';
import type { Product } from '../../types/product';
import * as variantsService from '../../services/variants.service';

type ViewMode = 'list' | 'add' | 'edit';
type SortKey = 'name' | 'basePrice' | 'stock';
type StockFilter = 'all' | 'available' | 'low' | 'out';

// Helper para obtener la primera imagen del producto
function getFirstImage(images: any): string {
  if (!images) return '';
  if (Array.isArray(images)) return images[0] || '';
  if (typeof images === 'object') return images.front || images.back || images.side || '';
  return '';
}

const text = (v: unknown) => (typeof v === 'string' ? v : '');
const money = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });
const LOW_STOCK = 20;
// Nombre de la categoría (la API manda categoryName; `category` es el slug)
const catName = (p: Product) => (p as Product & { categoryName?: string }).categoryName || text(p.category);

export const ProductsPage = () => {
  const { products, isLoading, addProduct, updateProduct, deleteProduct } = useProducts();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingVariantsFor, setGeneratingVariantsFor] = useState<Product | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [productsWithVariants, setProductsWithVariants] = useState<Set<string>>(new Set());

  // Filtros, orden y paginación del listado
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [desc, setDesc] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => catName(p)).filter(Boolean))).sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category && catName(p) !== category) return false;
      if (stockFilter === 'available' && p.stock <= 0) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (stockFilter === 'low' && (p.stock <= 0 || p.stock >= LOW_STOCK)) return false;
      if (!t) return true;
      return `${p.name} ${p.sku ?? ''} ${catName(p)} ${p.typeName ?? text(p.type)} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(t);
    });
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const r = sortKey === 'name' ? a.name.localeCompare(b.name, 'es') : (a[sortKey] as number) - (b[sortKey] as number);
        return desc ? -r : r;
      });
    }
    return list;
  }, [products, q, category, stockFilter, sortKey, desc]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const stats = useMemo(() => ({
    total: products.length,
    featured: products.filter((p) => p.featured).length,
    out: products.filter((p) => p.stock === 0).length,
    low: products.filter((p) => p.stock > 0 && p.stock < LOW_STOCK).length,
  }), [products]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setDesc((d) => !d); else { setSortKey(k); setDesc(false); }
  };
  const SortTh = ({ k, children, align }: { k: SortKey; children: string; align?: 'right' }) => (
    <Th align={align}>
      <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 uppercase hover:text-gray-900 ${sortKey === k ? 'text-gray-900' : ''}`}>
        {children}
        {sortKey === k ? (desc ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />}
      </button>
    </Th>
  );

  const handleAddProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setSaving(true);
      await addProduct(productData);
      toast.success('Producto creado correctamente');
      setViewMode('list');
    } catch (error: any) {
      toast.error('No se pudo crear el producto: ' + (error?.response?.data?.message || error?.message || 'error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!selectedProduct) return;
    try {
      setSaving(true);
      await updateProduct(String(selectedProduct.id), productData);
      toast.success('Producto actualizado correctamente');
    } catch (error: any) {
      toast.error('No se pudo actualizar el producto: ' + (error?.response?.data?.message || error?.message || 'error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!(await confirm({ title: `¿Eliminar "${product.name}"?`, message: 'Se elimina el producto del catálogo. Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await deleteProduct(String(product.id));
      toast.success('Producto eliminado correctamente');
      setSelectedProduct(null);
      setViewMode('list');
    } catch (error: any) {
      toast.error('No se pudo eliminar el producto: ' + (error?.response?.data?.message || error?.message || 'error desconocido'));
    }
  };

  const startEdit = (product: Product) => {
    setSelectedProduct(product);
    setViewMode('edit');
  };

  const cancelEdit = () => {
    setViewMode('list');
    setSelectedProduct(null);
  };

  // Verificar qué productos tienen variantes
  const checkProductVariants = async () => {
    const productIds = new Set<string>();
    for (const product of products) {
      try {
        const variants = await variantsService.getVariants({ productId: parseInt(String(product.id)) });
        if (variants.length > 0) {
          productIds.add(String(product.id));
        }
      } catch (error) {
        console.error(`Error checking variants for product ${product.id}:`, error);
      }
    }
    setProductsWithVariants(productIds);
  };

  // Cargar información de variantes al montar o cuando cambian los productos
  useEffect(() => {
    if (products.length > 0 && viewMode === 'list') {
      checkProductVariants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, viewMode]);

  const handleGenerateVariants = async () => {
    if (!generatingVariantsFor) return;

    try {
      setIsGenerating(true);
      const result = await variantsService.generateVariantsForProduct(
        parseInt(String(generatingVariantsFor.id)),
        0 // Stock inicial
      );

      // La API devuelve la lista de variantes creadas.
      const created = Array.isArray(result.created) ? result.created.length : Number(result.created) || 0;
      if (created > 0) {
        toast.success(`${created} variantes creadas exitosamente`);
        setProductsWithVariants(prev => new Set(prev).add(String(generatingVariantsFor.id)));
      } else if (!result.errors?.length) {
        toast.info('No había variantes nuevas para crear');
      }

      if (result.errors && result.errors.length > 0) {
        toast.error(`${result.errors.length} errores al crear variantes`);
      }

      setGeneratingVariantsFor(null);
    } catch (error: any) {
      toast.error('Error al generar variantes: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintBarcodes = (product: Product) => {
    navigate(`/admin-panel/barcodes/print/${product.id}`);
  };

  if (viewMode === 'add') {
    return (
      <Page>
        <PageHeader icon={Package} title="Nuevo producto" subtitle="Completa la información del producto"
          actions={<Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={cancelEdit}>Volver a productos</Button>} />
        <ProductForm onSubmit={handleAddProduct} onCancel={cancelEdit} saving={saving} />
      </Page>
    );
  }

  if (viewMode === 'edit' && selectedProduct) {
    return (
      <Page>
        <PageHeader icon={Package} title={selectedProduct.name} subtitle="Editar producto"
          actions={<Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={cancelEdit}>Volver a productos</Button>} />
        <ProductForm
          key={String(selectedProduct.id)}
          product={selectedProduct}
          onSubmit={handleEditProduct}
          onCancel={cancelEdit}
          onDelete={() => handleDeleteProduct(selectedProduct)}
          saving={saving}
        />
      </Page>
    );
  }

  const hasFilters = !!(q || category || stockFilter !== 'all');

  return (
    <Page>
      <PageHeader
        icon={Package}
        title="Productos"
        subtitle="Gestiona tu catálogo de productos"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setViewMode('add')}>Nuevo producto</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Productos" value={stats.total} />
        <StatCard icon={Star} tone="blue" label="Destacados" value={stats.featured} />
        <StatCard icon={AlertTriangle} tone="yellow" label="Stock bajo" value={stats.low} hint={`Menos de ${LOW_STOCK} unidades`} />
        <StatCard icon={PackageX} tone="red" label="Agotados" value={stats.out} />
      </div>

      <FilterBar>
        <div className="sm:col-span-2"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Buscar por nombre, SKU, tipo o etiqueta…" /></div>
        <SelectInput value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectInput>
        <SelectInput value={stockFilter} onChange={(e) => { setStockFilter(e.target.value as StockFilter); setPage(1); }} aria-label="Stock">
          <option value="all">Todo el stock</option>
          <option value="available">Disponibles</option>
          <option value="low">Stock bajo</option>
          <option value="out">Agotados</option>
        </SelectInput>
      </FilterBar>

      <TableCard footer={filtered.length > 0 && (
        <Pager page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
      )}>
        <Table>
          <THead>
            <tr>
              <SortTh k="name">Producto</SortTh>
              <Th>Tipo</Th>
              <SortTh k="basePrice" align="right">Precio</SortTh>
              <SortTh k="stock" align="right">Stock</SortTh>
              <Th align="center">Estado</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </THead>
          <TBody>
            {isLoading && products.length === 0 ? <TableMessage colSpan={6}>Cargando productos…</TableMessage>
              : filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  {hasFilters
                    ? <EmptyState icon={Package} title="No se encontraron productos" description="Prueba con otra búsqueda o quita los filtros." />
                    : <EmptyState icon={Package} title="No hay productos" description="Comienza agregando tu primer producto al catálogo."
                        action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setViewMode('add')}>Nuevo producto</Button>} />}
                </td></tr>
              ) : pageRows.map((product) => {
                const hasVariants = productsWithVariants.has(String(product.id));
                return (
                  <Tr key={product.id} onClick={() => startEdit(product)}>
                    <Td>
                      <div className="flex items-center gap-3 min-w-[14rem]">
                        <Thumb src={getFirstImage(product.images)} alt={product.name} size="lg" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{product.name}</p>
                          <p className="text-xs text-gray-500 truncate">{catName(product) || '—'}{product.sku ? ` · ${product.sku}` : ''}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{product.typeName || text(product.type) || '—'}</Td>
                    <Td align="right" className="tabular-nums whitespace-nowrap font-medium text-gray-900">{money(product.basePrice)}</Td>
                    <Td align="right" className={`tabular-nums ${product.stock === 0 ? 'text-red-600 font-medium' : product.stock < LOW_STOCK ? 'text-amber-600 font-medium' : ''}`}>{product.stock}</Td>
                    <Td align="center">
                      <div className="flex flex-wrap justify-center gap-1">
                        <Badge tone={product.stock > 0 ? 'green' : 'red'}>{product.stock > 0 ? 'Disponible' : 'Agotado'}</Badge>
                        {product.featured && <Badge tone="blue">Destacado</Badge>}
                      </div>
                    </Td>
                    <Td align="right" className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <IconButton title="Editar" tone="app" onClick={() => startEdit(product)}><Pencil className="w-4 h-4" /></IconButton>
                      <ActionMenu items={[
                        { label: 'Imprimir códigos de barras', icon: <Printer className="w-4 h-4" />, onClick: () => handlePrintBarcodes(product), hidden: !hasVariants },
                        { label: 'Generar variantes', icon: <Grid3x3 className="w-4 h-4" />, onClick: () => setGeneratingVariantsFor(product), hidden: hasVariants },
                        { label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleDeleteProduct(product), danger: true },
                      ]} />
                    </Td>
                  </Tr>
                );
              })}
          </TBody>
        </Table>
      </TableCard>

      <Dialog
        open={!!generatingVariantsFor}
        onClose={() => !isGenerating && setGeneratingVariantsFor(null)}
        title="Generar variantes"
        description={generatingVariantsFor?.name}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setGeneratingVariantsFor(null)} disabled={isGenerating}>Cancelar</Button>
            <Button onClick={handleGenerateVariants} isLoading={isGenerating} icon={<Grid3x3 className="w-4 h-4" />}>Generar variantes</Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm text-gray-600">
          <p>Se generarán todas las combinaciones de colores y tallas configuradas para este producto, con códigos de barras únicos.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cada variante tendrá un código de barras EAN-13 único.</li>
            <li>El stock inicial será 0 (puedes ajustarlo después).</li>
            <li>Las variantes existentes no se duplicarán.</li>
          </ul>
        </div>
      </Dialog>
    </Page>
  );
};
