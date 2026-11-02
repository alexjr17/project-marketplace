import { useState, useEffect } from 'react';
import { templatesService, type Template } from '../../services/templates.service';
import { Layers, Eye } from 'lucide-react';

interface TemplateSelectorProps {
  productTypeId: number | null;
  selectedTemplate: Template | null;
  onTemplateSelect: (template: Template | null) => void;
}

export const TemplateSelector = ({
  productTypeId,
  selectedTemplate,
  onTemplateSelect,
}: TemplateSelectorProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  useEffect(() => {
    if (productTypeId) {
      loadTemplates();
    } else {
      setTemplates([]);
    }
  }, [productTypeId]);

  const loadTemplates = async () => {
    if (!productTypeId) return;

    setLoading(true);
    try {
      // Por ahora cargamos todos y filtramos en el cliente
      // TODO: Implementar endpoint para filtrar por typeId en el backend
      const allTemplates = await templatesService.getAllTemplates();
      const filtered = allTemplates.filter(t => t.typeId === productTypeId && t.isActive);
      setTemplates(filtered);
    } catch (error) {
      console.error('Error cargando modelos:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  if (!productTypeId) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        Selecciona un tipo de producto para ver los modelos disponibles
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        Cargando modelos...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-6">
        <Layers className="w-12 h-12 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">
          No hay modelos disponibles para este tipo de producto
        </p>
        <button
          onClick={() => onTemplateSelect(null)}
          className="mt-3 text-sm text-app-600 hover:text-app-700 font-medium"
        >
          Personalizar desde cero
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-gray-900">
          Seleccionar Modelo
        </label>
        {selectedTemplate && (
          <button
            onClick={() => onTemplateSelect(null)}
            className="text-xs text-app-600 hover:text-app-700 font-medium"
          >
            Personalizar desde cero
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
        {templates.map((template) => (
          <div key={template.id} className="relative group">
            <button
              onClick={() => onTemplateSelect(template)}
              className={`w-full flex flex-col rounded-lg border-2 transition-all overflow-hidden ${
                selectedTemplate?.id === template.id
                  ? 'border-app-600 bg-app-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {/* Imagen del modelo */}
              {template.images?.front && (
                <div className="aspect-square bg-gray-100 relative">
                  <img
                    src={template.images.front}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay con ícono de vista previa */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              )}

              {/* Info del modelo */}
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {template.name}
                </p>
                <p className="text-xs text-gray-500">
                  ${template.basePrice.toLocaleString('es-CO')}
                </p>
              </div>
            </button>

            {/* Badge de seleccionado */}
            {selectedTemplate?.id === template.id && (
              <div className="absolute top-2 right-2 bg-app-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                Seleccionado
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewTemplate && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="bg-white rounded-xl p-4 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {previewTemplate.name}
            </h3>
            {previewTemplate.images?.front && (
              <img
                src={previewTemplate.images.front}
                alt={previewTemplate.name}
                className="w-full rounded-lg"
              />
            )}
            <p className="text-gray-600 mt-4">{previewTemplate.description}</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  onTemplateSelect(previewTemplate);
                  setPreviewTemplate(null);
                }}
                className="flex-1 bg-app-600 text-white px-4 py-2 rounded-lg hover:bg-app-700"
              >
                Usar este modelo
              </button>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
