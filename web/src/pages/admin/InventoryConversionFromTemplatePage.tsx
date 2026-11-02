import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRightLeft, Shirt, Package, Check } from 'lucide-react';
import {
  Page, PageHeader, Button, Badge, Card, CardTitle, SearchInput, Checkbox, FormActions, Spinner, EmptyState, Thumb,
  TableCard, Table, THead, TBody, Th, Tr, Td, toast,
} from '../../components/ui';
import { inventoryConversionsService } from '../../services/inventory-conversions.service';
import { getVariants, type ProductVariant } from '../../services/variants.service';
import { StepCard } from './InventoryStepCard';

const LIST = '/admin-panel/inventory-conversions';

interface FormData {
  conversionDate: string;
  description: string;
  notes: string;
}

/** Variante con la receta de la plantilla (se carga al elegir la plantilla). */
type TemplateVariant = ProductVariant & { templateRecipes?: any[] };

interface Product {
  id: number;
  name: string;
  sku: string;
  isTemplate: boolean;
  images: string[];
  variants: TemplateVariant[];
}

interface MatrixCell {
  colorId: number;
  colorName: string;
  colorHex: string;
  sizeId: number;
  sizeName: string;
  templateVariant: TemplateVariant | null;
  outputVariant: TemplateVariant | null;
  available: boolean;
}

interface CellQuantity {
  colorId: number;
  sizeId: number;
  quantity: number;
  templateVariant: TemplateVariant;
  outputVariant: TemplateVariant;
}

/** Primera imagen del producto (el API puede mandar un arreglo o un objeto {front, back…}). */
const firstImage = (images: unknown): string | null => {
  if (Array.isArray(images)) return images[0] ?? null;
  if (images && typeof images === 'object') return (Object.values(images as Record<string, unknown>).find((v) => typeof v === 'string') as string) ?? null;
  return null;
};

/** Fila elegible de una lista (producto o plantilla). */
function PickRow({ product, selected, onPick, icon: Icon }: { product: Product; selected: boolean; onPick: () => void; icon: typeof Package }) {
  const img = firstImage(product.images);
  return (
    <button type="button" onClick={onPick} className={`w-full px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${selected ? 'bg-app-50' : 'hover:bg-gray-50'}`}>
      {img ? <Thumb src={img} alt={product.name} /> : <span className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-gray-300" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-gray-900 truncate">{product.name}</span>
        <span className="block text-xs text-gray-500">{product.sku} · {product.variants.length} variantes</span>
      </span>
      {selected && <Check className="w-4 h-4 text-app-600" />}
    </button>
  );
}

/** Resumen del elegido con el botón Cambiar. */
function PickedSummary({ product, icon: Icon, onChange }: { product: Product; icon: typeof Package; onChange: () => void }) {
  const img = firstImage(product.images);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
      {img ? <Thumb src={img} alt={product.name} /> : <span className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5 text-gray-300" /></span>}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 truncate">{product.name}</p>
        <p className="text-xs text-gray-500">{product.sku} · {product.variants.length} variantes</p>
      </div>
      <Button size="sm" variant="ghost" onClick={onChange}>Cambiar</Button>
    </div>
  );
}

export default function InventoryConversionFromTemplatePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Datos del paso anterior (diálogo de Nueva conversión)
  const formData = (location.state as { formData?: FormData })?.formData || {
    conversionDate: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  };

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<Product[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Product | null>(null);
  const [cellQuantities, setCellQuantities] = useState<Map<string, number>>(new Map());

  // Insumos de la receta que NO se deben consumir (deseleccionados).
  const [excludedInsumoIds, setExcludedInsumoIds] = useState<Set<number>>(new Set());

  const [productSearch, setProductSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Recetas de la plantilla al elegirla (solo cuando cambia el id)
  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateRecipes(selectedTemplate.id);
    }
  }, [selectedTemplate?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const variants = await getVariants();

      // Agrupar variantes por producto
      const productMap = new Map<number, Product>();
      variants.forEach((variant) => {
        if (!productMap.has(variant.product.id)) {
          productMap.set(variant.product.id, {
            id: variant.product.id,
            name: variant.product.name,
            sku: variant.product.sku,
            isTemplate: variant.product.isTemplate,
            images: variant.product.images || [],
            variants: [],
          });
        }
        productMap.get(variant.product.id)!.variants.push(variant);
      });

      const allProducts = Array.from(productMap.values());
      setTemplates(allProducts.filter((p) => p.isTemplate));
      setProducts(allProducts.filter((p) => !p.isTemplate));
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateRecipes = async (templateId: number) => {
    try {
      setLoadingRecipes(true);
      const authData = localStorage.getItem('marketplace_auth');
      const token = authData ? JSON.parse(authData).token : '';

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiUrl}/template-recipes/product/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error('Error al cargar recetas');
      }

      // El API responde con el envoltorio { success, data: [...] }.
      const json = await response.json();
      const recipes: any[] = Array.isArray(json) ? json : (json?.data ?? []);

      const recipesByVariant = new Map<number, any[]>();
      recipes.forEach((recipe: any) => {
        if (!recipesByVariant.has(recipe.variantId)) recipesByVariant.set(recipe.variantId, []);
        recipesByVariant.get(recipe.variantId)!.push(recipe);
      });

      setSelectedTemplate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          variants: prev.variants.map((variant) => ({ ...variant, templateRecipes: recipesByVariant.get(variant.id) || [] })),
        };
      });
    } catch (error: any) {
      console.error('Error loading template recipes:', error);
      toast.error('Error al cargar recetas de la plantilla');
    } finally {
      setLoadingRecipes(false);
    }
  };

  // Insumos distintos que usa la receta de la plantilla seleccionada.
  const recipeInsumos = useMemo(() => {
    const map = new Map<number, { inputId: number; name: string; code: string; lines: number }>();
    for (const variant of selectedTemplate?.variants || []) {
      for (const recipe of variant.templateRecipes || []) {
        const input = recipe?.inputVariant?.input;
        if (!input) continue;
        if (!map.has(input.id)) map.set(input.id, { inputId: input.id, name: input.name, code: input.code, lines: 0 });
        map.get(input.id)!.lines++;
      }
    }
    return Array.from(map.values());
  }, [selectedTemplate]);

  // Al cambiar de plantilla, todos los insumos quedan seleccionados.
  useEffect(() => {
    setExcludedInsumoIds(new Set());
  }, [selectedTemplate?.id]);

  const toggleInsumo = (inputId: number) => {
    setExcludedInsumoIds((prev) => {
      const next = new Set(prev);
      if (next.has(inputId)) next.delete(inputId);
      else next.add(inputId);
      return next;
    });
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const term = productSearch.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term));
  }, [productSearch, products]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates;
    const term = templateSearch.toLowerCase();
    return templates.filter((t) => t.name.toLowerCase().includes(term) || t.sku.toLowerCase().includes(term));
  }, [templateSearch, templates]);

  // Matriz color × talla
  const matrix = useMemo((): MatrixCell[] => {
    if (!selectedProduct || !selectedTemplate) return [];
    const cells: MatrixCell[] = [];
    const colors = new Map<number, { name: string; hex: string }>();
    const sizes = new Map<number, string>();

    selectedProduct.variants.forEach((v) => {
      if (v.color && !colors.has(v.color.id)) colors.set(v.color.id, { name: v.color.name, hex: v.color.hexCode });
      if (v.size && !sizes.has(v.size.id)) sizes.set(v.size.id, v.size.abbreviation);
    });

    colors.forEach((color, colorId) => {
      sizes.forEach((sizeName, sizeId) => {
        const templateVariant = selectedTemplate.variants.find((v) => v.colorId === colorId && v.sizeId === sizeId);
        const outputVariant = selectedProduct.variants.find((v) => v.colorId === colorId && v.sizeId === sizeId);
        // Disponible si existen ambas variantes y la plantilla tiene stock
        const available = !!(templateVariant && outputVariant && templateVariant.stock > 0);
        cells.push({
          colorId, colorName: color.name, colorHex: color.hex, sizeId, sizeName,
          templateVariant: templateVariant || null, outputVariant: outputVariant || null, available,
        });
      });
    });
    return cells;
  }, [selectedProduct, selectedTemplate]);

  const matrixColors = useMemo(() => {
    const unique = new Map<number, { name: string; hex: string }>();
    matrix.forEach((cell) => { if (!unique.has(cell.colorId)) unique.set(cell.colorId, { name: cell.colorName, hex: cell.colorHex }); });
    return Array.from(unique.entries()).map(([id, data]) => ({ id, ...data }));
  }, [matrix]);

  const matrixSizes = useMemo(() => {
    const unique = new Map<number, string>();
    matrix.forEach((cell) => { if (!unique.has(cell.sizeId)) unique.set(cell.sizeId, cell.sizeName); });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [matrix]);

  const getCellKey = (colorId: number, sizeId: number) => `${colorId}-${sizeId}`;

  const handleQuantityChange = (cell: MatrixCell, value: string) => {
    const quantity = parseInt(value) || 0;
    const key = getCellKey(cell.colorId, cell.sizeId);
    setCellQuantities((prev) => {
      const newMap = new Map(prev);
      if (quantity > 0) newMap.set(key, quantity);
      else newMap.delete(key);
      return newMap;
    });
  };

  // Reiniciar cantidades al cambiar producto o plantilla
  useEffect(() => {
    setCellQuantities(new Map());
  }, [selectedProduct, selectedTemplate]);

  const selectedCombinations = useMemo((): CellQuantity[] => {
    const combinations: CellQuantity[] = [];
    cellQuantities.forEach((quantity, key) => {
      const [colorId, sizeId] = key.split('-').map(Number);
      const cell = matrix.find((c) => c.colorId === colorId && c.sizeId === sizeId);
      if (cell && cell.templateVariant && cell.outputVariant && quantity > 0) {
        combinations.push({ colorId, sizeId, quantity, templateVariant: cell.templateVariant, outputVariant: cell.outputVariant });
      }
    });
    return combinations;
  }, [cellQuantities, matrix]);

  const totalUnits = selectedCombinations.reduce((sum, c) => sum + c.quantity, 0);

  const handleCreate = async () => {
    if (selectedCombinations.length === 0) {
      toast.error('Ingresa al menos una cantidad en la matriz');
      return;
    }

    try {
      setCreating(true);

      // Conversión en borrador
      const conversion = await inventoryConversionsService.createConversion({
        conversionType: 'TEMPLATE',
        templateId: selectedTemplate!.id,
        conversionDate: formData.conversionDate,
        description: formData.description || `Conversión de plantilla: ${selectedTemplate!.name}`,
        notes: formData.notes,
      });

      // Insumos agregados por inputVariantId (cada variante de la plantilla puede tener varios insumos)
      const inputMap = new Map<number, number>();
      selectedCombinations.forEach((combo) => {
        if (combo.templateVariant.templateRecipes && combo.templateVariant.templateRecipes.length > 0) {
          combo.templateVariant.templateRecipes.forEach((recipe: any) => {
            // Saltar los insumos que el usuario deseleccionó de la receta.
            const insumoId = recipe.inputVariant?.input?.id;
            if (insumoId && excludedInsumoIds.has(insumoId)) return;
            const inputVariantId = recipe.inputVariant.id;
            const requiredQty = combo.quantity * Number(recipe.quantity);
            inputMap.set(inputVariantId, (inputMap.get(inputVariantId) || 0) + requiredQty);
          });
        } else {
          console.warn('No recipes found for variant:', combo.templateVariant.sku);
        }
      });

      for (const [inputVariantId, totalQty] of inputMap.entries()) {
        await inventoryConversionsService.addInputItem(conversion.id, { inputVariantId, quantity: totalQty });
      }

      for (const combo of selectedCombinations) {
        await inventoryConversionsService.addOutputItem(conversion.id, { variantId: combo.outputVariant.id, quantity: combo.quantity });
      }

      toast.success(`Conversión creada con ${selectedCombinations.length} variantes`);
      navigate(`${LIST}/${conversion.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Error al crear conversión');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <Page><Spinner label="Cargando productos y plantillas…" /></Page>;
  }

  const bothPicked = !!selectedProduct && !!selectedTemplate;
  const hasRecipeStep = bothPicked && !loadingRecipes && recipeInsumos.length > 0;
  const qtyStep = hasRecipeStep ? 4 : 3;

  return (
    <Page>
      <PageHeader
        icon={ArrowRightLeft}
        backTo={LIST}
        title="Conversión desde plantilla"
        subtitle={
          <>
            {new Date(formData.conversionDate + 'T00:00:00').toLocaleDateString('es-CO')}
            {formData.description && <> · {formData.description}</>}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <StepCard step={1} done={!!selectedProduct} title="Producto a generar" description="El producto terminado que entra al inventario.">
          {selectedProduct ? (
            <PickedSummary product={selectedProduct} icon={Package} onChange={() => { setSelectedProduct(null); setSelectedTemplate(null); }} />
          ) : (
            <div className="space-y-3">
              <SearchInput value={productSearch} onChange={setProductSearch} placeholder="Buscar producto…" />
              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {filteredProducts.length === 0 ? (
                  <EmptyState icon={Package} title="No hay productos con variantes" description="Genera variantes para los productos en Plantillas o Variantes." />
                ) : filteredProducts.map((p) => (
                  <PickRow key={p.id} product={p} icon={Package} selected={false} onPick={() => { setSelectedProduct(p); setSelectedTemplate(null); }} />
                ))}
              </div>
            </div>
          )}
        </StepCard>

        <StepCard step={2} done={!!selectedTemplate} disabled={!selectedProduct} title="Plantilla a usar" description={selectedProduct ? 'La prenda base con su receta de insumos.' : 'Primero elige el producto.'}>
          {selectedTemplate ? (
            <PickedSummary product={selectedTemplate} icon={Shirt} onChange={() => setSelectedTemplate(null)} />
          ) : (
            <div className="space-y-3">
              <SearchInput value={templateSearch} onChange={setTemplateSearch} placeholder="Buscar plantilla…" />
              <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {filteredTemplates.length === 0 ? (
                  <EmptyState icon={Shirt} title="No hay plantillas con variantes" description="Genera variantes para las plantillas en la página de Plantillas." />
                ) : filteredTemplates.map((t) => (
                  <PickRow key={t.id} product={t} icon={Shirt} selected={false} onPick={() => setSelectedTemplate(t)} />
                ))}
              </div>
            </div>
          )}
        </StepCard>
      </div>

      {selectedTemplate && loadingRecipes && (
        <Card><Spinner className="py-6" label="Cargando recetas de la plantilla…" /></Card>
      )}

      {/* Insumos de la receta: elegir lo que se consume */}
      {hasRecipeStep && (
        <StepCard
          step={3}
          done
          title="Insumos de la receta"
          description="Desmarca un insumo si esta conversión no debe descontarlo del inventario."
          actions={<Badge tone="app">{recipeInsumos.length - excludedInsumoIds.size} de {recipeInsumos.length}</Badge>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recipeInsumos.map((insumo) => {
              const checked = !excludedInsumoIds.has(insumo.inputId);
              return (
                <div key={insumo.inputId} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${checked ? 'border-gray-200' : 'border-gray-200 bg-gray-50'}`}>
                  <Checkbox
                    checked={checked}
                    onChange={() => toggleInsumo(insumo.inputId)}
                    label={<span className="font-medium text-gray-900">{insumo.name}</span>}
                    description={`${insumo.code} · ${insumo.lines} variante(s) en la receta`}
                  />
                  {!checked && <Badge>No se consume</Badge>}
                </div>
              );
            })}
          </div>
        </StepCard>
      )}

      {/* Matriz color × talla */}
      <StepCard
        step={qtyStep}
        done={selectedCombinations.length > 0}
        disabled={!bothPicked || loadingRecipes}
        title="Cantidades por color y talla"
        description={bothPicked ? 'Escribe cuántas unidades producir en cada combinación. “N/A”: falta la variante o la plantilla no tiene stock.' : 'Elige el producto y la plantilla para ver la matriz.'}
      >
        {matrix.length === 0 ? (
          <EmptyState title="Sin combinaciones" description="El producto no tiene variantes de color y talla." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color / talla</th>
                  {matrixSizes.map((size) => <th key={size.id} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[76px]">{size.name}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matrixColors.map((color) => (
                  <tr key={color.id}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: color.hex }} />
                        <span className="font-medium text-gray-800">{color.name}</span>
                      </span>
                    </td>
                    {matrixSizes.map((size) => {
                      const cell = matrix.find((c) => c.colorId === color.id && c.sizeId === size.id);
                      const currentQty = cellQuantities.get(getCellKey(color.id, size.id)) || 0;
                      if (!cell || !cell.available) {
                        return <td key={size.id} className="px-2 py-2 text-center text-xs text-gray-300">N/A</td>;
                      }
                      return (
                        <td key={size.id} className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={cell.templateVariant?.stock || 0}
                            value={currentQty || ''}
                            onChange={(e) => handleQuantityChange(cell, e.target.value)}
                            placeholder="0"
                            aria-label={`Cantidad ${color.name} ${size.name}`}
                            className={`w-16 h-9 rounded-lg border text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500 ${currentQty > 0 ? 'border-app-400 bg-app-50 font-semibold text-app-700' : 'border-gray-300'}`}
                          />
                          <span className="block text-[11px] text-gray-400 mt-0.5">máx. {cell.templateVariant?.stock || 0}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StepCard>

      {/* Resumen */}
      {selectedCombinations.length > 0 && (
        <section className="space-y-3">
          <CardTitle icon={Package}>Resumen</CardTitle>
          <TableCard footer={<div className="flex justify-between text-sm"><span className="text-gray-500">Total a producir</span><span className="font-bold text-gray-900 tabular-nums">{totalUnits} unidades</span></div>}>
            <Table>
              <THead>
                <tr><Th>Variante</Th><Th>SKU</Th><Th align="right">Stock plantilla</Th><Th align="right">Cantidad</Th></tr>
              </THead>
              <TBody>
                {selectedCombinations.map((combo) => {
                  const c = matrix.find((m) => m.colorId === combo.colorId && m.sizeId === combo.sizeId);
                  return (
                    <Tr key={`${combo.colorId}-${combo.sizeId}`}>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: c?.colorHex || '#ccc' }} />
                          <span className="font-medium text-gray-900">{c?.colorName} · {c?.sizeName}</span>
                        </span>
                      </Td>
                      <Td className="font-mono text-xs">{combo.outputVariant.sku}</Td>
                      <Td align="right" className="tabular-nums">{combo.templateVariant.stock}</Td>
                      <Td align="right" className="font-semibold text-gray-900 tabular-nums">{combo.quantity}</Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableCard>
        </section>
      )}

      <FormActions sticky>
        <span className="sm:mr-auto self-center text-sm text-gray-500">
          {selectedCombinations.length > 0
            ? <>{selectedCombinations.length} variante{selectedCombinations.length !== 1 ? 's' : ''} · <b className="text-gray-900">{totalUnits} unidades</b></>
            : 'Sin cantidades todavía'}
        </span>
        <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
        <Button icon={<Package className="w-4 h-4" />} isLoading={creating} disabled={selectedCombinations.length === 0} onClick={handleCreate}>
          Crear conversión
        </Button>
      </FormActions>
    </Page>
  );
}
