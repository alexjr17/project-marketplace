import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, ExternalLink, Package, Truck } from 'lucide-react';
import { useOrders } from '../../context/OrdersContext';
import { useToast } from '../../context/ToastContext';
import { ORDER_STATUS_LABELS } from '../../types/order';
import {
  Page, PageHeader, Button, IconButton, StatCard, FilterBar, SearchInput, Tabs, Dialog, Field, TextInput,
  TableCard, Table, THead, TBody, Th, Tr, Td, Badge, EmptyState, useConfirm,
} from '../../components/ui';
import { ORDER_TONE, fmtDateTime } from './orderUi';

type TabKey = 'toShip' | 'shipped';

/** Despachos: pedidos pagados o en preparación por enviar, y envíos en tránsito por confirmar. */
export const ShippingPage = () => {
  const navigate = useNavigate();
  const { orders, updateOrderStatus, updateTrackingInfo } = useOrders();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<TabKey>('toShip');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState({ number: '', url: '' });
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  const ordersToShip = useMemo(() => orders.filter((o) => o.status === 'paid' || o.status === 'processing'), [orders]);
  const shippedOrders = useMemo(() => orders.filter((o) => o.status === 'shipped'), [orders]);
  const deliveredToday = orders.filter((o) => o.status === 'delivered' && o.deliveredAt && new Date(o.deliveredAt).toDateString() === new Date().toDateString()).length;

  const filteredOrdersToShip = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return ordersToShip;
    return ordersToShip.filter((o) =>
      o.orderNumber.toLowerCase().includes(query) || o.userName.toLowerCase().includes(query) || o.shipping.city.toLowerCase().includes(query));
  }, [ordersToShip, searchQuery]);

  const filteredShippedOrders = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return shippedOrders;
    return shippedOrders.filter((o) =>
      o.orderNumber.toLowerCase().includes(query) || o.userName.toLowerCase().includes(query) || o.trackingNumber?.toLowerCase().includes(query));
  }, [shippedOrders, searchQuery]);

  const handleOpenTrackingModal = (orderId: string) => {
    const order = orders.find((o) => String(o.id) === orderId);
    setSelectedOrderId(orderId);
    setTrackingData({ number: order?.trackingNumber || '', url: order?.trackingUrl || '' });
    setIsTrackingModalOpen(true);
  };

  const closeTracking = () => { setIsTrackingModalOpen(false); setSelectedOrderId(null); };

  const handleMarkAsShipped = () => {
    if (!selectedOrderId || !trackingData.number) {
      toast.error('Ingresa el número de guía');
      return;
    }
    updateTrackingInfo(selectedOrderId, trackingData.number, trackingData.url || undefined);
    updateOrderStatus(selectedOrderId, 'shipped');
    toast.success('Pedido marcado como enviado');
    setIsTrackingModalOpen(false);
    setSelectedOrderId(null);
    setTrackingData({ number: '', url: '' });
  };

  const handleMarkAsDelivered = async (orderId: string, orderNumber: string) => {
    if (!(await confirm({ title: `¿Marcar ${orderNumber} como entregado?`, message: 'El pedido pasará a estado final y ya no admite cambios.', confirmText: 'Marcar entregado' }))) return;
    updateOrderStatus(orderId, 'delivered');
    toast.success('Pedido marcado como entregado');
  };

  const selected = orders.find((o) => String(o.id) === selectedOrderId);
  const view = (id: number) => navigate(`/admin-panel/orders/${id}`);

  return (
    <Page>
      <PageHeader icon={Truck} title="Despachos" subtitle="Envía los pedidos pagados y confirma las entregas" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} tone={ordersToShip.length > 0 ? 'yellow' : 'green'} label="Por despachar" value={ordersToShip.length} hint="Pagados o en preparación" />
        <StatCard icon={Truck} tone="blue" label="En tránsito" value={shippedOrders.length} />
        <StatCard icon={CheckCircle} tone="green" label="Entregados hoy" value={deliveredToday} />
      </div>

      <FilterBar>
        <div className="sm:col-span-2"><SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por pedido, cliente, ciudad o guía…" /></div>
      </FilterBar>

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'toShip', label: 'Por despachar', count: filteredOrdersToShip.length },
          { value: 'shipped', label: 'En tránsito', count: filteredShippedOrders.length },
        ]}
      />

      {tab === 'toShip' && (filteredOrdersToShip.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={CheckCircle} title={searchQuery ? 'Ningún pedido coincide con la búsqueda' : '¡Todo al día!'} description={searchQuery ? undefined : 'No hay pedidos pendientes de despacho.'} />
        </div>
      ) : (
        <TableCard>
          <Table>
            <THead><tr><Th>Pedido</Th><Th>Cliente</Th><Th>Dirección</Th><Th align="right">Unidades</Th><Th align="right">Acciones</Th></tr></THead>
            <TBody>
              {filteredOrdersToShip.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <button type="button" onClick={() => view(o.id)} className="font-medium text-gray-900 hover:text-app-700 text-left whitespace-nowrap">{o.orderNumber}</button>
                    <span className="block mt-0.5"><Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge></span>
                  </Td>
                  <Td>
                    <span className="text-gray-900">{o.userName}</span>
                    <span className="block text-xs text-gray-500">{o.shipping.phone}</span>
                  </Td>
                  <Td className="min-w-[14rem]">
                    <span className="text-gray-900">{o.shipping.address}</span>
                    <span className="block text-xs text-gray-500">{[o.shipping.city, o.shipping.postalCode].filter(Boolean).join(', ')}</span>
                    {o.shipping.notes && <span className="block text-xs text-amber-700 mt-0.5">Nota: {o.shipping.notes}</span>}
                  </Td>
                  <Td align="right">{o.items.reduce((acc, item) => acc + item.quantity, 0)}</Td>
                  <Td align="right" className="whitespace-nowrap">
                    <IconButton title="Ver pedido" tone="app" onClick={() => view(o.id)}><ChevronRight className="w-4 h-4" /></IconButton>
                    <Button size="sm" icon={<Truck className="w-4 h-4" />} onClick={() => handleOpenTrackingModal(String(o.id))}>Despachar</Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableCard>
      ))}

      {tab === 'shipped' && (filteredShippedOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={Truck} title={searchQuery ? 'Ningún envío coincide con la búsqueda' : 'Sin envíos en tránsito'} description={searchQuery ? undefined : 'Los pedidos enviados aparecerán aquí.'} />
        </div>
      ) : (
        <TableCard>
          <Table>
            <THead><tr><Th>Pedido</Th><Th>Cliente</Th><Th>Guía</Th><Th>Enviado</Th><Th align="right">Acciones</Th></tr></THead>
            <TBody>
              {filteredShippedOrders.map((o) => (
                <Tr key={o.id}>
                  <Td><button type="button" onClick={() => view(o.id)} className="font-medium text-gray-900 hover:text-app-700 text-left whitespace-nowrap">{o.orderNumber}</button></Td>
                  <Td>
                    <span className="text-gray-900">{o.userName}</span>
                    <span className="block text-xs text-gray-500">{o.shipping.city}</span>
                  </Td>
                  <Td>
                    {o.trackingNumber ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono">{o.trackingNumber}</span>
                        {o.trackingUrl && <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer" title="Rastrear envío" className="text-app-700"><ExternalLink className="w-4 h-4" /></a>}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(o.shippedAt)}</Td>
                  <Td align="right" className="whitespace-nowrap">
                    <IconButton title="Ver pedido" tone="app" onClick={() => view(o.id)}><ChevronRight className="w-4 h-4" /></IconButton>
                    <Button size="sm" variant="success" icon={<CheckCircle className="w-4 h-4" />} onClick={() => handleMarkAsDelivered(String(o.id), o.orderNumber)}>Entregado</Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableCard>
      ))}

      <Dialog
        open={isTrackingModalOpen}
        onClose={closeTracking}
        title="Despachar pedido"
        description={selected ? `${selected.orderNumber} · ${selected.userName}` : 'Ingresa la información de envío.'}
        footer={
          <>
            <Button variant="secondary" onClick={closeTracking}>Cancelar</Button>
            <Button icon={<Truck className="w-4 h-4" />} onClick={handleMarkAsShipped}>Marcar como enviado</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Número de guía" required>
            <TextInput autoFocus value={trackingData.number} onChange={(e) => setTrackingData({ ...trackingData, number: e.target.value })} placeholder="Ej: COL123456789" />
          </Field>
          <Field label="URL de seguimiento" hint="Opcional. El cliente la verá en su pedido.">
            <TextInput type="url" value={trackingData.url} onChange={(e) => setTrackingData({ ...trackingData, url: e.target.value })} placeholder="https://tracking.example.com/..." />
          </Field>
        </div>
      </Dialog>
    </Page>
  );
};
