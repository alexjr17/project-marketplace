import { useState, useEffect } from 'react';
import { errorMessage } from '../../lib/http';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Trash2, Send, CheckCircle, Package, ClipboardList } from 'lucide-react';
import {
  Page, PageHeader, Button, Card, CardTitle, DescriptionList, Field, SelectInput, DateInput, TextArea,
  FormActions, Dialog, Spinner, useConfirm, toast,
} from '../../components/ui';
import { PurchaseItemSelector, type PurchaseItem } from '../../components/admin/PurchaseItemSelector';
import { useAuth } from '../../context/AuthContext';
import * as purchaseOrdersService from '../../services/purchase-orders.service';
import * as suppliersService from '../../services/suppliers.service';
import type { PurchaseOrder, PurchaseOrderStatus } from '../../services/purchase-orders.service';
import type { Supplier } from '../../services/suppliers.service';
import { PurchaseOrderStatusBadge, money } from './PurchaseOrderStatus';
import { PurchaseOrderItems } from './PurchaseOrderItems';
import { PurchaseOrderReceiveDialog, type ReceiveLine } from './PurchaseOrderReceiveDialog';

const LIST = '/admin-panel/purchase-orders';
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('es-CO') : null);

export default function PurchaseOrderDetailPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin } = useAuth();
  const isCreating = id === 'new';

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showItemSelectorModal, setShowItemSelectorModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Formulario de creación / edición
  const [formData, setFormData] = useState<{
    supplierId: number;
    expectedDate: string;
    notes: string;
    items: PurchaseItem[];
  }>({ supplierId: 0, expectedDate: '', notes: '', items: [] });

  // Recepción
  const [receiveItems, setReceiveItems] = useState<ReceiveLine[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const suppliersData = await suppliersService.getSuppliers({ isActive: true });
      setSuppliers(suppliersData);

      if (isCreating) {
        setFormData({ supplierId: suppliersData[0]?.id || 0, expectedDate: '', notes: '', items: [] });
      } else {
        const orderData = await purchaseOrdersService.getPurchaseOrderById(Number(id));
        setOrder(orderData);

        // Ítems de la orden → ítems del formulario
        const formItems: PurchaseItem[] = orderData.items.map((item) => {
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

        // Recepción pre-cargada con lo pendiente
        setReceiveItems(orderData.items.map((item) => ({
          itemId: item.id,
          quantityReceived: Number(item.quantity) - Number(item.quantityReceived),
        })));
      }
    } catch {
      toast.error('Error al cargar datos');
      navigate(LIST);
    } finally {
      setLoading(false);
    }
  };

  const handleItemsSelected = (items: PurchaseItem[]) => {
    setFormData((prev) => ({ ...prev, items: [...prev.items, ...items] }));
    setShowItemSelectorModal(false);
  };

  const removeItem = (index: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const removeGroup = (indices: number[]) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => !indices.includes(i)) });
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], quantity: Math.max(1, quantity) };
    setFormData({ ...formData, items: newItems });
  };

  const updateItemCost = (index: number, unitCost: number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], unitCost };
    setFormData({ ...formData, items: newItems });
  };

  const handleSave = async () => {
    if (!formData.supplierId) {
      toast.error('Selecciona un proveedor');
      return;
    }
    if (formData.items.length === 0) {
      toast.error('Agrega al menos un ítem');
      return;
    }

    try {
      setSaving(true);
      const apiItems = formData.items.map((item) => ({
        variantId: item.variantId,
        inputId: item.type === 'input' ? item.inputId : undefined,
        inputVariantId: item.inputVariantId,
        description: item.variantInfo ? `${item.productName} - ${item.variantInfo}` : item.productName,
        quantity: item.quantity,
        unitCost: item.unitCost,
      }));

      // Fecha a ISO-8601
      const expectedDateISO = formData.expectedDate
        ? new Date(formData.expectedDate + 'T00:00:00').toISOString()
        : undefined;

      const payload = {
        supplierId: formData.supplierId,
        expectedDate: expectedDateISO,
        notes: formData.notes || undefined,
        items: apiItems,
      };

      if (isCreating) {
        await purchaseOrdersService.createPurchaseOrder(payload);
        toast.success('Orden de compra creada');
      } else {
        await purchaseOrdersService.updatePurchaseOrder(Number(id), payload);
        toast.success('Orden de compra actualizada');
      }
      navigate(LIST);
    } catch (error) {
      toast.error(errorMessage(error, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: PurchaseOrderStatus) => {
    if (!order) return;
    try {
      setSaving(true);
      await purchaseOrdersService.updateStatus(order.id, newStatus);
      toast.success('Estado actualizado');
      loadData();
    } catch (error) {
      toast.error(errorMessage(error, 'Error al cambiar estado'));
    } finally {
      setSaving(false);
    }
  };

  const openReceive = () => {
    if (!order) return;
    setReceiveItems(order.items.map((item) => ({
      itemId: item.id,
      quantityReceived: Number(item.quantity) - Number(item.quantityReceived),
    })));
    setShowReceiveModal(true);
  };

  const handleReceive = async () => {
    if (!order) return;
    const itemsToReceive = receiveItems.filter((item) => item.quantityReceived > 0);
    if (itemsToReceive.length === 0) {
      toast.error('Ingresa las cantidades a recibir');
      return;
    }
    try {
      setSaving(true);
      await purchaseOrdersService.receiveItems(order.id, itemsToReceive);
      toast.success('Ítems recibidos correctamente');
      setShowReceiveModal(false);
      loadData();
    } catch (error) {
      toast.error(errorMessage(error, 'Error al recibir'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    const ok = await confirm({
      title: `¿Eliminar la orden ${order.orderNumber}?`,
      message: 'Esta acción no se puede deshacer.',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      setSaving(true);
      await purchaseOrdersService.deletePurchaseOrder(order.id);
      toast.success('Orden eliminada');
      navigate(LIST);
    } catch (error) {
      toast.error(errorMessage(error, 'Error al eliminar'));
    } finally {
      setSaving(false);
    }
  };

  const canEdit = isCreating || order?.status === 'DRAFT';
  // Eliminar: solo el administrador y solo órdenes en borrador o canceladas.
  const canDelete = isSuperAdmin && !!order && ['DRAFT', 'CANCELLED'].includes(order.status);
  const showReception = !canEdit && !!order && ['CONFIRMED', 'PARTIAL', 'RECEIVED'].includes(order.status);

  if (loading) {
    return <Page><Spinner label="Cargando orden…" /></Page>;
  }

  // Progreso de recepción
  const totalQuantity = order ? order.items.reduce((sum, item) => sum + Number(item.quantity), 0) : 0;
  const totalReceived = order ? order.items.reduce((sum, item) => sum + Number(item.quantityReceived), 0) : 0;
  const totalPending = totalQuantity - totalReceived;
  const receptionPercentage = totalQuantity > 0 ? Math.round((totalReceived / totalQuantity) * 100) : 0;

  const supplier = order?.supplier;

  const headerActions = (
    <>
      {canDelete && (
        <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete} disabled={saving}>
          Eliminar
        </Button>
      )}
      {order?.status === 'DRAFT' && (
        <Button variant="outline" icon={<Send className="w-4 h-4" />} onClick={() => handleStatusChange('SENT')} disabled={saving}>
          Enviar al proveedor
        </Button>
      )}
      {order?.status === 'SENT' && (
        <Button icon={<CheckCircle className="w-4 h-4" />} onClick={() => handleStatusChange('CONFIRMED')} disabled={saving}>
          Confirmar
        </Button>
      )}
      {order && ['CONFIRMED', 'PARTIAL'].includes(order.status) && (
        <Button icon={<Package className="w-4 h-4" />} onClick={openReceive} disabled={saving}>
          Recibir mercancía
        </Button>
      )}
    </>
  );

  return (
    <Page>
      <PageHeader
        icon={ClipboardList}
        backTo={LIST}
        title={
          isCreating ? 'Nueva orden de compra' : (
            <span className="flex items-center gap-3">
              Orden {order?.orderNumber}
              {order && <PurchaseOrderStatusBadge status={order.status} />}
            </span>
          )
        }
        subtitle={
          isCreating
            ? 'Elige el proveedor y agrega los productos o insumos a comprar'
            : `${supplier?.name ?? ''} · ${fmtDate(order?.orderDate) ?? ''}`
        }
        actions={isCreating ? undefined : headerActions}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Ítems */}
        <div className="lg:col-span-2 min-w-0">
          <PurchaseOrderItems
            items={formData.items}
            order={order}
            canEdit={canEdit}
            showReception={showReception}
            onAdd={() => setShowItemSelectorModal(true)}
            onQuantity={updateItemQuantity}
            onCost={updateItemCost}
            onRemove={removeItem}
            onRemoveGroup={removeGroup}
          />
        </div>

        {/* Lateral: datos de la orden y recepción */}
        <div className={`space-y-5 ${canEdit ? "order-first lg:order-none" : ""}`}>
          {canEdit ? (
            <Card>
              <CardTitle>Datos de la orden</CardTitle>
              <div className="space-y-4">
                <Field label="Proveedor" required>
                  <SelectInput value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: Number(e.target.value) })}>
                    <option value="">Seleccionar…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Fecha esperada" hint="Cuándo esperas recibir la mercancía.">
                  <DateInput value={formData.expectedDate} onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })} />
                </Field>
                <Field label="Notas">
                  <TextArea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Notas para esta orden…" />
                </Field>
              </div>
            </Card>
          ) : order && (
            <Card>
              <CardTitle>Datos de la orden</CardTitle>
              <DescriptionList
                cols={1}
                items={[
                  { label: 'Proveedor', value: supplier ? <>{supplier.name} <span className="text-gray-400">({supplier.code})</span></> : null },
                  { label: 'Estado', value: <PurchaseOrderStatusBadge status={order.status} /> },
                  { label: 'Fecha de la orden', value: fmtDate(order.orderDate) },
                  { label: 'Fecha esperada', value: fmtDate(order.expectedDate) },
                  { label: 'Total', value: <span className="text-lg font-bold">{money(order.total)}</span> },
                  { label: 'Notas', value: order.notes || null },
                ]}
              />
            </Card>
          )}

          {showReception && order && (
            <Card>
              <CardTitle>Recepción</CardTitle>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-bold text-gray-900 tabular-nums">{receptionPercentage}%</span>
                <span className="text-sm text-gray-500 tabular-nums">{totalReceived} de {totalQuantity} unidades</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${receptionPercentage === 100 ? 'bg-green-500' : receptionPercentage > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}
                  style={{ width: `${receptionPercentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-3 text-sm">
                <span className="flex items-center gap-1.5 text-gray-600"><span className="w-2 h-2 rounded-full bg-green-500" />Recibido {totalReceived}</span>
                <span className="flex items-center gap-1.5 text-gray-600"><span className="w-2 h-2 rounded-full bg-amber-500" />Pendiente {totalPending}</span>
              </div>
            </Card>
          )}
        </div>
      </div>

      {canEdit && (
        <FormActions sticky>
          <Button variant="secondary" onClick={() => navigate(LIST)}>Cancelar</Button>
          <Button icon={<Save className="w-4 h-4" />} isLoading={saving} disabled={formData.items.length === 0} onClick={handleSave}>
            {isCreating ? 'Crear orden' : 'Guardar cambios'}
          </Button>
        </FormActions>
      )}

      {/* Selector de ítems */}
      <Dialog open={showItemSelectorModal} onClose={() => setShowItemSelectorModal(false)} title="Agregar productos o insumos" size="xl">
        <PurchaseItemSelector onItemsSelected={handleItemsSelected} onClose={() => setShowItemSelectorModal(false)} />
      </Dialog>

      {order && (
        <PurchaseOrderReceiveDialog
          open={showReceiveModal}
          onClose={() => setShowReceiveModal(false)}
          order={order}
          lines={receiveItems}
          onChange={setReceiveItems}
          onConfirm={handleReceive}
          saving={saving}
        />
      )}
    </Page>
  );
}
