import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Save, Loader2, Package, Boxes, Shirt, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import { getVariants, type ProductVariant } from '../../services/variants.service';
import { inputsService, type Input, type InputVariant } from '../../services/inputs.service';

interface TemplateRecipe {
  id?: number;
  inputVariantId: number;
  quantity: number;
  inputVariant?: InputVariant;
}

interface TemplateVariantWithRecipes extends ProductVariant {
  templateRecipes: TemplateRecipe[];
}

interface Product {
  id: number;
  name: string;
  sku: string;
  images: string[];
  variants: TemplateVariantWithRecipes[];
}

export default function TemplateRecipesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [templates, setTemplates] = useState<Product[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Product | null>(null);
  const [inputs, setInputs] = useState<Input[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Expanded variants (accordion)
  const [expandedVariants, setExpandedVariants] = useState<Set<number>>(new Set());

  // Search
  const [templateSearch, setTemplateSearch] = useState('');

  // Modal for adding input to a variant
  const [showAddInputModal, setShowAddInputModal] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedInput, setSelectedInput] = useState<Input | null>(null);
  const [selectedInputVariant, setSelectedInputVariant] = useState<InputVariant | null>(null);
  const [inputQuantity, setInputQuantity] = useState<number>(1);
  const [inputSearch, setInputSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const [variantsData, inputsData] = await Promise.all([
        getVariants(),
        inputsService.getAll({}),
      ]);

      // Group variants by product (only templates)
      const productMap = new Map<number, Product>();

      variantsData.forEach(variant => {
        if (variant.product.isTemplate) {
          if (!productMap.has(variant.product.id)) {
            productMap.set(variant.product.id, {
              id: variant.product.id,
              name: variant.product.name,
              sku: variant.product.sku,
              images: variant.product.images || [],
              variants: [],
            });
          }
          productMap.get(variant.product.id)!.variants.push({
            ...variant,
            templateRecipes: variant.templateRecipes || [],
          });
        }
      });

      setTemplates(Array.from(productMap.values()));
      setInputs(inputsData.inputs);
    } catch (error) {
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleVariant = (variantId: number) => {
    setExpandedVariants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(variantId)) {
        newSet.delete(variantId);
      } else {
        newSet.add(variantId);
      }
      return newSet;
    });
  };

  const handleAddRecipe = (variantId: number) => {
    setSelectedVariantId(variantId);
    setSelectedInput(null);
    setSelectedInputVariant(null);
    setInputQuantity(1);
    setInputSearch('');
    setShowAddInputModal(true);
  };

  const handleSaveRecipe = async () => {
    if (!selectedVariantId) {
      showToast('Error: no se seleccionó una variante', 'error');
      return;
    }

    // If input has no variants, use the first variant from the input (default variant)
    let inputVariantToUse = selectedInputVariant;
    if (!inputVariantToUse && selectedInput && !selectedInput.inputType?.hasVariants) {
      // Use the default variant (first one) if the input doesn't have variants
      if (selectedInput.variants && selectedInput.variants.length > 0) {
        inputVariantToUse = selectedInput.variants[0];
      }
    }

    if (!inputVariantToUse) {
      showToast('Selecciona un insumo válido', 'error');
      return;
    }

    if (inputQuantity <= 0) {
      showToast('La cantidad debe ser mayor a 0', 'error');
      return;
    }

    try {
      setSaving(true);

      const authData = localStorage.getItem('marketplace_auth');
      const token = authData ? JSON.parse(authData).token : '';

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiUrl}/template-recipes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          variantId: selectedVariantId,
          inputVariantId: inputVariantToUse.id,
          quantity: inputQuantity,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al agregar receta');
      }

      showToast('Receta agregada correctamente', 'success');
      setShowAddInputModal(false);
      loadData();
    } catch (error) {
      showToast('Error al agregar receta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRecipe = async (variantId: number, inputVariantId: number, recipeId?: number) => {
    if (!confirm('¿Eliminar este insumo de la receta?')) return;

    try {
      setSaving(true);

      const authData = localStorage.getItem('marketplace_auth');
      const token = authData ? JSON.parse(authData).token : '';

      // Use the specific endpoint to delete by composite key
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(
        `${apiUrl}/template-recipes/variant/${variantId}/input/${inputVariantId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al eliminar receta');
      }

      showToast('Receta eliminada correctamente', 'success');
      loadData();
    } catch (error) {
      showToast('Error al eliminar receta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.sku.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const filteredInputs = inputs.filter(i =>
    i.name.toLowerCase().includes(inputSearch.toLowerCase()) ||
    i.code.toLowerCase().includes(inputSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas de Plantillas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los insumos y cantidades necesarias para cada variante de plantilla
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Templates List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shirt className="w-5 h-5 text-indigo-600" />
              Plantillas
            </h2>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar plantilla..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Templates */}
          <div className="max-h-[600px] overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No se encontraron plantillas</p>
            ) : (
              filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
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
        </div>

        {/* Right: Variants and Recipes */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedTemplate ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Shirt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Selecciona una plantilla para gestionar sus recetas</p>
            </div>
          ) : (
            <>
              {/* Selected Template Header */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  {selectedTemplate.images.length > 0 ? (
                    <img
                      src={selectedTemplate.images[0]}
                      alt={selectedTemplate.name}
                      className="w-16 h-16 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                      <Shirt className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedTemplate.name}</h2>
                    <p className="text-sm text-gray-500">{selectedTemplate.sku}</p>
                  </div>
                </div>
              </div>

              {/* Variants with Recipes */}
              <div className="space-y-3">
                {selectedTemplate.variants.map((variant) => {
                  const isExpanded = expandedVariants.has(variant.id);
                  const hasRecipes = variant.templateRecipes && variant.templateRecipes.length > 0;

                  return (
                    <div key={variant.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Variant Header */}
                      <button
                        onClick={() => toggleVariant(variant.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded border border-gray-300"
                            style={{ backgroundColor: variant.color?.hexCode || '#ccc' }}
                          />
                          <div className="text-left">
                            <p className="font-medium text-gray-900">
                              {variant.color?.name || 'Sin color'} • {variant.size?.abbreviation || 'S/T'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {variant.sku} • {hasRecipes ? `${variant.templateRecipes.length} insumo${variant.templateRecipes.length !== 1 ? 's' : ''}` : 'Sin insumos'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasRecipes && (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                              Stock: {variant.stock}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Variant Recipes (Expanded) */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 bg-gray-50">
                          {/* Recipes List */}
                          {variant.templateRecipes.length > 0 && (
                            <div className="divide-y divide-gray-200">
                              {variant.templateRecipes.map((recipe, idx) => (
                                <div key={idx} className="px-4 py-3 flex items-center justify-between bg-white">
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {recipe.inputVariant?.input.name || 'Insumo'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {recipe.inputVariant?.sku}
                                      {recipe.inputVariant?.color && ` • ${recipe.inputVariant.color.name}`}
                                      {recipe.inputVariant?.size && ` • ${recipe.inputVariant.size.name}`}
                                      {' • '}
                                      <span className="font-medium text-orange-600">
                                        {recipe.quantity} {recipe.inputVariant?.input.unitOfMeasure}
                                      </span>
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveRecipe(variant.id, recipe.inputVariantId, recipe.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    disabled={saving}
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Button */}
                          <div className="p-3">
                            <Button
                              variant="admin-outline"
                              size="sm"
                              onClick={() => handleAddRecipe(variant.id)}
                              className="w-full"
                            >
                              <Plus className="w-4 h-4" />
                              Agregar Insumo
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Input Modal */}
      {showAddInputModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Agregar Insumo a Receta</h3>
              <button
                onClick={() => setShowAddInputModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Step 1: Select Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1. Selecciona el Insumo
                </label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar insumo..."
                    value={inputSearch}
                    onChange={(e) => setInputSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                  {filteredInputs.map((input) => (
                    <button
                      key={input.id}
                      onClick={() => {
                        setSelectedInput(input);
                        setSelectedInputVariant(null);
                      }}
                      className={`w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                        selectedInput?.id === input.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <p className="font-medium text-gray-900">{input.name}</p>
                      <p className="text-sm text-gray-500">
                        {input.code} • {input.unitOfMeasure}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Select Variant */}
              {selectedInput && selectedInput.inputType?.hasVariants && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. Selecciona la Variante
                  </label>
                  <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                    {selectedInput.variants?.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedInputVariant(variant)}
                        className={`w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                          selectedInputVariant?.id === variant.id ? 'bg-indigo-50' : ''
                        }`}
                      >
                        <p className="font-medium text-gray-900">
                          {variant.color?.name || 'Sin color'}
                          {variant.size?.name && ` • ${variant.size.name}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          {variant.sku} • Stock: {Number(variant.currentStock)} {selectedInput.unitOfMeasure}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedInput && !selectedInput.inputType?.hasVariants && (
                <p className="text-sm text-gray-500 italic">
                  Este insumo no tiene variantes. Se usará directamente.
                </p>
              )}

              {/* Step 3: Enter Quantity */}
              {(selectedInputVariant || (selectedInput && !selectedInput.inputType?.hasVariants)) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {selectedInput?.inputType?.hasVariants ? '3' : '2'}. Ingresa la Cantidad
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={inputQuantity}
                      onChange={(e) => setInputQuantity(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Cantidad"
                    />
                    <span className="text-sm text-gray-500">{selectedInput?.unitOfMeasure}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <Button
                variant="admin-outline"
                onClick={() => setShowAddInputModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="admin-primary"
                onClick={handleSaveRecipe}
                disabled={saving || (!selectedInputVariant && (!selectedInput || selectedInput.inputType?.hasVariants))}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
