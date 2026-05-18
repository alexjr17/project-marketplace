import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRoles } from '../context/RolesContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/shared/Button';
import { Input } from '../components/shared/Input';
import { AddressesSection } from '../components/profile/AddressesSection';
import { useToast } from '../context/ToastContext';
import { User, Mail, Calendar, Shield, Edit2, Save, X, CreditCard, Phone, Loader2, MapPin } from 'lucide-react';

type ProfileTab = 'general' | 'addresses';

export const ProfilePage = () => {
  const { user, updateProfile, isAdmin, isSuperAdmin } = useAuth();
  const { getRoleById } = useRoles();
  const { settings } = useSettings();
  const toast = useToast();

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradientBgStyle = `linear-gradient(to bottom right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No has iniciado sesión</h2>
          <p className="text-gray-600">Por favor inicia sesión para ver tu perfil</p>
        </div>
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

  const tabs: { id: ProfileTab; label: string; icon: typeof User }[] = [
    { id: 'general', label: 'Información General', icon: User },
    { id: 'addresses', label: 'Direcciones', icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-600 mt-2">Gestiona tu información personal</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Header con Avatar */}
          <div className="px-8 py-12" style={{ background: gradientBgStyle }}>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg">
                <span
                  className="text-4xl font-bold bg-clip-text text-transparent"
                  style={{ backgroundImage: gradientBgStyle, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                <p className="text-white/80 mt-1">{user.email}</p>
                {(isAdmin || isSuperAdmin) && (
                  <span className="inline-block mt-3 px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                    <Shield className="w-4 h-4 inline mr-1" />
                    {getRoleById(user.roleId)?.name || 'Administrador'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Menú de pestañas */}
          <div className="flex border-b border-gray-200 px-4 sm:px-8">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 -mb-px transition-colors"
                  style={{
                    borderColor: isActive ? brandColors.primary : 'transparent',
                    color: isActive ? brandColors.primary : '#6b7280',
                  }}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Contenido de pestañas */}
          <div className="p-8">
            {activeTab === 'general' && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Información Personal</h3>
                  {!isEditing && (
                    <Button
                      onClick={() => setIsEditing(true)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </Button>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Nombre */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4" />
                      Nombre Completo
                    </label>
                    {isEditing ? (
                      <Input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Tu nombre completo"
                        required
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                        {user.name}
                      </div>
                    )}
                  </div>

                  {/* Email - Solo lectura */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Mail className="w-4 h-4" />
                      Correo Electrónico
                    </label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                      {user.email}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">El correo electrónico no se puede modificar</p>
                  </div>

                  {/* Cédula */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <CreditCard className="w-4 h-4" />
                      Cédula / Documento de Identidad
                    </label>
                    {isEditing ? (
                      <Input
                        type="text"
                        value={formData.cedula}
                        onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                        placeholder="Número de identificación"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                        {user.profile?.cedula || 'No especificado'}
                      </div>
                    )}
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Phone className="w-4 h-4" />
                      Teléfono
                    </label>
                    {isEditing ? (
                      <Input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+57 300 123 4567"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                        {user.profile?.phone || 'No especificado'}
                      </div>
                    )}
                  </div>

                  {/* Fecha de Creación */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4" />
                      Miembro Desde
                    </label>
                    <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                      {new Date(user.createdAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  {isEditing && (
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
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
                            Guardar Cambios
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </form>
              </>
            )}

            {activeTab === 'addresses' && (
              <AddressesSection brandColor={brandColors.primary} />
            )}
          </div>
        </div>

        {/* Sección de Seguridad */}
        {activeTab === 'general' && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Seguridad</h3>
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => toast.info('Función de cambio de contraseña próximamente')}
              >
                Cambiar Contraseña
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
