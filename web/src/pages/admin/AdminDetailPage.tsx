import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUsers } from '../../context/UsersContext';
import { useRoles } from '../../context/RolesContext';
import type { User } from '../../types/user';
import { Check, X, Pencil, Save, Package, Building2, Crown, Shield, UserCog, ShoppingBag, MapPin, Clock, DollarSign } from 'lucide-react';
import {
  Avatar, Badge, Button, Card, CardTitle, DescriptionList, EmptyState, Field, FormActions, FormGrid, Page, PageHeader,
  SelectInput, Spinner, StatCard, Table, TableCard, Tabs, TBody, Td, TextInput, Th, THead, Timeline, Tr, toast, useConfirm,
  type Tone,
} from '../../components/ui';

type TabType = 'profile' | 'addresses' | 'orders' | 'activity';
const LIST = '/admin-panel/admins';
const fmtDate = (d: string | Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('es-CO', opts);

const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  completed: { label: 'Completado', tone: 'green' },
  processing: { label: 'En proceso', tone: 'blue' },
  pending: { label: 'Pendiente', tone: 'yellow' },
  cancelled: { label: 'Cancelado', tone: 'red' },
};

export const AdminDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { getAdminById, updateAdmin, toggleAdminStatus } = useUsers();
  const { roles } = useRoles();

  const [admin, setAdmin] = useState<User | undefined>(undefined);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadAdmin = async () => {
      if (!id) {
        setIsLoadingAdmin(false);
        return;
      }
      setIsLoadingAdmin(true);
      try {
        const data = await getAdminById(id);
        setAdmin(data);
      } catch (error) {
        console.error('Error loading admin:', error);
      } finally {
        setIsLoadingAdmin(false);
      }
    };
    loadAdmin();
  }, [id, getAdminById]);

  // Roles disponibles para asignar (excluyendo SuperAdmin y Cliente)
  const assignableRoles = roles.filter(r => r.id !== 1 && r.id !== 2 && r.isActive);

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', cedula: '', roleId: 3 });

  useEffect(() => {
    if (admin) {
      setFormData({
        name: admin.name || '',
        phone: admin.phone || '',
        cedula: admin.cedula || '',
        roleId: admin.roleId ?? (admin.role === 'superadmin' ? 1 : 3),
      });
    }
  }, [admin]);

  // Direcciones mock para demostración
  const [addresses] = useState([
    {
      id: '1',
      label: 'Casa',
      address: admin?.address?.address || 'Calle 123 #45-67',
      city: admin?.address?.city || 'Bogotá',
      postalCode: admin?.address?.postalCode || '110111',
      country: admin?.address?.country || 'Colombia',
      isDefault: true,
    },
  ]);

  // Pedidos mock para demostración
  const [orders] = useState([
    { id: 'ORD-001', date: new Date('2024-11-20'), status: 'completed', total: 125000, items: 3 },
    { id: 'ORD-002', date: new Date('2024-11-15'), status: 'processing', total: 89000, items: 2 },
  ]);

  // Actividad mock para demostración
  const [activities] = useState([
    { id: '1', action: 'Inicio de sesión en panel admin', date: new Date('2024-11-25T10:30:00'), ip: '192.168.1.1' },
    { id: '2', action: 'Actualizó producto #123', date: new Date('2024-11-24T15:45:00'), ip: '192.168.1.1' },
    { id: '3', action: 'Creó nuevo producto', date: new Date('2024-11-20T14:20:00'), ip: '192.168.1.1' },
    { id: '4', action: 'Cambió estado de pedido ORD-045', date: new Date('2024-11-18T09:15:00'), ip: '192.168.1.1' },
    { id: '5', action: 'Registro como administrador', date: new Date('2024-02-15T11:00:00'), ip: '192.168.1.1' },
  ]);

  if (isLoadingAdmin) return <Page><Spinner label="Cargando administrador…" /></Page>;

  if (!admin) {
    return (
      <Page>
        <PageHeader icon={UserCog} backTo={LIST} title="Administrador" />
        <Card>
          <EmptyState
            icon={Shield}
            title="Administrador no encontrado"
            description="El administrador que buscas no existe o fue eliminado."
            action={<Button variant="secondary" onClick={() => navigate(LIST)}>Volver a administradores</Button>}
          />
        </Card>
      </Page>
    );
  }

  const isSuperAdmin = admin.role === 'superadmin';
  const isOriginalSuper = isSuperAdmin && admin.id === 'super-admin-001';
  const isActive = admin.status === 'active';
  const roleLabel = isSuperAdmin
    ? 'Super Administrador'
    : roles.find((r) => r.id === formData.roleId)?.name || admin.roleName || 'Administrador';

  const reload = async () => {
    try { setAdmin(await getAdminById(id!)); } catch { /* se mantiene lo que había */ }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // No permitir cambiar rol del superadmin original
      if (isOriginalSuper) {
        await updateAdmin(admin.id, { name: formData.name, phone: formData.phone || undefined, cedula: formData.cedula || undefined });
      } else {
        await updateAdmin(admin.id, { name: formData.name, phone: formData.phone || undefined, cedula: formData.cedula || undefined, roleId: formData.roleId });
      }
      toast.success('Perfil actualizado correctamente');
      setIsEditing(false);
      await reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (isSuperAdmin) {
      toast.error('No se puede desactivar el Super Administrador');
      return;
    }
    if (isActive && !(await confirm({ title: `¿Desactivar a ${admin.name}?`, message: 'No podrá entrar al panel hasta que lo actives de nuevo.', confirmText: 'Desactivar', tone: 'danger' }))) return;
    try {
      await toggleAdminStatus(admin.id);
      toast.success(isActive ? 'Administrador desactivado correctamente' : 'Administrador activado correctamente');
      await reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo cambiar el estado');
    }
  };

  const cancelEdit = () => {
    setFormData({ name: admin.name || '', phone: admin.phone || '', cedula: admin.cedula || '', roleId: admin.roleId ?? (isSuperAdmin ? 1 : 3) });
    setIsEditing(false);
  };

  return (
    <Page>
      <PageHeader
        icon={UserCog}
        backTo={LIST}
        title={
          <span className="inline-flex items-center gap-2">
            {admin.name}
            {isSuperAdmin && <Crown className="w-5 h-5 text-amber-500" />}
          </span>
        }
        subtitle={admin.email}
        actions={!isSuperAdmin && (
          isActive
            ? <Button variant="secondary" className="text-red-600" icon={<X className="w-4 h-4" />} onClick={handleToggleStatus}>Desactivar</Button>
            : <Button variant="success" icon={<Check className="w-4 h-4" />} onClick={handleToggleStatus}>Activar</Button>
        )}
      />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={admin.name} size="lg" />
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
            <Badge tone={isSuperAdmin ? 'yellow' : 'app'}>
              {isSuperAdmin ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
              {roleLabel}
            </Badge>
            <Badge tone={isActive ? 'green' : 'gray'}>{isActive ? 'Activo' : 'Inactivo'}</Badge>
            <span className="text-sm text-gray-500">Desde {fmtDate(admin.createdAt, { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ShoppingBag} label="Pedidos" value={orders.length} />
        <StatCard icon={DollarSign} tone="green" label="Total gastado" value={`$${orders.reduce((acc, o) => acc + o.total, 0).toLocaleString('es-CO')}`} />
        <StatCard icon={MapPin} tone="blue" label="Direcciones" value={addresses.length} />
      </div>

      <Tabs<TabType>
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'profile', label: 'Perfil' },
          { value: 'addresses', label: 'Direcciones', count: addresses.length },
          { value: 'orders', label: 'Pedidos', count: orders.length },
          { value: 'activity', label: 'Actividad' },
        ]}
      />

      {activeTab === 'profile' && (
        <Card>
          <CardTitle
            icon={UserCog}
            actions={!isEditing && <Button size="sm" variant="secondary" icon={<Pencil className="w-4 h-4" />} onClick={() => setIsEditing(true)}>Editar</Button>}
          >
            Información personal
          </CardTitle>
          {isEditing ? (
            <>
              <FormGrid>
                <Field label="Nombre completo" required>
                  <TextInput value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </Field>
                <Field label="Correo" hint="El correo no se puede modificar.">
                  <TextInput value={admin.email} disabled readOnly />
                </Field>
                <Field label="Teléfono">
                  <TextInput type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+57 300 123 4567" />
                </Field>
                <Field label="Cédula / Documento">
                  <TextInput value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })} placeholder="1234567890" />
                </Field>
                <Field label="Rol" hint={isOriginalSuper ? 'El rol del Super Administrador original no se puede cambiar.' : 'Define los permisos del administrador.'}>
                  {isOriginalSuper ? (
                    <TextInput value="Super Administrador" disabled readOnly />
                  ) : (
                    <SelectInput value={formData.roleId} onChange={(e) => setFormData({ ...formData, roleId: Number(e.target.value) })}>
                      {assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </SelectInput>
                  )}
                </Field>
              </FormGrid>
              <FormActions>
                <Button variant="secondary" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
                <Button isLoading={saving} icon={<Save className="w-4 h-4" />} onClick={handleSaveProfile}>Guardar</Button>
              </FormActions>
            </>
          ) : (
            <DescriptionList
              items={[
                { label: 'Nombre completo', value: admin.name },
                { label: 'Correo', value: admin.email },
                { label: 'Teléfono', value: admin.phone || null },
                { label: 'Cédula / Documento', value: admin.cedula || null },
                {
                  label: 'Rol',
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      {isSuperAdmin ? <Crown className="w-4 h-4 text-amber-500" /> : <Shield className="w-4 h-4 text-app-600" />}
                      {roleLabel}
                      {isOriginalSuper && <span className="text-xs text-gray-500">(No editable)</span>}
                    </span>
                  ),
                },
                { label: 'Fecha de registro', value: fmtDate(admin.createdAt) },
                { label: 'Última actualización', value: fmtDate(admin.updatedAt) },
              ]}
            />
          )}
        </Card>
      )}

      {activeTab === 'addresses' && (
        <Card>
          <CardTitle icon={MapPin}>Direcciones de envío</CardTitle>
          {addresses.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((address) => (
                <div key={address.id} className={`flex items-start gap-3 rounded-lg border p-4 ${address.isDefault ? 'border-app-300' : 'border-gray-200'}`}>
                  <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{address.label}</p>
                      {address.isDefault && <Badge tone="app">Principal</Badge>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{address.address}</p>
                    <p className="text-sm text-gray-500">{address.city}, {address.postalCode} - {address.country}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={MapPin} title="Sin direcciones" description="El administrador no tiene direcciones registradas." />
          )}
        </Card>
      )}

      {activeTab === 'orders' && (
        orders.length > 0 ? (
          <TableCard>
            <Table>
              <THead>
                <tr><Th>Pedido</Th><Th>Fecha</Th><Th align="right">Productos</Th><Th align="right">Total</Th><Th align="center">Estado</Th></tr>
              </THead>
              <TBody>
                {orders.map((order) => (
                  <Tr key={order.id}>
                    <Td><span className="inline-flex items-center gap-2 font-medium text-gray-900"><Package className="w-4 h-4 text-gray-400" />{order.id}</span></Td>
                    <Td className="whitespace-nowrap">{fmtDate(order.date, { day: '2-digit', month: 'short', year: 'numeric' })}</Td>
                    <Td align="right">{order.items}</Td>
                    <Td align="right" className="font-medium text-gray-900">${order.total.toLocaleString('es-CO')}</Td>
                    <Td align="center"><Badge tone={ORDER_STATUS[order.status]?.tone ?? 'gray'}>{ORDER_STATUS[order.status]?.label ?? order.status}</Badge></Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableCard>
        ) : (
          <Card><EmptyState icon={ShoppingBag} title="Sin pedidos" description="El administrador no ha realizado ningún pedido." /></Card>
        )
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardTitle icon={Clock}>Registro de actividad</CardTitle>
          {activities.length > 0 ? (
            <Timeline
              items={activities.map((a, i) => ({
                title: a.action,
                meta: `${a.date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · IP ${a.ip}`,
                tone: i === 0 ? 'app' : 'gray',
              }))}
            />
          ) : (
            <EmptyState icon={Clock} title="Sin actividad" description="No hay registros de actividad para este administrador." />
          )}
        </Card>
      )}
    </Page>
  );
};
