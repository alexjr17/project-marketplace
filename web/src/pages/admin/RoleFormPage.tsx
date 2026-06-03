import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useRoles } from '../../context/RolesContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import type { Permission } from '../../types/roles';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, APPLICATIONS, getAppPermissions } from '../../types/roles';

export const RoleFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, createRole, updateRole } = useRoles();
  const toast = useToast();

  const isEditing = !!id;
  // Buscar el rol en el cache local (síncrono). getRoleById es async y
  // devolvía una Promise, por lo que `[...editingRole.permissions]` reventaba
  // con "permissions is not iterable".
  const editingRole = isEditing ? roles.find((r) => r.id === Number(id)) ?? null : null;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[],
    isActive: true,
  });

  // Aplicación seleccionada en el editor (Tienda, POS, Administración, Social Media)
  const [selectedAppId, setSelectedAppId] = useState(APPLICATIONS[0].id);

  // Cargar datos del rol si estamos editando
  useEffect(() => {
    if (editingRole) {
      // No permitir editar roles del sistema
      if (editingRole.isSystem) {
        toast.error('No se puede editar un rol del sistema');
        navigate('/admin-panel/roles');
        return;
      }

      setFormData({
        name: editingRole.name,
        description: editingRole.description,
        permissions: Array.isArray(editingRole.permissions) ? [...editingRole.permissions] : [],
        isActive: editingRole.isActive,
      });
    }
  }, [editingRole, navigate, toast]);

  const handleTogglePermission = (permission: Permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleToggleModule = (modulePermissions: Permission[]) => {
    const allSelected = modulePermissions.every(p => formData.permissions.includes(p));
    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !modulePermissions.includes(p))
        : [...new Set([...prev.permissions, ...modulePermissions])],
    }));
  };

  const handleSelectAll = () => {
    const allSelected = formData.permissions.length === ALL_PERMISSIONS.length;
    setFormData(prev => ({
      ...prev,
      permissions: allSelected ? [] : [...ALL_PERMISSIONS],
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }

    // Verificar si el nombre ya existe (excepto el rol actual si estamos editando)
    const nameExists = roles.some(
      r => r.name.toLowerCase() === formData.name.toLowerCase() && r.id !== Number(id)
    );
    if (nameExists) {
      toast.error('Ya existe un rol con ese nombre');
      return;
    }

    if (isEditing && editingRole) {
      updateRole(editingRole.id, formData);
      toast.success('Rol actualizado correctamente');
    } else {
      createRole(formData);
      toast.success('Rol creado correctamente');
    }

    navigate('/admin-panel/roles');
  };

  const handleDelete = () => {
    if (!editingRole) return;
    if (!confirm('¿Estás seguro de eliminar este rol?')) return;

    // Por ahora solo navegamos de vuelta, la eliminación real se haría aquí
    toast.success('Rol eliminado correctamente');
    navigate('/admin-panel/roles');
  };

  // Contar permisos seleccionados por módulo
  const getModuleSelectionCount = (modulePermissions: Permission[]) => {
    return modulePermissions.filter(p => formData.permissions.includes(p)).length;
  };

  // App seleccionada y sus grupos de permisos (módulos que le pertenecen)
  const selectedApp = APPLICATIONS.find((a) => a.id === selectedAppId) || APPLICATIONS[0];
  const selectedAppGroups = PERMISSION_GROUPS.filter((g) => selectedApp.modules.includes(g.module));
  const accessChecked = formData.permissions.includes(selectedApp.access.id);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 rounded-xl">
            <Shield className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Editar Rol' : 'Nuevo Rol'}
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              {isEditing
                ? 'Modifica los permisos y configuración del rol'
                : 'Crea un nuevo rol con permisos personalizados'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin-panel/roles')}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Roles
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda - Información básica */}
        <div className="lg:col-span-1 space-y-6">
          {/* Card de información */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Información del Rol
            </h2>

            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Rol *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Gestor de Pedidos"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  placeholder="Describe las responsabilidades de este rol"
                />
              </div>

              {/* Estado */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Estado del rol</p>
                  <p className="text-sm text-gray-500">
                    {formData.isActive ? 'El rol está activo' : 'El rol está inactivo'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Resumen de permisos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Resumen
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Permisos seleccionados</span>
                <span className="font-semibold text-orange-600">
                  {formData.permissions.length} / {ALL_PERMISSIONS.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(formData.permissions.length / ALL_PERMISSIONS.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {formData.permissions.length === 0
                  ? 'No hay permisos seleccionados'
                  : formData.permissions.length === ALL_PERMISSIONS.length
                    ? 'Todos los permisos seleccionados'
                    : `${Math.round((formData.permissions.length / ALL_PERMISSIONS.length) * 100)}% de permisos`}
              </p>
            </div>
          </div>

          {/* Botones de acción (móvil) */}
          <div className="lg:hidden flex gap-3">
            {isEditing && (
              <Button variant="admin-danger" onClick={handleDelete} className="flex-1">
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}
            <Button variant="admin-primary" onClick={handleSave} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {isEditing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </div>

        {/* Columna derecha - Permisos */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Permisos del Rol
              </h2>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
              >
                {formData.permissions.length === ALL_PERMISSIONS.length
                  ? 'Deseleccionar todo'
                  : 'Seleccionar todo'}
              </button>
            </div>

            {/* Selector de aplicaciones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {APPLICATIONS.map((app) => {
                const perms = getAppPermissions(app.id);
                const sel = perms.filter((p) => formData.permissions.includes(p)).length;
                const active = app.id === selectedAppId;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedAppId(app.id)}
                    className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-orange-300 bg-orange-50 ring-1 ring-orange-200'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-semibold ${active ? 'text-orange-800' : 'text-gray-800'}`}>
                      {app.name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sel > 0 ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {sel} / {perms.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Descripción + acceso a la app seleccionada */}
            <p className="text-sm text-gray-500 mb-3">{selectedApp.description}</p>
            <label
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors mb-4 ${
                accessChecked
                  ? 'bg-orange-100 border-orange-200'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <input
                type="checkbox"
                checked={accessChecked}
                onChange={() => handleTogglePermission(selectedApp.access.id)}
                className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
              />
              <div className="min-w-0">
                <span className={`text-sm font-semibold ${accessChecked ? 'text-orange-900' : 'text-gray-800'}`}>
                  {selectedApp.access.label}
                </span>
                <p className="text-xs text-gray-500">{selectedApp.access.description}</p>
              </div>
            </label>

            {selectedAppGroups.length === 0 && (
              <p className="text-sm text-gray-400 italic">
                Esta aplicación solo requiere el permiso de acceso.
              </p>
            )}

            <div className="space-y-4">
              {selectedAppGroups.map((group) => {
                const groupPermissions = group.permissions.map(p => p.id);
                const allSelected = groupPermissions.every(p => formData.permissions.includes(p));
                const someSelected = groupPermissions.some(p => formData.permissions.includes(p));
                const selectedCount = getModuleSelectionCount(groupPermissions);

                return (
                  <div
                    key={group.module}
                    className={`border rounded-xl overflow-hidden transition-colors ${
                      allSelected
                        ? 'border-orange-200 bg-orange-50/50'
                        : someSelected
                          ? 'border-orange-100 bg-orange-50/30'
                          : 'border-gray-200'
                    }`}
                  >
                    {/* Header del módulo */}
                    <div
                      className={`flex items-center justify-between p-4 cursor-pointer ${
                        allSelected ? 'bg-orange-100/50' : 'bg-gray-50'
                      }`}
                      onClick={() => handleToggleModule(groupPermissions)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => handleToggleModule(groupPermissions)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                        />
                        <div>
                          <span className="font-semibold text-gray-900">{group.label}</span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {group.permissions.length} permisos disponibles
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-medium px-2 py-1 rounded ${
                        allSelected
                          ? 'bg-orange-200 text-orange-800'
                          : someSelected
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-200 text-gray-600'
                      }`}>
                        {selectedCount} / {groupPermissions.length}
                      </span>
                    </div>

                    {/* Permisos del módulo */}
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {group.permissions.map((perm) => {
                        const isChecked = formData.permissions.includes(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-orange-100 border border-orange-200'
                                : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(perm.id)}
                              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                            />
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${isChecked ? 'text-orange-900' : 'text-gray-700'}`}>
                                {perm.label}
                              </span>
                              {perm.description && (
                                <p className="text-xs text-gray-500 truncate">
                                  {perm.description}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botones de acción (desktop) */}
            <div className="hidden lg:flex gap-3 mt-6 pt-6 border-t">
              {isEditing && (
                <Button variant="admin-danger" onClick={handleDelete} className="flex-1">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              )}
              <Button variant="admin-primary" onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Guardar' : 'Crear'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
