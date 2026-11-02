import { useEffect, useState } from 'react';
import { MapPin, Plus, Star, Edit2, Trash2, Save, Home, CheckCircle2 } from 'lucide-react';
import { addressesService, type Address, type AddressInput } from '../../services/addresses.service';
import { CitySelect, CountrySelect } from '../shared/CitySelect';
import { Badge, Button, CardTitle, Checkbox, Dialog, EmptyState, Field, IconButton, Spinner, TextInput, useConfirm } from '../ui';
import { useToast } from '../../context/ToastContext';

interface AddressesSectionProps {
  /** Obsoleto: el acento sale del color de la app (`app-*`). Se acepta por compatibilidad. */
  brandColor?: string;
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

export const AddressesSection = (_props: AddressesSectionProps) => {
  const toast = useToast();
  const confirm = useConfirm();
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
    if (!(await confirm({ title: '¿Eliminar esta dirección?', message: 'No se puede deshacer.', tone: 'danger' }))) return;
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
    return <Spinner label="Cargando direcciones…" />;
  }

  return (
    <div>
      <CardTitle
        icon={MapPin}
        actions={
          <Button size="sm" variant="outline" onClick={openNew} icon={<Plus className="w-4 h-4" />}>
            Agregar dirección
          </Button>
        }
      >
        Mis direcciones
      </CardTitle>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Aún no tienes direcciones guardadas"
          description="Agrega una para agilizar tus compras."
          action={<Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>Agregar dirección</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {addresses.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border p-4 flex flex-col ${a.isDefault ? 'border-app-300 bg-app-50/40' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-start gap-3">
                <Home className={`w-5 h-5 flex-shrink-0 mt-0.5 ${a.isDefault ? 'text-app-600' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                    {a.isDefault && <Badge tone="app"><CheckCircle2 className="w-3 h-3" />Predeterminada</Badge>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{a.address}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {a.city}
                    {a.department && `, ${a.department}`}
                    {a.postalCode && ` · ${a.postalCode}`}
                    {a.country && ` · ${a.country}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                {!a.isDefault && (
                  <Button size="sm" variant="ghost" onClick={() => handleSetDefault(a.id)} disabled={busyId === a.id} icon={<Star className="w-4 h-4" />} className="mr-auto">
                    Usar por defecto
                  </Button>
                )}
                <IconButton title="Editar dirección" tone="app" onClick={() => openEdit(a)} disabled={busyId === a.id}>
                  <Edit2 className="w-4 h-4" />
                </IconButton>
                <IconButton title="Eliminar dirección" tone="danger" onClick={() => handleDelete(a.id)} disabled={busyId === a.id}>
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crear / editar dirección */}
      <Dialog
        open={editingId !== null}
        onClose={closeForm}
        title={editingId && editingId > 0 ? 'Editar dirección' : 'Nueva dirección'}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={isSaving}>Cancelar</Button>
            <Button type="submit" form="address-form" isLoading={isSaving} icon={<Save className="w-4 h-4" />}>Guardar</Button>
          </>
        }
      >
        <form id="address-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Etiqueta" required>
              <TextInput value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Casa, Trabajo, etc." />
            </Field>
            <Field label="Código postal">
              <TextInput value={form.postalCode || ''} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="110111" />
            </Field>
            <Field label="Dirección" required className="sm:col-span-2">
              <TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle 123 #45-67, Apto 301" />
            </Field>
            <div className="sm:col-span-2">
              <CitySelect city={form.city} onChange={(city, department) => setForm({ ...form, city, department })} required />
            </div>
            <div className="sm:col-span-2">
              <CountrySelect value={form.country || 'Colombia'} onChange={(country) => setForm({ ...form, country })} />
            </div>
          </div>
          <Checkbox
            label="Usar como dirección predeterminada"
            checked={!!form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
        </form>
      </Dialog>
    </div>
  );
};
