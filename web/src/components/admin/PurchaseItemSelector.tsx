import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Package, Boxes, Plus, Minus, ArrowLeft, ChevronRight } from 'lucide-react';
import {
  Button, IconButton, Badge, Tabs, SearchInput, SelectInput, Field, NumberInput, MoneyInput, Checkbox, Thumb, EmptyState, Spinner,
} from '../ui';
import { productsService } from '../../services/products.service';
import { inputsService, type Input } from '../../services/inputs.service';
import * as variantsService from '../../services/variants.service';
import { catalogsService, type ProductType as CatalogProductType } from '../../services/catalogs.service';
import type { Product } from '../../types/product';

export interface PurchaseItem {
  type: 'variant' | 'input' | 'input-variant';
  variantId?: number;
  inputId?: number;
  inputVariantId?: number;
  productName: string;
  variantInfo?: string; // e.g., "Rojo - M"
  sku?: string;
  quantity: number;
  unitCost: number;
  stock?: number; // Stock disponible de la variante
}

interface Props {
  onItemsSelected: (items: PurchaseItem[]) => void;
  onClose: () => void;
}

export function PurchaseItemSelector({ onItemsSelected, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'products' | 'inputs'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [inputs, setInputs] = useState<Input[]>([]);
  const [loading, setLoading] = useState(false);

  // Product type filter
  const [productTypes, setProductTypes] = useState<CatalogProductType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | ''>('');

  // Selected product for matrix view
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productVariants, setProductVariants] = useState<variantsService.ProductVariant[]>([]);
  const [variantQuantities, setVariantQuantities] = useState<Record<number, number>>({});
  const [unitCost, setUnitCost] = useState(0);

  // For inputs - direct quantity selection (inputs without variants)
  const [selectedInputs, setSelectedInputs] = useState<Record<number, { quantity: number; unitCost: number }>>({});

  // For inputs with variants - matrix view
  const [selectedInput, setSelectedInput] = useState<Input | null>(null);
  const [inputVariantQuantities, setInputVariantQuantities] = useState<Record<number, number>>({});
  const [inputUnitCost, setInputUnitCost] = useState(0);

  // Load product types on mount
  useEffect(() => {
    const loadProductTypes = async () => {
      try {
        const types = await catalogsService.getProductTypes();
        setProductTypes(types.filter(t => t.isActive));
      } catch (error) {
        console.error('Error loading product types:', error);
      }
    };
    loadProductTypes();
  }, []);

  // Load products on search (excluding templates)
  useEffect(() => {
    const searchProducts = async () => {
      if (activeTab !== 'products') return;
      setLoading(true);
      try {
        // Build filter with type if selected
        const selectedType = productTypes.find(t => t.id === selectedTypeId);
        const result = await productsService.getAll({
          search: searchTerm,
          limit: 50, // Get more to filter out templates
          type: selectedType?.slug || undefined,
        });
        // Filter out templates - only show regular products for purchase orders
        const regularProducts = result.data.filter((p: any) => !p.isTemplate);
        setProducts(regularProducts);
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab, selectedTypeId, productTypes]);

  // Load inputs on search
  useEffect(() => {
    const searchInputs = async () => {
      if (activeTab !== 'inputs') return;
      setLoading(true);
      try {
        const result = await inputsService.getAll({ search: searchTerm });
        setInputs(result);
      } catch (error) {
        console.error('Error searching inputs:', error);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchInputs, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab]);

  // Load variants when product is selected
  useEffect(() => {
    const loadVariants = async () => {
      if (!selectedProduct) return;
      try {
        const variants = await variantsService.getVariants({
          productId: Number(selectedProduct.id),
          isActive: true
        });
        setProductVariants(variants);
        setVariantQuantities({});
        setUnitCost(selectedProduct.basePrice);
      } catch (error) {
        console.error('Error loading variants:', error);
      }
    };
    loadVariants();
  }, [selectedProduct]);

  // Input variants state (initialized from selectedInput.variants which comes from backend)
  const [inputVariants, setInputVariants] = useState<import('../../services/inputs.service').InputVariant[]>([]);

  // Get unique colors and sizes from variants
  const { colors, sizes } = useMemo(() => {
    const colorMap = new Map<number, { id: number; name: string; hexCode: string }>();
    const sizeMap = new Map<number, { id: number; name: string; abbreviation: string }>();

    productVariants.forEach(v => {
      if (v.color) {
        colorMap.set(v.color.id, v.color);
      }
      if (v.size) {
        sizeMap.set(v.size.id, v.size);
      }
    });

    return {
      colors: Array.from(colorMap.values()),
      sizes: Array.from(sizeMap.values()),
    };
  }, [productVariants]);

  // Find variant by color and size
  const findVariant = (colorId: number | null, sizeId: number | null) => {
    return productVariants.find(v =>
      (colorId === null ? v.colorId === null : v.colorId === colorId) &&
      (sizeId === null ? v.sizeId === null : v.sizeId === sizeId)
    );
  };

  // Update quantity for a variant
  const updateVariantQuantity = (variantId: number, delta: number) => {
    setVariantQuantities(prev => {
      const current = prev[variantId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [variantId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variantId]: newQty };
    });
  };

  // Set exact quantity for variant
  const setVariantQuantity = (variantId: number, quantity: number) => {
    setVariantQuantities(prev => {
      if (quantity <= 0) {
        const { [variantId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variantId]: quantity };
    });
  };

  // Toggle input selection
  const toggleInput = (input: Input) => {
    setSelectedInputs(prev => {
      if (prev[input.id]) {
        const { [input.id]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [input.id]: {
          quantity: 1,
          unitCost: Number(input.unitCost) || 0
        }
      };
    });
  };

  // Update input quantity
  const updateInputQuantity = (inputId: number, quantity: number) => {
    setSelectedInputs(prev => ({
      ...prev,
      [inputId]: { ...prev[inputId], quantity: Math.max(1, quantity) }
    }));
  };

  // Update input cost
  const updateInputCost = (inputId: number, cost: number) => {
    setSelectedInputs(prev => ({
      ...prev,
      [inputId]: { ...prev[inputId], unitCost: cost }
    }));
  };

  // Input variant quantity functions
  const updateInputVariantQuantity = (variantId: number, delta: number) => {
    setInputVariantQuantities(prev => {
      const current = prev[variantId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [variantId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variantId]: newQty };
    });
  };

  const setInputVariantQuantity = (variantId: number, quantity: number) => {
    setInputVariantQuantities(prev => {
      if (quantity <= 0) {
        const { [variantId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [variantId]: quantity };
    });
  };

  // Calculate total items selected
  const totalVariantQty = Object.values(variantQuantities).reduce((a, b) => a + b, 0);
  const totalInputQty = Object.values(selectedInputs).reduce((a, b) => a + b.quantity, 0);
  const totalInputVariantQty = Object.values(inputVariantQuantities).reduce((a, b) => a + b, 0);

  // Add selected items
  const handleAddItems = () => {
    const items: PurchaseItem[] = [];

    // Add variant items
    Object.entries(variantQuantities).forEach(([variantId, quantity]) => {
      const variant = productVariants.find(v => v.id === Number(variantId));
      if (variant && quantity > 0) {
        const colorName = variant.color?.name || '';
        const sizeName = variant.size?.abbreviation || variant.size?.name || '';
        const variantInfo = [colorName, sizeName].filter(Boolean).join(' / ');

        items.push({
          type: 'variant',
          variantId: variant.id,
          productName: variant.product.name,
          variantInfo: variantInfo || undefined,
          sku: variant.sku,
          quantity,
          unitCost,
        });
      }
    });

    // Add input items (for inputs without variants)
    Object.entries(selectedInputs).forEach(([inputId, data]) => {
      const input = inputs.find(i => i.id === Number(inputId));
      if (input) {
        items.push({
          type: 'input',
          inputId: input.id,
          productName: input.name,
          sku: input.code,
          quantity: data.quantity,
          unitCost: data.unitCost,
        });
      }
    });

    // Add input variant items (for inputs with variants)
    if (selectedInput && inputVariants.length > 0) {
      Object.entries(inputVariantQuantities).forEach(([variantId, quantity]) => {
        const variant = inputVariants.find(v => v.id === Number(variantId));
        if (variant && quantity > 0) {
          const colorName = variant.color?.name || '';
          const sizeName = variant.size?.abbreviation || variant.size?.name || '';
          const variantInfo = [colorName, sizeName].filter(Boolean).join(' / ');

          items.push({
            type: 'input-variant',
            inputId: selectedInput.id,
            inputVariantId: variant.id,
            productName: selectedInput.name,
            variantInfo: variantInfo || undefined,
            sku: variant.sku,
            quantity,
            unitCost: inputUnitCost,
          });
        }
      });
    }

    if (items.length > 0) {
      onItemsSelected(items);
    }
  };

  // Check if product has variants (colors or sizes)
  const hasVariants = colors.length > 0 || sizes.length > 0;

  const totalSelected = totalVariantQty + totalInputQty + totalInputVariantQty;

  const switchTab = (tab: 'products' | 'inputs') => {
    setActiveTab(tab);
    setSelectedProduct(null);
    setSelectedInput(null);
    setInputVariants([]);
    setSearchTerm('');
  };

  return (
    <div className="flex flex-col h-[70vh] max-h-[640px] min-h-[420px]">
      <Tabs
        value={activeTab}
        onChange={switchTab}
        tabs={[
          { value: 'products', label: <span className="inline-flex items-center gap-2"><Package className="w-4 h-4" />Productos</span> },
          { value: 'inputs', label: <span className="inline-flex items-center gap-2"><Boxes className="w-4 h-4" />Insumos</span> },
        ]}
      />

      {/* Búsqueda y filtro por tipo */}
      <div className="flex flex-col sm:flex-row gap-2 py-3">
        <SearchInput
          className="flex-1"
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={`Buscar ${activeTab === 'products' ? 'productos' : 'insumos'}…`}
        />
        {activeTab === 'products' && (
          <div className="sm:w-52">
            <SelectInput
              aria-label="Tipo de producto"
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Todos los tipos</option>
              {productTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </SelectInput>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto -mx-1 px-1">
        {activeTab === 'products' ? (
          selectedProduct ? (
            <div className="space-y-4">
              <SelectionHeader
                title={selectedProduct.name}
                onBack={() => setSelectedProduct(null)}
                cost={unitCost}
                onCost={setUnitCost}
                meta={productVariants.length > 0 && (
                  <>
                    <span className="text-gray-500">{productVariants.length} variantes disponibles</span>
                    {productVariants.filter((v) => v.stock <= v.minStock).length > 0 && (
                      <Badge tone="red">{productVariants.filter((v) => v.stock <= v.minStock).length} con bajo stock</Badge>
                    )}
                    {productVariants.filter((v) => v.stock === 0).length > 0 && (
                      <Badge tone="yellow">{productVariants.filter((v) => v.stock === 0).length} sin stock</Badge>
                    )}
                  </>
                )}
              />

              {hasVariants ? (
                <VariantMatrix
                  colors={colors}
                  sizes={sizes}
                  find={(c, s) => {
                    const v = findVariant(c, s);
                    return v ? { id: v.id, stock: v.stock || 0, low: (v.stock || 0) <= (v.minStock || 0) } : undefined;
                  }}
                  quantities={variantQuantities}
                  onStep={updateVariantQuantity}
                  onSet={setVariantQuantity}
                />
              ) : productVariants.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Cantidad a comprar</p>
                    <Badge className="mt-1" tone={productVariants[0].stock <= productVariants[0].minStock ? 'red' : 'green'}>
                      Stock actual: {productVariants[0].stock}
                    </Badge>
                  </div>
                  <QtyStepper
                    value={variantQuantities[productVariants[0].id] || 0}
                    onStep={(d) => updateVariantQuantity(productVariants[0].id, d)}
                    onSet={(q) => setVariantQuantity(productVariants[0].id, q)}
                  />
                </div>
              ) : (
                <EmptyState icon={Package} title="Este producto no tiene variantes disponibles" />
              )}

              {totalVariantQty > 0 && (
                <SelectionSummary label={`${totalVariantQty} unidades seleccionadas`} subtotal={totalVariantQty * unitCost} />
              )}
            </div>
          ) : loading ? (
            <Spinner label="Buscando…" />
          ) : products.length === 0 ? (
            <EmptyState icon={Package} title={searchTerm ? 'No se encontraron productos' : 'Busca un producto para comenzar'} />
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {products.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors group"
                  >
                    <Thumb src={product.images?.front} alt={product.name} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate group-hover:text-app-700">{product.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {product.sku && <span className="font-mono">{product.sku}</span>}
                        {product.typeSlug && <span>{product.typeName || product.typeSlug}</span>}
                        <span>{product.colors?.length || 0} colores · {(product.sizes as any[])?.length || 0} tallas</span>
                      </div>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900">${product.basePrice.toLocaleString('es-CO')}</p>
                    </div>
                    <Badge tone={product.stock > 0 ? 'green' : 'yellow'}>Stock: {product.stock || 0}</Badge>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-app-600 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : selectedInput ? (
          <div className="space-y-4">
            <SelectionHeader
              title={selectedInput.name}
              onBack={() => { setSelectedInput(null); setInputVariants([]); setInputVariantQuantities({}); }}
              cost={inputUnitCost}
              onCost={setInputUnitCost}
              meta={inputVariants.length > 0 && <span className="text-gray-500">{inputVariants.length} variantes disponibles</span>}
            />

            {inputVariants.length > 0 ? (() => {
              const inputColors = new Map<number, { id: number; name: string; hexCode: string }>();
              const inputSizes = new Map<number, { id: number; name: string; abbreviation: string }>();
              inputVariants.forEach((v) => {
                if (v.color) inputColors.set(v.color.id, v.color);
                if (v.size) inputSizes.set(v.size.id, v.size);
              });
              const findInputVariant = (colorId: number | null, sizeId: number | null) =>
                inputVariants.find((v) =>
                  (colorId === null ? v.colorId === null : v.colorId === colorId) &&
                  (sizeId === null ? v.sizeId === null : v.sizeId === sizeId)
                );
              return (
                <VariantMatrix
                  colors={Array.from(inputColors.values())}
                  sizes={Array.from(inputSizes.values())}
                  find={(c, s) => {
                    const v = findInputVariant(c, s);
                    if (!v) return undefined;
                    const stock = Number(v.currentStock);
                    return { id: v.id, stock, low: stock <= 0 };
                  }}
                  quantities={inputVariantQuantities}
                  onStep={updateInputVariantQuantity}
                  onSet={setInputVariantQuantity}
                />
              );
            })() : (
              <EmptyState icon={Boxes} title="Este insumo no tiene variantes disponibles" />
            )}

            {totalInputVariantQty > 0 && (
              <SelectionSummary label={`${totalInputVariantQty} unidades seleccionadas`} subtotal={totalInputVariantQty * inputUnitCost} />
            )}
          </div>
        ) : loading ? (
          <Spinner label="Buscando…" />
        ) : inputs.length === 0 ? (
          <EmptyState icon={Boxes} title={searchTerm ? 'No se encontraron insumos' : 'Busca un insumo para comenzar'} />
        ) : (
          <div className="space-y-4">
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {inputs.map((input) => {
                const hasInputVariants = input.inputType?.hasVariants && input.variants && input.variants.length > 0;
                const isSelected = !!selectedInputs[input.id];

                // Insumo con variantes: se abre su matriz color × talla
                if (hasInputVariants) {
                  return (
                    <li key={input.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInput(input);
                          setInputVariants(input.variants || []);
                          setInputVariantQuantities({});
                          setInputUnitCost(Number(input.unitCost) || 0);
                        }}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors group"
                      >
                        <span className="w-10 h-10 rounded-lg bg-app-50 text-app-600 flex items-center justify-center flex-shrink-0"><Boxes className="w-5 h-5" /></span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-app-700">{input.name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="font-mono">{input.code}</span>
                            {input.inputType?.name && <span>{input.inputType.name}</span>}
                            <span>{input.inputColors?.length || 0} colores · {input.inputSizes?.length || input.inputType?.inputTypeSizes?.length || 0} tallas</span>
                          </div>
                          <p className="mt-0.5 text-sm font-semibold text-gray-900">${Number(input.unitCost).toLocaleString('es-CO')}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-app-600 flex-shrink-0" />
                      </button>
                    </li>
                  );
                }

                // Insumo sin variantes: se marca y se indica cantidad y costo
                return (
                  <li key={input.id} className={`p-3 ${isSelected ? 'bg-app-50' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <Checkbox
                        className="flex-1 min-w-0"
                        checked={isSelected}
                        onChange={() => toggleInput(input)}
                        label={<span className="font-medium text-gray-900">{input.name}</span>}
                        description={`${input.code} · ${input.unitOfMeasure}`}
                      />
                      {isSelected && (
                        <div className="flex items-center gap-2 pl-6 sm:pl-0">
                          <div className="w-24">
                            <NumberInput
                              aria-label="Cantidad"
                              value={selectedInputs[input.id].quantity}
                              onChange={(e) => updateInputQuantity(input.id, Number(e.target.value))}
                              min="1"
                            />
                          </div>
                          <div className="w-32">
                            <MoneyInput
                              aria-label="Costo unitario"
                              value={selectedInputs[input.id].unitCost}
                              onChange={(e) => updateInputCost(input.id, Number(e.target.value))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {totalInputQty > 0 && (
              <SelectionSummary
                label={`${Object.keys(selectedInputs).length} insumos · ${totalInputQty} unidades`}
                subtotal={Object.values(selectedInputs).reduce((sum, s) => sum + s.quantity * s.unitCost, 0)}
              />
            )}
          </div>
        )}
      </div>

      {/* Pie */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          {totalSelected > 0 ? `${totalSelected} unidades seleccionadas` : 'Selecciona ítems para agregar'}
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={handleAddItems} disabled={totalSelected === 0}>
            Agregar a la orden
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Piezas locales del selector ---------- */

/** Cantidad con botones − / + y campo editable. */
function QtyStepper({ value, onStep, onSet }: { value: number; onStep: (delta: number) => void; onSet: (q: number) => void }) {
  return (
    <div className={`inline-flex items-center rounded-lg border ${value > 0 ? 'border-app-400 bg-app-50' : 'border-gray-300 bg-white'}`}>
      <button type="button" title="Restar" onClick={() => onStep(-1)} disabled={value === 0} className="p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label="Cantidad"
        value={value || ''}
        onChange={(e) => onSet(Number(e.target.value))}
        min="0"
        placeholder="0"
        className="w-12 bg-transparent text-center text-sm font-medium text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" title="Sumar" onClick={() => onStep(1)} className="p-1.5 text-gray-500 hover:text-gray-900">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Encabezado del producto o insumo elegido: volver a la lista, nombre y costo unitario. */
function SelectionHeader({ title, onBack, cost, onCost, meta }: {
  title: string; onBack: () => void; cost: number; onCost: (v: number) => void; meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-gray-100 pb-3">
      <div className="flex items-start gap-2 min-w-0">
        <IconButton title="Volver a la lista" onClick={onBack} className="-ml-2"><ArrowLeft className="w-4 h-4" /></IconButton>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{title}</p>
          <p className="text-sm text-gray-500">Indica la cantidad por variante</p>
          {meta && <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">{meta}</div>}
        </div>
      </div>
      <Field label="Costo unitario" className="sm:w-40">
        <MoneyInput value={cost} onChange={(e) => onCost(Number(e.target.value))} />
      </Field>
    </div>
  );
}

/** Total de lo seleccionado en la vista actual. */
function SelectionSummary({ label, subtotal }: { label: string; subtotal: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-app-200 bg-app-50 px-4 py-3 text-sm">
      <span className="font-medium text-app-800">{label}</span>
      <span className="font-semibold text-app-800">Subtotal: ${subtotal.toLocaleString('es-CO')}</span>
    </div>
  );
}

/** Matriz color × talla con stock y cantidad por celda. */
function VariantMatrix({ colors, sizes, find, quantities, onStep, onSet }: {
  colors: { id: number; name: string; hexCode: string }[];
  sizes: { id: number; name: string; abbreviation: string }[];
  find: (colorId: number | null, sizeId: number | null) => { id: number; stock: number; low: boolean } | undefined;
  quantities: Record<number, number>;
  onStep: (variantId: number, delta: number) => void;
  onSet: (variantId: number, q: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
              {colors.length > 0 ? 'Color' : ''}
            </th>
            {(sizes.length > 0 ? sizes : [null]).map((size) => (
              <th key={size?.id ?? 'no-size'} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">
                {size ? size.abbreviation || size.name : 'Cantidad'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {(colors.length > 0 ? colors : [null]).map((color) => (
            <tr key={color?.id ?? 'no-color'}>
              <td className="px-3 py-2 sticky left-0 bg-white">
                {color && (
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" style={{ backgroundColor: color.hexCode }} />
                    <span className="text-gray-800">{color.name}</span>
                  </span>
                )}
              </td>
              {(sizes.length > 0 ? sizes : [null]).map((size) => {
                const cell = find(color?.id ?? null, size?.id ?? null);
                if (!cell) {
                  return <td key={size?.id ?? 'no-size'} className="px-3 py-2 text-center text-gray-300">—</td>;
                }
                return (
                  <td key={size?.id ?? 'no-size'} className="px-3 py-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`text-xs ${cell.low ? 'text-red-600' : 'text-gray-500'}`}>Stock {cell.stock}</span>
                      <QtyStepper value={quantities[cell.id] || 0} onStep={(d) => onStep(cell.id, d)} onSet={(q) => onSet(cell.id, q)} />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
