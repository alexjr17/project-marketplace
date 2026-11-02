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
import { ClipboardList, Plus, Eye, Clock, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import {
  Page, PageHeader, Button, IconButton, StatCard, FilterBar, SearchInput, SelectInput,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Pager, EmptyState, toast,
} from '../../components/ui';
import * as purchaseOrdersService from '../../services/purchase-orders.service';
import type { PurchaseOrder, PurchaseOrderStatus, PurchaseOrderStats } from '../../services/purchase-orders.service';
import { PurchaseOrderStatusBadge, money } from './PurchaseOrderStatus';

// Alineación de cada columna (números a la derecha, estado al centro).
const ALIGN: Record<string, 'left' | 'center' | 'right'> = { total: 'right', items: 'right', status: 'center', actions: 'right' };

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [stats, setStats] = useState<PurchaseOrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersData, statsData] = await Promise.all([
        purchaseOrdersService.getPurchaseOrders({ status: statusFilter || undefined }),
        purchaseOrdersService.getStats(),
      ]);
      setOrders(ordersData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('No se pudieron cargar las órdenes de compra');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => navigate('/admin-panel/purchase-orders/new');
  const handleView = (order: PurchaseOrder) => navigate(`/admin-panel/purchase-orders/${order.id}`);

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        accessorKey: 'orderNumber',
        header: 'Orden',
        cell: ({ row }) => <span className="font-mono font-medium text-gray-900">{row.original.orderNumber}</span>,
      },
      {
        accessorKey: 'supplier.name',
        header: 'Proveedor',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-gray-900">{row.original.supplier.name}</p>
            <p className="text-xs text-gray-500">{row.original.supplier.code}</p>
          </div>
        ),
      },
      {
        accessorKey: 'orderDate',
        header: 'Fecha',
        cell: ({ row }) => <span className="whitespace-nowrap">{new Date(row.original.orderDate).toLocaleDateString('es-CO')}</span>,
      },
      {
        accessorKey: 'items',
        header: 'Ítems / unidades',
        cell: ({ row }) => {
          const totalUnits = row.original.items.reduce((sum, item) => sum + Number(item.quantity), 0);
          return (
            <div className="whitespace-nowrap">
              <span className="font-medium text-gray-900">{row.original.items.length}</span>
              <span className="text-gray-500"> ítems</span>
              <div className="text-xs text-gray-500">{totalUnits.toLocaleString('es-CO')} unidades</div>
            </div>
          );
        },
      },
      {
        accessorKey: 'total',
        header: 'Total',
        cell: ({ row }) => <span className="font-medium text-gray-900 whitespace-nowrap">{money(row.original.total)}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => <PurchaseOrderStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <IconButton title="Ver detalle" tone="app" onClick={(e) => { e.stopPropagation(); handleView(row.original); }}>
            <Eye className="w-4 h-4" />
          </IconButton>
        ),
      },
    ],
    []
  );

  const filteredData = useMemo(() => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(
      (o) => o.orderNumber.toLowerCase().includes(term) || o.supplier.name.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

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
  const total = table.getFilteredRowModel().rows.length;
  const rows = table.getRowModel().rows;
  const hasFilters = !!searchTerm || !!statusFilter;

  return (
    <Page>
      <PageHeader
        icon={ClipboardList}
        title="Órdenes de compra"
        subtitle="Compras a proveedores: borrador, envío, confirmación y recepción"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nueva orden</Button>}
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Clock} tone="yellow" label="Pendientes" value={stats.pendingCount} />
          <StatCard icon={CheckCircle} tone="green" label="Recibidas" value={stats.byStatus.received} />
          <StatCard icon={XCircle} tone="red" label="Canceladas" value={stats.byStatus.cancelled} />
          <StatCard icon={DollarSign} label="Compras del mes" value={money(stats.monthlyTotal)} />
        </div>
      )}

      <FilterBar
        actions={hasFilters ? (
          <Button variant="ghost" onClick={() => { setSearchTerm(''); setStatusFilter(''); }}>Limpiar</Button>
        ) : undefined}
      >
        <SearchInput className="sm:col-span-2" value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por número o proveedor…" />
        <SelectInput
          aria-label="Estado"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | '')}
        >
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="SENT">Enviada</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="PARTIAL">Parcial</option>
          <option value="RECEIVED">Recibida</option>
          <option value="CANCELLED">Cancelada</option>
        </SelectInput>
      </FilterBar>

      <TableCard
        footer={total > 0 ? (
          <Pager
            page={pageIndex + 1}
            pageSize={pageSize}
            total={total}
            onPage={(p) => table.setPageIndex(p - 1)}
            onPageSize={(s) => table.setPageSize(s)}
          />
        ) : undefined}
      >
        <Table>
          <THead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <Th key={h.id} align={ALIGN[h.column.id] ?? 'left'}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </Th>
                ))}
              </tr>
            ))}
          </THead>
          <TBody>
            {loading ? (
              <TableMessage colSpan={columns.length}>Cargando…</TableMessage>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    icon={ClipboardList}
                    title={hasFilters ? 'Sin resultados' : 'Aún no hay órdenes de compra'}
                    description={hasFilters ? 'Prueba con otro texto o estado.' : 'Crea la primera orden para pedir mercancía a un proveedor.'}
                    action={!hasFilters ? <Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nueva orden</Button> : undefined}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Tr key={row.id} onClick={() => handleView(row.original)}>
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
