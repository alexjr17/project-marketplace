import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Monitor, Trash2, Tags } from 'lucide-react';
import {
  Alert, Button, Card, CardTitle, Checkbox, Field, FormActions, FormGrid, Page, PageHeader, Spinner, Switch, TextInput,
  toast, useConfirm,
} from '../../components/ui';
import * as cashRegisterService from '../../services/cash-register.service';
import { catalogsService, type Category } from '../../services/catalogs.service';

const LIST = '/admin-panel/cash-registers';

export default function CashRegisterFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [form, setForm] = useState({
    name: '',
    location: '',
    code: '',
    isActive: true,
    categoryIds: [] as number[],
  });

  useEffect(() => {
    (async () => {
      try {
        const cats = await catalogsService.getCategories();
        setCategories(cats);
        if (isEditing) {
          const reg = await cashRegisterService.getCashRegister(Number(id));
          setForm({
            name: reg.name,
            location: reg.location,
            code: reg.code,
            isActive: reg.isActive,
            categoryIds: Array.isArray(reg.categoryIds) ? reg.categoryIds : [],
          });
        }
      } catch (error) {
        console.error('Error cargando la caja:', error);
        toast.error('Error al cargar la información');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEditing]);

  const toggleCategory = (categoryId: number) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((c) => c !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    if (!(await confirm({ title: '¿Eliminar esta caja registradora?', message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      setSaving(true);
      await cashRegisterService.deleteCashRegister(Number(id));
      toast.success('Caja eliminada correctamente');
      navigate(LIST);
    } catch (error: any) {
      console.error('Error eliminando la caja:', error);
      toast.error(error.response?.data?.message || 'No se pudo eliminar la caja');
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.code.trim()) {
      toast.error('Completa nombre, ubicación y código');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        code: form.code.trim(),
        categoryIds: form.categoryIds,
      };
      if (isEditing) {
        await cashRegisterService.updateCashRegister(Number(id), { ...payload, isActive: form.isActive });
        toast.success('Caja actualizada correctamente');
      } else {
        await cashRegisterService.createCashRegister(payload);
        toast.success('Caja creada correctamente');
      }
      navigate(LIST);
    } catch (error: any) {
      console.error('Error guardando la caja:', error);
      toast.error(error.response?.data?.message || 'Error al guardar la caja');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Page><Spinner label="Cargando caja…" /></Page>;

  const allCategories = form.categoryIds.length === 0;

  return (
    <Page>
      <PageHeader
        icon={Monitor}
        backTo={LIST}
        title={isEditing ? 'Editar caja' : 'Nueva caja'}
        subtitle="Datos de la caja y categorías de productos que puede vender"
        actions={isEditing && (
          <Button variant="secondary" className="text-red-600" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete} disabled={saving}>
            Eliminar
          </Button>
        )}
      />

      <Card>
        <CardTitle icon={Monitor}>Datos de la caja</CardTitle>
        <FormGrid>
          <Field label="Nombre" required>
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Caja principal" />
          </Field>
          <Field label="Ubicación" required>
            <TextInput value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Mostrador" />
          </Field>
          <Field label="Código" required hint="Código único para identificar la caja.">
            <TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CAJA01" className="font-mono" />
          </Field>
          {isEditing && (
            <div className="md:pt-7">
              <Switch
                checked={form.isActive}
                onChange={(isActive) => setForm({ ...form, isActive })}
                label="Caja activa"
                description={form.isActive ? 'Activa y disponible en el POS' : 'Inactiva: no se puede abrir'}
              />
            </div>
          )}
        </FormGrid>
      </Card>

      <Card>
        <CardTitle
          icon={Tags}
          actions={form.categoryIds.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, categoryIds: [] })}>Quitar todas (vender todo)</Button>
          )}
        >
          Categorías que vende
        </CardTitle>
        <div className="mb-3">
          {allCategories
            ? <Alert tone="success">Sin categorías seleccionadas: esta caja podrá vender <b>todos</b> los productos.</Alert>
            : <Alert tone="info">Solo se mostrarán en el POS los productos de las {form.categoryIds.length} categorías marcadas.</Alert>}
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-500">No hay categorías.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5 max-h-80 overflow-y-auto">
            {categories.map((cat) => (
              <Checkbox key={cat.id} label={cat.name} checked={form.categoryIds.includes(cat.id)} onChange={() => toggleCategory(cat.id)} />
            ))}
          </div>
        )}
      </Card>

      <FormActions sticky>
        <Button variant="secondary" onClick={() => navigate(LIST)} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} isLoading={saving} icon={<Save className="w-4 h-4" />}>{isEditing ? 'Guardar' : 'Crear caja'}</Button>
      </FormActions>
    </Page>
  );
}
