import { useEffect, useMemo, useState } from 'react';
import { Check, Package } from 'lucide-react';
import { inputsService, type Input } from '../../services/inputs.service';
import { Alert, Badge, EmptyState, SearchInput, Spinner, toast } from '../ui';

interface TemplateRecipesSectionProps {
  templateId: number;
  selectedInputIds: number[];
  onInputsChange: (inputIds: number[]) => void;
}

/** Selección de los insumos base (camisetas, suéteres…) que usa un modelo. */
export function TemplateRecipesSection({
  selectedInputIds,
  onInputsChange,
}: TemplateRecipesSectionProps) {
  const [inputs, setInputs] = useState<Input[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    loadInputs();
  }, []);

  const loadInputs = async () => {
    setLoading(true);
    try {
      const allInputs = await inputsService.getAll();
      // Filtrar solo insumos activos (sin importar si tienen variantes o stock)
      setInputs(allInputs.filter((input) => input.isActive));
    } catch (error: any) {
      console.error('Error loading inputs:', error);
      toast.error('Error al cargar insumos');
    } finally {
      setLoading(false);
    }
  };

  const toggleInput = (inputId: number) => {
    if (selectedInputIds.includes(inputId)) {
      onInputsChange(selectedInputIds.filter(id => id !== inputId));
    } else {
      onInputsChange([...selectedInputIds, inputId]);
    }
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? inputs.filter((i) => `${i.name} ${i.code} ${i.inputType?.name ?? ''}`.toLowerCase().includes(t)) : inputs;
  }, [inputs, q]);

  if (loading) return <Spinner label="Cargando insumos…" />;

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Selecciona los insumos base (camisetas, suéteres…) que usa este modelo. El sistema asocia las variantes del insumo con las del modelo que coinciden en color y talla.
      </Alert>

      {inputs.length > 6 && <SearchInput value={q} onChange={setQ} placeholder="Buscar insumo por nombre o código…" />}

      {inputs.length === 0 ? (
        <EmptyState icon={Package} title="No hay insumos activos" description="Crea los insumos en Inventario → Insumos." />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 max-h-[28rem] overflow-y-auto">
          {shown.map((input) => {
            const variantCount = input._count?.variants || 0;
            const totalStock = input.variants?.reduce((sum, v) => sum + Number(v.currentStock), 0) || 0;
            const on = selectedInputIds.includes(input.id);
            return (
              <li key={input.id}>
                <button type="button" onClick={() => toggleInput(input.id)} aria-pressed={on}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${on ? 'bg-app-50' : 'hover:bg-gray-50'}`}>
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-app-600 bg-app-600 text-white' : 'border-gray-300 bg-white'}`}>
                    {on && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{input.name}</span>
                      {input.inputType?.name && <Badge>{input.inputType.name}</Badge>}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Código {input.code} · {variantCount} variantes · Stock total {totalStock} {input.unitOfMeasure}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">Sin resultados</li>}
        </ul>
      )}

      <p className="text-xs text-gray-500">
        {selectedInputIds.length} insumo{selectedInputIds.length !== 1 ? 's' : ''} seleccionado{selectedInputIds.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
