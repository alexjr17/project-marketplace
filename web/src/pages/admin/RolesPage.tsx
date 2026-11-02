import { useNavigate } from 'react-router-dom';
import { Shield, Plus, Pencil, Trash2, Lock } from 'lucide-react';
import { useRoles } from '../../context/RolesContext';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types/roles';
import { ALL_PERMISSIONS } from '../../types/roles';
import { Alert, Badge, Button, Card, EmptyState, IconButton, Page, PageHeader, toast, useConfirm } from '../../components/ui';

export const RolesPage = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { roles, deleteRole } = useRoles();
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('roles.view');
  const canEdit = hasPermission('roles.view');
  const canDelete = hasPermission('roles.view');

  const handleCreate = () => navigate('/admin-panel/roles/new');

  const handleEdit = (role: Role) => {
    if (role.isSystem) {
      toast.error('No se puede editar un rol del sistema');
      return;
    }
    navigate(`/admin-panel/roles/${role.id}/edit`);
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      toast.error('No se puede eliminar un rol del sistema');
      return;
    }
    if (!(await confirm({ title: `¿Eliminar el rol "${role.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      if (await deleteRole(role.id)) toast.success('Rol eliminado');
      else toast.error('No se pudo eliminar el rol');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo eliminar el rol');
    }
  };

  const total = ALL_PERMISSIONS.length;

  return (
    <Page>
      <PageHeader
        icon={Shield}
        title="Roles y permisos"
        subtitle="Cada rol define qué puede ver y hacer un administrador"
        actions={canCreate && <Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nuevo rol</Button>}
      />

      <Alert tone="info" title="Roles del sistema">
        El Super Administrador tiene acceso total y el rol de Usuario es para clientes sin acceso al panel. Están protegidos: no se pueden editar ni eliminar.
      </Alert>

      {roles.length === 0 ? (
        <Card>
          <EmptyState
            icon={Shield}
            title="No hay roles"
            description="Crea un rol para asignar permisos personalizados."
            action={canCreate && <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Crear primer rol</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((role) => {
            const isAll = role.id === 0;
            const count = isAll ? total : role.permissions.length;
            const pct = total ? Math.round((count / total) * 100) : 0;
            const editable = !role.isSystem && canEdit;
            return (
              <div key={role.id} className="flex flex-col rounded-xl border border-gray-200 bg-white">
                <div
                  role={editable ? 'button' : undefined}
                  tabIndex={editable ? 0 : undefined}
                  onClick={editable ? () => handleEdit(role) : undefined}
                  onKeyDown={editable ? (e) => { if (e.key === 'Enter') handleEdit(role); } : undefined}
                  className={`flex-1 p-4 md:p-5 rounded-t-xl ${editable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
                        {role.name}
                        {role.isSystem && <Lock className="w-3.5 h-3.5 text-gray-400" aria-label="Rol del sistema" />}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{role.description || 'Sin descripción'}</p>
                    </div>
                    <Badge tone={role.isActive ? 'green' : 'gray'}>{role.isActive ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Permisos</span>
                      <span className="font-medium text-gray-900">{isAll ? `Todos (${total})` : `${count} de ${total}`}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div className={`h-1.5 rounded-full ${isAll ? 'bg-green-500' : 'bg-app-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2">
                  {role.isSystem ? (
                    <span className="text-xs text-gray-400 py-2">Rol protegido del sistema</span>
                  ) : (
                    <>
                      <span className="text-xs text-gray-400">ID {role.id}</span>
                      <div className="flex">
                        {canEdit && <IconButton title="Editar" tone="app" onClick={() => handleEdit(role)}><Pencil className="w-4 h-4" /></IconButton>}
                        {canDelete && <IconButton title="Eliminar" tone="danger" onClick={() => handleDelete(role)}><Trash2 className="w-4 h-4" /></IconButton>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
};
