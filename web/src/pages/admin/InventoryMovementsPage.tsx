import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Table as TanTable,
} from '@tanstack/react-table';
import {
  ArrowDownUp,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Box,
} from 'lucide-react';
import {
  Page, PageHeader, StatCard, Badge, Tabs, FilterBar, SearchInput, SelectInput,
  TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Pager, toast, type Tone,
} from '../../components/ui';
import * as inventoryService from '../../services/inventory.service';
import type {
  VariantMovement,
  MovementType,
  InventoryStats,
  InputBatchMovement,
  InputMovementType,
  InputMovementsStats,
} from '../../services/inventory.service';

type TabType = 'products' | 'inputs';

// Tonos de estado del estándar (verde entrada, rojo salida/daño, ámbar ajuste, azul informativo, gris resto)
const PRODUCT_TONE: Record<MovementType, Tone> = {
  PURCHASE: 'green', SALE: 'blue', ADJUSTMENT: 'yellow', TRANSFER_IN: 'green',
  TRANSFER_OUT: 'blue', RETURN: 'green', DAMAGE: 'red', INITIAL: 'gray',
};
const INPUT_TONE: Record<InputMovementType, Tone> = {
  ENTRADA: 'green', SALIDA: 'red', AJUSTE: 'yellow', RESERVA: 'blue',
  LIBERACION: 'gray', CONSUMO: 'blue', DEVOLUCION: 'green',
};

const REFERENCE_LABELS: Record<string, string> = {
  purchase: 'Compra',
  purchase_order: 'Orden de compra',
  adjustment: 'Ajuste',
  order: 'Pedido',
  production: 'Producción',
  inventory_count: 'Conteo físico',
};

const DateCell = ({ value }: { value: string }) => (
  <div className="whitespace-nowrap">
    <p className="text-gray-900">{new Date(value).toLocaleDateString()}</p>
    <p className="text-xs text-gray-500">{new Date(value).toLocaleTimeString()}</p>
  </div>
);

const QtyCell = ({ incoming, value }: { incoming: boolean; value: string | number }) => (
  <span className={`inline-flex items-center justify-end gap-1 font-medium tabular-nums ${incoming ? 'text-green-600' : 'text-red-600'}`}>
    {incoming ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
    {incoming ? '+' : '-'}{value}
  </span>
);

// Columnas numéricas (alineadas a la derecha)
const RIGHT_COLS = new Set(['quantity', 'previousStock', 'newStock']);

export default function InventoryMovementsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('products');

  // Productos
  const [movements, setMovements] = useState<VariantMovement[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [typeFilter, setTypeFilter] = useState<MovementType | ''>('');

  // Insumos
  const [inputMovements, setInputMovements] = useState<InputBatchMovement[]>([]);
  const [inputStats, setInputStats] = useState<InputMovementsStats | null>(null);
  const [inputTypeFilter, setInputTypeFilter] = useState<InputMovementType | ''>('');

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    if (activeTab === 'products') {
      loadProductsData();
    } else {
      loadInputsData();
    }
  }, [activeTab, typeFilter, inputTypeFilter]);

  const loadProductsData = async () => {
    try {
      setLoading(true);
      const [movementsData, statsData] = await Promise.all([
        inventoryService.getMovements({ movementType: typeFilter || undefined }),
        inventoryService.getStats(),
      ]);
      setMovements(movementsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading products data:', error);
      toast.error('Error al cargar datos de productos');
    } finally {
      setLoading(false);
    }
  };

  const loadInputsData = async () => {
    try {
      setLoading(true);
      const [movementsData, statsData] = await Promise.all([
        inventoryService.getInputMovements({ movementType: inputTypeFilter || undefined }),
        inventoryService.getInputMovementsStats(),
      ]);
      setInputMovements(movementsData);
      setInputStats(statsData);
    } catch (error) {
      console.error('Error loading inputs data:', error);
      toast.error('Error al cargar datos de insumos');
    } finally {
      setLoading(false);
    }
  };

  const productColumns = useMemo<ColumnDef<VariantMovement>[]>(
    () => [
      { accessorKey: 'createdAt', header: 'Fecha', cell: ({ row }) => <DateCell value={row.original.createdAt} /> },
      {
        accessorKey: 'variant',
        header: 'Producto',
        cell: ({ row }) => {
          const v = row.original.variant;
          return (
            <div>
              <p className="font-medium text-gray-900">{v?.product?.name || '-'}</p>
              <p className="text-xs text-gray-500">
                {v?.sku}
                {v?.color && ` · ${v.color.name}`}
                {v?.size && ` · ${v.size.name}`}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: 'movementType',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge tone={PRODUCT_TONE[row.original.movementType] ?? 'gray'}>
            {inventoryService.getMovementTypeLabel(row.original.movementType)}
          </Badge>
        ),
      },
      {
        accessorKey: 'quantity',
        header: 'Cantidad',
        cell: ({ row }) => (
          <QtyCell incoming={inventoryService.isIncoming(row.original.movementType)} value={Math.abs(row.original.quantity)} />
        ),
      },
      {
        accessorKey: 'previousStock',
        header: 'Stock anterior',
        cell: ({ row }) => <span className="text-gray-500 tabular-nums">{row.original.previousStock}</span>,
      },
      {
        accessorKey: 'newStock',
        header: 'Stock nuevo',
        cell: ({ row }) => <span className="font-medium text-gray-900 tabular-nums">{row.original.newStock}</span>,
      },
      {
        accessorKey: 'reason',
        header: 'Razón',
        cell: ({ row }) => <span className="text-gray-600 truncate max-w-[220px] block">{row.original.reason || '-'}</span>,
      },
    ],
    []
  );

  const inputColumns = useMemo<ColumnDef<InputBatchMovement>[]>(
    () => [
      { accessorKey: 'createdAt', header: 'Fecha', cell: ({ row }) => <DateCell value={row.original.createdAt} /> },
      {
        accessorKey: 'input',
        header: 'Insumo',
        cell: ({ row }) => {
          const input = row.original.input;
          const variant = row.original.inputVariant;
          return (
            <div>
              <p className="font-medium text-gray-900">{input?.name || '-'}</p>
              <p className="text-xs text-gray-500">{input?.code} · {input?.unitOfMeasure}</p>
              {variant && (
                <div className="flex items-center gap-1 mt-1">
                  {variant.color && (
                    <span
                      className="w-3 h-3 rounded-full border border-gray-300"
                      style={{ backgroundColor: variant.color.hexCode }}
                      title={variant.color.name}
                    />
                  )}
                  <span className="text-xs text-gray-600">
                    {variant.color?.name || ''} {variant.size?.abbreviation ? `/ ${variant.size.abbreviation}` : ''}
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'inputBatch',
        header: 'Lote / variante',
        cell: ({ row }) => {
          const variant = row.original.inputVariant;
          if (variant) return <span className="text-xs font-mono text-gray-700">{variant.sku}</span>;
          return <span className="text-gray-600">{row.original.inputBatch?.batchNumber || '-'}</span>;
        },
      },
      {
        accessorKey: 'movementType',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge tone={INPUT_TONE[row.original.movementType] ?? 'gray'}>
            {inventoryService.getInputMovementTypeLabel(row.original.movementType)}
          </Badge>
        ),
      },
      {
        accessorKey: 'quantity',
        header: 'Cantidad',
        cell: ({ row }) => (
          <QtyCell
            incoming={inventoryService.isInputIncoming(row.original.movementType)}
            value={Math.abs(Number(row.original.quantity)).toFixed(2)}
          />
        ),
      },
      {
        accessorKey: 'referenceType',
        header: 'Referencia',
        cell: ({ row }) => {
          const refType = row.original.referenceType;
          const refId = row.original.referenceId;
          if (!refType) return <span className="text-gray-400">-</span>;
          return (
            <span className="text-gray-600 whitespace-nowrap">
              {REFERENCE_LABELS[refType] || refType}
              {refId && ` #${refId}`}
            </span>
          );
        },
      },
      {
        accessorKey: 'reason',
        header: 'Razón',
        cell: ({ row }) => <span className="text-gray-600 truncate max-w-[220px] block">{row.original.reason || '-'}</span>,
      },
    ],
    []
  );

  const filteredProductsData = useMemo(() => {
    if (!searchTerm) return movements;
    const term = searchTerm.toLowerCase();
    return movements.filter(
      (m) =>
        m.variant?.sku?.toLowerCase().includes(term) ||
        m.variant?.product?.name?.toLowerCase().includes(term) ||
        m.reason?.toLowerCase().includes(term)
    );
  }, [movements, searchTerm]);

  const filteredInputsData = useMemo(() => {
    if (!searchTerm) return inputMovements;
    const term = searchTerm.toLowerCase();
    return inputMovements.filter(
      (m) =>
        m.input?.code?.toLowerCase().includes(term) ||
        m.input?.name?.toLowerCase().includes(term) ||
        m.reason?.toLowerCase().includes(term)
    );
  }, [inputMovements, searchTerm]);

  const productsTable = useReactTable({
    data: filteredProductsData,
    columns: productColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const inputsTable = useReactTable({
    data: filteredInputsData,
    columns: inputColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const changeTab = (tab: TabType) => {
    setActiveTab(tab);
    setSearchTerm('');
  };

  const renderTable = <T,>(table: TanTable<T>, colCount: number, emptyText: string) => {
    const total = table.getFilteredRowModel().rows.length;
    const { pageIndex, pageSize } = table.getState().pagination;
    return (
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
                {hg.headers.map((header) => (
                  <Th key={header.id} align={RIGHT_COLS.has(header.column.id) ? 'right' : 'left'}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                ))}
              </tr>
            ))}
          </THead>
          <TBody>
            {loading ? (
              <TableMessage colSpan={colCount}>Cargando…</TableMessage>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableMessage colSpan={colCount}>{searchTerm ? 'Sin resultados para la búsqueda.' : emptyText}</TableMessage>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <Td key={cell.id} align={RIGHT_COLS.has(cell.column.id) ? 'right' : 'left'}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Td>
                  ))}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableCard>
    );
  };

  return (
    <Page>
      <PageHeader icon={ArrowDownUp} title="Movimientos de inventario" subtitle="Historial de entradas y salidas de productos e insumos" />

      <Tabs
        value={activeTab}
        onChange={changeTab}
        tabs={[
          { value: 'products', label: 'Productos (variantes)' },
          { value: 'inputs', label: 'Insumos (consumibles)' },
        ]}
      />

      {activeTab === 'products' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Package} label="Variantes" value={Number(stats.totalVariants).toLocaleString('es-CO')} />
          <StatCard icon={TrendingUp} tone="green" label="Stock total" value={Number(stats.totalStock).toLocaleString('es-CO')} />
          <StatCard icon={AlertTriangle} tone="yellow" label="Stock bajo" value={stats.lowStock} hint={stats.outOfStock > 0 ? `${stats.outOfStock} sin stock` : 'Ninguna agotada'} hintTone={stats.outOfStock > 0 ? 'red' : 'gray'} />
          <StatCard icon={ArrowDownUp} tone="blue" label="Movimientos hoy" value={stats.todayMovements} />
        </div>
      )}

      {activeTab === 'inputs' && inputStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Box} label="Insumos" value={inputStats.totalInputs} />
          <StatCard icon={TrendingUp} tone="green" label="Stock total" value={Number(inputStats.totalStock).toLocaleString('es-CO', { maximumFractionDigits: 2 })} />
          <StatCard icon={AlertTriangle} tone="yellow" label="Stock bajo" value={inputStats.lowStock} />
          <StatCard icon={ArrowDownUp} tone="blue" label="Movimientos hoy" value={inputStats.todayMovements} />
        </div>
      )}

      <FilterBar>
        <SearchInput
          className="sm:col-span-2"
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={activeTab === 'products' ? 'Buscar por SKU, producto o razón…' : 'Buscar por código, insumo o razón…'}
        />
        {activeTab === 'products' ? (
          <SelectInput aria-label="Tipo de movimiento" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as MovementType | '')}>
            <option value="">Todos los tipos</option>
            <option value="PURCHASE">Compra</option>
            <option value="SALE">Venta</option>
            <option value="ADJUSTMENT">Ajuste</option>
            <option value="TRANSFER_IN">Transferencia entrada</option>
            <option value="TRANSFER_OUT">Transferencia salida</option>
            <option value="RETURN">Devolución</option>
            <option value="DAMAGE">Daño / merma</option>
            <option value="INITIAL">Stock inicial</option>
          </SelectInput>
        ) : (
          <SelectInput aria-label="Tipo de movimiento" value={inputTypeFilter} onChange={(e) => setInputTypeFilter(e.target.value as InputMovementType | '')}>
            <option value="">Todos los tipos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SALIDA">Salida</option>
            <option value="AJUSTE">Ajuste</option>
            <option value="RESERVA">Reserva</option>
            <option value="LIBERACION">Liberación</option>
            <option value="CONSUMO">Consumo</option>
            <option value="DEVOLUCION">Devolución</option>
          </SelectInput>
        )}
      </FilterBar>

      {activeTab === 'products'
        ? renderTable(productsTable, productColumns.length, 'No hay movimientos de productos.')
        : renderTable(inputsTable, inputColumns.length, 'No hay movimientos de insumos.')}
    </Page>
  );
}
