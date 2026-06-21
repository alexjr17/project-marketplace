import { useEffect, useState } from 'react';
import { MapPin, Plus, Star, Edit2, Trash2, Save, X, Loader2, Home, CheckCircle2 } from 'lucide-react';
import { addressesService, type Address, type AddressInput } from '../../services/addresses.service';
import { CitySelect, CountrySelect } from '../shared/CitySelect';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useToast } from '../../context/ToastContext';

interface AddressesSectionProps {
  /** Color de marca para acentos. */
  brandColor: string;
}

const emptyForm: AddressInput = {
  label: '',
  address: '',
  city: '',
  department: '',
  postalCode: '',
  country: 'Colombia',
  isDefault: false,
};

export const AddressesSection = ({ brandColor }: AddressesSectionProps) => {
  const toast = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Formulario: null = oculto, 0 = nueva, >0 = editando esa dirección
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AddressInput>(emptyForm);

  const loadAddresses = async () => {
    try {
      setAddresses(await addressesService.list());
    } catch {
      toast.error('No se pudieron cargar las direcciones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setForm({ ...emptyForm, isDefault: addresses.length === 0 });
    setEditingId(0);
  };

  const openEdit = (a: Address) => {
    setForm({
      label: a.label,
      address: a.address,
      city: a.city,
      department: a.department || '',
      postalCode: a.postalCode || '',
      country: a.country || 'Colombia',
      isDefault: a.isDefault,
    });
    setEditingId(a.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim() || !form.address.trim() || !form.city.trim()) {
      toast.error('Completa la etiqueta, dirección y ciudad');
      return;
    }
    setIsSaving(true);
    try {
      if (editingId && editingId > 0) {
        await addressesService.update(editingId, form);
        toast.success('Dirección actualizada');
      } else {
        await addressesService.create(form);
        toast.success('Dirección agregada');
      }
      await loadAddresses();
      closeForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la dirección');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (id: number) => {
    setBusyId(id);
    try {
      await addressesService.setDefault(id);
      await loadAddresses();
      toast.success('Dirección predeterminada actualizada');
    } catch {
      toast.error('No se pudo marcar como predeterminada');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar esta dirección?')) return;
    setBusyId(id);
    try {
      await addressesService.remove(id);
      await loadAddresses();
      toast.success('Dirección eliminada');
    } catch {
      toast.error('No se pudo eliminar la dirección');
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-900">Mis Direcciones</h3>
        {editingId === null && (
          <Button onClick={openNew} variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Agregar dirección
          </Button>
        )}
      </div>

      {/* Formulario crear / editar */}
      {editingId !== null && (
        <form
          onSubmit={handleSave}
          className="mb-6 p-5 border-2 border-gray-200 rounded-xl bg-gray-50 space-y-4"
        >
          <h4 className="font-semibold text-gray-900">
            {editingId > 0 ? 'Editar dirección' : 'Nueva dirección'}
          </h4>

          <Input
            label="Etiqueta *"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Casa, Trabajo, etc."
          />
          <Input
            label="Dirección *"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Calle 123 #45-67, Apto 301"
          />
          <CitySelect
            city={form.city}
            onChange={(city, department) => setForm({ ...form, city, department })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Código postal"
              value={form.postalCode || ''}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              placeholder="110111"
            />
            <CountrySelect value={form.country || 'Colombia'} onChange={(country) => setForm({ ...form, country })} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            Usar como dirección predeterminada
          </label>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {isSaving ? (
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
        </form>
      )}

      {/* Lista de direcciones */}
      {addresses.length === 0 && editingId === null ? (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aún no tienes direcciones guardadas</p>
          <p className="text-sm text-gray-400 mt-1">
            Agrega una para agilizar tus compras en el checkout
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div
              key={a.id}
              className="p-4 rounded-xl border-2 transition-colors"
              style={{ borderColor: a.isDefault ? brandColor : '#e5e7eb' }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${brandColor}15` }}
                >
                  <Home className="w-5 h-5" style={{ color: brandColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{a.label}</p>
                    {a.isDefault && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Predeterminada
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{a.address}</p>
                  <p className="text-sm text-gray-600">
                    {a.city}
                    {a.department && `, ${a.department}`}
                    {a.postalCode && ` · ${a.postalCode}`}
                    {a.country && ` · ${a.country}`}
                  </p>

                  <div className="flex items-center gap-3 mt-3">
                    {!a.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(a.id)}
                        disabled={busyId === a.id}
                        className="text-sm font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
                        style={{ color: brandColor }}
                      >
                        <Star className="w-4 h-4" />
                        Predeterminada
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      disabled={busyId === a.id || editingId !== null}
                      className="text-sm font-medium text-gray-600 flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      disabled={busyId === a.id}
                      className="text-sm font-medium text-red-600 flex items-center gap-1 hover:underline disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressesSection;
