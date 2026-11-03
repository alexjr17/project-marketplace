import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Copy, CreditCard, Download, ExternalLink, FileText, Image, MapPin,
  Package, Printer, RefreshCw, Truck, Upload, User,
} from 'lucide-react';
import { useOrders } from '../../context/OrdersContext';
import { useToast } from '../../context/ToastContext';
import type { Order, OrderItem, OrderStatus, PaymentEvidence } from '../../types/order';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, EVIDENCE_TYPE_LABELS } from '../../types/order';
import {
  Page, PageHeader, Card, CardTitle, Button, IconButton, Badge, Tabs, DescriptionList, Timeline,
  Dialog, Field, TextInput, TextArea, SelectInput, RadioGroup, EmptyState, Spinner, Thumb,
} from '../../components/ui';
import { ORDER_TONE, fmtDateTime, money } from './orderUi';

type TabType = 'summary' | 'items' | 'shipping' | 'history';

/** Nombre legible de una vista del personalizador ('manga-izquierda' → 'Manga izquierda'). */
const viewLabel = (slug: string) => {
  const t = slug.replace(/[-_]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Vista';
};

const slugify = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').toLowerCase();

/** Vistas de una personalización v2: la vista previa de cada una y los diseños que lleva. */
const designViews = (item: OrderItem) => {
  const c = item.customization;
  if (!c?.designs?.length) return [];
  const slugs = Array.from(new Set([...c.designs.map((d) => d.viewSlug), ...Object.keys(c.previews || {})]));
  return slugs.map((slug) => ({
    slug,
    preview: c.previews?.[slug],
    designs: c.designs!.filter((d) => d.viewSlug === slug),
  }));
};

const EVIDENCE_OPTIONS: { value: PaymentEvidence['type']; label: string }[] = [
  { value: 'receipt', label: 'Recibo' },
  { value: 'transfer', label: 'Comprobante de transferencia' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'other', label: 'Otro' },
];

// Flujo de estados permitido desde el estado actual.
const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Detalle de un pedido: pestañas con resumen, productos, envío e historial; estado y totales a la derecha. */
export const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { getOrderById, changeOrderStatus, addEvidenceToStatus } = useOrders();
  const toast = useToast();

  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        setOrder(await getOrderById(id));
      } catch (error) {
        console.error('Error loading order:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadOrder();
  }, [id, getOrderById]);

  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [isChangeStatusOpen, setIsChangeStatusOpen] = useState(false);
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [selectedHistoryEntryId, setSelectedHistoryEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [statusFormData, setStatusFormData] = useState<{
    newStatus: OrderStatus; note: string; trackingNumber: string; trackingUrl: string; cancellationReason: string;
    evidenceType: PaymentEvidence['type']; evidenceUrl: string; evidenceDescription: string;
  }>({
    newStatus: 'pending', note: '', trackingNumber: '', trackingUrl: '', cancellationReason: '',
    evidenceType: 'receipt', evidenceUrl: '', evidenceDescription: '',
  });

  const [evidenceFormData, setEvidenceFormData] = useState({ type: 'receipt' as PaymentEvidence['type'], url: '', description: '' });

  // Solo la primera carga muestra la pantalla de espera; las recargas no borran lo que se ve.
  if (isLoading && !order) return <Page><Spinner label="Cargando pedido…" /></Page>;

  if (!order) {
    return (
      <Page>
        <PageHeader icon={FileText} title="Pedido no encontrado" backTo="/admin-panel/orders" />
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={Package} title="El pedido que buscas no existe" description="Puede que el enlace esté mal o que el pedido se haya eliminado." />
        </div>
      </Page>
    );
  }

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    toast.success('Número de pedido copiado');
  };

  // Descargar diseño como PNG (suffix: frente, espalda, frente-diseno-1…)
  const handleDownloadDesign = (designUrl: string, itemName: string, suffix: string) => {
    try {
      const link = document.createElement('a');
      link.href = designUrl;
      const fileName = `${order.orderNumber}_${itemName.replace(/\s+/g, '-')}_${suffix}.png`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Diseño descargado: ${fileName}`);
    } catch {
      toast.error('Error al descargar el diseño');
    }
  };

  // Mejor imagen disponible (original si existe, si no la vista previa)
  const getBestImage = (item: OrderItem, side: 'front' | 'back'): string | undefined => {
    if (!item.customization) return undefined;
    return side === 'front'
      ? item.customization.originalFront || item.customization.designFront
      : item.customization.originalBack || item.customization.designBack;
  };

  const hasOriginalImage = (item: OrderItem, side: 'front' | 'back'): boolean => {
    if (!item.customization) return false;
    return side === 'front' ? !!item.customization.originalFront : !!item.customization.originalBack;
  };

  /** Archivos de producción de un ítem: v2 = vista previa de cada vista + original de cada diseño. */
  const productionFiles = (item: OrderItem): { url: string; suffix: string }[] => {
    const views = designViews(item);
    if (views.length) {
      return views.flatMap((v) => [
        ...(v.preview ? [{ url: v.preview, suffix: `${slugify(v.slug)}-vista` }] : []),
        ...v.designs.map((d, i) => ({ url: d.originalImageData || d.imageData, suffix: `${slugify(v.slug)}-diseno-${i + 1}` })),
      ]).filter((f) => !!f.url);
    }
    return (['front', 'back'] as const)
      .map((side) => ({ url: getBestImage(item, side) || '', suffix: side === 'front' ? 'frente' : 'espalda' }))
      .filter((f) => !!f.url);
  };

  const downloadFiles = (files: { url: string; suffix: string; name: string }[]) => {
    files.forEach((f, i) => setTimeout(() => handleDownloadDesign(f.url, f.name, f.suffix), i * 500));
  };

  const handleDownloadAllDesigns = (item: OrderItem) => {
    downloadFiles(productionFiles(item).map((f) => ({ ...f, name: item.productName })));
  };

  const handleDownloadAllOrderDesigns = () => {
    const itemsWithDesigns = order.items.filter((item) => item.customization);
    if (itemsWithDesigns.length === 0) {
      toast.info('Este pedido no tiene productos personalizados');
      return;
    }
    downloadFiles(itemsWithDesigns.flatMap((item) => productionFiles(item).map((f) => ({ ...f, name: item.productName }))));
    toast.success(`Descargando ${itemsWithDesigns.length} diseño(s) en calidad original...`);
  };

  const availableStatuses = STATUS_FLOW[order.status] || [];

  const handleOpenChangeStatus = () => {
    setStatusFormData({
      // Preselecciona el siguiente estado natural (el primero del flujo).
      newStatus: availableStatuses[0] ?? order.status,
      note: '',
      trackingNumber: order.trackingNumber || '',
      trackingUrl: order.trackingUrl || '',
      cancellationReason: '',
      evidenceType: 'receipt',
      evidenceUrl: '',
      evidenceDescription: '',
    });
    setIsChangeStatusOpen(true);
  };

  const handleChangeStatus = async () => {
    const { newStatus, note, trackingNumber, trackingUrl, cancellationReason, evidenceType, evidenceUrl, evidenceDescription } = statusFormData;

    if (newStatus === order.status) { toast.error('Selecciona un estado diferente'); return; }
    if (newStatus === 'shipped' && !trackingNumber) { toast.error('Ingresa el número de guía para marcar como enviado'); return; }
    if (newStatus === 'cancelled' && !cancellationReason) { toast.error('Ingresa el motivo de cancelación'); return; }

    const evidences = evidenceUrl
      ? [{ type: evidenceType, url: evidenceUrl, description: evidenceDescription, uploadedBy: 'Admin' }]
      : undefined;

    setSaving(true);
    try {
      await changeOrderStatus({
        orderId: order.id,
        newStatus,
        note: note || undefined,
        evidences,
        trackingNumber: newStatus === 'shipped' ? trackingNumber : undefined,
        trackingUrl: newStatus === 'shipped' ? trackingUrl : undefined,
        cancellationReason: newStatus === 'cancelled' ? cancellationReason : undefined,
      });
      const updatedOrder = await getOrderById(String(order.id));
      setOrder(updatedOrder);
      toast.success(`Estado cambiado a "${ORDER_STATUS_LABELS[newStatus]}"`);
      setIsChangeStatusOpen(false);
    } catch (error) {
      toast.error('Error al cambiar el estado del pedido');
      console.error('Error changing status:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddEvidence = (historyEntryId: string) => {
    setSelectedHistoryEntryId(historyEntryId);
    setEvidenceFormData({ type: 'receipt', url: '', description: '' });
    setIsAddEvidenceOpen(true);
  };

  const closeEvidence = () => { setIsAddEvidenceOpen(false); setSelectedHistoryEntryId(null); };

  const handleAddEvidence = () => {
    if (!selectedHistoryEntryId || !evidenceFormData.url) {
      toast.error('Ingresa la URL del archivo');
      return;
    }
    addEvidenceToStatus(order.id, selectedHistoryEntryId, {
      type: evidenceFormData.type,
      url: evidenceFormData.url,
      description: evidenceFormData.description || undefined,
      uploadedBy: 'Admin',
    });
    toast.success('Evidencia agregada correctamente');
    closeEvidence();
  };

  const units = order.items.reduce((acc, item) => acc + item.quantity, 0);
  const hasDesigns = order.items.some((item) => item.customization);
  const history = [...order.statusHistory].reverse();
  const set = (patch: Partial<typeof statusFormData>) => setStatusFormData((p) => ({ ...p, ...patch }));

  return (
    <Page>
      <PageHeader
        icon={FileText}
        backTo="/admin-panel/orders"
        title={order.orderNumber}
        subtitle={`Creado el ${fmtDateTime(order.createdAt)} · ${order.userName}`}
        actions={
          <>
            <IconButton title="Copiar número de pedido" onClick={handleCopyOrderNumber}><Copy className="w-4 h-4" /></IconButton>
            {hasDesigns && <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={handleDownloadAllOrderDesigns}>Descargar diseños</Button>}
            {availableStatuses.length > 0 && <Button icon={<RefreshCw className="w-4 h-4" />} onClick={handleOpenChangeStatus}>Cambiar estado</Button>}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Contenido principal */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <Tabs<TabType>
            value={activeTab}
            onChange={setActiveTab}
            tabs={[
              { value: 'summary', label: 'Resumen' },
              { value: 'items', label: 'Productos', count: order.items.length },
              { value: 'shipping', label: 'Envío' },
              { value: 'history', label: 'Historial', count: order.statusHistory.length },
            ]}
          />

          {activeTab === 'summary' && (
            <>
              <Card>
                <CardTitle icon={User}>Cliente</CardTitle>
                <DescriptionList items={[
                  { label: 'Nombre', value: order.userName },
                  { label: 'Email', value: order.userEmail },
                  { label: 'Teléfono', value: order.shipping?.phone || null },
                  { label: 'Ciudad', value: order.shipping?.city || null },
                ]} />
              </Card>
              <Card>
                <CardTitle icon={CreditCard}>Pago</CardTitle>
                <DescriptionList items={[
                  { label: 'Método', value: PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod },
                  { label: 'Referencia', value: order.paymentReference || null },
                  { label: 'Productos', value: `${order.items.length} (${units} unidades)` },
                  { label: 'Total', value: <span className="font-semibold">{money(order.total)}</span> },
                ]} />
              </Card>
            </>
          )}

          {activeTab === 'items' && (
            <Card padded={false}>
              <ul className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <li key={item.id} className="p-4 md:p-5">
                    <div className="flex gap-4">
                      <Thumb src={item.productImage} alt={item.productName} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        {(item.size || item.color) && (
                          <p className="text-sm text-gray-500 mt-0.5">
                            {[item.size && `Talla ${item.size}`, item.color && `Color ${item.color}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {item.customization && <Badge tone="app" className="mt-2"><Printer className="w-3 h-3" />Personalizado</Badge>}
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="font-medium text-gray-900">{money(item.unitPrice * item.quantity)}</p>
                        <p className="text-sm text-gray-500">{item.quantity} × {money(item.unitPrice)}</p>
                      </div>
                    </div>

                    {designViews(item).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            Diseños para producción
                            {item.customization!.designs!.some((d) => d.originalImageData) && <Badge tone="green">HD</Badge>}
                          </p>
                          <Button size="sm" variant="ghost" icon={<Download className="w-4 h-4" />} onClick={() => handleDownloadAllDesigns(item)}>Descargar todos</Button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {designViews(item).map((view) => (
                            <div key={view.slug} className="rounded-lg border border-gray-200 overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-700">{viewLabel(view.slug)}</span>
                                {view.preview && (
                                  <IconButton title={`Descargar vista previa: ${viewLabel(view.slug)}`}
                                    onClick={() => handleDownloadDesign(view.preview!, item.productName, `${slugify(view.slug)}-vista`)}
                                  ><Download className="w-4 h-4" /></IconButton>
                                )}
                              </div>
                              {view.preview
                                ? <img src={view.preview} alt={`${item.productName} - ${viewLabel(view.slug)}`} className="w-full h-44 object-contain bg-gray-50" />
                                : <div className="h-20 flex items-center justify-center bg-gray-50 text-xs text-gray-400">Sin vista previa</div>}
                              <ul className="divide-y divide-gray-100">
                                {view.designs.map((d, i) => {
                                  const file = d.originalImageData || d.imageData;
                                  return (
                                    <li key={d.id || i} className="flex items-center gap-3 px-3 py-2">
                                      <Thumb src={d.imageData} alt={d.originalFileName || `Diseño ${i + 1}`} size="sm" />
                                      <div className="flex-1 min-w-0 text-xs">
                                        <p className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                                          {d.zoneName || `Diseño ${i + 1}`}
                                          {d.originalImageData && <Badge tone="green">Original</Badge>}
                                        </p>
                                        {d.originalFileName && <p className="text-gray-500 truncate">{d.originalFileName}</p>}
                                        <p className="text-gray-500 tabular-nums">
                                          Centro {Math.round(d.position.x)}% · {Math.round(d.position.y)}% — {Math.round(d.size.width)}% × {Math.round(d.size.height)}%
                                          {d.rotation ? ` — ${Math.round(d.rotation)}°` : ''}
                                        </p>
                                      </div>
                                      {file && (
                                        <IconButton title={d.originalImageData ? 'Descargar en calidad original' : 'Descargar diseño'}
                                          onClick={() => handleDownloadDesign(file, item.productName, `${slugify(view.slug)}-diseno-${i + 1}`)}
                                        ><Download className="w-4 h-4" /></IconButton>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {designViews(item).length === 0 && item.customization && (item.customization.designFront || item.customization.designBack) && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            Diseños para producción
                            {(hasOriginalImage(item, 'front') || hasOriginalImage(item, 'back')) && <Badge tone="green">HD</Badge>}
                          </p>
                          <Button size="sm" variant="ghost" icon={<Download className="w-4 h-4" />} onClick={() => handleDownloadAllDesigns(item)}>Descargar todos</Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(['front', 'back'] as const).map((side) => {
                            const preview = side === 'front' ? item.customization!.designFront : item.customization!.designBack;
                            if (!preview) return null;
                            const original = hasOriginalImage(item, side);
                            return (
                              <div key={side} className="rounded-lg border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
                                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    {side === 'front' ? 'Frente' : 'Espalda'}
                                    {original && <Badge tone="green">Original</Badge>}
                                  </span>
                                  <IconButton
                                    title={original ? 'Descargar en calidad original' : side === 'front' ? 'Descargar diseño frontal' : 'Descargar diseño trasero'}
                                    onClick={() => handleDownloadDesign(getBestImage(item, side)!, item.productName, side === 'front' ? 'frente' : 'espalda')}
                                  ><Download className="w-4 h-4" /></IconButton>
                                </div>
                                <img src={preview} alt={`${item.productName} - ${side === 'front' ? 'Frente' : 'Espalda'}`} className="w-full h-40 object-contain bg-gray-50" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {activeTab === 'shipping' && (
            <>
              <Card>
                <CardTitle icon={MapPin}>Dirección de entrega</CardTitle>
                <DescriptionList items={[
                  { label: 'Destinatario', value: order.shipping?.name || order.shipping?.recipientName },
                  { label: 'Teléfono', value: order.shipping?.phone || null },
                  { label: 'Dirección', value: order.shipping?.address, full: true },
                  { label: 'Ciudad', value: [order.shipping?.city, order.shipping?.postalCode].filter(Boolean).join(', ') || null },
                  { label: 'País', value: order.shipping?.country || null },
                  ...(order.shipping?.notes ? [{ label: 'Notas', value: order.shipping?.notes, full: true }] : []),
                ]} />
              </Card>
              <Card>
                <CardTitle icon={Truck}>Seguimiento</CardTitle>
                {order.trackingNumber ? (
                  <DescriptionList items={[
                    { label: 'Número de guía', value: <span className="font-mono">{order.trackingNumber}</span> },
                    {
                      label: 'Enlace', value: order.trackingUrl
                        ? <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-app-700 hover:underline">Ver seguimiento <ExternalLink className="w-3.5 h-3.5" /></a>
                        : null,
                    },
                    { label: 'Enviado', value: order.shippedAt ? fmtDateTime(order.shippedAt) : null },
                    { label: 'Entregado', value: order.deliveredAt ? fmtDateTime(order.deliveredAt) : null },
                  ]} />
                ) : (
                  <EmptyState icon={Truck} title="Sin información de envío" description="La guía se registra al marcar el pedido como Enviado." />
                )}
              </Card>
            </>
          )}

          {activeTab === 'history' && (
            <Card>
              <CardTitle icon={RefreshCw}>Historial de estados</CardTitle>
              {history.length === 0 ? (
                <p className="text-sm text-gray-500">Sin cambios de estado registrados.</p>
              ) : (
                <Timeline items={history.map((entry, index) => ({
                  tone: index === 0 ? 'app' : entry.toStatus === 'cancelled' ? 'red' : 'gray',
                  title: (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {entry.fromStatus && <><Badge tone={ORDER_TONE[entry.fromStatus]}>{ORDER_STATUS_LABELS[entry.fromStatus]}</Badge><ArrowRight className="w-3.5 h-3.5 text-gray-400" /></>}
                      <Badge tone={ORDER_TONE[entry.toStatus]}>{ORDER_STATUS_LABELS[entry.toStatus]}</Badge>
                    </span>
                  ),
                  meta: `${fmtDateTime(entry.changedAt)} · por ${entry.changedBy}`,
                  description: (
                    <span className="block space-y-2">
                      {entry.note && <span className="block text-gray-700">{entry.note}</span>}
                      {entry.trackingNumber && (
                        <span className="flex items-center gap-2 text-gray-600">
                          <Truck className="w-4 h-4" /> Guía: <span className="font-mono">{entry.trackingNumber}</span>
                          {entry.trackingUrl && <a href={entry.trackingUrl} target="_blank" rel="noopener noreferrer" title="Ver seguimiento" className="text-app-700"><ExternalLink className="w-4 h-4" /></a>}
                        </span>
                      )}
                      {entry.cancellationReason && (
                        <span className="flex items-start gap-2 text-red-700"><AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{entry.cancellationReason}</span>
                      )}
                      {entry.evidences && entry.evidences.length > 0 && (
                        <span className="block space-y-1">
                          {entry.evidences.map((evidence) => (
                            <a key={evidence.id} href={evidence.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm hover:border-app-300">
                              <Image className="w-4 h-4 text-gray-400" />
                              <span className="flex-1 min-w-0 truncate">
                                <span className="font-medium text-gray-800">{EVIDENCE_TYPE_LABELS[evidence.type]}</span>
                                {evidence.description && <span className="text-gray-500"> — {evidence.description}</span>}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                            </a>
                          ))}
                        </span>
                      )}
                      {(entry.toStatus === 'paid' || entry.toStatus === 'cancelled') && (
                        <Button size="sm" variant="ghost" icon={<Upload className="w-4 h-4" />} onClick={() => handleOpenAddEvidence(entry.id)}>Agregar evidencia</Button>
                      )}
                    </span>
                  ),
                }))} />
              )}
            </Card>
          )}
        </div>

        {/* Lateral: estado y totales */}
        <div className="space-y-4">
          <Card>
            <CardTitle>Estado</CardTitle>
            <Badge tone={ORDER_TONE[order.status]} className="text-sm px-3 py-1">{ORDER_STATUS_LABELS[order.status]}</Badge>
            {availableStatuses.length > 0 ? (
              <>
                <p className="text-xs text-gray-500 mt-4 mb-1.5">Puede pasar a</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableStatuses.map((s) => <Badge key={s} tone={ORDER_TONE[s]}>{ORDER_STATUS_LABELS[s]}</Badge>)}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 mt-3">Estado final: ya no admite cambios.</p>
            )}
          </Card>

          <Card>
            <CardTitle>Totales</CardTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd className="text-gray-900">{money(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Envío</dt><dd className="text-gray-900">{order.shippingCost > 0 ? money(order.shippingCost) : 'Gratis'}</dd></div>
              {order.discount > 0 && (
                <div className="flex justify-between"><dt className="text-gray-500">Descuento</dt><dd className="text-green-700">-{money(order.discount)}</dd></div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base"><dt className="font-medium text-gray-900">Total</dt><dd className="font-bold text-gray-900">{money(order.total)}</dd></div>
            </dl>
            <p className="text-xs text-gray-500 mt-3">{order.items.length} productos · {units} unidades · {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
          </Card>
        </div>
      </div>

      {/* Cambiar estado */}
      <Dialog
        open={isChangeStatusOpen}
        onClose={() => setIsChangeStatusOpen(false)}
        title="Cambiar estado del pedido"
        description={`Estado actual: ${ORDER_STATUS_LABELS[order.status]}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsChangeStatusOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleChangeStatus} isLoading={saving} variant={statusFormData.newStatus === 'cancelled' ? 'danger' : 'primary'}>
              {statusFormData.newStatus === 'cancelled' ? 'Cancelar pedido' : 'Cambiar estado'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nuevo estado" required>
            <RadioGroup<OrderStatus>
              variant="cards"
              value={statusFormData.newStatus}
              onChange={(v) => set({ newStatus: v })}
              options={availableStatuses.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))}
            />
          </Field>

          {statusFormData.newStatus === 'shipped' && (
            <>
              <Field label="Número de guía" required>
                <TextInput value={statusFormData.trackingNumber} onChange={(e) => set({ trackingNumber: e.target.value })} placeholder="Ej: COL123456789" />
              </Field>
              <Field label="URL de seguimiento">
                <TextInput type="url" value={statusFormData.trackingUrl} onChange={(e) => set({ trackingUrl: e.target.value })} placeholder="https://tracking.example.com/..." />
              </Field>
            </>
          )}

          {statusFormData.newStatus === 'cancelled' && (
            <Field label="Motivo de cancelación" required>
              <TextArea value={statusFormData.cancellationReason} onChange={(e) => set({ cancellationReason: e.target.value })} placeholder="Describe el motivo de la cancelación…" rows={3} />
            </Field>
          )}

          {statusFormData.newStatus === 'paid' && (
            <>
              <Field label="Tipo de evidencia">
                <SelectInput value={statusFormData.evidenceType} onChange={(e) => set({ evidenceType: e.target.value as PaymentEvidence['type'] })}>
                  {EVIDENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </SelectInput>
              </Field>
              <Field label="URL del comprobante" hint="Opcional: enlace al recibo o captura del pago.">
                <TextInput type="url" value={statusFormData.evidenceUrl} onChange={(e) => set({ evidenceUrl: e.target.value })} placeholder="https://example.com/comprobante.pdf" />
              </Field>
              <Field label="Descripción">
                <TextInput value={statusFormData.evidenceDescription} onChange={(e) => set({ evidenceDescription: e.target.value })} placeholder="Descripción del comprobante" />
              </Field>
            </>
          )}

          <Field label="Nota" hint="Opcional, queda en el historial.">
            <TextArea value={statusFormData.note} onChange={(e) => set({ note: e.target.value })} placeholder="Agrega una nota sobre este cambio de estado…" rows={2} />
          </Field>
        </div>
      </Dialog>

      {/* Agregar evidencia */}
      <Dialog
        open={isAddEvidenceOpen}
        onClose={closeEvidence}
        title="Agregar evidencia"
        footer={
          <>
            <Button variant="secondary" onClick={closeEvidence}>Cancelar</Button>
            <Button icon={<Upload className="w-4 h-4" />} onClick={handleAddEvidence}>Agregar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tipo de evidencia">
            <SelectInput value={evidenceFormData.type} onChange={(e) => setEvidenceFormData({ ...evidenceFormData, type: e.target.value as PaymentEvidence['type'] })}>
              {EVIDENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
          </Field>
          <Field label="URL del archivo" required>
            <TextInput type="url" value={evidenceFormData.url} onChange={(e) => setEvidenceFormData({ ...evidenceFormData, url: e.target.value })} placeholder="https://example.com/archivo.pdf" />
          </Field>
          <Field label="Descripción">
            <TextInput value={evidenceFormData.description} onChange={(e) => setEvidenceFormData({ ...evidenceFormData, description: e.target.value })} placeholder="Descripción del archivo" />
          </Field>
        </div>
      </Dialog>
    </Page>
  );
};
