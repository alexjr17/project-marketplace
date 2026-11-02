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
import { ClipboardCheck, Plus, Eye, FileEdit, Clock, Hourglass, CalendarCheck } from 'lucide-react';
import {
  Page, PageHeader, Button, IconButton, StatCard, Badge, FilterBar, SearchInput, SelectInput,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Pager, toast,
} from '../../components/ui';
import * as inventoryCountsService from '../../services/inventory-counts.service';
import type { InventoryCount, InventoryCountStatus, InventoryCountStats } from '../../services/inventory-counts.service';
import { CountStatusBadge, fmtDate } from './InventoryCountShared';

const ALIGN: Record<string, 'left' | 'right' | 'center'> = { totalItems: 'right', status: 'center', actions: 'right' };

export default function InventoryCountsPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [stats, setStats] = useState<InventoryCountStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InventoryCountStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [countsData, statsData] = await Promise.all([
        inventoryCountsService.getInventoryCounts({ status: statusFilter || undefined }),
        inventoryCountsService.getStats(),
      ]);
      setCounts(countsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => navigate('/admin-panel/inventory-counts/new');
  const handleView = (count: InventoryCount) => navigate(`/admin-panel/inventory-counts/${count.id}`);

  const columns = useMemo<ColumnDef<InventoryCount>[]>(
    () => [
      {
        accessorKey: 'countNumber',
        header: 'Conteo',
        cell: ({ row }) => <span className="font-mono font-medium text-gray-900">{row.original.countNumber}</span>,
      },
      {
        accessorKey: 'countType',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge tone={row.original.countType === 'FULL' ? 'app' : 'blue'}>
            {inventoryCountsService.TYPE_LABELS[row.original.countType]}
          </Badge>
        ),
      },
      {
        accessorKey: 'countDate',
        header: 'Fecha',
        cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.countDate)}</span>,
      },
      {
        accessorKey: 'totalItems',
        header: 'Ítems',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            <span className="font-medium text-gray-900">{row.original.totalItems}</span>
            {row.original.itemsWithDiff > 0 && (
              <span className="block text-xs text-amber-700">{row.original.itemsWithDiff} con diferencia</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'countedByName',
        header: 'Contado por',
        cell: ({ row }) => row.original.countedByName || <span className="text-gray-400">—</span>,
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => <CountStatusBadge status={row.original.status} />,
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
    if (!searchTerm) return counts;
    const term = searchTerm.toLowerCase();
    return counts.filter(
      (c) => c.countNumber.toLowerCase().includes(term) || (c.countedByName && c.countedByName.toLowerCase().includes(term))
    );
  }, [counts, searchTerm]);

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
        icon={ClipboardCheck}
        title="Conteos físicos"
        subtitle="Conteo periódico de los insumos para cuadrar el inventario"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nuevo conteo</Button>}
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={ClipboardCheck} label="Conteos" value={stats.total.toLocaleString('es-CO')} />
          <StatCard
            icon={FileEdit}
            tone="gray"
            label="En curso"
            value={(stats.byStatus.DRAFT + stats.byStatus.IN_PROGRESS).toLocaleString('es-CO')}
            hint={`${stats.byStatus.DRAFT} borrador · ${stats.byStatus.IN_PROGRESS} en progreso`}
          />
          <StatCard
            icon={Hourglass}
            tone="yellow"
            label="Por aprobar"
            value={stats.byStatus.PENDING_APPROVAL.toLocaleString('es-CO')}
            hint={stats.byStatus.PENDING_APPROVAL > 0 ? 'Esperan revisión' : undefined}
            hintTone="yellow"
          />
          <StatCard
            icon={stats.lastCount ? CalendarCheck : Clock}
            tone="green"
            label="Último conteo"
            value={stats.lastCount ? fmtDate(stats.lastCount) : 'Nunca'}
          />
        </div>
      )}

      <FilterBar>
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por número o usuario…" />
        <SelectInput aria-label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InventoryCountStatus | '')}>
          <option value="">Todos los estados</option>
          {(Object.keys(inventoryCountsService.STATUS_LABELS) as InventoryCountStatus[]).map((s) => (
            <option key={s} value={s}>{inventoryCountsService.STATUS_LABELS[s]}</option>
          ))}
        </SelectInput>
      </FilterBar>

      <TableCard
        footer={filteredData.length > 0 ? (
          <Pager
            page={pageIndex + 1}
            pageSize={pageSize}
            total={filteredData.length}
            onPage={(p) => table.setPageIndex(p - 1)}
            onPageSize={(s) => table.setPageSize(s)}
          />
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
              <TableMessage colSpan={columns.length}>Cargando conteos…</TableMessage>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableMessage colSpan={columns.length}>
                {searchTerm || statusFilter ? 'Ningún conteo coincide con los filtros.' : (
                  <span className="flex flex-col items-center gap-3">
                    <span>Aún no hay conteos. Crea uno para verificar el inventario físico.</span>
                    <Button size="sm" variant="outline" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nuevo conteo</Button>
                  </span>
                )}
              </TableMessage>
            ) : (
              table.getRowModel().rows.map((row) => (
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
