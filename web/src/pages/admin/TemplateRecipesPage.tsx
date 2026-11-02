import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, Plus, Save, Shirt, Trash2 } from 'lucide-react';
import { getVariants, type ProductVariant } from '../../services/variants.service';
import { inputsService, type Input, type InputVariant } from '../../services/inputs.service';
import { templateRecipesService } from '../../services/template-recipes.service';
import {
  Badge, Button, Card, Dialog, EmptyState, Field, NumberInput, Page, PageHeader, SearchInput, Spinner, Thumb, toast, useConfirm,
} from '../../components/ui';

interface TemplateRecipe {
  id?: number;
  inputVariantId: number;
  quantity: number;
  inputVariant?: InputVariant & { input?: { name: string; unitOfMeasure: string } };
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
  const confirm = useConfirm();

  const [templates, setTemplates] = useState<Product[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
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
      setLoading((l) => l || templates.length === 0);

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
            templateRecipes: (variant as ProductVariant & { templateRecipes?: TemplateRecipe[] }).templateRecipes || [],
          });
        }
      });

      setTemplates(Array.from(productMap.values()));
      // El servicio devuelve la lista; se acepta también la forma { inputs } por compatibilidad.
      const list = Array.isArray(inputsData) ? inputsData : (inputsData as unknown as { inputs?: Input[] })?.inputs;
      setInputs(list ?? []);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // La plantilla seleccionada se toma de la lista (así se refresca al recargar)
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;

  const toggleVariant = (variantId: number) => {
    setExpandedVariants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(variantId)) newSet.delete(variantId);
      else newSet.add(variantId);
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
      toast.error('Error: no se seleccionó una variante');
      return;
    }

    // If input has no variants, use the first variant from the input (default variant)
    let inputVariantToUse = selectedInputVariant;
    if (!inputVariantToUse && selectedInput && !selectedInput.inputType?.hasVariants) {
      if (selectedInput.variants && selectedInput.variants.length > 0) {
        inputVariantToUse = selectedInput.variants[0];
      }
    }

    if (!inputVariantToUse) {
      toast.error('Selecciona un insumo válido');
      return;
    }

    if (inputQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      setSaving(true);

      await templateRecipesService.createRecipe({
        variantId: selectedVariantId,
        inputVariantId: inputVariantToUse.id,
        quantity: inputQuantity,
      });

      toast.success('Receta agregada correctamente');
      setShowAddInputModal(false);
      loadData();
    } catch (error) {
      toast.error('Error al agregar receta');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRecipe = async (variantId: number, inputVariantId: number) => {
    if (!(await confirm({ title: '¿Quitar este insumo de la receta?', message: 'La variante dejará de descontar este insumo.', tone: 'danger', confirmText: 'Quitar' }))) return;

    try {
      setSaving(true);

      await templateRecipesService.deleteRecipeInput(variantId, inputVariantId);

      toast.success('Receta eliminada correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar receta');
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

  const canSave = !!selectedInputVariant || (!!selectedInput && !selectedInput.inputType?.hasVariants);
  const pickRow = (on: boolean) => `w-full px-3 py-2.5 text-left transition-colors ${on ? 'bg-app-50 text-app-800' : 'hover:bg-gray-50'}`;

  return (
    <Page>
      <PageHeader
        icon={ClipboardList}
        title="Recetas de plantillas"
        subtitle="Insumos y cantidades que consume cada variante de una plantilla"
        backTo="/admin-panel/templates"
      />

      {loading ? <Spinner label="Cargando recetas…" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Izquierda: plantillas */}
          <Card padded={false}>
            <div className="p-3 border-b border-gray-100">
              <SearchInput value={templateSearch} onChange={setTemplateSearch} placeholder="Buscar plantilla…" />
            </div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">
              {filteredTemplates.length === 0 ? (
                <p className="p-6 text-sm text-gray-400 text-center">
                  {templates.length === 0 ? 'No hay plantillas con variantes. Genera las variantes desde Plantillas personalizables.' : 'No se encontraron plantillas'}
                </p>
              ) : (
                filteredTemplates.map((template) => {
                  const active = selectedTemplateId === template.id;
                  const withRecipes = template.variants.filter(v => v.templateRecipes.length > 0).length;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`w-full flex items-center gap-3 p-3 text-left transition-colors border-l-2 ${active ? 'border-l-app-600 bg-app-50' : 'border-l-transparent hover:bg-gray-50'}`}
                    >
                      <Thumb src={template.images[0]} alt={template.name} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{template.name}</p>
                        <p className="text-xs text-gray-500 truncate">{template.sku} · {template.variants.length} variantes</p>
                        <p className="text-xs text-gray-400">{withRecipes} con receta</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          {/* Derecha: variantes y recetas */}
          <div className="lg:col-span-2 space-y-3">
            {!selectedTemplate ? (
              <Card>
                <EmptyState icon={Shirt} title="Selecciona una plantilla" description="Elige una plantilla de la lista para ver y editar la receta de cada variante." />
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex items-center gap-3">
                    <Thumb src={selectedTemplate.images[0]} alt={selectedTemplate.name} size="lg" />
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">{selectedTemplate.name}</h2>
                      <p className="text-sm text-gray-500">{selectedTemplate.sku} · {selectedTemplate.variants.length} variantes</p>
                    </div>
                  </div>
                </Card>

                {selectedTemplate.variants.map((variant) => {
                  const isExpanded = expandedVariants.has(variant.id);
                  const count = variant.templateRecipes.length;

                  return (
                    <Card key={variant.id} padded={false}>
                      <button
                        type="button"
                        onClick={() => toggleVariant(variant.id)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors text-left"
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg border border-gray-300 flex-shrink-0" style={{ backgroundColor: variant.color?.hexCode || '#ccc' }} />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900">{variant.color?.name || 'Sin color'} · {variant.size?.abbreviation || 'S/T'}</p>
                            <p className="text-xs text-gray-500 truncate">{variant.sku}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge tone={count > 0 ? 'green' : 'yellow'}>{count > 0 ? `${count} insumo${count !== 1 ? 's' : ''}` : 'Sin insumos'}</Badge>
                          {count > 0 && <span className="hidden sm:inline text-xs text-gray-500 tabular-nums">Stock {variant.stock}</span>}
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {count > 0 && (
                            <ul className="divide-y divide-gray-100">
                              {variant.templateRecipes.map((recipe, idx) => (
                                <li key={idx} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{recipe.inputVariant?.input?.name || 'Insumo'}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {recipe.inputVariant?.sku}
                                      {recipe.inputVariant?.color && ` · ${recipe.inputVariant.color.name}`}
                                      {recipe.inputVariant?.size && ` · ${recipe.inputVariant.size.name}`}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm font-medium text-gray-900 tabular-nums">{recipe.quantity} {recipe.inputVariant?.input?.unitOfMeasure}</span>
                                    <button
                                      type="button"
                                      title="Quitar de la receta"
                                      aria-label="Quitar de la receta"
                                      onClick={() => handleRemoveRecipe(variant.id, recipe.inputVariantId)}
                                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                                      disabled={saving}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="p-3 border-t border-gray-100">
                            <Button variant="outline" size="sm" fullWidth icon={<Plus className="w-4 h-4" />} onClick={() => handleAddRecipe(variant.id)}>
                              Agregar insumo
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={showAddInputModal}
        onClose={() => setShowAddInputModal(false)}
        title="Agregar insumo a la receta"
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowAddInputModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveRecipe} isLoading={saving} disabled={!canSave} icon={<Save className="w-4 h-4" />}>Guardar</Button>
          </>
        )}
      >
        <div className="space-y-5">
          <Field label="1. Insumo">
            <div className="space-y-2">
              <SearchInput value={inputSearch} onChange={setInputSearch} placeholder="Buscar insumo por nombre o código…" />
              <div className="rounded-lg border border-gray-200 max-h-48 overflow-y-auto divide-y divide-gray-100">
                {filteredInputs.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">Sin resultados</p>}
                {filteredInputs.map((input) => (
                  <button key={input.id} type="button" onClick={() => { setSelectedInput(input); setSelectedInputVariant(null); }} className={pickRow(selectedInput?.id === input.id)}>
                    <p className="text-sm font-medium text-gray-900">{input.name}</p>
                    <p className="text-xs text-gray-500">{input.code} · {input.unitOfMeasure}</p>
                  </button>
                ))}
              </div>
            </div>
          </Field>

          {selectedInput && selectedInput.inputType?.hasVariants && (
            <Field label="2. Variante del insumo">
              <div className="rounded-lg border border-gray-200 max-h-48 overflow-y-auto divide-y divide-gray-100">
                {selectedInput.variants?.map((variant) => (
                  <button key={variant.id} type="button" onClick={() => setSelectedInputVariant(variant)} className={pickRow(selectedInputVariant?.id === variant.id)}>
                    <p className="text-sm font-medium text-gray-900">{variant.color?.name || 'Sin color'}{variant.size?.name && ` · ${variant.size.name}`}</p>
                    <p className="text-xs text-gray-500">{variant.sku} · Stock {Number(variant.currentStock)} {selectedInput.unitOfMeasure}</p>
                  </button>
                ))}
              </div>
            </Field>
          )}

          {selectedInput && !selectedInput.inputType?.hasVariants && (
            <p className="text-sm text-gray-500">Este insumo no tiene variantes; se usará directamente.</p>
          )}

          {canSave && (
            <Field label={`${selectedInput?.inputType?.hasVariants ? '3' : '2'}. Cantidad por unidad`} className="max-w-xs">
              <NumberInput min="0.01" step="0.01" value={inputQuantity} onChange={(e) => setInputQuantity(parseFloat(e.target.value) || 0)} suffix={selectedInput?.unitOfMeasure} />
            </Field>
          )}
        </div>
      </Dialog>
    </Page>
  );
}
