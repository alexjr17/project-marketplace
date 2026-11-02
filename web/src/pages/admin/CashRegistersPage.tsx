import { useState, useEffect, useMemo } from 'react';
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
import { Plus, Pencil, Trash2, Power, Monitor, MapPin, Users, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, EmptyState, FilterBar, IconButton, Page, PageHeader, Pager, SearchInput, Spinner, StatCard,
  Table, TableCard, TBody, Td, Th, THead, Tr, toast, useConfirm,
} from '../../components/ui';
import * as cashRegisterService from '../../services/cash-register.service';
import type { CashRegister, CashSession } from '../../services/cash-register.service';

const columnHelper = createColumnHelper<CashRegister>();

const getActiveSession = (register: CashRegister): CashSession | null =>
  register.cashSessions && register.cashSessions.length > 0 ? register.cashSessions[0] : null;

export default function CashRegistersPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  useEffect(() => {
    loadCashRegisters();
  }, []);

  const loadCashRegisters = async () => {
    try {
      setLoading(true);
      const data = await cashRegisterService.getCashRegisters();
      setCashRegisters(data);
    } catch (error) {
      console.error('Error loading cash registers:', error);
      toast.error('Error al cargar las cajas registradoras');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => navigate('/admin-panel/cash-registers/new');
  const handleEdit = (register: CashRegister) => navigate(`/admin-panel/cash-registers/${register.id}/edit`);

  const handleDelete = async (register: CashRegister) => {
    if (!(await confirm({ title: `¿Eliminar la caja "${register.name}"?`, message: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return;
    try {
      await cashRegisterService.deleteCashRegister(register.id);
      toast.success('Caja eliminada correctamente');
      await loadCashRegisters();
    } catch (error: any) {
      console.error('Error deleting register:', error);
      toast.error(error?.message || 'Error al eliminar la caja');
    }
  };

  const stats = useMemo(() => ({
    total: cashRegisters.length,
    active: cashRegisters.filter((r) => r.isActive).length,
    inUse: cashRegisters.filter((r) => r.cashSessions && r.cashSessions.length > 0).length,
  }), [cashRegisters]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column }) => (
          <button onClick={() => column.toggleSorting()} className="inline-flex items-center gap-1 uppercase hover:text-gray-900">
            Caja <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        ),
        cell: (info) => {
          const register = info.row.original;
          return (
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${register.isActive ? 'bg-app-50 text-app-600' : 'bg-gray-100 text-gray-400'}`}>
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{register.name}</p>
                <p className="text-xs text-gray-500 font-mono">{register.code}</p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('location', {
        header: 'Ubicación',
        cell: (info) => (
          <span className="inline-flex items-center gap-1.5 text-gray-600">
            <MapPin className="w-4 h-4 text-gray-400" />
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('isActive', {
        header: 'Estado',
        cell: (info) => <Badge tone={info.getValue() ? 'green' : 'gray'}>{info.getValue() ? 'Activa' : 'Inactiva'}</Badge>,
      }),
      columnHelper.display({
        id: 'session',
        header: 'Sesión activa',
        cell: ({ row }) => {
          const activeSession = getActiveSession(row.original);
          if (!activeSession) return <span className="text-gray-400">Sin sesión</span>;
          return (
            <div className="flex items-center gap-2">
              <Avatar size="sm" name={activeSession.seller?.name || 'Usuario'} />
              <div>
                <p className="font-medium text-gray-900">{activeSession.seller?.name || 'Usuario'}</p>
                <p className="text-xs text-gray-500">
                  Desde {new Date(activeSession.openedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <div className="flex items-center justify-end whitespace-nowrap">
            <IconButton title="Editar" tone="app" onClick={() => handleEdit(row.original)}><Pencil className="w-4 h-4" /></IconButton>
            <IconButton title="Eliminar" tone="danger" onClick={() => handleDelete(row.original)}><Trash2 className="w-4 h-4" /></IconButton>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: cashRegisters,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const alignOf = (id: string) => (id === 'actions' ? 'right' : id === 'isActive' ? 'center' : 'left') as 'left' | 'center' | 'right';

  return (
    <Page>
      <PageHeader
        icon={Monitor}
        title="Cajas registradoras"
        subtitle="Cajas del punto de venta y las categorías que puede vender cada una"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nueva caja</Button>}
      />

      {loading ? (
        <Spinner label="Cargando cajas registradoras…" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Monitor} label="Total cajas" value={stats.total} />
            <StatCard icon={Power} tone="green" label="Activas" value={stats.active} hint={stats.total - stats.active > 0 ? `${stats.total - stats.active} inactivas` : undefined} />
            <StatCard icon={Users} tone="blue" label="En uso" value={stats.inUse} hint="Con sesión abierta" />
          </div>

          <FilterBar>
            <SearchInput value={globalFilter ?? ''} onChange={setGlobalFilter} placeholder="Buscar por nombre, código o ubicación…" className="sm:col-span-2" />
          </FilterBar>

          <TableCard
            footer={filteredCount > 0 && (
              <Pager page={pageIndex + 1} pageSize={pageSize} total={filteredCount} onPage={(p) => table.setPageIndex(p - 1)} onPageSize={(s) => table.setPageSize(s)} />
            )}
          >
            {table.getRowModel().rows.length === 0 ? (
              <EmptyState
                icon={Monitor}
                title={globalFilter ? 'No se encontraron cajas' : 'No hay cajas registradoras'}
                description={globalFilter ? 'Intenta con otra búsqueda.' : 'Crea tu primera caja registradora para comenzar.'}
                action={!globalFilter && <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nueva caja</Button>}
              />
            ) : (
              <Table>
                <THead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <Th key={h.id} align={alignOf(h.column.id)}>
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </Th>
                      ))}
                    </tr>
                  ))}
                </THead>
                <TBody>
                  {table.getRowModel().rows.map((row) => (
                    <Tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <Td key={cell.id} align={alignOf(cell.column.id)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </TableCard>
        </>
      )}
    </Page>
  );
}
