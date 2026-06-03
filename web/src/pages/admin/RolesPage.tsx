import { useNavigate } from 'react-router-dom';
import { Shield, Plus, Edit2, Trash2, Lock, Check, X } from 'lucide-react';
import { useRoles } from '../../context/RolesContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import type { Role } from '../../types/roles';
import { ALL_PERMISSIONS } from '../../types/roles';

export const RolesPage = () => {
  const navigate = useNavigate();
  const { roles, deleteRole } = useRoles();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const canCreate = hasPermission('roles.view');
  const canEdit = hasPermission('roles.view');
  const canDelete = hasPermission('roles.view');

  const handleCreate = () => {
    navigate('/admin-panel/roles/new');
  };

  const handleEdit = (role: Role) => {
    if (role.isSystem) {
      toast.error('No se puede editar un rol del sistema');
      return;
    }
    navigate(`/admin-panel/roles/${role.id}/edit`);
  };

  const handleDelete = (role: Role) => {
    if (role.isSystem) {
      toast.error('No se puede eliminar un rol del sistema');
      return;
    }

    if (confirm(`¿Eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) {
      if (deleteRole(role.id)) {
        toast.success('Rol eliminado');
      } else {
        toast.error('No se pudo eliminar el rol');
      }
    }
  };

  const getRoleBadgeColor = (role: Role) => {
    if (role.id === 0) return 'bg-red-100 text-red-800 border-red-200';
    if (role.id === 1) return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-500" />
            Roles y Permisos
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Gestiona los roles y permisos del sistema
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} variant="admin-orange" size="sm">
            <Plus className="w-4 h-4" />
            Nuevo Rol
          </Button>
        )}
      </div>

      {/* Info de roles del sistema */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-amber-800 text-sm">
          <strong>Roles del Sistema:</strong> El rol "Super Administrador" (ID: 0) tiene acceso total y solo puede existir uno.
          El rol "Usuario" (ID: 1) es para usuarios normales sin acceso al panel administrativo.
          Estos roles no se pueden editar ni eliminar.
        </p>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-shadow hover:shadow-md ${
              role.isSystem ? 'border-gray-200' : 'border-gray-100'
            }`}
          >
            {/* Card Header */}
            <div className={`px-5 py-4 border-b ${role.id === 0 ? 'bg-red-50' : role.id === 1 ? 'bg-gray-50' : 'bg-blue-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getRoleBadgeColor(role)}`}>
                    ID: {role.id}
                  </span>
                  {role.isSystem && (
                    <span title="Rol del sistema">
                      <Lock className="w-4 h-4 text-gray-400" />
                    </span>
                  )}
                </div>
                {role.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                    <Check className="w-3 h-3" />
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                    <X className="w-3 h-3" />
                    Inactivo
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mt-2">{role.name}</h3>
            </div>

            {/* Card Body */}
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {role.description || 'Sin descripción'}
              </p>

              {/* Permisos */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Permisos:</span>
                <span className={`font-semibold ${role.id === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                  {role.id === 0 ? (
                    <>Todos ({ALL_PERMISSIONS.length})</>
                  ) : (
                    <>{role.permissions.length} / {ALL_PERMISSIONS.length}</>
                  )}
                </span>
              </div>

              {/* Progress bar de permisos */}
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full ${role.id === 0 ? 'bg-green-500' : role.id === 1 ? 'bg-gray-400' : 'bg-blue-500'}`}
                  style={{ width: `${role.id === 0 ? 100 : (role.permissions.length / ALL_PERMISSIONS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Card Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              {role.isSystem ? (
                <span className="text-xs text-gray-400 py-2">Rol protegido del sistema</span>
              ) : (
                <>
                  {canEdit && (
                    <button
                      onClick={() => handleEdit(role)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(role)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {roles.length === 0 && (
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay roles</h3>
          <p className="text-gray-500 mb-4">Crea un nuevo rol para asignar permisos personalizados</p>
          {canCreate && (
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Crear primer rol
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
