import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { zoneTypesService, type CreateZoneTypeDto } from '../../services/zone-types.service';
import { Save, Scissors, Trash2 } from 'lucide-react';
import {
  Alert, Button, Card, CardTitle, Field, FormActions, FormGrid, NumberInput, Page, PageHeader, Spinner,
  TextArea, TextInput, toast, useConfirm,
} from '../../components/ui';

const LIST = '/admin-panel/zone-types';

export default function ZoneTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isNew = id === 'new';

  const [formData, setFormData] = useState<CreateZoneTypeDto>({
    name: '',
    slug: '',
    description: '',
    sortOrder: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && id) {
      loadZoneType(parseInt(id));
    }
  }, [id, isNew]);

  const loadZoneType = async (zoneTypeId: number) => {
    try {
      setLoading(true);
      const data = await zoneTypesService.getById(zoneTypeId);
      setFormData({
        name: data.name,
        slug: data.slug,
        description: data.description || '',
        sortOrder: data.sortOrder,
      });
    } catch (err) {
      setError('Error al cargar el tipo de zona');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isNew) {
        await zoneTypesService.create(formData);
        toast.success('Tipo de zona creado');
      } else {
        await zoneTypesService.update(parseInt(id!), formData);
        toast.success('Tipo de zona actualizado');
      }
      navigate(LIST);
    } catch (err: any) {
      const msg = err?.message || 'Error al guardar el tipo de zona';
      setError(msg);
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: '¿Eliminar este tipo de zona?', message: 'Las plantillas que lo usen pueden quedar sin zona. No se puede deshacer.', tone: 'danger' }))) return;

    try {
      setLoading(true);
      await zoneTypesService.delete(parseInt(id!));
      toast.success('Tipo de zona eliminado');
      navigate(LIST);
    } catch (err: any) {
      const msg = err?.message || 'Error al eliminar el tipo de zona';
      setError(msg);
      toast.error(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generar slug desde el nombre
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setFormData((prev) => ({ ...prev, name, slug }));
  };

  return (
    <Page>
      <PageHeader
        icon={Scissors}
        backTo={LIST}
        title={isNew ? 'Nuevo tipo de zona' : 'Editar tipo de zona'}
        subtitle={isNew ? 'Crea un nuevo tipo de zona para las plantillas' : 'Modifica la información del tipo de zona'}
      />

      {error && <Alert tone="error">{error}</Alert>}

      {loading && !isNew ? <Spinner label="Cargando…" /> : (
        <form onSubmit={handleSubmit} className="max-w-3xl">
          <Card>
            <CardTitle>Información</CardTitle>
            <div className="space-y-4">
              <FormGrid>
                <Field label="Nombre" required htmlFor="zt-name">
                  <TextInput id="zt-name" value={formData.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ej: Frente, Espalda, Mangas" required autoFocus={isNew} />
                </Field>
                <Field label="Slug" required htmlFor="zt-slug" hint="Identificador único; se genera desde el nombre.">
                  <TextInput id="zt-slug" value={formData.slug} onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))} placeholder="frente" required className="font-mono" />
                </Field>
              </FormGrid>
              <Field label="Descripción" htmlFor="zt-desc">
                <TextArea id="zt-desc" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe el tipo de zona…" />
              </Field>
              <Field label="Orden de aparición" htmlFor="zt-order" hint="Los números menores aparecen primero." className="max-w-xs">
                <NumberInput id="zt-order" value={formData.sortOrder} onChange={(e) => setFormData((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} min="0" step="1" />
              </Field>
            </div>
            <FormActions>
              {!isNew && (
                <Button variant="danger" className="sm:mr-auto" onClick={handleDelete} disabled={loading} icon={<Trash2 className="w-4 h-4" />}>Eliminar</Button>
              )}
              <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
              <Button type="submit" isLoading={loading} icon={<Save className="w-4 h-4" />}>Guardar</Button>
            </FormActions>
          </Card>
        </form>
      )}
    </Page>
  );
}
