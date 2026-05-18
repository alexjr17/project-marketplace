import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Shirt, Package, Loader2, AlertCircle, Search, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { useToast } from '../../context/ToastContext';
import { inventoryConversionsService } from '../../services/inventory-conversions.service';
import { getVariants, type ProductVariant } from '../../services/variants.service';

interface FormData {
  conversionDate: string;
  description: string;
  notes: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  isTemplate: boolean;
  images: string[];
  variants: ProductVariant[];
}

interface MatrixCell {
  colorId: number;
  colorName: string;
  colorHex: string;
  sizeId: number;
  sizeName: string;
  templateVariant: ProductVariant | null;
  outputVariant: ProductVariant | null;
  available: boolean;
}

interface CellQuantity {
  colorId: number;
  sizeId: number;
  quantity: number;
  templateVariant: ProductVariant;
  outputVariant: ProductVariant;
}

export default function InventoryConversionFromTemplatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  // Form data from previous modal
  const formData = (location.state as { formData?: FormData })?.formData || {
    conversionDate: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  };

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Products and templates
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<Product[]>([]);

  // Selected items
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Product | null>(null);
  const [cellQuantities, setCellQuantities] = useState<Map<string, number>>(new Map());

  // Insumos de la receta que NO se deben consumir (deseleccionados).
  const [excludedInsumoIds, setExcludedInsumoIds] = useState<Set<number>>(new Set());

  // Search terms
  const [productSearch, setProductSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Load template recipes when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      console.log('useEffect triggered - loading recipes for template:', selectedTemplate.id);
      loadTemplateRecipes(selectedTemplate.id);
    }
  }, [selectedTemplate?.id]); // Only trigger when ID changes, not when the whole object changes

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all variants to get products with variants
      const variants = await getVariants();

      // Group variants by product
      const productMap = new Map<number, Product>();

      variants.forEach(variant => {
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
      const templateProducts = allProducts.filter(p => p.isTemplate);
      const regularProducts = allProducts.filter(p => !p.isTemplate);

      setTemplates(templateProducts);
      setProducts(regularProducts);
    } catch (error: any) {
      console.error('Error loading data:', error);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateRecipes = async (templateId: number) => {
    try {
      console.log('loadTemplateRecipes called for templateId:', templateId);
      setLoadingRecipes(true);
      const authData = localStorage.getItem('marketplace_auth');
      const token = authData ? JSON.parse(authData).token : '';

      // Load all recipes for this template
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(
        `${apiUrl}/template-recipes/product/${templateId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error('Error al cargar recetas');
      }

      // El API responde con el envoltorio { success, data: [...] }.
      const json = await response.json();
      const recipes: any[] = Array.isArray(json) ? json : (json?.data ?? []);

      // Group recipes by variantId
      const recipesByVariant = new Map<number, any[]>();
      recipes.forEach((recipe: any) => {
        if (!recipesByVariant.has(recipe.variantId)) {
          recipesByVariant.set(recipe.variantId, []);
        }
        recipesByVariant.get(recipe.variantId)!.push(recipe);
      });

      console.log('Recipes grouped by variant:', Array.from(recipesByVariant.entries()));

      // Update selected template variants with their recipes
      setSelectedTemplate(prev => {
        if (!prev) return prev;

        const updated = {
          ...prev,
          variants: prev.variants.map(variant => ({
            ...variant,
            templateRecipes: recipesByVariant.get(variant.id) || [],
          })),
        };

        console.log('Updated template with recipes:', updated);
        return updated;
      });
    } catch (error: any) {
      console.error('Error loading template recipes:', error);
      showToast('Error al cargar recetas de la plantilla', 'error');
    } finally {
      console.log('loadTemplateRecipes finished, setting loadingRecipes to false');
      setLoadingRecipes(false);
    }
  };

  // Insumos distintos que usa la receta de la plantilla seleccionada.
  const recipeInsumos = useMemo(() => {
    const map = new Map<number, { inputId: number; name: string; code: string; lines: number }>();
    const variants = (selectedTemplate as any)?.variants || [];
    for (const variant of variants) {
      for (const recipe of variant.templateRecipes || []) {
        const input = recipe?.inputVariant?.input;
        if (!input) continue;
        if (!map.has(input.id)) {
          map.set(input.id, { inputId: input.id, name: input.name, code: input.code, lines: 0 });
        }
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
      if (next.has(inputId)) {
        next.delete(inputId);
      } else {
        next.add(inputId);
      }
      return next;
    });
  };

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const term = productSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term)
    );
  }, [productSearch, products]);

  // Filtered templates for search
  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates;
    const term = templateSearch.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(term) ||
      t.sku.toLowerCase().includes(term)
    );
  }, [templateSearch, templates]);

  // Build color x size matrix
  const matrix = useMemo((): MatrixCell[] => {
    if (!selectedProduct || !selectedTemplate) return [];

    const cells: MatrixCell[] = [];

    // Get unique colors and sizes from the product
    const colors = new Map<number, { name: string; hex: string }>();
    const sizes = new Map<number, string>();

    selectedProduct.variants.forEach(v => {
      if (v.color && !colors.has(v.color.id)) {
        colors.set(v.color.id, { name: v.color.name, hex: v.color.hexCode });
      }
      if (v.size && !sizes.has(v.size.id)) {
        sizes.set(v.size.id, v.size.abbreviation);
      }
    });

    // Build matrix cells
    colors.forEach((color, colorId) => {
      sizes.forEach((sizeName, sizeId) => {
        // Find matching variants
        const templateVariant = selectedTemplate.variants.find(
          v => v.colorId === colorId && v.sizeId === sizeId
        );
        const outputVariant = selectedProduct.variants.find(
          v => v.colorId === colorId && v.sizeId === sizeId
        );

        // Cell is available if both variants exist and template has stock
        const available = !!(templateVariant && outputVariant && templateVariant.stock > 0);

        cells.push({
          colorId,
          colorName: color.name,
          colorHex: color.hex,
          sizeId,
          sizeName,
          templateVariant: templateVariant || null,
          outputVariant: outputVariant || null,
          available,
        });
      });
    });

    return cells;
  }, [selectedProduct, selectedTemplate]);

  // Get unique colors and sizes for matrix headers
  const matrixColors = useMemo(() => {
    const unique = new Map<number, { name: string; hex: string }>();
    matrix.forEach(cell => {
      if (!unique.has(cell.colorId)) {
        unique.set(cell.colorId, { name: cell.colorName, hex: cell.colorHex });
      }
    });
    return Array.from(unique.entries()).map(([id, data]) => ({ id, ...data }));
  }, [matrix]);

  const matrixSizes = useMemo(() => {
    const unique = new Map<number, string>();
    matrix.forEach(cell => {
      if (!unique.has(cell.sizeId)) {
        unique.set(cell.sizeId, cell.sizeName);
      }
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [matrix]);

  // Get cell key for Map
  const getCellKey = (colorId: number, sizeId: number) => `${colorId}-${sizeId}`;

  // Handle quantity change for a cell
  const handleQuantityChange = (cell: MatrixCell, value: string) => {
    const quantity = parseInt(value) || 0;
    const key = getCellKey(cell.colorId, cell.sizeId);

    setCellQuantities(prev => {
      const newMap = new Map(prev);
      if (quantity > 0) {
        newMap.set(key, quantity);
      } else {
        newMap.delete(key);
      }
      return newMap;
    });
  };

  // Reset quantities when product or template changes
  useEffect(() => {
    setCellQuantities(new Map());
  }, [selectedProduct, selectedTemplate]);

  // Calculate selected combinations
  const selectedCombinations = useMemo((): CellQuantity[] => {
    const combinations: CellQuantity[] = [];

    cellQuantities.forEach((quantity, key) => {
      const [colorId, sizeId] = key.split('-').map(Number);
      const cell = matrix.find(c => c.colorId === colorId && c.sizeId === sizeId);

      if (cell && cell.templateVariant && cell.outputVariant && quantity > 0) {
        combinations.push({
          colorId,
          sizeId,
          quantity,
          templateVariant: cell.templateVariant,
          outputVariant: cell.outputVariant,
        });
      }
    });

    return combinations;
  }, [cellQuantities, matrix]);

  const handleCreate = async () => {
    if (selectedCombinations.length === 0) {
      showToast('Ingresa al menos una cantidad en la matriz', 'error');
      return;
    }

    try {
      setCreating(true);

      // Create one conversion with all combinations
      // First, create the conversion in DRAFT mode
      const conversion = await inventoryConversionsService.createConversion({
        conversionType: 'TEMPLATE',
        templateId: selectedTemplate!.id,
        conversionDate: formData.conversionDate,
        description: formData.description || `Conversión de plantilla: ${selectedTemplate!.name}`,
        notes: formData.notes,
      });

      // Add all input items (aggregate by inputVariantId)
      // Each template variant can have MULTIPLE ingredients, so we need to process all recipes
      const inputMap = new Map<number, number>();

      selectedCombinations.forEach(combo => {
        console.log('Processing combo:', {
          variantSku: combo.templateVariant.sku,
          quantity: combo.quantity,
          recipes: combo.templateVariant.templateRecipes,
        });

        if (combo.templateVariant.templateRecipes && combo.templateVariant.templateRecipes.length > 0) {
          // Process each ingredient/recipe for this template variant
          combo.templateVariant.templateRecipes.forEach((recipe: any) => {
            // Saltar los insumos que el usuario deseleccionó de la receta.
            const insumoId = recipe.inputVariant?.input?.id;
            if (insumoId && excludedInsumoIds.has(insumoId)) {
              return;
            }
            const inputVariantId = recipe.inputVariant.id;
            const requiredQty = combo.quantity * Number(recipe.quantity);
            console.log('Adding input:', {
              inputVariantId,
              inputName: recipe.inputVariant.input?.name,
              recipeQty: recipe.quantity,
              comboQty: combo.quantity,
              requiredQty,
            });
            inputMap.set(inputVariantId, (inputMap.get(inputVariantId) || 0) + requiredQty);
          });
        } else {
          console.warn('No recipes found for variant:', combo.templateVariant.sku);
        }
      });

      console.log('Final input map:', Array.from(inputMap.entries()));

      // Add aggregated input items
      for (const [inputVariantId, totalQty] of inputMap.entries()) {
        await inventoryConversionsService.addInputItem(conversion.id, {
          inputVariantId,
          quantity: totalQty,
        });
      }

      // Add all output items
      for (const combo of selectedCombinations) {
        await inventoryConversionsService.addOutputItem(conversion.id, {
          variantId: combo.outputVariant.id,
          quantity: combo.quantity,
        });
      }

      showToast(`Conversión creada con ${selectedCombinations.length} variantes`, 'success');
      navigate(`/admin-panel/inventory-conversions/${conversion.id}`);
    } catch (error: any) {
      showToast(error.message || 'Error al crear conversión', 'error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin-panel/inventory-conversions')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Conversión desde Plantilla</h1>
          <p className="text-sm text-gray-500">
            Selecciona el producto a generar, la plantilla a usar, y la combinación de color/talla
          </p>
        </div>
      </div>

      {/* Form Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Fecha: </span>
            <span className="font-medium text-gray-900">
              {new Date(formData.conversionDate).toLocaleDateString()}
            </span>
          </div>
          {formData.description && (
            <div className="md:col-span-2">
              <span className="text-gray-600">Descripción: </span>
              <span className="font-medium text-gray-900">{formData.description}</span>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout - Product and Template Selection */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Select Product (Output) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-100">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">1. Producto a Generar</h2>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Product List */}
            <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    No hay productos con variantes
                  </p>
                  <p className="text-xs text-gray-500">
                    Genera variantes para los productos en la página de Templates o Variantes
                  </p>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setSelectedTemplate(null);
                    }}
                    className={`w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                      selectedProduct?.id === product.id ? 'bg-green-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {product.images.length > 0 ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded border border-gray-200"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">
                          {product.sku} • {product.variants.length} variantes
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Selected Product Summary */}
            {selectedProduct && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-gray-600 mb-2">Producto seleccionado:</p>
                <div className="flex items-center gap-2">
                  {selectedProduct.images.length > 0 ? (
                    <img
                      src={selectedProduct.images[0]}
                      alt={selectedProduct.name}
                      className="w-10 h-10 object-cover rounded border border-green-300"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-green-100 rounded border border-green-300 flex items-center justify-center">
                      <Package className="w-5 h-5 text-green-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                    <p className="text-sm text-gray-600">{selectedProduct.sku}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Select Template */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <Shirt className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-900">2. Plantilla a Usar</h2>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {!selectedProduct ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  Primero selecciona un producto
                </p>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Buscar plantilla..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Template List */}
                <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredTemplates.length === 0 ? (
                    <div className="p-6 text-center">
                      <Shirt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        No hay plantillas con variantes
                      </p>
                      <p className="text-xs text-gray-500">
                        Genera variantes para las plantillas en la página de Templates
                      </p>
                    </div>
                  ) : (
                    filteredTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplate(template);
                        }}
                        className={`w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                          selectedTemplate?.id === template.id ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {template.images.length > 0 ? (
                            <img
                              src={template.images[0]}
                              alt={template.name}
                              className="w-12 h-12 object-cover rounded border border-gray-200"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                              <Shirt className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{template.name}</p>
                            <p className="text-sm text-gray-500">
                              {template.sku} • {template.variants.length} variantes
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Selected Template Summary */}
                {selectedTemplate && (
                  <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-xs text-gray-600 mb-2">Plantilla seleccionada:</p>
                    <div className="flex items-center gap-2">
                      {selectedTemplate.images.length > 0 ? (
                        <img
                          src={selectedTemplate.images[0]}
                          alt={selectedTemplate.name}
                          className="w-10 h-10 object-cover rounded border border-indigo-300"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-indigo-100 rounded border border-indigo-300 flex items-center justify-center">
                          <Shirt className="w-5 h-5 text-indigo-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{selectedTemplate.name}</p>
                        <p className="text-sm text-gray-600">{selectedTemplate.sku}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Loading Recipes Indicator */}
      {selectedTemplate && loadingRecipes && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <p className="text-sm text-gray-600">Cargando recetas de la plantilla...</p>
          </div>
        </div>
      )}

      {/* Insumos de la receta: seleccionar / deseleccionar lo que se consume */}
      {selectedProduct && selectedTemplate && !loadingRecipes && recipeInsumos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
            <h2 className="font-semibold text-gray-900">3. Insumos de la receta</h2>
            <p className="text-xs text-gray-600 mt-1">
              Marca los insumos que esta conversión debe consumir. Si desmarcas uno, no se
              descontará de inventario.
            </p>
          </div>
          <div className="p-4 space-y-2">
            {recipeInsumos.map((insumo) => {
              const checked = !excludedInsumoIds.has(insumo.inputId);
              return (
                <label
                  key={insumo.inputId}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    checked ? 'border-orange-300 bg-orange-50/50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleInsumo(insumo.inputId)}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{insumo.name}</p>
                    <p className="text-xs text-gray-500">
                      {insumo.code} · {insumo.lines} variante(s) en la receta
                    </p>
                  </div>
                  {!checked && (
                    <span className="text-xs text-gray-400">No se consume</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Matrix: Color x Size */}
      {selectedProduct && selectedTemplate && matrix.length > 0 && !loadingRecipes && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
            <h2 className="font-semibold text-gray-900">4. Ingresa Cantidades por Color y Talla</h2>
            <p className="text-xs text-gray-600 mt-1">
              Ingresa la cantidad a producir en cada combinación (puedes seleccionar múltiples)
            </p>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-300 bg-gray-50 p-2 text-sm font-medium text-gray-700">
                    Color / Talla
                  </th>
                  {matrixSizes.map(size => (
                    <th
                      key={size.id}
                      className="border border-gray-300 bg-gray-50 p-2 text-sm font-medium text-gray-700"
                    >
                      {size.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixColors.map(color => (
                  <tr key={color.id}>
                    <td className="border border-gray-300 bg-gray-50 p-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded border border-gray-300"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-sm font-medium text-gray-700">{color.name}</span>
                      </div>
                    </td>
                    {matrixSizes.map(size => {
                      const cell = matrix.find(
                        c => c.colorId === color.id && c.sizeId === size.id
                      );
                      const cellKey = getCellKey(color.id, size.id);
                      const currentQty = cellQuantities.get(cellKey) || 0;

                      if (!cell) {
                        return (
                          <td key={`${color.id}-${size.id}`} className="border border-gray-300 p-2">
                            <div className="text-center text-xs text-gray-400">-</div>
                          </td>
                        );
                      }

                      return (
                        <td key={`${color.id}-${size.id}`} className="border border-gray-300 p-2">
                          {cell.available ? (
                            <div className="flex flex-col items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max={cell.templateVariant?.stock || 0}
                                value={currentQty || ''}
                                onChange={(e) => handleQuantityChange(cell, e.target.value)}
                                placeholder="0"
                                className={`w-16 px-2 py-1 text-center text-sm border rounded focus:ring-2 focus:ring-orange-500 ${
                                  currentQty > 0 ? 'border-orange-500 bg-orange-50' : 'border-gray-300'
                                }`}
                              />
                              <span className="text-xs text-gray-500">
                                Máx: {cell.templateVariant?.stock || 0}
                              </span>
                            </div>
                          ) : (
                            <div className="text-center">
                              <span className="text-xs text-gray-400">N/A</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary and Actions */}
      {selectedCombinations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            Resumen: {selectedCombinations.length} variante{selectedCombinations.length !== 1 ? 's' : ''} seleccionada{selectedCombinations.length !== 1 ? 's' : ''}
          </h3>

          {/* List of selected combinations */}
          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {selectedCombinations.map((combo, idx) => (
              <div key={`${combo.colorId}-${combo.sizeId}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: matrix.find(c => c.colorId === combo.colorId)?.colorHex || '#ccc' }}
                  />
                  <div>
                    <p className="font-medium text-gray-900">
                      {matrix.find(c => c.colorId === combo.colorId)?.colorName} • {matrix.find(c => c.sizeId === combo.sizeId)?.sizeName}
                    </p>
                    <p className="text-xs text-gray-500">
                      SKU: {combo.outputVariant.sku}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-orange-600">{combo.quantity} unidades</p>
                  <p className="text-xs text-gray-500">
                    Stock plantilla: {combo.templateVariant.stock}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Total Summary */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">Total a Producir:</span>
              <span className="text-lg font-bold text-orange-600">
                {selectedCombinations.reduce((sum, c) => sum + c.quantity, 0)} unidades
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="admin-outline"
              onClick={() => navigate('/admin-panel/inventory-conversions')}
            >
              Cancelar
            </Button>
            <Button
              variant="admin-orange"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Crear Conversión
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-sm text-gray-600">
          <strong>Flujo:</strong> Selecciona el producto que quieres generar, luego la plantilla con la receta de insumos.
          La matriz muestra todas las combinaciones de color y talla del producto. Ingresa las cantidades directamente en las celdas
          (puedes seleccionar múltiples combinaciones). Las celdas con "N/A" no están disponibles (falta la variante de plantilla
          o producto, o no hay stock). Al crear la conversión, se agregarán automáticamente todos los insumos necesarios
          según la receta de la plantilla para todas las variantes seleccionadas.
        </p>
      </div>
    </div>
  );
}
