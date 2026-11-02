import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Edit2, MapPin, Save, ShoppingBag, User as UserIcon, Users, X } from 'lucide-react';
import { useUsers } from '../../context/UsersContext';
import { useToast } from '../../context/ToastContext';
import ordersService, { type ApiOrder } from '../../services/orders.service';
import type { User } from '../../types/user';
import type { OrderStatus } from '../../types/order';
import { ORDER_STATUS_LABELS } from '../../types/order';
import {
  Page, PageHeader, Card, CardTitle, Button, Badge, Tabs, DescriptionList, Field, TextInput, FormGrid, FormActions,
  StatCard, Avatar, EmptyState, Spinner, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, useConfirm,
} from '../../components/ui';
import { ORDER_TONE, fmtDate, fmtDateTime, money } from './orderUi';

type TabType = 'profile' | 'addresses' | 'orders';

/** Detalle de un cliente: perfil editable, dirección y sus pedidos. */
export const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getUserById, updateUser, toggleUserStatus } = useUsers();
  const toast = useToast();
  const confirm = useConfirm();

  const [user, setUser] = useState<User | undefined>(undefined);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (!id) { setIsLoadingUser(false); return; }
      setIsLoadingUser(true);
      try {
        setUser(await getUserById(Number(id)));
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsLoadingUser(false);
      }
    };
    loadUser();
  }, [id, getUserById]);

  // Pedidos reales del cliente (filtro userId del listado de pedidos).
  useEffect(() => {
    if (!id) return;
    setLoadingOrders(true);
    ordersService.getAll({ userId: Number(id), limit: 50, sortBy: 'createdAt', sortOrder: 'desc' })
      .then((r) => { setOrders(r.data); setOrdersTotal(r.pagination?.total ?? r.data.length); })
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [id]);

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', cedula: '' });

  useEffect(() => {
    if (user) setFormData({ name: user.name || '', phone: user.phone || '', cedula: user.cedula || '' });
  }, [user]);

  if (isLoadingUser && !user) return <Page><Spinner label="Cargando cliente…" /></Page>;

  if (!user) {
    return (
      <Page>
        <PageHeader icon={Users} title="Cliente no encontrado" backTo="/admin-panel/users" />
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={UserIcon} title="El cliente que buscas no existe" description="Puede que el enlace esté mal o que se haya eliminado." />
        </div>
      </Page>
    );
  }

  // Tras guardar, el contexto actualiza su lista y el efecto de carga vuelve a leer el cliente.

  const handleSaveProfile = async () => {
    if (!formData.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await updateUser(user.id, {
        name: formData.name,
        phone: formData.phone || undefined,
        cedula: formData.cedula || undefined,
      });
      toast.success('Perfil actualizado correctamente');
      setIsEditing(false);
    } catch {
      toast.error('No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    const active = user.status === 'active';
    if (active && !(await confirm({ title: `¿Desactivar a ${user.name}?`, message: 'No podrá iniciar sesión en la tienda hasta que lo actives de nuevo.', tone: 'danger', confirmText: 'Desactivar' }))) return;
    try {
      await toggleUserStatus(user.id);
      toast.success(active ? 'Usuario desactivado correctamente' : 'Usuario activado correctamente');
    } catch {
      toast.error('No se pudo cambiar el estado del cliente');
    }
  };

  const spent = orders.filter((o) => String(o.status).toUpperCase() !== 'CANCELLED').reduce((acc, o) => acc + Number(o.total || 0), 0);
  const addr = user.address;
  const hasAddress = !!(addr && (addr.address || addr.city));

  return (
    <Page>
      <PageHeader
        icon={Users}
        backTo="/admin-panel/users"
        title={user.name}
        subtitle={`${user.email} · cliente desde ${new Date(user.createdAt).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`}
        actions={
          user.status === 'active'
            ? <Button variant="secondary" icon={<X className="w-4 h-4" />} onClick={handleToggleStatus}>Desactivar</Button>
            : <Button variant="success" icon={<Check className="w-4 h-4" />} onClick={handleToggleStatus}>Activar</Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ShoppingBag} label="Pedidos" value={loadingOrders ? '…' : ordersTotal} />
        <StatCard icon={ShoppingBag} tone="green" label="Total comprado" value={loadingOrders ? '…' : money(spent)} hint="Sin pedidos cancelados" />
        <StatCard icon={UserIcon} tone={user.status === 'active' ? 'green' : 'gray'} label="Estado" value={user.status === 'active' ? 'Activo' : 'Inactivo'} />
      </div>

      <Tabs<TabType>
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'profile', label: 'Perfil' },
          { value: 'orders', label: 'Pedidos', count: ordersTotal },
          { value: 'addresses', label: 'Dirección' },
        ]}
      />

      {activeTab === 'profile' && (
        <Card>
          <CardTitle
            icon={UserIcon}
            actions={!isEditing && <Button size="sm" variant="secondary" icon={<Edit2 className="w-4 h-4" />} onClick={() => setIsEditing(true)}>Editar</Button>}
          >
            Información personal
          </CardTitle>
          {isEditing ? (
            <>
              <FormGrid>
                <Field label="Nombre completo" required><TextInput value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></Field>
                <Field label="Email" hint="El email no se puede modificar"><TextInput value={user.email} disabled /></Field>
                <Field label="Teléfono"><TextInput type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+57 300 123 4567" /></Field>
                <Field label="Cédula / documento"><TextInput value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })} placeholder="1234567890" /></Field>
              </FormGrid>
              <FormActions>
                <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={saving}>Cancelar</Button>
                <Button icon={<Save className="w-4 h-4" />} onClick={handleSaveProfile} isLoading={saving}>Guardar</Button>
              </FormActions>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row gap-5">
              <Avatar name={user.name} size="lg" />
              <div className="flex-1">
                <DescriptionList items={[
                  { label: 'Nombre completo', value: user.name },
                  { label: 'Email', value: user.email },
                  { label: 'Teléfono', value: user.phone || null },
                  { label: 'Cédula / documento', value: user.cedula || null },
                  { label: 'Fecha de registro', value: fmtDate(user.createdAt) },
                  { label: 'Última actualización', value: fmtDate(user.updatedAt) },
                ]} />
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'addresses' && (
        <Card>
          <CardTitle icon={MapPin}>Dirección de envío</CardTitle>
          {hasAddress ? (
            <DescriptionList items={[
              { label: 'Dirección', value: addr?.address || null, full: true },
              { label: 'Ciudad', value: addr?.city || null },
              { label: 'Código postal', value: addr?.postalCode || null },
              { label: 'País', value: addr?.country || null },
            ]} />
          ) : (
            <EmptyState icon={MapPin} title="Sin dirección" description="El cliente no tiene una dirección registrada." />
          )}
        </Card>
      )}

      {activeTab === 'orders' && (
        <TableCard>
          <Table>
            <THead><tr><Th>Pedido</Th><Th>Fecha</Th><Th align="right">Productos</Th><Th align="center">Estado</Th><Th align="right">Total</Th></tr></THead>
            <TBody>
              {loadingOrders ? <TableMessage colSpan={5}>Cargando pedidos…</TableMessage>
                : orders.length === 0 ? <TableMessage colSpan={5}>El cliente no ha realizado ningún pedido.</TableMessage>
                  : orders.map((o) => {
                    const st = String(o.status).toLowerCase() as OrderStatus;
                    return (
                      <Tr key={o.id} onClick={() => navigate(`/admin-panel/orders/${o.id}`)}>
                        <Td className="font-medium text-gray-900 whitespace-nowrap">{o.orderNumber}</Td>
                        <Td className="whitespace-nowrap">{fmtDateTime(o.createdAt)}</Td>
                        <Td align="right">{o.items?.length ?? 0}</Td>
                        <Td align="center"><Badge tone={ORDER_TONE[st] ?? 'gray'}>{ORDER_STATUS_LABELS[st] ?? o.status}</Badge></Td>
                        <Td align="right" className="font-medium text-gray-900">{money(o.total)}</Td>
                      </Tr>
                    );
                  })}
            </TBody>
          </Table>
        </TableCard>
      )}
    </Page>
  );
};
