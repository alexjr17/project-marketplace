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
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { Modal } from '../../components/shared/Modal';
import type { User } from '../../types/user';
import {
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Settings,
  UserCheck,
  Check,
  X,
  Plus,
  Crown,
  UserCog,
} from 'lucide-react';

const columnHelper = createColumnHelper<User>();

export const AdminUsersPage = () => {
  const navigate = useNavigate();
  const { admins, addAdmin } = useUsers();
  const { roles } = useRoles();
  const toast = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Roles disponibles para asignar (excluyendo Usuario normal - id: 1)
  const assignableRoles = roles.filter(r => r.id !== 1 && r.isActive);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    roleId: 2, // Por defecto, primer rol personalizado o admin básico
  });

  // Filtrar por estado
  const filteredAdmins = useMemo(() => {
    if (statusFilter === 'all') return admins;
    return admins.filter((a) => a.status === statusFilter);
  }, [admins, statusFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-gray-900"
          >
            Administrador
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: (info) => (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {info.getValue().charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-medium text-gray-900 flex items-center gap-2">
                {info.getValue()}
                {info.row.original.role === 'superadmin' && (
                  <Crown className="w-4 h-4 text-yellow-500" />
                )}
              </div>
              <div className="text-sm text-gray-500">{info.row.original.email}</div>
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
          // Nombre real del rol: lo trae el usuario (roleName) o se resuelve
          // por roleId desde la lista de roles; respaldo "Administrador".
          const roleName = isSuperAdmin
            ? 'Super Administrador'
            : (admin.roleName || roles.find((r) => r.id === admin.roleId)?.name || 'Administrador');

          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                isSuperAdmin
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {isSuperAdmin ? (
                <>
                  <Crown className="w-3 h-3 mr-1" />
                  {roleName}
                </>
              ) : (
                <>
                  <Shield className="w-3 h-3 mr-1" />
                  {roleName}
                </>
              )}
            </span>
          );
        },
      }),
      columnHelper.accessor('phone', {
        header: 'Teléfono',
        cell: (info) => (
          <span className="text-gray-600">{info.getValue() || '-'}</span>
        ),
      }),
      columnHelper.accessor('createdAt', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-gray-900"
          >
            Registro
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: (info) => (
          <span className="text-gray-600">
            {new Date(info.getValue()).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: (info) => {
          const status = info.getValue();
          return status === 'active' ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <Check className="w-3 h-3 mr-1" />
              Activo
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <X className="w-3 h-3 mr-1" />
              Inactivo
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Acciones</div>,
        cell: (info) => (
          <div className="flex justify-end">
            <button
              onClick={() => handleViewAdmin(info.row.original)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Ver detalles"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredAdmins,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const handleViewAdmin = (admin: User) => {
    navigate(`/admin-panel/admins/${admin.id}`);
  };

  const handleOpenForm = () => {
    // Usar el primer rol disponible que no sea superadmin ni usuario
    const defaultRoleId = assignableRoles.find(r => r.id !== 0)?.id || 2;
    setFormData({
      email: '',
      password: '',
      name: '',
      phone: '',
      roleId: defaultRoleId,
    });
    setIsFormOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.name) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    // Determinar el role string basado en el roleId
    const role = formData.roleId === 0 ? 'superadmin' : 'admin';

    addAdmin({
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
  };

  // Estadísticas
  const stats = {
    total: admins.length,
    active: admins.filter((a) => a.status === 'active').length,
    superadmins: admins.filter((a) => a.role === 'superadmin').length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administradores</h1>
          <p className="text-gray-600 mt-1 text-sm">Gestiona los administradores del sistema</p>
        </div>
        <Button onClick={handleOpenForm} variant="admin-orange" size="sm">
          <Plus className="w-4 h-4" />
          Nuevo Admin
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <UserCog className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Activos</p>
              <p className="text-xl font-bold text-green-600">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Crown className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Super Admins</p>
              <p className="text-xl font-bold text-yellow-600">{stats.superadmins}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Inactivos
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12">
                    <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {globalFilter ? 'No se encontraron administradores' : 'No hay administradores'}
                    </h3>
                    <p className="text-gray-500">
                      {globalFilter
                        ? 'Intenta con otra búsqueda'
                        : 'Los administradores aparecerán aquí'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {table.getRowModel().rows.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Mostrando{' '}
              <span className="font-medium">
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              </span>{' '}
              a{' '}
              <span className="font-medium">
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}
              </span>{' '}
              de <span className="font-medium">{table.getFilteredRowModel().rows.length}</span> administradores
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex gap-1">
                {Array.from({ length: table.getPageCount() }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => table.setPageIndex(page - 1)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      table.getState().pagination.pageIndex === page - 1
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Admin Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Nuevo Administrador"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nombre del administrador"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@ejemplo.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña *
            </label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+57 300 123 4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol *
            </label>
            <select
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: Number(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            >
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.id === 0 && ' (Acceso total)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              El rol determina los permisos del administrador
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              Crear
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
