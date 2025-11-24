import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { useCatalogs } from '../../../context/CatalogsContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/shared/Button';
import { Input } from '../../../components/shared/Input';
import { Modal } from '../../../components/shared/Modal';
import type { Color } from '../../../types/catalog';
import { Plus, Settings, Trash2, Check, X, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

const columnHelper = createColumnHelper<Color>();

export const ColorsPage = () => {
  const { colors, addColor, updateColor, deleteColor } = useCatalogs();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [formData, setFormData] = useState({
    name: '',
    hexCode: '#000000',
    active: true,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting()}
            className="flex items-center gap-1 hover:text-gray-900"
          >
            Nombre
            <ArrowUpDown className="w-4 h-4" />
          </button>
        ),
        cell: (info) => <span className="font-medium text-gray-900">{info.getValue()}</span>,
      }),
      columnHelper.accessor('hexCode', {
        header: 'Color',
        cell: (info) => (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg border-2 border-gray-300 shadow-sm"
              style={{ backgroundColor: info.getValue() }}
            />
            <span className="text-sm text-gray-600">{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('active', {
        header: 'Estado',
        cell: (info) => {
          const active = info.getValue();
          return active ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
              <Check className="w-3 h-3 mr-1" />
              Activo
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
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
              onClick={() => openEditModal(info.row.original)}
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
    data: colors,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const openAddModal = () => {
    setEditingColor(null);
    setFormData({ name: '', hexCode: '#000000', active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (color: Color) => {
    setEditingColor(color);
    setFormData({
      name: color.name,
      hexCode: color.hexCode,
      active: color.active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingColor) {
      updateColor(editingColor.id, formData);
      toast.success('Color actualizado correctamente');
    } else {
      addColor(formData);
      toast.success('Color creado correctamente');
    }
    setIsModalOpen(false);
    setFormData({ name: '', hexCode: '#000000', active: true });
  };

  const handleDelete = (id: string) => {
    deleteColor(id);
    toast.success('Color eliminado correctamente');
    setDeleteConfirmId(null);
    setIsModalOpen(false);
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Colores</h1>
          <p className="text-gray-600 mt-1 text-sm">Gestiona los colores disponibles</p>
        </div>
        <Button onClick={openAddModal} variant="admin-primary">
          <Plus className="w-5 h-5 mr-2" />
          Agregar Color
        </Button>
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
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
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
                  colors.length
                )}
              </span>{' '}
              de <span className="font-medium">{colors.length}</span> colores
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingColor ? 'Editar Color' : 'Agregar Color'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Azul Marino"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código de Color (Hex)
            </label>
            <div className="flex gap-3">
              <Input
                type="text"
                value={formData.hexCode}
                onChange={(e) => setFormData({ ...formData, hexCode: e.target.value })}
                placeholder="#000000"
                pattern="^#[0-9A-Fa-f]{6}$"
                required
              />
              <input
                type="color"
                value={formData.hexCode}
                onChange={(e) => setFormData({ ...formData, hexCode: e.target.value })}
                className="w-16 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Formato: #RRGGBB</p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="active" className="ml-2 text-sm font-medium text-gray-700">
              Activo
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            {editingColor && (
              <Button
                type="button"
                variant="admin-danger"
                onClick={() => setDeleteConfirmId(editingColor.id)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}
            <Button
              type="button"
              variant="admin-secondary"
              onClick={() => setIsModalOpen(false)}
              className={`w-full ${!editingColor ? 'sm:col-start-2' : ''}`}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="admin-primary" className="w-full">
              {editingColor ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmId(null)}
          title="Confirmar Eliminación"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              ¿Estás seguro de que deseas eliminar este color? Esta acción no se puede deshacer.
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
                onClick={() => handleDelete(deleteConfirmId)}
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
