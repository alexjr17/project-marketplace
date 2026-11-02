import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Truck, Plus, Pencil, Phone, Mail, Building2, CheckCircle, ClipboardList } from 'lucide-react';
import {
  Page, PageHeader, Button, IconButton, StatCard, Badge, FilterBar, SearchInput,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Pager, toast,
} from '../../components/ui';
import * as suppliersService from '../../services/suppliers.service';
import type { Supplier, SupplierStats } from '../../services/suppliers.service';

const ALIGN: Record<string, 'left' | 'right' | 'center'> = { orders: 'right', isActive: 'center', actions: 'right' };

export default function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<SupplierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [suppliersData, statsData] = await Promise.all([suppliersService.getSuppliers(), suppliersService.getStats()]);
      setSuppliers(suppliersData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => navigate('/admin-panel/suppliers/new');
  const handleEdit = (supplier: Supplier) => navigate(`/admin-panel/suppliers/${supplier.id}`);

  const columns = useMemo<ColumnDef<Supplier>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Proveedor',
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-medium text-gray-900">{row.original.name}</p>
            <p className="text-xs text-gray-500">
              <span className="font-mono">{row.original.code}</span>
              {row.original.taxId && <> · {row.original.taxIdType}: {row.original.taxId}</>}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'contactName',
        header: 'Contacto',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            {row.original.contactName && <p className="text-gray-900">{row.original.contactName}</p>}
            {row.original.phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{row.original.phone}</p>}
            {row.original.email && <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{row.original.email}</p>}
            {!row.original.contactName && !row.original.phone && !row.original.email && <span className="text-gray-400">—</span>}
          </div>
        ),
      },
      {
        accessorKey: 'city',
        header: 'Ubicación',
        cell: ({ row }) => row.original.city
          ? <span className="whitespace-nowrap">{row.original.city}{row.original.department && `, ${row.original.department}`}</span>
          : <span className="text-gray-400">—</span>,
      },
      {
        id: 'orders',
        accessorFn: (s) => s._count?.purchaseOrders || 0,
        header: 'Órdenes',
        cell: ({ row }) => <span className="tabular-nums">{row.original._count?.purchaseOrders || 0}</span>,
      },
      {
        accessorKey: 'isActive',
        header: 'Estado',
        cell: ({ row }) => <Badge tone={row.original.isActive ? 'green' : 'gray'}>{row.original.isActive ? 'Activo' : 'Inactivo'}</Badge>,
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <IconButton title="Editar" tone="app" onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }}>
            <Pencil className="w-4 h-4" />
          </IconButton>
        ),
      },
    ],
    []
  );

  const filteredData = useMemo(() => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.code.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term) ||
        s.taxId?.toLowerCase().includes(term) ||
        s.contactName?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <Page>
      <PageHeader
        icon={Truck}
        title="Proveedores"
        subtitle="Empresas y personas a las que les compras"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nuevo proveedor</Button>}
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Building2} label="Proveedores" value={stats.total.toLocaleString('es-CO')} />
          <StatCard icon={CheckCircle} tone="green" label="Activos" value={stats.active.toLocaleString('es-CO')} hint={stats.total - stats.active > 0 ? `${stats.total - stats.active} inactivos` : undefined} />
          <StatCard icon={ClipboardList} tone="blue" label="Con órdenes" value={stats.withOrders.toLocaleString('es-CO')} to="/admin-panel/purchase-orders" hint="Ver órdenes de compra" />
        </div>
      )}

      <FilterBar>
        <SearchInput className="sm:col-span-2" value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por código, nombre, NIT, contacto…" />
      </FilterBar>

      <TableCard
        footer={filteredData.length > 0 ? (
          <Pager page={pageIndex + 1} pageSize={pageSize} total={filteredData.length} onPage={(p) => table.setPageIndex(p - 1)} onPageSize={(s) => table.setPageSize(s)} />
        ) : undefined}
      >
        <Table>
          <THead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <Th key={header.id} align={ALIGN[header.column.id] ?? 'left'}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                ))}
              </tr>
            ))}
          </THead>
          <TBody>
            {loading ? (
              <TableMessage colSpan={columns.length}>Cargando proveedores…</TableMessage>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableMessage colSpan={columns.length}>
                {searchTerm ? 'Ningún proveedor coincide con la búsqueda.' : (
                  <span className="flex flex-col items-center gap-3">
                    <span>Aún no hay proveedores.</span>
                    <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nuevo proveedor</Button>
                  </span>
                )}
              </TableMessage>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Tr key={row.id} onClick={() => handleEdit(row.original)}>
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id} align={ALIGN[cell.column.id] ?? 'left'}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Td>
                  ))}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableCard>
    </Page>
  );
}
