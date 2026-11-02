import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Trash2, Truck } from 'lucide-react';
import {
  Page, PageHeader, Button, Card, CardTitle, Field, TextInput, TextArea, SelectInput, Switch, FormGrid, FormActions,
  Spinner, useConfirm, toast,
} from '../../components/ui';
import * as suppliersService from '../../services/suppliers.service';

const LIST = '/admin-panel/suppliers';

const EMPTY = {
  code: '',
  name: '',
  taxId: '',
  taxIdType: 'NIT',
  contactName: '',
  email: '',
  phone: '',
  altPhone: '',
  website: '',
  address: '',
  city: '',
  department: '',
  postalCode: '',
  country: 'Colombia',
  paymentTerms: '',
  paymentMethod: '',
  bankName: '',
  bankAccountType: '',
  bankAccount: '',
  notes: '',
  isActive: true,
};

type FormState = typeof EMPTY;
type TextKey = Exclude<keyof FormState, 'isActive'>;

export default function SupplierDetailPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== 'new';

  const [formData, setFormData] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; name?: string }>({});

  useEffect(() => {
    if (isEditing) loadSupplier();
    else generateCode();
  }, [id]);

  const generateCode = async () => {
    try {
      const code = await suppliersService.generateCode();
      setFormData((prev) => ({ ...prev, code }));
    } catch (error) {
      toast.error('Error al generar código');
    }
  };

  const loadSupplier = async () => {
    try {
      setLoading(true);
      const supplier = await suppliersService.getSupplierById(Number(id));
      setFormData({
        code: supplier.code,
        name: supplier.name,
        taxId: supplier.taxId || '',
        taxIdType: supplier.taxIdType || 'NIT',
        contactName: supplier.contactName || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        altPhone: supplier.altPhone || '',
        website: supplier.website || '',
        address: supplier.address || '',
        city: supplier.city || '',
        department: supplier.department || '',
        postalCode: supplier.postalCode || '',
        country: supplier.country || 'Colombia',
        paymentTerms: supplier.paymentTerms || '',
        paymentMethod: supplier.paymentMethod || '',
        bankName: supplier.bankName || '',
        bankAccountType: supplier.bankAccountType || '',
        bankAccount: supplier.bankAccount || '',
        notes: supplier.notes || '',
        isActive: supplier.isActive,
      });
    } catch (error) {
      toast.error('Error al cargar proveedor');
      navigate(LIST);
    } finally {
      setLoading(false);
    }
  };

  /** Props de un campo de texto: valor y cambio. */
  const bind = (key: TextKey) => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setFormData({ ...formData, [key]: e.target.value }),
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!formData.code || !formData.name) {
      setErrors({ code: formData.code ? undefined : 'Requerido', name: formData.name ? undefined : 'Requerido' });
      toast.error('El código y nombre son requeridos');
      return;
    }
    setErrors({});

    try {
      setSaving(true);
      if (isEditing) {
        await suppliersService.updateSupplier(Number(id), formData);
        toast.success('Proveedor actualizado');
      } else {
        await suppliersService.createSupplier(formData);
        toast.success('Proveedor creado');
      }
      navigate(LIST);
    } catch (error: any) {
      toast.error(error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: '¿Eliminar este proveedor?', message: 'Esta acción no se puede deshacer.', tone: 'danger' });
    if (!ok) return;
    try {
      setSaving(true);
      await suppliersService.deleteSupplier(Number(id));
      toast.success('Proveedor eliminado');
      navigate(LIST);
    } catch (error: any) {
      toast.error(error?.message || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Page><Spinner label="Cargando proveedor…" /></Page>;
  }

  return (
    <Page>
      <PageHeader
        icon={Truck}
        backTo={LIST}
        title={isEditing ? (formData.name || 'Proveedor') : 'Nuevo proveedor'}
        subtitle={isEditing ? <span className="font-mono">{formData.code}</span> : 'Registra un proveedor para tus órdenes de compra'}
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardTitle>Identificación</CardTitle>
            <FormGrid cols={2}>
              <Field label="Código" required error={errors.code} hint={!isEditing ? 'Se genera solo; puedes cambiarlo.' : undefined}>
                <TextInput {...bind('code')} error={!!errors.code} className="font-mono" />
              </Field>
              <Field label="Nombre o razón social" required error={errors.name}>
                <TextInput {...bind('name')} error={!!errors.name} />
              </Field>
              <Field label="Tipo de identificación">
                <SelectInput {...bind('taxIdType')}>
                  <option value="NIT">NIT</option>
                  <option value="RUT">RUT</option>
                  <option value="CC">Cédula</option>
                  <option value="CE">Cédula de extranjería</option>
                </SelectInput>
              </Field>
              <Field label="Número de identificación">
                <TextInput {...bind('taxId')} />
              </Field>
            </FormGrid>
          </Card>

          <Card>
            <CardTitle>Contacto</CardTitle>
            <FormGrid cols={2}>
              <Field label="Nombre de contacto"><TextInput {...bind('contactName')} /></Field>
              <Field label="Correo"><TextInput type="email" {...bind('email')} /></Field>
              <Field label="Teléfono"><TextInput type="tel" {...bind('phone')} /></Field>
              <Field label="Teléfono alternativo"><TextInput type="tel" {...bind('altPhone')} /></Field>
              <Field label="Sitio web" className="md:col-span-2"><TextInput {...bind('website')} placeholder="https://…" /></Field>
            </FormGrid>
          </Card>

          <Card>
            <CardTitle>Dirección</CardTitle>
            <FormGrid cols={2}>
              <Field label="Dirección" className="md:col-span-2"><TextInput {...bind('address')} /></Field>
              <Field label="Ciudad"><TextInput {...bind('city')} /></Field>
              <Field label="Departamento"><TextInput {...bind('department')} /></Field>
              <Field label="Código postal"><TextInput {...bind('postalCode')} /></Field>
              <Field label="País"><TextInput {...bind('country')} /></Field>
            </FormGrid>
          </Card>

          <Card>
            <CardTitle>Pago</CardTitle>
            <FormGrid cols={2}>
              <Field label="Términos de pago"><TextInput {...bind('paymentTerms')} placeholder="Ej: 30 días" /></Field>
              <Field label="Método de pago"><TextInput {...bind('paymentMethod')} placeholder="Ej: Transferencia" /></Field>
              <Field label="Banco"><TextInput {...bind('bankName')} /></Field>
              <Field label="Tipo de cuenta">
                <SelectInput {...bind('bankAccountType')}>
                  <option value="">Seleccionar…</option>
                  <option value="Ahorros">Ahorros</option>
                  <option value="Corriente">Corriente</option>
                </SelectInput>
              </Field>
              <Field label="Número de cuenta" className="md:col-span-2"><TextInput {...bind('bankAccount')} /></Field>
            </FormGrid>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle>Estado</CardTitle>
            <Switch
              checked={formData.isActive}
              onChange={(v) => setFormData({ ...formData, isActive: v })}
              label="Proveedor activo"
              description="Solo los activos aparecen al crear órdenes de compra."
            />
          </Card>
          <Card>
            <CardTitle>Notas</CardTitle>
            <TextArea rows={5} {...bind('notes')} placeholder="Notas sobre el proveedor…" />
          </Card>
        </div>

        <div className="lg:col-span-3">
          <FormActions sticky>
            {isEditing && (
              <Button variant="ghost" className="sm:mr-auto text-red-600 hover:bg-red-50 hover:text-red-700" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete} disabled={saving}>
                Eliminar
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
            <Button type="submit" icon={<Save className="w-4 h-4" />} isLoading={saving}>{isEditing ? 'Guardar' : 'Crear proveedor'}</Button>
          </FormActions>
        </div>
      </form>
    </Page>
  );
}
