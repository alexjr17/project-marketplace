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
import {
  ArrowRightLeft,
  Plus,
  Eye,
  Boxes,
  Package,
  FileEdit,
  Clock,
  CheckCircle,
  DollarSign,
  Wrench,
  Shirt,
  ArrowLeft,
} from 'lucide-react';
import {
  Page, PageHeader, Button, IconButton, StatCard, Badge, FilterBar, SearchInput, SelectInput, Field,
  TextInput, TextArea, DateInput, TableCard, Table, THead, TBody, Th, Tr, Td, TableMessage, Pager, Dialog,
  Spinner, EmptyState, toast,
} from '../../components/ui';
import {
  inventoryConversionsService,
  type InventoryConversion,
  type ConversionStatus,
  type ConversionStats,
} from '../../services/inventory-conversions.service';
import { CONVERSION_STATUS, formatCOP } from './InventoryConversionShared';
import { errorMessage } from '../../lib/http';

type CreateType = 'manual' | 'template';

/** Columnas con su alineación (el Th/Td del kit la recibe por `meta`). */
type Align = 'left' | 'center' | 'right';

export default function InventoryConversionsPage() {
  const navigate = useNavigate();
  const [conversions, setConversions] = useState<InventoryConversion[]>([]);
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversionStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [conversionsData, statsData] = await Promise.all([
        inventoryConversionsService.listConversions({
          status: statusFilter || undefined,
        }),
        inventoryConversionsService.getStats(),
      ]);
      setConversions(conversionsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // Ventana de creación: primero el tipo, luego fecha / descripción / notas.
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<CreateType | null>(null);
  const [formData, setFormData] = useState({
    conversionDate: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    setShowCreateModal(true);
    setSelectedType(null);
    setFormData({
      conversionDate: new Date().toISOString().split('T')[0],
      description: '',
      notes: '',
    });
  };

  const handleCreateConversion = async () => {
    try {
      setCreating(true);
      if (selectedType === 'manual') {
        const newConversion = await inventoryConversionsService.createConversion(formData);
        toast.success('Conversión creada');
        setShowCreateModal(false);
        navigate(`/admin-panel/inventory-conversions/${newConversion.id}`);
      } else {
        // Para plantilla, navegar a la pantalla de selección
        setShowCreateModal(false);
        navigate('/admin-panel/inventory-conversions/new-from-template', {
          state: { formData },
        });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Error al crear conversión'));
    } finally {
      setCreating(false);
    }
  };

  const handleView = (conversion: InventoryConversion) => {
    navigate(`/admin-panel/inventory-conversions/${conversion.id}`);
  };

  const columns = useMemo<ColumnDef<InventoryConversion>[]>(
    () => [
      {
        accessorKey: 'conversionNumber',
        header: 'Conversión',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-mono font-medium text-gray-900">{row.original.conversionNumber}</p>
            {row.original.description && (
              <p className="text-xs text-gray-500 truncate max-w-[16rem]">{row.original.description}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'conversionDate',
        header: 'Fecha',
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{new Date(row.original.conversionDate).toLocaleDateString('es-CO')}</span>
        ),
      },
      {
        id: 'type',
        header: 'Tipo',
        cell: ({ row }) =>
          row.original.conversionType === 'TEMPLATE'
            ? <Badge tone="blue"><Shirt className="w-3 h-3" />Plantilla</Badge>
            : <Badge tone="gray"><Wrench className="w-3 h-3" />Manual</Badge>,
      },
      {
        id: 'items',
        header: 'Insumos → Productos',
        meta: { align: 'center' },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="inline-flex items-center gap-1" title="Insumos consumidos">
              <Boxes className="w-3.5 h-3.5 text-gray-400" />{row.original.inputItems.length}
            </span>
            <span className="text-gray-300">→</span>
            <span className="inline-flex items-center gap-1" title="Productos generados">
              <Package className="w-3.5 h-3.5 text-gray-400" />{row.original.outputItems.length}
            </span>
          </span>
        ),
      },
      {
        id: 'costs',
        header: 'Costo insumos',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 whitespace-nowrap">{formatCOP(row.original.totalInputCost)}</span>
        ),
      },
      {
        accessorKey: 'createdByName',
        header: 'Creado por',
        cell: ({ row }) => <span className="text-gray-600">{row.original.createdByName || '—'}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        meta: { align: 'center' },
        cell: ({ row }) => {
          const s = CONVERSION_STATUS[row.original.status];
          return <Badge tone={s.tone}>{s.label}</Badge>;
        },
      },
      {
        id: 'actions',
        header: 'Acciones',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <IconButton
            title="Ver detalle"
            tone="app"
            onClick={(e) => {
              e.stopPropagation();
              handleView(row.original);
            }}
          >
            <Eye className="w-4 h-4" />
          </IconButton>
        ),
      },
    ],
    []
  );

  const filteredData = useMemo(() => {
    if (!searchTerm) return conversions;
    const term = searchTerm.toLowerCase();
    return conversions.filter(
      (c) =>
        c.conversionNumber.toLowerCase().includes(term) ||
        (c.createdByName && c.createdByName.toLowerCase().includes(term)) ||
        (c.description && c.description.toLowerCase().includes(term))
    );
  }, [conversions, searchTerm]);

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

  const alignOf = (meta: unknown): Align => ((meta as { align?: Align } | undefined)?.align ?? 'left');
  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const hasFilters = !!searchTerm || !!statusFilter;

  return (
    <Page>
      <PageHeader
        icon={ArrowRightLeft}
        title="Conversiones"
        subtitle="Convierte insumos o plantillas en productos terminados"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nueva conversión</Button>}
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={FileEdit} tone="gray" label="Borradores" value={stats.byStatus.DRAFT} hint={`${stats.total} en total`} />
          <StatCard icon={Clock} tone="yellow" label="Pendientes de aprobar" value={stats.byStatus.PENDING} />
          <StatCard icon={CheckCircle} tone="green" label="Aprobadas" value={stats.byStatus.APPROVED} />
          <StatCard icon={DollarSign} label="Costo de insumos" value={formatCOP(stats.totalInputCost)} />
        </div>
      )}

      <FilterBar>
        <SearchInput
          className="sm:col-span-2"
          value={searchTerm}
          onChange={(v) => { setSearchTerm(v); table.setPageIndex(0); }}
          placeholder="Buscar por número, usuario o descripción…"
        />
        <SelectInput
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ConversionStatus | '')}
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(CONVERSION_STATUS) as ConversionStatus[]).map((s) => (
            <option key={s} value={s}>{CONVERSION_STATUS[s].label}</option>
          ))}
        </SelectInput>
      </FilterBar>

      <TableCard
        footer={totalRows > 0 ? (
          <Pager
            page={pageIndex + 1}
            pageSize={pageSize}
            total={totalRows}
            onPage={(p) => table.setPageIndex(p - 1)}
            onPageSize={(s) => table.setPageSize(s)}
          />
        ) : undefined}
      >
        {!loading && totalRows === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title={hasFilters ? 'Sin resultados' : 'Aún no hay conversiones'}
            description={hasFilters ? 'Prueba con otro término o estado.' : 'Crea una conversión para transformar insumos en productos.'}
            action={!hasFilters ? <Button icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Nueva conversión</Button> : undefined}
          />
        ) : (
          <Table>
            <THead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Th key={header.id} align={alignOf(header.column.columnDef.meta)}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </Th>
                  ))}
                </tr>
              ))}
            </THead>
            <TBody>
              {loading ? (
                <TableMessage colSpan={columns.length}><Spinner className="py-2" label="Cargando…" /></TableMessage>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <Tr key={row.id} onClick={() => handleView(row.original)}>
                    {row.getVisibleCells().map((cell) => (
                      <Td key={cell.id} align={alignOf(cell.column.columnDef.meta)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Td>
                    ))}
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        )}
      </TableCard>

      {/* Nueva conversión: 1) tipo, 2) datos generales */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nueva conversión"
        description={!selectedType ? 'Elige cómo quieres crearla' : selectedType === 'manual' ? 'Conversión manual' : 'Conversión desde plantilla'}
        footer={
          !selectedType ? (
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
          ) : (
            <>
              <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => setSelectedType(null)} disabled={creating}>
                Atrás
              </Button>
              <Button onClick={handleCreateConversion} isLoading={creating}>
                {selectedType === 'manual' ? 'Crear conversión' : 'Continuar'}
              </Button>
            </>
          )
        }
      >
        {!selectedType ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { type: 'manual' as const, icon: Wrench, title: 'Manual', text: 'Eliges los insumos a consumir y los productos a generar.' },
              { type: 'template' as const, icon: Shirt, title: 'Desde plantilla', text: 'Usa la receta de una plantilla para producir por color y talla.' },
            ]).map((o) => (
              <button
                key={o.type}
                type="button"
                onClick={() => setSelectedType(o.type)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-app-400 hover:bg-app-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-app-500"
              >
                <span className="rounded-lg bg-app-50 p-2.5 text-app-600 group-hover:bg-white"><o.icon className="w-5 h-5" /></span>
                <span className="font-semibold text-gray-900">{o.title}</span>
                <span className="text-sm text-gray-500">{o.text}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Fecha de conversión" required>
              <DateInput
                value={formData.conversionDate}
                onChange={(e) => setFormData({ ...formData, conversionDate: e.target.value })}
              />
            </Field>
            <Field label="Descripción" hint={selectedType === 'template' ? 'Si la dejas vacía se usa el nombre de la plantilla.' : undefined}>
              <TextInput
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Motivo de la conversión"
              />
            </Field>
            <Field label="Notas">
              <TextArea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales"
                rows={3}
              />
            </Field>
          </div>
        )}
      </Dialog>
    </Page>
  );
}
