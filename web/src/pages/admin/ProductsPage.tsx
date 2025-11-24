import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useProducts } from '../../context/ProductsContext';
import { useToast } from '../../context/ToastContext';
import { ProductForm } from '../../components/admin/ProductForm';
import { Modal } from '../../components/shared/Modal';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import type { Product } from '../../types/product';
import { Settings, Trash2, Plus, Package, ArrowLeft, Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

type ViewMode = 'list' | 'add' | 'edit';

const columnHelper = createColumnHelper<Product>();

export const ProductsPage = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const toast = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Definir columnas
  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-gray-900"
          >
            Producto
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: (info) => (
          <div className="flex items-center">
            <img
              src={info.row.original.images.front}
              alt={info.getValue()}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900">{info.getValue()}</div>
              <div className="text-sm text-gray-500">{info.row.original.category}</div>
            </div>
          </div>
        ),
      }),
      columnHelper.accessor('type', {
        header: 'Tipo',
        cell: (info) => (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('basePrice', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-gray-900"
          >
            Precio
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: (info) => `$${info.getValue().toFixed(2)}`,
      }),
      columnHelper.accessor('stock', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-gray-900"
          >
            Stock
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: (info) => {
          const stock = info.getValue();
          return (
            <span className={stock === 0 ? 'text-red-600 font-medium' : stock < 20 ? 'text-amber-600 font-medium' : 'text-gray-900'}>
              {stock}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'status',
        header: 'Estado',
        cell: (info) => (
          <div className="flex flex-col gap-1">
            {info.row.original.featured && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                Destacado
              </span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              info.row.original.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {info.row.original.stock > 0 ? 'Disponible' : 'Agotado'}
            </span>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Acciones</div>,
        cell: (info) => (
          <div className="flex justify-end">
            <button
              onClick={() => startEdit(info.row.original)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Editar"
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
    data: products,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
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

  const handleAddProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    addProduct(productData);
    toast.success('Producto creado correctamente');
  };

  const handleEditProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedProduct) {
      updateProduct(selectedProduct.id, productData);
      toast.success('Producto actualizado correctamente');
    }
  };

  const handleDeleteProduct = (id: string) => {
    deleteProduct(id);
    toast.success('Producto eliminado correctamente');
    setDeleteConfirmId(null);
    setSelectedProduct(null);
    setViewMode('list');
  };

  const startEdit = (product: Product) => {
    setSelectedProduct(product);
    setViewMode('edit');
  };

  const cancelEdit = () => {
    setViewMode('list');
    setSelectedProduct(null);
  };

  if (viewMode === 'add') {
    return (
      <div className="p-4 md:p-8">
        {/* Header con botón volver */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Agregar Nuevo Producto</h1>
            <p className="text-gray-600 mt-1 text-sm">Completa la información del producto</p>
          </div>
          <button
            onClick={cancelEdit}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Volver a Productos</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
          <ProductForm onSubmit={handleAddProduct} />
        </div>
      </div>
    );
  }

  if (viewMode === 'edit' && selectedProduct) {
    return (
      <div className="p-4 md:p-8">
        {/* Header con botón volver */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Editar Producto</h1>
            <p className="text-gray-600 mt-1 text-sm">Actualiza la información del producto</p>
          </div>
          <button
            onClick={cancelEdit}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Volver a Productos</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
          <ProductForm
            product={selectedProduct}
            onSubmit={handleEditProduct}
            onDelete={() => setDeleteConfirmId(selectedProduct.id)}
          />
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <Modal
            isOpen={true}
            onClose={() => setDeleteConfirmId(null)}
            title="Confirmar Eliminación"
          >
            <div className="space-y-4">
              <p className="text-gray-600">
                ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="admin-secondary"
                  onClick={() => setDeleteConfirmId(null)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="admin-danger"
                  onClick={() => handleDeleteProduct(deleteConfirmId)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600 mt-1 text-sm">Gestiona tu catálogo de productos</p>
        </div>
        <Button onClick={() => setViewMode('add')} variant="admin-primary">
          <Plus className="w-5 h-5 mr-2" />
          Agregar Producto
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar productos..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products Table */}
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
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {globalFilter ? 'No se encontraron productos' : 'No hay productos'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {globalFilter
                        ? 'Intenta con otra búsqueda'
                        : 'Comienza agregando tu primer producto al catálogo'}
                    </p>
                    {!globalFilter && (
                      <Button onClick={() => setViewMode('add')} variant="admin-primary">
                        <Plus className="w-5 h-5 mr-2" />
                        Agregar Producto
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
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
              de <span className="font-medium">{table.getFilteredRowModel().rows.length}</span> productos
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmId(null)}
          title="Confirmar Eliminación"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="admin-secondary"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="admin-danger"
                onClick={() => handleDeleteProduct(deleteConfirmId)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
