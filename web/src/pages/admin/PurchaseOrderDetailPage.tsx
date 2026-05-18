import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Trash2,
  Send,
  CheckCircle,
  Package,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { PurchaseItemSelector, type PurchaseItem } from '../../components/admin/PurchaseItemSelector';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import * as purchaseOrdersService from '../../services/purchase-orders.service';
import * as suppliersService from '../../services/suppliers.service';
import type { PurchaseOrder, PurchaseOrderStatus } from '../../services/purchase-orders.service';
import type { Supplier } from '../../services/suppliers.service';

export default function PurchaseOrderDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { isSuperAdmin } = useAuth();
  const isCreating = id === 'new';

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [showItemSelectorModal, setShowItemSelectorModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form state for creating/editing orders
  const [formData, setFormData] = useState<{
    supplierId: number;
    expectedDate: string;
    notes: string;
    items: PurchaseItem[];
  }>({
    supplierId: 0,
    expectedDate: '',
    notes: '',
    items: [],
  });

  // Receive form
  const [receiveItems, setReceiveItems] = useState<{ itemId: number; quantityReceived: number }[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const suppliersData = await suppliersService.getSuppliers({ isActive: true });
      setSuppliers(suppliersData);

      if (isCreating) {
        setFormData({
          supplierId: suppliersData[0]?.id || 0,
          expectedDate: '',
          notes: '',
          items: [],
        });
      } else {
        const orderData = await purchaseOrdersService.getPurchaseOrderById(Number(id));
        setOrder(orderData);

        // Convert order items to form items
        const formItems: PurchaseItem[] = orderData.items.map(item => {
          // Determine the type and extract info
          let type: 'variant' | 'input' | 'input-variant' = 'variant';
          let productName = item.description || '';
          let variantInfo: string | undefined = undefined;
          let sku: string | undefined = undefined;

          if (item.variant) {
            type = 'variant';
            productName = item.variant.product.name;
            variantInfo = `${item.variant.color?.name || ''} / ${item.variant.size?.abbreviation || ''}`.trim();
            sku = item.variant.sku;
          } else if (item.inputVariant) {
            type = 'input-variant';
            productName = item.inputVariant.input?.name || item.description || '';
            variantInfo = `${item.inputVariant.color?.name || ''} / ${item.inputVariant.size?.abbreviation || ''}`.trim();
            sku = item.inputVariant.sku;
          } else if (item.input) {
            type = 'input';
            productName = item.input.name;
            sku = item.input.code;
          }

          return {
            type,
            variantId: item.variantId || undefined,
            inputId: item.inputId || undefined,
            inputVariantId: item.inputVariantId || undefined,
            productName,
            variantInfo: variantInfo || undefined,
            sku,
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
          };
        });

        setFormData({
          supplierId: orderData.supplierId,
          expectedDate: orderData.expectedDate ? orderData.expectedDate.split('T')[0] : '',
          notes: orderData.notes || '',
          items: formItems,
        });

        // Initialize receive items with pending quantities (auto-fill)
        setReceiveItems(
          orderData.items.map((item) => ({
            itemId: item.id,
            quantityReceived: Number(item.quantity) - Number(item.quantityReceived), // Pre-fill with pending
          }))
        );
      }
    } catch (error) {
      showToast('Error al cargar datos', 'error');
      navigate('/admin-panel/purchase-orders');
    } finally {
      setLoading(false);
    }
  };

  // Handle items selected from item selector
  const handleItemsSelected = (items: PurchaseItem[]) => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, ...items],
    }));
    setShowItemSelectorModal(false);
  };

  // Remove item from form
  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  // Update item quantity
  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], quantity: Math.max(1, quantity) };
    setFormData({ ...formData, items: newItems });
  };

  // Update item cost
  const updateItemCost = (index: number, unitCost: number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], unitCost };
    setFormData({ ...formData, items: newItems });
  };

  // Save order
  const handleSave = async () => {
    if (!formData.supplierId) {
      showToast('Selecciona un proveedor', 'error');
      return;
    }
    if (formData.items.length === 0) {
      showToast('Agrega al menos un item', 'error');
      return;
    }

    try {
      setSaving(true);
      const apiItems = formData.items.map(item => ({
        variantId: item.variantId,
        inputId: item.type === 'input' ? item.inputId : undefined,
        inputVariantId: item.inputVariantId,
        description: item.variantInfo ? `${item.productName} - ${item.variantInfo}` : item.productName,
        quantity: item.quantity,
        unitCost: item.unitCost,
      }));

      // Convert date to ISO-8601 DateTime format
      const expectedDateISO = formData.expectedDate
        ? new Date(formData.expectedDate + 'T00:00:00').toISOString()
        : undefined;

      if (isCreating) {
        await purchaseOrdersService.createPurchaseOrder({
          supplierId: formData.supplierId,
          expectedDate: expectedDateISO,
          notes: formData.notes || undefined,
          items: apiItems,
        });
        showToast('Orden de compra creada', 'success');
      } else {
        await purchaseOrdersService.updatePurchaseOrder(Number(id), {
          supplierId: formData.supplierId,
          expectedDate: expectedDateISO,
          notes: formData.notes || undefined,
          items: apiItems,
        });
        showToast('Orden de compra actualizada', 'success');
      }
      navigate('/admin-panel/purchase-orders');
    } catch (error: any) {
      showToast(error.message || 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Change status
  const handleStatusChange = async (newStatus: PurchaseOrderStatus) => {
    if (!order) return;
    try {
      setSaving(true);
      await purchaseOrdersService.updateStatus(order.id, newStatus);
      showToast('Estado actualizado', 'success');
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al cambiar estado', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Receive items
  const handleReceive = async () => {
    if (!order) return;

    const itemsToReceive = receiveItems.filter((item) => item.quantityReceived > 0);
    if (itemsToReceive.length === 0) {
      showToast('Ingresa las cantidades a recibir', 'error');
      return;
    }

    try {
      setSaving(true);
      await purchaseOrdersService.receiveItems(order.id, itemsToReceive);
      showToast('Items recibidos correctamente', 'success');
      setShowReceiveModal(false);
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al recibir', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete order
  const handleDelete = async () => {
    if (!order) return;

    try {
      setSaving(true);
      await purchaseOrdersService.deletePurchaseOrder(order.id);
      showToast('Orden eliminada', 'success');
      navigate('/admin-panel/purchase-orders');
    } catch (error: any) {
      showToast(error.message || 'Error al eliminar', 'error');
    } finally {
      setSaving(false);
      setShowDeleteModal(false);
    }
  };

  // Calculate form total
  const formTotal = formData.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  // Check if order can be edited
  const canEdit = isCreating || order?.status === 'DRAFT';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCreating ? 'Nueva Orden de Compra' : `Orden ${order?.orderNumber}`}
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            {isCreating
              ? 'Crea una nueva orden de compra para proveedores'
              : `Estado: ${order ? purchaseOrdersService.getStatusLabel(order.status) : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status Actions */}
          {order && order.status === 'DRAFT' && (
            <Button
              variant="admin-secondary"
              size="sm"
              onClick={() => handleStatusChange('SENT')}
              disabled={saving}
            >
              <Send className="w-4 h-4" />
              Enviar
            </Button>
          )}
          {order && order.status === 'SENT' && (
            <Button
              variant="admin-secondary"
              size="sm"
              onClick={() => handleStatusChange('CONFIRMED')}
              disabled={saving}
            >
              <CheckCircle className="w-4 h-4" />
              Confirmar
            </Button>
          )}
          {order && ['CONFIRMED', 'PARTIAL'].includes(order.status) && (
            <Button
              variant="admin-secondary"
              size="sm"
              onClick={() => {
                // Reset receive items with current pending quantities
                setReceiveItems(
                  order.items.map((item) => ({
                    itemId: item.id,
                    quantityReceived: Number(item.quantity) - Number(item.quantityReceived),
                  }))
                );
                setShowReceiveModal(true);
              }}
              disabled={saving}
            >
              <Package className="w-4 h-4" />
              Recibir
            </Button>
          )}
          <button
            onClick={() => navigate('/admin-panel/purchase-orders')}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Órdenes
          </button>
        </div>
      </div>

      {/* Order Info (for existing orders) */}
      {order && !isCreating && (() => {
        // Calculate reception statistics
        const totalQuantity = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
        const totalReceived = order.items.reduce((sum, item) => sum + Number(item.quantityReceived), 0);
        const totalPending = totalQuantity - totalReceived;
        const receptionPercentage = totalQuantity > 0 ? Math.round((totalReceived / totalQuantity) * 100) : 0;

        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Proveedor</p>
                <p className="font-medium">{order.supplier.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha</p>
                <p className="font-medium">{new Date(order.orderDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado</p>
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${purchaseOrdersService.getStatusColor(
                    order.status
                  )}`}
                >
                  {purchaseOrdersService.getStatusLabel(order.status)}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="font-bold text-lg">${Number(order.total).toLocaleString()}</p>
              </div>
            </div>

            {/* Reception Progress (only for orders that can receive items) */}
            {['CONFIRMED', 'PARTIAL', 'RECEIVED'].includes(order.status) && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progreso de Recepción</span>
                  <span className="text-sm text-gray-500">
                    {totalReceived} de {totalQuantity} unidades ({receptionPercentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      receptionPercentage === 100
                        ? 'bg-green-500'
                        : receptionPercentage > 0
                        ? 'bg-orange-500'
                        : 'bg-gray-300'
                    }`}
                    style={{ width: `${receptionPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Recibido: {totalReceived}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Pendiente: {totalPending}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          {/* Supplier and Date */}
          {canEdit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={!canEdit}
                >
                  <option value="">Seleccionar...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Esperada</label>
                <input
                  type="date"
                  value={formData.expectedDate}
                  onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  disabled={!canEdit}
                />
              </div>
            </div>
          )}

          {/* Items Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items de la orden</label>
              {canEdit && (
                <Button variant="admin-secondary" size="sm" onClick={() => setShowItemSelectorModal(true)}>
                  <Plus className="w-4 h-4" />
                  Agregar Items
                </Button>
              )}
            </div>

            {formData.items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Package className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 mb-2">No hay items agregados</p>
                {canEdit && (
                  <Button variant="admin-secondary" size="sm" onClick={() => setShowItemSelectorModal(true)}>
                    <Plus className="w-4 h-4" />
                    Agregar Productos o Insumos
                  </Button>
                )}
              </div>
            ) : (() => {
              // Group items by product/input for matrix view
              const groupedFormItems = formData.items.reduce((acc, item, index) => {
                const groupKey = item.productName;
                if (!acc[groupKey]) {
                  acc[groupKey] = { name: item.productName, items: [], unitCost: item.unitCost };
                }
                acc[groupKey].items.push({ item, index });
                return acc;
              }, {} as Record<string, { name: string; items: { item: PurchaseItem; index: number }[]; unitCost: number }>);

              const showReceptionColumns = !canEdit && order && ['CONFIRMED', 'PARTIAL', 'RECEIVED'].includes(order.status);

              return (
                <div className="space-y-4">
                  {Object.entries(groupedFormItems).map(([groupKey, group]) => {
                    // Check if group has multiple items with variants
                    const hasMultipleVariants = group.items.length > 1 && group.items.some(({ item }) => item.variantInfo);

                    if (hasMultipleVariants) {
                      // Matrix view for multiple variants
                      // Extract colors and sizes from variantInfo
                      const colors = new Map<string, { name: string; hexCode?: string }>();
                      const sizes = new Map<string, string>();

                      group.items.forEach(({ item }) => {
                        if (item.variantInfo) {
                          // Support both " / " and " - " separators
                          const parts = item.variantInfo.split(/ \/ | - /).map(p => p.trim());
                          if (parts[0]) colors.set(parts[0], { name: parts[0] });
                          if (parts[1]) sizes.set(parts[1], parts[1]);
                        }
                      });

                      const colorsArr = Array.from(colors.values());
                      const sizesArr = Array.from(sizes.keys());

                      const findItemByColorSize = (colorName: string, sizeName: string) => {
                        return group.items.find(({ item }) => {
                          if (!item.variantInfo) return false;
                          // Support both " / " and " - " separators
                          const parts = item.variantInfo.split(/ \/ | - /).map(p => p.trim());
                          return parts[0] === colorName && parts[1] === sizeName;
                        });
                      };

                      // Calculate group totals
                      const groupTotal = group.items.reduce((sum, { item }) => sum + (item.quantity * item.unitCost), 0);
                      const groupQty = group.items.reduce((sum, { item }) => sum + item.quantity, 0);
                      const groupReceived = group.items.reduce((sum, { index }) => {
                        const orderItem = order?.items?.[index];
                        return sum + (orderItem ? Number(orderItem.quantityReceived) : 0);
                      }, 0);
                      const groupPending = groupQty - groupReceived;
                      const isGroupComplete = showReceptionColumns && groupPending === 0;

                      return (
                        <div key={groupKey} className={`border rounded-lg overflow-hidden ${
                          isGroupComplete ? 'border-green-300' : 'border-gray-200'
                        }`}>
                          <div className={`px-4 py-3 flex items-center justify-between ${
                            isGroupComplete ? 'bg-green-50' : 'bg-gray-50'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-gray-900">{group.name}</span>
                              <span className="text-sm text-gray-500">
                                {groupQty} unidades · ${group.unitCost.toLocaleString()}/u
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              {showReceptionColumns && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                    Recibido: {groupReceived}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full ${
                                    groupPending > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    Pendiente: {groupPending}
                                  </span>
                                </div>
                              )}
                              <span className="font-bold text-gray-900">
                                ${groupTotal.toLocaleString()}
                              </span>
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    // Remove all items in this group
                                    const indicesToRemove = group.items.map(({ index }) => index).sort((a, b) => b - a);
                                    let newItems = [...formData.items];
                                    indicesToRemove.forEach(idx => {
                                      newItems = newItems.filter((_, i) => i !== idx);
                                    });
                                    setFormData({ ...formData, items: newItems });
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                  title="Eliminar grupo"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Legend for reception columns */}
                          {showReceptionColumns && (
                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-xs">
                              <span className="text-gray-500 font-medium">Leyenda:</span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></span>
                                Pedido
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
                                Recibido
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded bg-orange-100 border border-orange-300"></span>
                                Pendiente
                              </span>
                            </div>
                          )}
                          <div className="p-4 overflow-x-auto bg-white">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr>
                                  <th className="p-3 text-left text-xs font-semibold text-gray-700 bg-gray-100 sticky left-0 border-b-2 border-gray-200">
                                    Color / Talla
                                  </th>
                                  {sizesArr.map(size => (
                                    <th key={size} className="p-3 text-center text-xs font-semibold text-gray-700 bg-gray-100 min-w-[90px] border-b-2 border-gray-200">
                                      {size}
                                    </th>
                                  ))}
                                  <th className="p-3 text-center text-xs font-semibold text-gray-700 bg-gray-100 min-w-[70px] border-b-2 border-gray-200">
                                    Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {colorsArr.map((color, colorIdx) => {
                                  // Calculate row totals
                                  const rowTotal = sizesArr.reduce((sum, size) => {
                                    const found = findItemByColorSize(color.name, size);
                                    return sum + (found ? found.item.quantity : 0);
                                  }, 0);
                                  const rowReceived = sizesArr.reduce((sum, size) => {
                                    const found = findItemByColorSize(color.name, size);
                                    if (!found) return sum;
                                    const orderItem = order?.items?.[found.index];
                                    return sum + (orderItem ? Number(orderItem.quantityReceived) : 0);
                                  }, 0);

                                  return (
                                    <tr key={color.name} className={colorIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                      <td className="p-3 border-b border-gray-100 sticky left-0 bg-inherit font-medium">
                                        <span className="text-sm text-gray-800">{color.name}</span>
                                      </td>
                                      {sizesArr.map(size => {
                                        const found = findItemByColorSize(color.name, size);
                                        if (!found) {
                                          return (
                                            <td key={size} className="p-2 text-center border-b border-gray-100">
                                              <span className="text-gray-300">—</span>
                                            </td>
                                          );
                                        }

                                        const { item, index } = found;
                                        const orderItem = order?.items?.[index];
                                        const received = orderItem ? Number(orderItem.quantityReceived) : 0;
                                        const pending = item.quantity - received;
                                        const cellComplete = showReceptionColumns && pending === 0;

                                        return (
                                          <td key={size} className={`p-2 border-b border-gray-100 ${cellComplete ? 'bg-green-50' : ''}`}>
                                            {canEdit ? (
                                              <div className="flex justify-center">
                                                <input
                                                  type="number"
                                                  value={item.quantity}
                                                  onChange={(e) => updateItemQuantity(index, Number(e.target.value))}
                                                  className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm font-medium"
                                                  min="1"
                                                />
                                              </div>
                                            ) : showReceptionColumns ? (
                                              <div className="flex flex-col items-center gap-1">
                                                <div className="grid grid-cols-3 gap-1 text-xs w-full max-w-[90px]">
                                                  <div className="text-center px-1.5 py-1 rounded bg-blue-50 border border-blue-200">
                                                    <span className="font-semibold text-blue-700">{item.quantity}</span>
                                                  </div>
                                                  <div className={`text-center px-1.5 py-1 rounded ${
                                                    received > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                                                  }`}>
                                                    <span className={`font-semibold ${received > 0 ? 'text-green-700' : 'text-gray-400'}`}>{received}</span>
                                                  </div>
                                                  <div className={`text-center px-1.5 py-1 rounded ${
                                                    pending > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-gray-200'
                                                  }`}>
                                                    <span className={`font-semibold ${pending > 0 ? 'text-orange-700' : 'text-gray-400'}`}>{pending}</span>
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="text-center">
                                                <span className="font-semibold text-gray-800 text-base">{item.quantity}</span>
                                              </div>
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="p-2 border-b border-gray-100 bg-gray-50 text-center">
                                        <div className="font-bold text-gray-800">{rowTotal}</div>
                                        {showReceptionColumns && rowReceived > 0 && (
                                          <div className="text-xs text-green-600">({rowReceived} rec.)</div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-100">
                                  <td className="p-3 font-semibold text-gray-700 sticky left-0 bg-gray-100 border-t-2 border-gray-200">
                                    Total por talla
                                  </td>
                                  {sizesArr.map(size => {
                                    const colTotal = colorsArr.reduce((sum, color) => {
                                      const found = findItemByColorSize(color.name, size);
                                      return sum + (found ? found.item.quantity : 0);
                                    }, 0);
                                    return (
                                      <td key={size} className="p-3 text-center font-bold text-gray-800 border-t-2 border-gray-200">
                                        {colTotal}
                                      </td>
                                    );
                                  })}
                                  <td className="p-3 text-center font-bold text-gray-900 bg-gray-200 border-t-2 border-gray-200">
                                    {groupQty}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    }

                    // Simple row view for single items
                    return group.items.map(({ item, index }) => {
                      const orderItem = order?.items?.[index];
                      const received = orderItem ? Number(orderItem.quantityReceived) : 0;
                      const pending = item.quantity - received;
                      const isComplete = showReceptionColumns && pending === 0;

                      return (
                        <div key={index} className={`border rounded-lg p-4 ${
                          isComplete ? 'border-green-300 bg-green-50' : 'border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-1 h-12 rounded-full ${
                                showReceptionColumns
                                  ? pending === 0
                                    ? 'bg-green-500'
                                    : received > 0
                                    ? 'bg-orange-500'
                                    : 'bg-gray-300'
                                  : 'bg-gray-200'
                              }`} />
                              <div>
                                <p className="font-medium text-gray-900">{item.productName}</p>
                                {item.variantInfo && (
                                  <p className="text-xs text-gray-500">{item.variantInfo}</p>
                                )}
                                {item.sku && <p className="text-xs text-gray-400 font-mono">{item.sku}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-xs text-gray-500">Cantidad</p>
                                {canEdit ? (
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => updateItemQuantity(index, Number(e.target.value))}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                    min="1"
                                  />
                                ) : (
                                  <p className="font-medium">{item.quantity}</p>
                                )}
                              </div>
                              {showReceptionColumns && (
                                <>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500">Recibido</p>
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-medium ${
                                      received > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      {received}
                                    </span>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500">Pendiente</p>
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-medium ${
                                      pending > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                      {pending}
                                    </span>
                                  </div>
                                </>
                              )}
                              <div className="text-center">
                                <p className="text-xs text-gray-500">Costo Unit.</p>
                                {canEdit ? (
                                  <input
                                    type="number"
                                    value={item.unitCost}
                                    onChange={(e) => updateItemCost(index, Number(e.target.value))}
                                    className="w-24 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                    min="0"
                                  />
                                ) : (
                                  <p className="font-medium">${item.unitCost.toLocaleString()}</p>
                                )}
                              </div>
                              <div className="text-center min-w-[80px]">
                                <p className="text-xs text-gray-500">Subtotal</p>
                                <p className="font-bold">${(item.quantity * item.unitCost).toLocaleString()}</p>
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() => removeItem(index)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })}

                  {/* Total */}
                  <div className="bg-gray-50 rounded-lg p-4 flex justify-end">
                    <div className="text-right">
                      <span className="text-gray-600 mr-4">Total:</span>
                      <span className="text-xl font-bold text-gray-900">${formTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Notes */}
          {canEdit && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                placeholder="Notas adicionales para esta orden..."
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {/* Eliminar: solo el administrador y solo órdenes en borrador o canceladas. */}
            {isSuperAdmin && order && ['DRAFT', 'CANCELLED'].includes(order.status) && (
              <Button
                type="button"
                variant="admin-danger"
                onClick={() => setShowDeleteModal(true)}
                disabled={saving}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            )}
            {canEdit && (
              <Button
                variant="admin-primary"
                onClick={handleSave}
                disabled={saving || formData.items.length === 0}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isCreating ? 'Crear Orden' : 'Guardar'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Item Selector Modal */}
      <Modal
        isOpen={showItemSelectorModal}
        onClose={() => setShowItemSelectorModal(false)}
        title="Agregar Productos o Insumos"
        size="xl"
      >
        <PurchaseItemSelector
          onItemsSelected={handleItemsSelected}
          onClose={() => setShowItemSelectorModal(false)}
        />
      </Modal>

      {/* Receive Modal */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        title="Recibir Mercancía"
        size="xl"
      >
        {order && (() => {
          // Group items by product/input for matrix view
          const groupedItems = order.items.reduce((acc, item, index) => {
            let groupKey = '';
            let groupName = '';

            if (item.variant?.product) {
              groupKey = `product-${item.variant.product.id}`;
              groupName = item.variant.product.name;
            } else if (item.inputVariant?.input) {
              groupKey = `input-${item.inputVariant.input.id}`;
              groupName = item.inputVariant.input.name;
            } else if (item.input) {
              groupKey = `input-simple-${item.input.id}`;
              groupName = item.input.name;
            } else {
              groupKey = `item-${item.id}`;
              groupName = item.description || 'Item';
            }

            if (!acc[groupKey]) {
              acc[groupKey] = { name: groupName, items: [], hasVariants: false };
            }
            acc[groupKey].items.push({ item, index });

            // Check if this group has variants (multiple items or has color/size)
            if (item.variant || item.inputVariant) {
              acc[groupKey].hasVariants = true;
            }

            return acc;
          }, {} as Record<string, { name: string; items: { item: typeof order.items[0]; index: number }[]; hasVariants: boolean }>);

          // Calculate totals
          const totalPending = order.items.reduce((sum, item) =>
            sum + (Number(item.quantity) - Number(item.quantityReceived)), 0);
          const totalToReceive = receiveItems.reduce((sum, ri) => sum + ri.quantityReceived, 0);

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <span className="text-sm text-gray-600">
                  Las cantidades se pre-cargan con lo pendiente. Edita solo si no llegó completo.
                </span>
                <div className="text-sm font-medium">
                  <span className="text-orange-600">{totalToReceive}</span>
                  <span className="text-gray-400"> / {totalPending} pendientes</span>
                </div>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {Object.entries(groupedItems).map(([groupKey, group]) => {
                  // If only one item or no variants, show simple view
                  if (group.items.length === 1 || !group.hasVariants) {
                    return group.items.map(({ item, index }) => {
                      const pending = Number(item.quantity) - Number(item.quantityReceived);
                      const receiveQty = receiveItems[index]?.quantityReceived || 0;
                      const isComplete = receiveQty === pending;

                      return (
                        <div key={item.id} className={`flex items-center gap-4 p-3 rounded-lg border ${
                          isComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {item.variant?.product.name || item.inputVariant?.input?.name || item.input?.name || item.description}
                            </p>
                            {(item.variant || item.inputVariant) && (
                              <p className="text-xs text-gray-500">
                                {item.variant?.color?.name || item.inputVariant?.color?.name} / {item.variant?.size?.abbreviation || item.inputVariant?.size?.abbreviation}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              Pedido: {Number(item.quantity)} | Ya recibido: {Number(item.quantityReceived)} | Pendiente: <span className="font-medium text-orange-600">{pending}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const newItems = [...receiveItems];
                                newItems[index] = {
                                  itemId: item.id,
                                  quantityReceived: Math.max(0, receiveQty - 1),
                                };
                                setReceiveItems(newItems);
                              }}
                              className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-30"
                              disabled={receiveQty === 0}
                            >
                              <span className="text-lg font-bold text-gray-600">−</span>
                            </button>
                            <input
                              type="number"
                              value={receiveQty}
                              onChange={(e) => {
                                const newItems = [...receiveItems];
                                newItems[index] = {
                                  itemId: item.id,
                                  quantityReceived: Math.min(Math.max(0, Number(e.target.value)), pending),
                                };
                                setReceiveItems(newItems);
                              }}
                              className={`w-20 px-2 py-1.5 border rounded-lg text-center font-medium ${
                                isComplete ? 'border-green-300 bg-green-50' : 'border-gray-300'
                              }`}
                              min="0"
                              max={pending}
                            />
                            <button
                              onClick={() => {
                                const newItems = [...receiveItems];
                                newItems[index] = {
                                  itemId: item.id,
                                  quantityReceived: Math.min(pending, receiveQty + 1),
                                };
                                setReceiveItems(newItems);
                              }}
                              className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-30"
                              disabled={receiveQty >= pending}
                            >
                              <span className="text-lg font-bold text-gray-600">+</span>
                            </button>
                          </div>
                        </div>
                      );
                    });
                  }

                  // Matrix view for products/inputs with multiple variants
                  // Get unique colors and sizes
                  const colors = new Map<number, { id: number; name: string; hexCode?: string }>();
                  const sizes = new Map<number, { id: number; name: string; abbreviation?: string }>();

                  group.items.forEach(({ item }) => {
                    const color = item.variant?.color || item.inputVariant?.color;
                    const size = item.variant?.size || item.inputVariant?.size;
                    if (color) colors.set(color.id, color);
                    if (size) sizes.set(size.id, size);
                  });

                  const colorsArr = Array.from(colors.values());
                  const sizesArr = Array.from(sizes.values());

                  const findItemByColorSize = (colorId: number | null, sizeId: number | null) => {
                    return group.items.find(({ item }) => {
                      const itemColor = item.variant?.color || item.inputVariant?.color;
                      const itemSize = item.variant?.size || item.inputVariant?.size;
                      return (itemColor?.id || null) === colorId && (itemSize?.id || null) === sizeId;
                    });
                  };

                  // Calculate group totals
                  const groupPending = group.items.reduce((sum, { item }) =>
                    sum + (Number(item.quantity) - Number(item.quantityReceived)), 0);
                  const groupToReceive = group.items.reduce((sum, { index }) =>
                    sum + (receiveItems[index]?.quantityReceived || 0), 0);
                  const isGroupComplete = groupToReceive === groupPending;

                  return (
                    <div key={groupKey} className={`border rounded-lg overflow-hidden ${
                      isGroupComplete ? 'border-green-300 bg-green-50' : 'border-gray-200'
                    }`}>
                      <div className={`px-4 py-2 flex items-center justify-between ${
                        isGroupComplete ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <span className="font-medium text-gray-900">{group.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {groupToReceive} / {groupPending} unidades
                          </span>
                          {isGroupComplete && (
                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">Completo</span>
                          )}
                        </div>
                      </div>
                      <div className="p-4 overflow-x-auto bg-white">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr>
                              <th className="p-3 text-left text-xs font-semibold text-gray-700 bg-gray-100 border-b-2 border-gray-200">
                                Color / Talla
                              </th>
                              {sizesArr.map(size => (
                                <th key={size.id} className="p-3 text-center text-xs font-semibold text-gray-700 bg-gray-100 min-w-[100px] border-b-2 border-gray-200">
                                  {size.abbreviation || size.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {colorsArr.map((color, colorIdx) => (
                              <tr key={color.id} className={colorIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="p-3 border-b border-gray-100 font-medium">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0"
                                      style={{ backgroundColor: color.hexCode }}
                                    />
                                    <span className="text-sm text-gray-800">{color.name}</span>
                                  </div>
                                </td>
                                {sizesArr.map(size => {
                                  const found = findItemByColorSize(color.id, size.id);
                                  if (!found) {
                                    return (
                                      <td key={size.id} className="p-2 text-center border-b border-gray-100">
                                        <span className="text-gray-300">—</span>
                                      </td>
                                    );
                                  }

                                  const { item, index } = found;
                                  const pending = Number(item.quantity) - Number(item.quantityReceived);
                                  const receiveQty = receiveItems[index]?.quantityReceived || 0;
                                  const cellComplete = receiveQty === pending;

                                  return (
                                    <td key={size.id} className={`p-2 border-b border-gray-100 ${cellComplete ? 'bg-green-50' : ''}`}>
                                      <div className="flex flex-col items-center gap-1">
                                        <div className="text-[11px] text-gray-500">
                                          Pend: <span className={`font-semibold ${pending > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{pending}</span>
                                        </div>
                                        <input
                                          type="number"
                                          value={receiveQty}
                                          onChange={(e) => {
                                            const newItems = [...receiveItems];
                                            newItems[index] = {
                                              itemId: item.id,
                                              quantityReceived: Math.min(Math.max(0, Number(e.target.value)), pending),
                                            };
                                            setReceiveItems(newItems);
                                          }}
                                          className={`w-16 px-2 py-1.5 text-center border-2 rounded-lg text-sm font-semibold transition-colors ${
                                            cellComplete
                                              ? 'border-green-400 bg-green-100 text-green-700'
                                              : receiveQty > 0
                                                ? 'border-orange-400 bg-orange-50 text-orange-700'
                                                : 'border-gray-300 bg-white'
                                          }`}
                                          min="0"
                                          max={pending}
                                        />
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div className="flex gap-3 mt-6">
          <Button variant="admin-secondary" onClick={() => setShowReceiveModal(false)} className="flex-1">
            Cancelar
          </Button>
          <Button variant="admin-primary" onClick={handleReceive} disabled={saving} className="flex-1">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Package className="w-4 h-4 mr-2" />
            )}
            Confirmar Recepción
          </Button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Eliminar Orden">
        <div className="space-y-4">
          <p className="text-gray-600">
            ¿Estás seguro de eliminar la orden <strong>{order?.orderNumber}</strong>? Esta acción no se
            puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="admin-secondary" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="admin-danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
