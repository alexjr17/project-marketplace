import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { useToast } from '../../context/ToastContext';
import * as posService from '../../services/pos.service';
import settingsService from '../../services/settings.service';
import OpenSessionPrompt from '../../components/pos/OpenSessionPrompt';
import PrintPreviewModal from '../../components/pos/PrintPreviewModal';
import type { PrintSettings } from '../../types/settings';
import { DEFAULT_PRINT_SETTINGS } from '../../types/settings';
import { History, Receipt, DollarSign, CreditCard, Printer, Mail, X, CheckCircle, Smartphone, Eye, RefreshCw, Camera, Image as ImageIcon, Clock, Pencil, Trash2, Undo2, Minus, Plus, TrendingUp, Ban } from 'lucide-react';
import { Alert, Badge, Button, Dialog, EmptyState, Field, FileDrop, Page, PageHeader, Pager, RadioGroup, SelectInput, Spinner, StatCard, TableCard, Table, THead, TBody, Th, Tr, Td, TextInput, Timeline, type Tone } from '../../components/ui';

// Estado de la venta → etiqueta + estilo del badge.
function statusInfo(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'PAID': return { label: 'Pagado', tone: 'green' };
    case 'PENDING': return { label: 'Pendiente', tone: 'yellow' };
    case 'CANCELLED': return { label: 'Cancelado', tone: 'red' };
    default: return { label: status || '—', tone: 'gray' };
  }
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', mixed: 'Mixto', debe: 'Fiado',
};

/** Icono del método de pago (colores con significado: efectivo verde, fiado ámbar). */
function MethodIcon({ method }: { method: string }) {
  if (method === 'cash') return <DollarSign className="w-4 h-4 text-green-600" />;
  if (method === 'card') return <CreditCard className="w-4 h-4 text-blue-600" />;
  if (method === 'transfer') return <Smartphone className="w-4 h-4 text-blue-600" />;
  if (method === 'mixed') return <span className="flex -space-x-1"><DollarSign className="w-4 h-4 text-green-600" /><Smartphone className="w-4 h-4 text-blue-600" /></span>;
  if (method === 'debe') return <Clock className="w-4 h-4 text-amber-600" />;
  return null;
}

export default function SalesHistoryPage() {
  // Editar, devolver y anular exigen pos.cancel_sale (el backend lo valida).
  const { hasPermission } = useAuth();
  const canModifySales = hasPermission('pos.cancel_sale');
  const { currentSession, isLoadingSession } = usePOS();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Venta seleccionada para ver su resumen + acciones.
  const [summarySale, setSummarySale] = useState<any | null>(null);
  // Devolución parcial.
  const [returnModalSale, setReturnModalSale] = useState<any | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnRefundMethod, setReturnRefundMethod] = useState<'cash' | 'transfer'>('cash');
  const [isReturning, setIsReturning] = useState(false);

  // Email modal state
  const [emailModalSale, setEmailModalSale] = useState<any | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Print preview modal state
  const [printPreviewSale, setPrintPreviewSale] = useState<any | null>(null);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);

  // Evidence modal state
  const [evidenceModalSale, setEvidenceModalSale] = useState<any | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Ref para almacenar la imagen sin causar re-renders
  const imageDataRef = useRef<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [statusFilter, setStatusFilter] = useState<'all' | 'PAID' | 'PENDING' | 'CANCELLED'>('all');

  useEffect(() => {
    loadPrintSettings();
  }, []);

  // Load sales when session is available
  useEffect(() => {
    if (currentSession) {
      loadSales();
    }
  }, [currentSession]);

  // Attach camera stream to video element when stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraStream, isCameraActive]);

  // Cleanup resources when component unmounts or modal closes
  useEffect(() => {
    return () => {
      // Limpiar cámara al desmontar
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const loadPrintSettings = async () => {
    try {
      const data = await settingsService.getPrintingSettings();
      setPrintSettings({ ...DEFAULT_PRINT_SETTINGS, ...data });
    } catch (error) {
      console.error('Error loading print settings:', error);
    }
  };

  const loadSales = async () => {
    if (!currentSession) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await posService.getSalesHistory();
      setSales(data);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Anular una venta (devuelve stock, queda como Cancelada). El motivo se pide en un diálogo.
  const [cancelSale, setCancelSale] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelSale = (sale: any) => {
    setCancelSale(sale);
    setCancelReason('');
  };

  const confirmCancelSale = async () => {
    if (!cancelSale) return;
    if (!cancelReason.trim()) {
      showToast('El motivo es requerido', 'error');
      return;
    }
    setIsCancelling(true);
    try {
      await posService.cancelSale(cancelSale.id, cancelReason.trim());
      showToast('Venta anulada', 'success');
      setCancelSale(null);
      loadSales();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'No se pudo anular la venta', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  // Abrir modal de devolución
  const openReturnModal = (sale: any) => {
    setReturnModalSale(sale);
    setReturnQtys({});
    setReturnReason('');
    setReturnRefundMethod(sale.paymentMethod === 'transfer' ? 'transfer' : 'cash');
  };

  const setReturnQty = (variantId: number, qty: number, max: number) => {
    const v = Math.max(0, Math.min(qty, max));
    setReturnQtys((prev) => ({ ...prev, [variantId]: v }));
  };

  const returnRefundTotal = (sale: any) =>
    (sale?.items || []).reduce(
      (sum: number, it: any) => sum + (returnQtys[it.variantId] || 0) * Number(it.unitPrice ?? it.price ?? 0),
      0
    );

  const handleReturn = async () => {
    if (!returnModalSale) return;
    const items = (returnModalSale.items || [])
      .map((it: any) => ({ variantId: it.variantId, quantity: returnQtys[it.variantId] || 0 }))
      .filter((i: any) => i.quantity > 0);
    if (items.length === 0) {
      showToast('Selecciona al menos un producto a devolver', 'error');
      return;
    }
    setIsReturning(true);
    try {
      await posService.returnSale(returnModalSale.id, {
        items,
        reason: returnReason.trim() || undefined,
        refundMethod: returnRefundMethod,
      });
      showToast('Devolución registrada correctamente', 'success');
      setReturnModalSale(null);
      loadSales();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'No se pudo registrar la devolución', 'error');
    } finally {
      setIsReturning(false);
    }
  };

  // Imprimir ticket de una venta (usa el mismo PDF que se envía por email)
  const handlePrintTicket = async (sale: any) => {
    // Si está habilitado el modal de vista previa, mostrarlo
    if (printSettings.showPreviewModal) {
      setPrintPreviewSale(sale);
      return;
    }

    // Si no, imprimir directamente
    try {
      await posService.printInvoicePDF(sale.id);
    } catch (error) {
      console.error('Error printing invoice:', error);
      showToast('Error al imprimir el recibo', 'error');
    }
  };

  // Abrir modal para enviar factura
  const handleOpenEmailModal = (sale: any) => {
    setEmailModalSale(sale);
    setEmailInput(sale.customerEmail || '');
  };

  // Enviar factura por email
  const handleSendInvoice = async () => {
    if (!emailModalSale || !emailInput.trim()) {
      showToast('Ingresa un email válido', 'error');
      return;
    }

    setIsSendingEmail(true);
    try {
      await posService.sendInvoiceEmail(emailModalSale.id, emailInput.trim());
      showToast('Recibo enviado exitosamente', 'success');

      // Actualizar el sale con el email
      setSales(prevSales =>
        prevSales.map(s =>
          s.id === emailModalSale.id
            ? { ...s, customerEmail: emailInput.trim() }
            : s
        )
      );

      setEmailModalSale(null);
      setEmailInput('');
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      showToast(error.response?.data?.message || 'Error al enviar recibo', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Abrir modal de evidencia
  const handleOpenEvidenceModal = async (sale: any) => {
    // Limpiar todo primero
    imageDataRef.current = null;
    setEvidenceModalSale(sale);
    setIsCameraActive(false);
    setEvidencePreview(null);

    // Si ya tiene evidencia, cargarla desde el servidor
    if (sale.paymentEvidence) {
      setIsLoadingEvidence(true);
      try {
        const evidence = await posService.getPaymentEvidence(sale.id);
        imageDataRef.current = evidence;
        setEvidencePreview(evidence);
      } catch (error) {
        console.error('Error loading evidence:', error);
        setEvidencePreview(null);
      } finally {
        setIsLoadingEvidence(false);
      }
    }
  };

  // Cerrar modal de evidencia
  const handleCloseEvidenceModal = () => {
    stopCamera();
    imageDataRef.current = null;
    setEvidenceModalSale(null);
    setEvidencePreview(null);
    setIsCameraActive(false);
  };

  // Detectar si es móvil para ajustar compresión
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Comprimir imagen para optimizar memoria en móviles
  const compressImage = (
    source: HTMLVideoElement | HTMLImageElement,
    sourceWidth: number,
    sourceHeight: number
  ): string => {
    // MUY agresivo en móviles para evitar problemas de memoria
    const MAX_SIZE = isMobile ? 400 : 800;
    const QUALITY = isMobile ? 0.4 : 0.6;

    let width = sourceWidth;
    let height = sourceHeight;

    // Redimensionar si es necesario
    if (width > MAX_SIZE || height > MAX_SIZE) {
      if (width > height) {
        height = Math.round((height * MAX_SIZE) / width);
        width = MAX_SIZE;
      } else {
        width = Math.round((width * MAX_SIZE) / height);
        height = MAX_SIZE;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0, width, height);
      const result = canvas.toDataURL('image/jpeg', QUALITY);
      // Limpiar canvas para liberar memoria
      canvas.width = 0;
      canvas.height = 0;
      return result;
    }
    return '';
  };

  // Manejar selección de archivo
  const handleFileSelect = (file?: File) => {
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast('La imagen no debe superar 10MB', 'error');
        return;
      }

      const img = new Image();
      img.onload = () => {
        // Comprimir imagen para optimizar memoria
        const compressed = compressImage(img, img.width, img.height);
        if (compressed) {
          // Guardar en ref Y en state (state para preview, ref para upload)
          imageDataRef.current = compressed;
          setEvidencePreview(compressed);
          stopCamera();
          setIsCameraActive(false);
        }
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        showToast('Error al procesar la imagen', 'error');
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  // Iniciar cámara
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      // El useEffect se encarga de asignar el stream al video element
    } catch (error) {
      console.error('Error accessing camera:', error);
      showToast('No se pudo acceder a la cámara', 'error');
    }
  };

  // Detener cámara
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  // Capturar foto de la cámara
  const capturePhoto = () => {
    if (videoRef.current) {
      const imageData = compressImage(
        videoRef.current,
        videoRef.current.videoWidth,
        videoRef.current.videoHeight
      );
      if (imageData) {
        // Guardar en ref Y en state
        imageDataRef.current = imageData;
        setEvidencePreview(imageData);
        stopCamera();
        setIsCameraActive(false);
      }
    }
  };

  // Subir evidencia - optimizado para móviles
  const handleUploadEvidence = async () => {
    // Validación inicial
    if (!evidenceModalSale) {
      showToast('Error: No hay venta seleccionada', 'error');
      return;
    }

    // Usar ref que tiene la imagen (no depende del state)
    const imageToUpload = imageDataRef.current;
    if (!imageToUpload) {
      showToast('Selecciona una imagen primero', 'error');
      return;
    }

    // Guardar ID antes de cualquier cambio
    const saleId = evidenceModalSale.id;

    // PRIMERO: Limpiar memoria liberando la imagen del state
    setEvidencePreview(null);

    // Luego mostrar loading
    setIsUploadingEvidence(true);

    try {
      // Hacer el request usando la referencia (no el state)
      await posService.uploadPaymentEvidence(saleId, imageToUpload);

      // Limpiar ref después del upload exitoso
      imageDataRef.current = null;

      // Detener cámara si está activa
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }

      // Cerrar modal primero
      setIsCameraActive(false);
      setIsUploadingEvidence(false);
      setEvidenceModalSale(null);

      // Actualizar lista de ventas después de cerrar modal
      setSales((prevSales) =>
        prevSales.map((s) =>
          s.id === saleId ? { ...s, paymentEvidence: 'uploaded' } : s
        )
      );

      // Toast al final
      showToast('Evidencia subida correctamente', 'success');

    } catch (error: any) {
      // En caso de error, restaurar la imagen para reintentar
      setEvidencePreview(imageToUpload);
      setIsUploadingEvidence(false);
      const errorMsg = error?.response?.data?.message
        || error?.message
        || 'Error al subir';
      showToast(`Error: ${errorMsg}`, 'error');
    }
  };

  // Filtro por estado + paginación
  const filteredSales = statusFilter === 'all' ? sales : sales.filter((s) => s.status === statusFilter);
  const totalPages = Math.ceil(filteredSales.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedSales = filteredSales.slice(startIndex, endIndex);

  // Reset to page 1 when sales change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [sales.length, totalPages, currentPage]);

  if (isLoadingSession) {
    return <Spinner label="Validando sesión de caja…" className="py-24" />;
  }

  if (!currentSession) {
    return (
      <Page>
        <PageHeader icon={History} title="Historial de ventas" subtitle="Ventas de la sesión de caja" />
        <OpenSessionPrompt
          title="Sin sesión de caja"
          message="Abre una sesión de caja para ver el historial de ventas"
        />
      </Page>
    );
  }

  const closeEmailModal = () => {
    setEmailModalSale(null);
    setEmailInput('');
  };

  const countBy = (m: string) => sales.filter((x) => x.paymentMethod === m).length;

  return (
    <Page>
      <PageHeader
        icon={History}
        title="Historial de ventas"
        subtitle={`Ventas de la sesión actual · ${currentSession.cashRegister?.name ?? ''}`}
        actions={
          <Button variant="secondary" icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />} onClick={loadSales} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Receipt} label="Total ventas" value={currentSession.salesCount} />
        <StatCard icon={DollarSign} tone="green" label="Total vendido" value={`$${currentSession.totalSales.toLocaleString()}`} />
        <StatCard
          icon={TrendingUp}
          tone="blue"
          label="Ticket promedio"
          value={`$${currentSession.salesCount > 0 ? Math.round(currentSession.totalSales / currentSession.salesCount).toLocaleString() : 0}`}
        />
        <StatCard
          icon={CreditCard}
          tone="gray"
          label="Por método"
          value={
            <span className="flex items-center gap-3 text-base">
              <span className="flex items-center gap-1" title="Efectivo"><DollarSign className="w-4 h-4 text-green-600" />{countBy('cash')}</span>
              <span className="flex items-center gap-1" title="Transferencia"><Smartphone className="w-4 h-4 text-blue-600" />{countBy('transfer')}</span>
              <span className="flex items-center gap-1" title="Mixto"><span className="text-xs font-semibold text-gray-500">M</span>{countBy('mixed')}</span>
            </span>
          }
        />
      </div>

      {/* Filtro por estado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">Ventas realizadas</h2>
        <div className="overflow-x-auto">
          <RadioGroup
            variant="segmented"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'PAID', label: 'Pagadas' },
              { value: 'PENDING', label: 'Pendientes' },
              { value: 'CANCELLED', label: 'Canceladas' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <Spinner label="Cargando historial…" />
      ) : sales.length === 0 ? (
        <TableCard>
          <EmptyState icon={History} title="No hay ventas registradas en esta sesión" description="Las ventas que realices aparecerán aquí" />
        </TableCard>
      ) : (
        <TableCard
          footer={filteredSales.length > pageSize ? (
            <Pager page={currentPage} pageSize={pageSize} total={filteredSales.length} onPage={setCurrentPage} />
          ) : undefined}
        >
          <Table>
            <THead>
              <tr>
                <Th>Fecha / hora</Th>
                <Th># Orden</Th>
                <Th>Cliente</Th>
                <Th align="right">Productos</Th>
                <Th>Pago</Th>
                <Th align="center">Estado</Th>
                <Th align="right">Total</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </THead>
            <TBody>
              {paginatedSales.length === 0 ? (
                <tr><td colSpan={8}><EmptyState title="Sin ventas con este estado" /></td></tr>
              ) : paginatedSales.map((sale) => {
                const st = statusInfo(sale.status);
                return (
                  <Tr key={sale.id} onClick={() => setSummarySale(sale)}>
                    <Td className="whitespace-nowrap">
                      <div className="text-gray-900">{new Date(sale.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{new Date(sale.createdAt).toLocaleTimeString()}</div>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-gray-900">{sale.orderNumber}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="text-gray-900">{sale.posCustomer?.name || sale.customerName || 'Cliente general'}</div>
                      {sale.posCustomer?.cedula && <div className="text-xs text-gray-500">CC: {sale.posCustomer.cedula}</div>}
                    </Td>
                    <Td align="right" className="whitespace-nowrap tabular-nums">{sale.items?.length || 0}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MethodIcon method={sale.paymentMethod} />
                        <div>
                          <span className="text-gray-700 font-medium">{METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}</span>
                          {sale.cardType && <span className="text-xs text-gray-500 block capitalize">{sale.cardType}</span>}
                        </div>
                      </div>
                    </Td>
                    <Td align="center"><Badge tone={st.tone}>{st.label}</Badge></Td>
                    <Td align="right" className="whitespace-nowrap font-semibold text-gray-900 tabular-nums">${sale.total.toLocaleString()}</Td>
                    <Td align="right" className="whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="w-4 h-4" />}
                        onClick={(e) => { e.stopPropagation(); setSummarySale(sale); }}
                        title="Ver resumen y acciones"
                      >
                        Resumen
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableCard>
      )}

      {/* Enviar recibo por email */}
      <Dialog
        open={!!emailModalSale}
        onClose={closeEmailModal}
        size="sm"
        title="Enviar recibo por email"
        description={emailModalSale ? `Orden ${emailModalSale.orderNumber}` : undefined}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={closeEmailModal}>Cancelar</Button>
            <Button size="lg" icon={<Mail className="w-4 h-4" />} onClick={handleSendInvoice} isLoading={isSendingEmail} disabled={!emailInput.trim()}>
              {isSendingEmail ? 'Enviando…' : 'Enviar recibo'}
            </Button>
          </>
        }
      >
        {emailModalSale && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">Fecha</span><span>{new Date(emailModalSale.createdAt).toLocaleString('es-CO')}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-500">Total</span><span className="text-lg font-bold text-gray-900">${Number(emailModalSale.total).toLocaleString()}</span></div>
            </div>
            {emailModalSale.customerEmail && (
              <Alert tone="success">Recibo enviado anteriormente a: <strong>{emailModalSale.customerEmail}</strong></Alert>
            )}
            <Field label={emailModalSale.customerEmail ? 'Reenviar a otro email' : 'Email del cliente'}>
              <TextInput
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="cliente@email.com"
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvoice()}
                autoFocus
              />
            </Field>
          </div>
        )}
      </Dialog>

      {/* Vista previa de impresión */}
      <PrintPreviewModal
        isOpen={!!printPreviewSale}
        onClose={() => setPrintPreviewSale(null)}
        saleId={printPreviewSale?.id || 0}
        orderNumber={printPreviewSale?.orderNumber}
      />

      {/* Evidencia de pago (transferencias) */}
      <Dialog
        key={evidenceModalSale ? `evidence-modal-${evidenceModalSale.id}` : 'evidence-modal'}
        open={!!evidenceModalSale}
        onClose={handleCloseEvidenceModal}
        title="Evidencia de pago"
        description={evidenceModalSale ? `Orden ${evidenceModalSale.orderNumber} · Transferencia · $${Number(evidenceModalSale.total).toLocaleString()}` : undefined}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={handleCloseEvidenceModal}>Cancelar</Button>
            <Button
              size="lg"
              icon={<CheckCircle className="w-4 h-4" />}
              onClick={handleUploadEvidence}
              isLoading={isUploadingEvidence}
              disabled={isLoadingEvidence || !evidencePreview}
            >
              {isUploadingEvidence ? 'Guardando…' : 'Guardar evidencia'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {isLoadingEvidence ? (
            <Spinner label="Cargando evidencia…" />
          ) : isCameraActive ? (
            <div className="space-y-3">
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" style={{ maxHeight: '300px' }} />
                <button
                  onClick={capturePhoto}
                  title="Tomar foto"
                  aria-label="Tomar foto"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-app-600 flex items-center justify-center"
                >
                  <span className="w-12 h-12 bg-app-600 rounded-full" />
                </button>
              </div>
              <Button variant="secondary" fullWidth onClick={() => { stopCamera(); setIsCameraActive(false); }}>Cancelar cámara</Button>
            </div>
          ) : isUploadingEvidence ? (
            <Spinner label="Subiendo evidencia… Por favor espera" />
          ) : evidencePreview ? (
            <div className="relative rounded-lg border border-gray-200 bg-gray-50">
              <img
                src={evidencePreview}
                alt="Evidencia de pago"
                className="w-full rounded-lg object-contain"
                style={{ maxHeight: '300px' }}
                onError={() => {
                  showToast('Error al cargar la imagen', 'error');
                  setEvidencePreview(null);
                }}
              />
              <button
                onClick={() => { imageDataRef.current = null; setEvidencePreview(null); }}
                className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 text-red-600 rounded-full hover:bg-red-50"
                title="Quitar imagen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <EmptyState icon={ImageIcon} title="No hay imagen de evidencia" description="Sube una imagen o usa la cámara para capturar" />
          )}

          {!isCameraActive && !isLoadingEvidence && !isUploadingEvidence && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FileDrop compact accept="image/*" maxSizeMB={10} title="Subir imagen" onFiles={(files) => handleFileSelect(files[0])} />
              <Button variant="outline" size="lg" className="h-full min-h-12" icon={<Camera className="w-5 h-5" />} onClick={startCamera}>
                Usar cámara
              </Button>
            </div>
          )}
        </div>
      </Dialog>

      {/* Resumen de la venta + acciones */}
      {summarySale && (() => {
        const st = statusInfo(summarySale.status);
        const isCancelled = summarySale.status === 'CANCELLED';
        const pick = (fn: (sale: any) => void) => () => { const sale = summarySale; setSummarySale(null); fn(sale); };
        return (
          <Dialog
            open
            onClose={() => setSummarySale(null)}
            title={<span className="font-mono">{summarySale.orderNumber}</span>}
            description={new Date(summarySale.createdAt).toLocaleString('es-CO')}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm min-w-0">
                  <span className="text-gray-900 font-medium">{summarySale.posCustomer?.name || summarySale.customerName || 'Cliente general'}</span>
                  {summarySale.posCustomer?.cedula && <span className="text-gray-500"> · CC {summarySale.posCustomer.cedula}</span>}
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>

              {/* Productos */}
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {(summarySale.items || []).map((it: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="text-gray-700 truncate">{it.quantity}× {it.productName || it.product?.name || 'Producto'}</span>
                    <span className="text-gray-900 font-medium whitespace-nowrap">${(Number(it.unitPrice ?? it.price ?? 0) * (it.quantity || 1)).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Totales */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>${Number(summarySale.subtotal).toLocaleString()}</span></div>
                {summarySale.discount > 0 && (
                  <div className="flex justify-between text-red-600"><span>Descuento</span><span>-${Number(summarySale.discount).toLocaleString()}</span></div>
                )}
                {summarySale.tax > 0 && (
                  <div className="flex justify-between text-gray-600"><span>Impuesto</span><span>${Number(summarySale.tax).toLocaleString()}</span></div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-1.5 mt-1.5">
                  <span>Total</span><span>${Number(summarySale.total).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Pago</span>
                  <span className="flex items-center gap-1.5"><MethodIcon method={summarySale.paymentMethod} />{METHOD_LABEL[summarySale.paymentMethod] ?? 'Tarjeta'}</span>
                </div>
              </div>

              {/* Acciones */}
              <div className="space-y-2 pt-1">
                {!isCancelled && canModifySales && (
                  <Button size="lg" fullWidth icon={<Pencil className="w-4 h-4" />} onClick={() => { const id = summarySale.id; setSummarySale(null); navigate(`/pos/sale?edit=${id}`); }}>
                    Editar venta
                  </Button>
                )}
                {!isCancelled && canModifySales && (summarySale.items?.length > 0) && (
                  <Button variant="secondary" size="lg" fullWidth icon={<Undo2 className="w-4 h-4" />} onClick={pick(openReturnModal)}>
                    Devolver productos
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={pick(handlePrintTicket)}>Imprimir</Button>
                  <Button variant="secondary" icon={summarySale.customerEmail ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Mail className="w-4 h-4" />} onClick={pick(handleOpenEmailModal)}>Email</Button>
                  {summarySale.paymentMethod === 'transfer' && (
                    <Button variant="secondary" icon={summarySale.paymentEvidence ? <ImageIcon className="w-4 h-4" /> : <Camera className="w-4 h-4" />} onClick={pick(handleOpenEvidenceModal)}>Evidencia</Button>
                  )}
                  {!isCancelled && canModifySales && (
                    <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" icon={<Trash2 className="w-4 h-4" />} onClick={pick(handleCancelSale)}>Anular</Button>
                  )}
                </div>
              </div>

              {/* Historial de cambios */}
              {Array.isArray(summarySale.editHistory) && summarySale.editHistory.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"><History className="w-4 h-4 text-app-600" /> Historial de cambios</p>
                  <Timeline
                    items={[...summarySale.editHistory].reverse().map((e: any) => ({
                      title: e.action === 'created' ? 'Venta creada'
                        : e.action === 'payment' ? 'Abono recibido'
                        : e.action === 'return' ? 'Devolución' : 'Venta editada',
                      tone: e.action === 'created' || e.action === 'payment' ? 'green' as const : e.action === 'return' ? 'red' as const : 'app' as const,
                      meta: e.timestamp ? new Date(e.timestamp).toLocaleString('es-CO') : undefined,
                      description: (
                        <>
                          {e.action === 'created' && e.snapshot && <span className="text-xs text-gray-500">Total ${Number(e.snapshot.total ?? 0).toLocaleString()}</span>}
                          {Array.isArray(e.changes) && e.changes.length > 0 && (
                            <ul className="space-y-0.5">
                              {e.changes.map((c: any, ci: number) => (
                                <li key={ci} className="text-xs text-gray-600">
                                  <span className="text-gray-500">{c.label}:</span>{' '}
                                  <span className="line-through text-gray-400">{String(c.from)}</span>
                                  {' → '}
                                  <span className="font-medium text-gray-800">{String(c.to)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ),
                    }))}
                  />
                </div>
              )}
            </div>
          </Dialog>
        );
      })()}

      {/* Anular venta: motivo */}
      <Dialog
        open={!!cancelSale}
        onClose={() => !isCancelling && setCancelSale(null)}
        size="sm"
        title="¿Anular la venta?"
        description={cancelSale ? `${cancelSale.orderNumber} · Se devolverá el stock y la venta queda como Cancelada.` : undefined}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setCancelSale(null)} disabled={isCancelling}>Cancelar</Button>
            <Button variant="danger" size="lg" icon={<Ban className="w-4 h-4" />} onClick={confirmCancelSale} isLoading={isCancelling} disabled={!cancelReason.trim()}>
              Anular venta
            </Button>
          </>
        }
      >
        <Field label="Motivo de la anulación" required>
          <TextInput
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmCancelSale()}
            placeholder="Ej: error en el cobro"
            autoFocus
          />
        </Field>
      </Dialog>

      {/* Devolución parcial */}
      <Dialog
        open={!!returnModalSale}
        onClose={() => !isReturning && setReturnModalSale(null)}
        title="Devolver productos"
        description={returnModalSale ? <span className="font-mono">{returnModalSale.orderNumber}</span> : undefined}
        footer={
          <>
            <Button variant="secondary" size="lg" onClick={() => setReturnModalSale(null)} disabled={isReturning}>Cancelar</Button>
            <Button
              variant="danger"
              size="lg"
              icon={<Undo2 className="w-4 h-4" />}
              onClick={handleReturn}
              isLoading={isReturning}
              disabled={!returnModalSale || returnRefundTotal(returnModalSale) <= 0}
            >
              Confirmar devolución
            </Button>
          </>
        }
      >
        {returnModalSale && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
              {(returnModalSale.items || []).map((it: any, idx: number) => {
                const max = it.quantity || 0;
                const qty = returnQtys[it.variantId] || 0;
                return (
                  <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{it.productName || it.product?.name || 'Producto'}</p>
                      <p className="text-xs text-gray-500">Vendidos: {max} · ${Number(it.unitPrice ?? it.price ?? 0).toLocaleString()} c/u</p>
                    </div>
                    <div className="inline-flex items-center rounded-lg border border-gray-300 flex-shrink-0">
                      <button onClick={() => setReturnQty(it.variantId, qty - 1, max)} disabled={qty <= 0} title="Restar" aria-label="Restar" className="w-9 h-9 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-l-lg disabled:opacity-40">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{qty}</span>
                      <button onClick={() => setReturnQty(it.variantId, qty + 1, max)} disabled={qty >= max} title="Sumar" aria-label="Sumar" className="w-9 h-9 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-r-lg disabled:opacity-40">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Motivo" hint="Opcional">
                <TextInput value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Ej: producto en mal estado" />
              </Field>
              <Field label="Reembolso por">
                <SelectInput value={returnRefundMethod} onChange={(e) => setReturnRefundMethod(e.target.value as 'cash' | 'transfer')}>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                </SelectInput>
              </Field>
            </div>

            <div className="flex justify-between items-center rounded-lg border border-gray-200 px-4 py-3">
              <span className="text-sm font-medium text-gray-700">Total a reembolsar</span>
              <span className="text-xl font-bold text-red-600">${returnRefundTotal(returnModalSale).toLocaleString()}</span>
            </div>
          </div>
        )}
      </Dialog>
    </Page>
  );
}
