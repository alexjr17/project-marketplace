import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/shared/Button';
import { Input } from '../components/shared/Input';
import { useToast } from '../context/ToastContext';
import { User, Mail, Calendar, Shield, Edit2, Save, X, CreditCard, MapPin, Phone, Building2 } from 'lucide-react';

export const ProfilePage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    cedula: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Colombia',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí iría la lógica para actualizar el perfil
    // Por ahora solo mostramos un toast
    toast.success('Perfil actualizado correctamente');
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: user.name,
      cedula: '',
      phone: '',
      address: '',
      city: '',
      postalCode: '',
      country: 'Colombia',
    });
    setIsEditing(false);
  };

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
          <div className="bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 px-8 py-12">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg">
                <span className="text-4xl font-bold bg-gradient-to-br from-violet-600 to-pink-500 bg-clip-text text-transparent">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                <p className="text-violet-100 mt-1">{user.email}</p>
                {user.role === 'admin' && (
                  <span className="inline-block mt-3 px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full">
                    <Shield className="w-4 h-4 inline mr-1" />
                    Administrador
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="p-8">
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
                    {formData.cedula || 'No especificado'}
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
                    {formData.phone || 'No especificado'}
                  </div>
                )}
              </div>

              {/* Dirección de Envío */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Información de Envío
                </h4>

                <div className="space-y-6">
                  {/* Dirección */}
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Building2 className="w-4 h-4" />
                      Dirección
                    </label>
                    {isEditing ? (
                      <Input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Calle, número, apartamento, etc."
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                        {formData.address || 'No especificado'}
                      </div>
                    )}
                  </div>

                  {/* Ciudad y Código Postal */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Ciudad
                      </label>
                      {isEditing ? (
                        <Input
                          type="text"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="Ciudad"
                        />
                      ) : (
                        <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                          {formData.city || 'No especificado'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Código Postal
                      </label>
                      {isEditing ? (
                        <Input
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                          placeholder="110111"
                        />
                      ) : (
                        <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                          {formData.postalCode || 'No especificado'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* País */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      País
                    </label>
                    {isEditing ? (
                      <Input
                        type="text"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        placeholder="Colombia"
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-medium">
                        {formData.country}
                      </div>
                    )}
                  </div>
                </div>
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
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Sección de Seguridad */}
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
      </div>
    </div>
  );
};
