import { useEffect, useState } from 'react';
import { Modal } from '../shared/Modal';
import { Package, AlertCircle, Check } from 'lucide-react';
import * as variantsService from '../../services/variants.service';
import { templateRecipesService } from '../../services/template-recipes.service';
import { inputsService, type InputVariant } from '../../services/inputs.service';
import { Button, toast } from '../ui';

interface TemplateRecipesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: number;
  templateName: string;
}

interface VariantWithRecipe {
  variantId: number;
  sku: string;
  color: string;
  size: string;
  recipeInputVariantId: number | null;
  availableStock: number;
}

export function TemplateRecipesModal({
  isOpen,
  onClose,
  templateId,
  templateName,
}: TemplateRecipesModalProps) {

  const [variants, setVariants] = useState<VariantWithRecipe[]>([]);
  const [inputVariants, setInputVariants] = useState<(InputVariant & { input: { id: number; code: string; name: string; unitOfMeasure: string; isActive: boolean } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, templateId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar variantes del template
      const productVariants = await variantsService.getVariants({ productId: templateId });

      // Cargar recetas existentes
      const recipes = await templateRecipesService.getRecipesByProduct(templateId);

      // Cargar stock disponible
      const stockData = await templateRecipesService.getAvailableStock(templateId);

      // Combinar datos
      const variantsWithRecipes: VariantWithRecipe[] = productVariants.map((v) => {
        const recipe = recipes.find((r) => r.variantId === v.id);
        const stock = stockData.find((s) => s.variantId === v.id);

        return {
          variantId: v.id,
          sku: v.sku,
          color: v.color?.name || 'Sin color',
          size: v.size?.name || 'Sin talla',
          recipeInputVariantId: recipe?.inputVariantId || null,
          availableStock: stock?.availableStock || 0,
        };
      });

      setVariants(variantsWithRecipes);

      // Cargar todas las variantes de insumos disponibles
      const allInputVariants = await inputsService.getAllVariants();
      setInputVariants(allInputVariants.filter((iv) => iv.input.isActive));
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignInput = async (variantId: number, inputVariantId: number | null) => {
    try {
      if (inputVariantId === null) {
        // Eliminar asociación
        await templateRecipesService.deleteRecipe(variantId);
        toast.success('Asociación eliminada');
      } else {
        // Crear o actualizar asociación
        await templateRecipesService.createRecipe({
          variantId,
          inputVariantId,
          quantity: 1,
        });
        toast.success('Insumo asociado correctamente');
      }

      // Recargar datos
      await loadData();
    } catch (error: any) {
      console.error('Error assigning input:', error);
      toast.error('Error al asociar insumo');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Recetas: ${templateName}`} size="lg">
      <div className="space-y-4">
        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm text-blue-800">
              <p className="font-medium mb-1">Asociar Insumo Principal</p>
              <p>Asigna el insumo base (camiseta/suéter) que se usará para cada variante del template. El stock disponible se calculará automáticamente.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Cargando...</div>
        ) : variants.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1 text-sm text-yellow-800">
                <p className="font-medium mb-1">No hay variantes</p>
                <p>Este template no tiene variantes creadas. Genera las variantes primero usando el botón de generación de variantes.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {variants.map((variant) => {
              const selectedInput = inputVariants.find((iv) => iv.id === variant.recipeInputVariantId);
              const hasRecipe = variant.recipeInputVariantId !== null;

              return (
                <div
                  key={variant.variantId}
                  className={`border rounded-lg p-4 ${hasRecipe ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Variant Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {hasRecipe && <Check className="w-4 h-4 text-green-600" />}
                        <h4 className="font-medium text-gray-900">
                          {variant.color} - {variant.size}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">SKU: {variant.sku}</p>

                      {/* Input Selection */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Insumo:</label>
                        <select
                          value={variant.recipeInputVariantId || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : null;
                            handleAssignInput(variant.variantId, value);
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
                        >
                          <option value="">Sin asociar</option>
                          {inputVariants.map((iv) => (
                            <option key={iv.id} value={iv.id}>
                              {iv.input.name} - {iv.color?.name || 'Sin color'} {iv.size?.abbreviation || 'Sin talla'} (Stock: {iv.currentStock})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Stock Info */}
                      {selectedInput && (
                        <div className="mt-2 text-xs space-y-1">
                          <div className="flex justify-between text-gray-600">
                            <span>Stock del insumo:</span>
                            <span className="font-medium">{selectedInput.currentStock} {selectedInput.input.unitOfMeasure}</span>
                          </div>
                          <div className="flex justify-between text-green-700 font-medium">
                            <span>Stock disponible:</span>
                            <span>{variant.availableStock} unidades</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
