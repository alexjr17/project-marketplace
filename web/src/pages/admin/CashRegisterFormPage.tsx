import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Monitor, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import * as cashRegisterService from '../../services/cash-register.service';
import { catalogsService, type Category } from '../../services/catalogs.service';

export default function CashRegisterFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
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
        showToast('Error al cargar la información', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEditing, showToast]);

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
    if (!window.confirm('¿Eliminar esta caja registradora? Esta acción no se puede deshacer.')) return;
    try {
      setSaving(true);
      await cashRegisterService.deleteCashRegister(Number(id));
      showToast('Caja eliminada correctamente', 'success');
      navigate('/admin-panel/cash-registers');
    } catch (error: any) {
      console.error('Error eliminando la caja:', error);
      showToast(error.response?.data?.message || 'No se pudo eliminar la caja', 'error');
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.code.trim()) {
      showToast('Completa nombre, ubicación y código', 'error');
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
        showToast('Caja actualizada correctamente', 'success');
      } else {
        await cashRegisterService.createCashRegister(payload);
        showToast('Caja creada correctamente', 'success');
      }
      navigate('/admin-panel/cash-registers');
    } catch (error: any) {
      console.error('Error guardando la caja:', error);
      showToast(error.response?.data?.message || 'Error al guardar la caja', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const allCategories = form.categoryIds.length === 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Monitor className="w-7 h-7 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Editar Caja Registradora' : 'Nueva Caja Registradora'}
            </h1>
            <p className="text-gray-600 mt-0.5 text-sm">
              Datos de la caja y categorías de productos que puede vender
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin-panel/cash-registers')}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Caja principal" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación *</label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Mostrador" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CAJA01" />
            <p className="text-xs text-gray-500 mt-1">Código único para identificar la caja</p>
          </div>
          {isEditing && (
            <div className="flex items-end">
              <label className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900">Estado de la caja</p>
                  <p className="text-xs text-gray-500">{form.isActive ? 'Activa y disponible' : 'Inactiva'}</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
              </label>
            </div>
          )}
        </div>

        {/* Categorías */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Categorías que vende esta caja
            </label>
            {form.categoryIds.length > 0 && (
              <button
                type="button"
                onClick={() => setForm({ ...form, categoryIds: [] })}
                className="text-xs font-medium text-orange-600 hover:text-orange-700"
              >
                Quitar todas (vender todo)
              </button>
            )}
          </div>
          <p className={`text-xs mb-2 ${allCategories ? 'text-green-600' : 'text-gray-500'}`}>
            {allCategories
              ? 'Sin categorías seleccionadas: esta caja podrá vender TODOS los productos.'
              : 'Solo se mostrarán en el POS los productos de las categorías marcadas.'}
          </p>
          <div className="border border-gray-300 rounded-lg p-3 bg-gray-50 max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500">No hay categorías.</p>
            ) : (
              categories.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
          <div>
            {isEditing && (
              <Button variant="admin-danger" onClick={handleDelete} disabled={saving}>
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="admin-secondary" onClick={() => navigate('/admin-panel/cash-registers')} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="admin-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
