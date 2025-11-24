import { useState } from 'react';
import { useProducts } from '../context/ProductsContext';
import { AdminLayout } from '../components/admin/AdminLayout';
import { ProductForm } from '../components/admin/ProductForm';
import { Modal } from '../components/shared/Modal';
import { Button } from '../components/shared/Button';
import type { Product } from '../types/product';
import { Pencil, Trash2, Plus, Package, TrendingUp, DollarSign, Star } from 'lucide-react';

type ViewMode = 'list' | 'add' | 'edit';

export const AdminPage = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAddProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    addProduct(productData);
    setViewMode('list');
  };

  const handleEditProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (selectedProduct) {
      updateProduct(selectedProduct.id, productData);
      setViewMode('list');
      setSelectedProduct(null);
    }
  };

  const handleDeleteProduct = (id: string) => {
    deleteProduct(id);
    setDeleteConfirmId(null);
  };

  const startEdit = (product: Product) => {
    setSelectedProduct(product);
    setViewMode('edit');
  };

  const cancelEdit = () => {
    setViewMode('list');
    setSelectedProduct(null);
  };

  // Calculate statistics
  const stats = {
    total: products.length,
    inStock: products.filter(p => p.stock > 0).length,
    lowStock: products.filter(p => p.stock > 0 && p.stock < 20).length,
    avgPrice: products.reduce((sum, p) => sum + p.basePrice, 0) / products.length || 0,
    featured: products.filter(p => p.featured).length,
  };

  if (viewMode === 'add') {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Agregar Nuevo Producto</h1>
                <Button variant="outline" onClick={cancelEdit}>
                  Cancelar
                </Button>
              </div>
              <ProductForm onSubmit={handleAddProduct} />
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (viewMode === 'edit' && selectedProduct) {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Editar Producto</h1>
                <Button variant="outline" onClick={cancelEdit}>
                  Cancelar
                </Button>
              </div>
              <ProductForm product={selectedProduct} onSubmit={handleEditProduct} />
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Productos</h1>
          <p className="text-gray-600 mt-1 text-sm">Administra tu catálogo de productos</p>
        </div>
        <Button onClick={() => setViewMode('add')} size="lg">
          <Plus className="w-5 h-5 mr-2" />
          Agregar Producto
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {/* Total Productos */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-50 rounded-lg">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 font-medium">Total Productos</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
        </div>

        {/* En Stock */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 font-medium">En Stock</p>
            <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1">{stats.inStock}</p>
            {stats.lowStock > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {stats.lowStock} stock bajo
              </p>
            )}
          </div>
        </div>

        {/* Precio Promedio */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 font-medium">Precio Promedio</p>
            <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
              ${stats.avgPrice.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Destacados */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Star className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-600 font-medium">Destacados</p>
            <p className="text-2xl md:text-3xl font-bold text-purple-600 mt-1">{stats.featured}</p>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <img
                        src={product.images.front}
                        alt={product.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {product.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    ${product.basePrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={product.stock === 0 ? 'text-red-600 font-medium' : product.stock < 20 ? 'text-amber-600 font-medium' : 'text-gray-900'}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {product.featured && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          Destacado
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {product.stock > 0 ? 'Disponible' : 'Agotado'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {products.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos</h3>
            <p className="text-gray-500 mb-4">Comienza agregando tu primer producto al catálogo</p>
            <Button onClick={() => setViewMode('add')}>
              <Plus className="w-5 h-5 mr-2" />
              Agregar Producto
            </Button>
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
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleDeleteProduct(deleteConfirmId)}
                className="bg-red-600 hover:bg-red-700"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </AdminLayout>
  );
};
