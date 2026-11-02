import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useUsers } from '../../context/UsersContext';
import { useRoles } from '../../context/RolesContext';
import type { User } from '../../types/user';
import { Shield, ArrowUpDown, ChevronRight, UserCheck, Plus, Crown, UserCog, UserX } from 'lucide-react';
import {
  Avatar, Badge, Button, Dialog, EmptyState, Field, FilterBar, IconButton, Page, PageHeader, Pager, RadioGroup,
  SearchInput, SelectInput, StatCard, Table, TableCard, TBody, Td, TextInput, Th, THead, Tr, toast,
} from '../../components/ui';

const columnHelper = createColumnHelper<User>();
type StatusFilter = 'all' | 'active' | 'inactive';

const SortHeader = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">
    {label} <ArrowUpDown className="w-3.5 h-3.5" />
  </button>
);

export const AdminUsersPage = () => {
  const navigate = useNavigate();
  const { admins, addAdmin } = useUsers();
  const { roles } = useRoles();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Roles disponibles para asignar (excluyendo Usuario normal - id: 1)
  const assignableRoles = roles.filter(r => r.id !== 1 && r.isActive);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    roleId: 2,
  });

  const filteredAdmins = useMemo(() => {
    if (statusFilter === 'all') return admins;
    return admins.filter((a) => a.status === statusFilter);
  }, [admins, statusFilter]);

  const handleViewAdmin = (admin: User) => navigate(`/admin-panel/admins/${admin.id}`);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column }) => <SortHeader label="Administrador" onClick={() => column.toggleSorting()} />,
        cell: (info) => (
          <div className="flex items-center gap-3">
            <Avatar name={info.getValue()} />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 flex items-center gap-1.5">
                {info.getValue()}
                {info.row.original.role === 'superadmin' && <Crown className="w-4 h-4 text-amber-500" />}
              </p>
              <p className="text-xs text-gray-500">{info.row.original.email}</p>
            </div>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'role',
        header: 'Rol',
        cell: (info) => {
          const admin = info.row.original;
          const isSuperAdmin = admin.role === 'superadmin';
          // Nombre real del rol: lo trae el usuario (roleName) o se resuelve por roleId; respaldo "Administrador".
          const roleName = isSuperAdmin
            ? 'Super Administrador'
            : (admin.roleName || roles.find((r) => r.id === admin.roleId)?.name || 'Administrador');
          return (
            <Badge tone={isSuperAdmin ? 'yellow' : 'app'}>
              {isSuperAdmin ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
              {roleName}
            </Badge>
          );
        },
      }),
      columnHelper.accessor('phone', {
        header: 'Teléfono',
        cell: (info) => <span className="text-gray-600">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('createdAt', {
        header: ({ column }) => <SortHeader label="Registro" onClick={() => column.toggleSorting()} />,
        cell: (info) => (
          <span className="text-gray-600 whitespace-nowrap">
            {new Date(info.getValue()).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: (info) => <Badge tone={info.getValue() === 'active' ? 'green' : 'gray'}>{info.getValue() === 'active' ? 'Activo' : 'Inactivo'}</Badge>,
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Acciones',
        cell: (info) => (
          <IconButton title="Ver detalle" tone="app" onClick={(e) => { e.stopPropagation(); handleViewAdmin(info.row.original); }}>
            <ChevronRight className="w-4 h-4" />
          </IconButton>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roles]
  );

  const table = useReactTable({
    data: filteredAdmins,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const handleOpenForm = () => {
    // Usar el primer rol disponible que no sea superadmin ni usuario
    const defaultRoleId = assignableRoles.find(r => r.id !== 0)?.id || 2;
    setFormData({ email: '', password: '', name: '', phone: '', roleId: defaultRoleId });
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.email || !formData.password || !formData.name) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    const role = formData.roleId === 0 ? 'superadmin' : 'admin';
    setSaving(true);
    try {
      await addAdmin({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone || undefined,
        role,
        status: 'active',
        roleId: formData.roleId,
      });
      toast.success('Administrador creado correctamente');
      setIsFormOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo crear el administrador');
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: admins.length,
    active: admins.filter((a) => a.status === 'active').length,
    superadmins: admins.filter((a) => a.role === 'superadmin').length,
  };
  const inactive = stats.total - stats.active;

  const { pageIndex, pageSize } = table.getState().pagination;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const rightCols = new Set(['actions']);

  return (
    <Page>
      <PageHeader
        icon={UserCog}
        title="Administradores"
        subtitle="Personas con acceso al panel y el rol que define sus permisos"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={handleOpenForm}>Nuevo administrador</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={UserCog} label="Total" value={stats.total} />
        <StatCard icon={UserCheck} tone="green" label="Activos" value={stats.active} />
        <StatCard icon={UserX} tone="gray" label="Inactivos" value={inactive} />
        <StatCard icon={Crown} tone="yellow" label="Super admins" value={stats.superadmins} />
      </div>

      <FilterBar
        actions={
          <RadioGroup<StatusFilter>
            variant="segmented"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[{ value: 'all', label: 'Todos' }, { value: 'active', label: 'Activos' }, { value: 'inactive', label: 'Inactivos' }]}
          />
        }
      >
        <SearchInput value={globalFilter ?? ''} onChange={setGlobalFilter} placeholder="Buscar por nombre o correo…" className="sm:col-span-2" />
      </FilterBar>

      <TableCard
        footer={filteredCount > 0 && (
          <Pager page={pageIndex + 1} pageSize={pageSize} total={filteredCount} onPage={(p) => table.setPageIndex(p - 1)} onPageSize={(s) => table.setPageSize(s)} />
        )}
      >
        {table.getRowModel().rows.length === 0 ? (
          <EmptyState
            icon={Shield}
            title={globalFilter ? 'No se encontraron administradores' : 'No hay administradores'}
            description={globalFilter ? 'Intenta con otra búsqueda.' : 'Crea el primero para darle acceso al panel.'}
          />
        ) : (
          <Table>
            <THead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <Th key={h.id} align={rightCols.has(h.column.id) ? 'right' : h.column.id === 'status' ? 'center' : 'left'}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </Th>
                  ))}
                </tr>
              ))}
            </THead>
            <TBody>
              {table.getRowModel().rows.map((row) => (
                <Tr key={row.id} onClick={() => handleViewAdmin(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id} align={rightCols.has(cell.column.id) ? 'right' : cell.column.id === 'status' ? 'center' : 'left'}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Td>
                  ))}
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </TableCard>

      <Dialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Nuevo administrador"
        description="Podrá entrar al panel con este correo y contraseña."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
            <Button type="submit" form="new-admin-form" isLoading={saving} icon={<Plus className="w-4 h-4" />}>Crear administrador</Button>
          </>
        }
      >
        <form id="new-admin-form" onSubmit={handleSubmitForm} className="space-y-4">
          <Field label="Nombre completo" required>
            <TextInput value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nombre del administrador" required />
          </Field>
          <Field label="Correo" required>
            <TextInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="admin@ejemplo.com" required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contraseña" required>
              <TextInput type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required />
            </Field>
            <Field label="Teléfono">
              <TextInput type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+57 300 123 4567" />
            </Field>
          </div>
          <Field label="Rol" required hint="El rol determina los permisos del administrador.">
            <SelectInput value={formData.roleId} onChange={(e) => setFormData({ ...formData, roleId: Number(e.target.value) })} required>
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}{role.id === 0 && ' (Acceso total)'}</option>
              ))}
            </SelectInput>
          </Field>
        </form>
      </Dialog>
    </Page>
  );
};
