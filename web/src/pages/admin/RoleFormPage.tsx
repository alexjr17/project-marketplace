import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, Save, Trash2, KeyRound } from 'lucide-react';
import { useRoles } from '../../context/RolesContext';
import type { Permission } from '../../types/roles';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, APPLICATIONS, getAppPermissions } from '../../types/roles';
import {
  Badge, Button, Card, CardTitle, Checkbox, Field, FormActions, Page, PageHeader, Switch, TextArea, TextInput, toast, useConfirm,
} from '../../components/ui';

const LIST = '/admin-panel/roles';

/** Casilla de "seleccionar todo" con estado intermedio (algunos marcados). */
function GroupCheckbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      title={label}
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
      onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-app-600 focus:ring-app-500 cursor-pointer"
    />
  );
}

export const RoleFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { roles, createRole, updateRole, deleteRole } = useRoles();

  const isEditing = !!id;
  // Buscar el rol en el cache local (síncrono). getRoleById es async y devolvía una Promise,
  // por lo que `[...editingRole.permissions]` reventaba con "permissions is not iterable".
  const editingRole = isEditing ? roles.find((r) => r.id === Number(id)) ?? null : null;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[],
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  // Aplicación seleccionada en el editor (Tienda, POS, Administración, Social Media)
  const [selectedAppId, setSelectedAppId] = useState(APPLICATIONS[0].id);

  useEffect(() => {
    if (editingRole) {
      if (editingRole.isSystem) {
        toast.error('No se puede editar un rol del sistema');
        navigate(LIST);
        return;
      }
      setFormData({
        name: editingRole.name,
        description: editingRole.description,
        // Filtra permisos heredados que ya no existen en el catálogo, para que al guardar no falle la validación del backend.
        permissions: Array.isArray(editingRole.permissions)
          ? editingRole.permissions.filter((p) => (ALL_PERMISSIONS as string[]).includes(p))
          : [],
        isActive: editingRole.isActive,
      });
    }
  }, [editingRole, navigate]);

  const has = (p: Permission) => formData.permissions.includes(p);

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
    setFormData(prev => ({ ...prev, permissions: allSelected ? [] : [...ALL_PERMISSIONS] }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }
    const nameExists = roles.some(
      r => r.name.toLowerCase() === formData.name.toLowerCase() && r.id !== Number(id)
    );
    if (nameExists) {
      toast.error('Ya existe un rol con ese nombre');
      return;
    }
    setSaving(true);
    try {
      if (isEditing && editingRole) {
        await updateRole(editingRole.id, formData);
        toast.success('Rol actualizado correctamente');
      } else {
        await createRole(formData);
        toast.success('Rol creado correctamente');
      }
      navigate(LIST);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'No se pudo guardar el rol');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingRole) return;
    if (!(await confirm({ title: `¿Eliminar el rol "${editingRole.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await deleteRole(editingRole.id);
      toast.success('Rol eliminado correctamente');
      navigate(LIST);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'No se pudo eliminar el rol');
    }
  };

  const selectedApp = APPLICATIONS.find((a) => a.id === selectedAppId) || APPLICATIONS[0];
  const selectedAppGroups = PERMISSION_GROUPS.filter((g) => selectedApp.modules.includes(g.module));
  const accessChecked = has(selectedApp.access.id);
  const appPerms = getAppPermissions(selectedApp.id);
  const appAllSelected = appPerms.length > 0 && appPerms.every(has);
  const total = ALL_PERMISSIONS.length;
  const selected = formData.permissions.length;
  const pct = total ? Math.round((selected / total) * 100) : 0;

  return (
    <Page>
      <PageHeader
        icon={Shield}
        backTo={LIST}
        title={isEditing ? `Editar rol${editingRole ? `: ${editingRole.name}` : ''}` : 'Nuevo rol'}
        subtitle={isEditing ? 'Modifica los permisos y la configuración del rol' : 'Crea un rol con permisos personalizados'}
        actions={isEditing && (
          <Button variant="secondary" className="text-red-600" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete}>Eliminar</Button>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Datos del rol */}
        <div className="space-y-5 lg:sticky lg:top-4">
          <Card>
            <CardTitle icon={Shield}>Información del rol</CardTitle>
            <div className="space-y-4">
              <Field label="Nombre del rol" required>
                <TextInput value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Gestor de pedidos" />
              </Field>
              <Field label="Descripción">
                <TextArea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe las responsabilidades de este rol" />
              </Field>
              <Switch
                checked={formData.isActive}
                onChange={(isActive) => setFormData({ ...formData, isActive })}
                label="Rol activo"
                description={formData.isActive ? 'Se puede asignar a administradores.' : 'No se puede asignar.'}
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Permisos seleccionados</span>
              <span className="font-semibold text-gray-900">{selected} de {total}</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-app-600 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {selected === 0 ? 'No hay permisos seleccionados' : selected === total ? 'Todos los permisos seleccionados' : `${pct}% de los permisos`}
            </p>
            <Button size="sm" variant="ghost" className="mt-3 -ml-3" onClick={handleSelectAll}>
              {selected === total ? 'Quitar todos los permisos' : 'Marcar todos los permisos'}
            </Button>
          </Card>
        </div>

        {/* Permisos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="tablist" aria-label="Aplicaciones">
            {APPLICATIONS.map((app) => {
              const perms = getAppPermissions(app.id);
              const sel = perms.filter(has).length;
              const active = app.id === selectedAppId;
              return (
                <button
                  key={app.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedAppId(app.id)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${active ? 'border-app-500 bg-white ring-1 ring-app-500' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                >
                  <span className={`text-sm font-medium truncate ${active ? 'text-app-700' : 'text-gray-800'}`}>{app.name}</span>
                  <Badge tone={sel > 0 ? 'app' : 'gray'}>{sel}/{perms.length}</Badge>
                </button>
              );
            })}
          </div>

          <Card>
            <CardTitle
              icon={KeyRound}
              actions={appPerms.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => handleToggleModule(appPerms)}>
                  {appAllSelected ? 'Quitar todo en esta app' : 'Marcar todo en esta app'}
                </Button>
              )}
            >
              {selectedApp.name}
            </CardTitle>
            <p className="text-sm text-gray-500 -mt-2 mb-4">{selectedApp.description}</p>

            <div className={`rounded-lg border p-3 ${accessChecked ? 'border-app-300' : 'border-gray-200'}`}>
              <Checkbox
                label={<span className="font-medium text-gray-900">{selectedApp.access.label}</span>}
                description={selectedApp.access.description}
                checked={accessChecked}
                onChange={() => handleTogglePermission(selectedApp.access.id)}
              />
            </div>

            {selectedAppGroups.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">Esta aplicación solo requiere el permiso de acceso.</p>
            ) : (
              <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {selectedAppGroups.map((group) => {
                  const groupPermissions = group.permissions.map(p => p.id);
                  const count = groupPermissions.filter(has).length;
                  const allSelected = count === groupPermissions.length;
                  return (
                    <section key={group.module} className="p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer min-w-0">
                          <GroupCheckbox
                            label={`Seleccionar todo en ${group.label}`}
                            checked={allSelected}
                            indeterminate={count > 0 && !allSelected}
                            onChange={() => handleToggleModule(groupPermissions)}
                          />
                          <span className="font-semibold text-gray-900 truncate">{group.label}</span>
                        </label>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge tone={allSelected ? 'app' : count > 0 ? 'blue' : 'gray'}>{count}/{groupPermissions.length}</Badge>
                          <button type="button" onClick={() => handleToggleModule(groupPermissions)} className="text-xs font-medium text-app-700 hover:underline">
                            {allSelected ? 'Ninguno' : 'Todos'}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 pl-6">
                        {group.permissions.map((perm) => (
                          <Checkbox
                            key={perm.id}
                            label={perm.label}
                            description={perm.description}
                            checked={has(perm.id)}
                            onChange={() => handleTogglePermission(perm.id)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <FormActions sticky>
        <Button variant="secondary" onClick={() => navigate(LIST)} disabled={saving}>Cancelar</Button>
        <Button isLoading={saving} icon={<Save className="w-4 h-4" />} onClick={handleSave}>{isEditing ? 'Guardar' : 'Crear rol'}</Button>
      </FormActions>
    </Page>
  );
};
