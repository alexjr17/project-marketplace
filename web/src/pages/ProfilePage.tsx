import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/shared/PageHeader';
import { Seo } from '../components/seo/Seo';
import { Badge, Button, Card, CardTitle, DescriptionList, EmptyState, Field, FormActions, Tabs, TextInput } from '../components/ui';
import { AddressesSection } from '../components/profile/AddressesSection';
import { AccountLayout } from '../components/profile/AccountLayout';
import { useToast } from '../context/ToastContext';
import { User, Calendar, Shield, Edit2, Save, Lock, LogIn } from 'lucide-react';

type ProfileTab = 'general' | 'addresses';

export const ProfilePage = () => {
  const { user, updateProfile, isAdmin, isSuperAdmin } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<ProfileTab>('general');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    cedula: user?.profile?.cedula || '',
    phone: user?.profile?.phone || '',
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Mi perfil" backLabel="Inicio" backTo="/" />
        <AccountLayout>
          <Card padded={false}>
            <EmptyState icon={LogIn} title="No has iniciado sesión" description="Inicia sesión desde el ícono de usuario para ver tu perfil." />
          </Card>
        </AccountLayout>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateProfile({
        name: formData.name,
        cedula: formData.cedula,
        phone: formData.phone,
      });
      toast.success('Perfil actualizado correctamente');
      setIsEditing(false);
    } catch {
      toast.error('Error al actualizar el perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name,
      cedula: user.profile?.cedula || '',
      phone: user.profile?.phone || '',
    });
    setIsEditing(false);
  };

  const tabs: { value: ProfileTab; label: string }[] = [
    { value: 'general', label: 'Información general' },
    { value: 'addresses', label: 'Direcciones' },
  ];

  const memberSince = new Date(user.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo title="Mi perfil" />
      <PageHeader title="Mi perfil" subtitle="Gestiona tu información personal" backLabel="Inicio" backTo="/" />

      <AccountLayout>
        {/* Identidad */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-app-100 text-app-700 flex items-center justify-center text-xl font-bold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{user.name}</h2>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {(isAdmin || isSuperAdmin) && (
                  <Badge tone="app"><Shield className="w-3 h-3" />{user.roleName || 'Administrador'}</Badge>
                )}
                <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />Miembro desde {memberSince}</span>
              </div>
            </div>
          </div>
        </Card>

        <Tabs tabs={tabs} value={activeTab} onChange={(v) => setActiveTab(v)} />

        {activeTab === 'general' && (
          <>
            <Card>
              <CardTitle
                icon={User}
                actions={
                  !isEditing && (
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} icon={<Edit2 className="w-4 h-4" />}>
                      Editar
                    </Button>
                  )
                }
              >
                Información personal
              </CardTitle>

              {isEditing ? (
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nombre completo" required className="md:col-span-2">
                      <TextInput
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Tu nombre completo"
                        required
                      />
                    </Field>
                    <Field label="Cédula / documento de identidad">
                      <TextInput
                        type="text"
                        value={formData.cedula}
                        onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                        placeholder="Número de identificación"
                      />
                    </Field>
                    <Field label="Teléfono">
                      <TextInput
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+57 300 123 4567"
                      />
                    </Field>
                    <Field label="Correo electrónico" hint="El correo electrónico no se puede modificar" className="md:col-span-2">
                      <TextInput value={user.email} disabled />
                    </Field>
                  </div>
                  <FormActions>
                    <Button variant="secondary" onClick={handleCancel} disabled={isSaving}>Cancelar</Button>
                    <Button type="submit" isLoading={isSaving} icon={<Save className="w-4 h-4" />}>Guardar cambios</Button>
                  </FormActions>
                </form>
              ) : (
                <DescriptionList
                  items={[
                    { label: 'Nombre completo', value: user.name },
                    { label: 'Correo electrónico', value: user.email },
                    { label: 'Cédula / documento', value: user.profile?.cedula || <span className="text-gray-400">No especificado</span> },
                    { label: 'Teléfono', value: user.profile?.phone || <span className="text-gray-400">No especificado</span> },
                  ]}
                />
              )}
            </Card>

            <Card>
              <CardTitle icon={Lock}>Seguridad</CardTitle>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-gray-500">Cambia la contraseña con la que inicias sesión.</p>
                <Button variant="secondary" onClick={() => toast.info('Función de cambio de contraseña próximamente')}>
                  Cambiar contraseña
                </Button>
              </div>
            </Card>
          </>
        )}

        {activeTab === 'addresses' && (
          <Card>
            <AddressesSection />
          </Card>
        )}
      </AccountLayout>
    </div>
  );
};
