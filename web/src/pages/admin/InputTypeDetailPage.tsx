import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Save, Tags, Trash2 } from 'lucide-react';
import { inputTypesService, type CreateInputTypeDto, type UpdateInputTypeDto } from '../../services/input-types.service';
import { catalogsService } from '../../services/catalogs.service';
import type { Size } from '../../types/catalog';
import {
  Page, PageHeader, Button, Card, CardTitle, Field, TextInput, TextArea, NumberInput, FormGrid, FormActions,
  Alert, Spinner, EmptyState, useConfirm, toast,
} from '../../components/ui';
import { errorMessage } from '../../lib/http';

const LIST = '/admin-panel/input-types';

export default function InputTypeDetailPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== 'new';

  const [formData, setFormData] = useState<CreateInputTypeDto>({
    name: '',
    description: '',
    sortOrder: 0,
    sizeIds: [],
  });

  const [availableSizes, setAvailableSizes] = useState<Size[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    loadSizes();
    if (isEditing) {
      loadInputType();
    }
  }, [id]);

  const loadSizes = async () => {
    try {
      const sizes = await catalogsService.getSizes();
      setAvailableSizes(sizes.filter((s) => s.isActive));
    } catch (err) {
      console.error('Error al cargar tallas:', err);
    }
  };

  const loadInputType = async () => {
    try {
      setLoading(true);
      const data = await inputTypesService.getById(parseInt(id!));
      setFormData({
        name: data.name,
        description: data.description || '',
        sortOrder: data.sortOrder,
        sizeIds: data.inputTypeSizes?.map((its) => its.sizeId) || [],
      });
    } catch (err) {
      setError('Error al cargar el tipo de insumo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!formData.name.trim()) {
      setNameError('El nombre es requerido');
      toast.error('El nombre es requerido');
      return;
    }
    setNameError(null);

    try {
      setLoading(true);
      setError(null);

      // hasVariants se determina automáticamente por si hay tallas seleccionadas
      const hasVariants = formData.sizeIds && formData.sizeIds.length > 0;

      if (isEditing) {
        const updateData: UpdateInputTypeDto = {
          name: formData.name,
          description: formData.description || undefined,
          sortOrder: formData.sortOrder,
          hasVariants,
          sizeIds: formData.sizeIds || [],
        };
        await inputTypesService.update(parseInt(id!), updateData);
        toast.success('Tipo de insumo actualizado');
      } else {
        await inputTypesService.create({
          ...formData,
          hasVariants,
          sizeIds: formData.sizeIds || [],
        });
        toast.success('Tipo de insumo creado');
      }

      navigate(LIST);
    } catch (err) {
      setError('Error al guardar el tipo de insumo');
      toast.error('No se pudo guardar el tipo de insumo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: '¿Eliminar este tipo de insumo?',
      message: 'No se puede deshacer.',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setLoading(true);
      await inputTypesService.delete(parseInt(id!));
      toast.success('Tipo de insumo eliminado');
      navigate(LIST);
    } catch (err) {
      const msg = errorMessage(err, 'Error al eliminar el tipo de insumo');
      setError(msg);
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSize = (sizeId: number) => {
    setFormData((prev) => ({
      ...prev,
      sizeIds: prev.sizeIds?.includes(sizeId)
        ? prev.sizeIds.filter((sid) => sid !== sizeId)
        : [...(prev.sizeIds || []), sizeId],
    }));
  };

  const selectedCount = formData.sizeIds?.length || 0;

  if (loading && isEditing && !formData.name) {
    return <Page><Spinner label="Cargando…" /></Page>;
  }

  return (
    <Page>
      <PageHeader
        icon={Tags}
        backTo={LIST}
        title={isEditing ? 'Editar tipo de insumo' : 'Nuevo tipo de insumo'}
        subtitle={isEditing ? formData.name : 'Crea una categoría para agrupar insumos'}
      />

      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardTitle>Datos</CardTitle>
          <FormGrid cols={3}>
            <Field label="Nombre" required error={nameError} className="md:col-span-2">
              <TextInput
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Camisetas base, Sublimación, DTF"
              />
            </Field>
            <Field label="Orden" hint="Los números menores aparecen primero.">
              <NumberInput
                min="0"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Descripción" className="md:col-span-3">
              <TextArea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el tipo de insumo…"
              />
            </Field>
          </FormGrid>
        </Card>

        <Card>
          <CardTitle actions={<span className="text-sm text-gray-500">{selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}</span>}>
            Tallas
          </CardTitle>
          <p className="text-sm text-gray-500 -mt-2 mb-4">
            Marca las tallas que aplican (camisetas, gorras…): los insumos de este tipo tendrán variantes talla × color.
            Sin tallas, se manejan por unidad simple (tintas, papel…).
          </p>
          {availableSizes.length === 0 ? (
            <EmptyState title="No hay tallas disponibles" description="Crea tallas en Catálogo → Atributos → Tallas." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((size) => {
                const on = formData.sizeIds?.includes(size.id) || false;
                return (
                  <button
                    key={size.id}
                    type="button"
                    aria-pressed={on}
                    title={size.name}
                    onClick={() => toggleSize(size.id)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm transition-colors ${
                      on ? 'border-app-500 bg-app-50 text-app-700 font-medium' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {on && <Check className="w-3.5 h-3.5" />}
                    {size.abbreviation}
                    <span className={`text-xs ${on ? 'text-app-600' : 'text-gray-400'}`}>{size.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <FormActions sticky>
          {isEditing && (
            <Button variant="ghost" className="sm:mr-auto text-red-600 hover:bg-red-50 hover:text-red-700" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete} disabled={loading}>
              Eliminar
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
          <Button type="submit" icon={<Save className="w-4 h-4" />} isLoading={loading}>Guardar</Button>
        </FormActions>
      </form>
    </Page>
  );
}
