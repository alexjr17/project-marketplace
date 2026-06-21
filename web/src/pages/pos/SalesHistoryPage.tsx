import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { Button } from '../../components/shared/Button';
import { useToast } from '../../context/ToastContext';
import * as posService from '../../services/pos.service';
import settingsService from '../../services/settings.service';
import OpenSessionPrompt from '../../components/pos/OpenSessionPrompt';
import PrintPreviewModal from '../../components/pos/PrintPreviewModal';
import type { PrintSettings } from '../../types/settings';
import { DEFAULT_PRINT_SETTINGS } from '../../types/settings';
import { History, Receipt, Calendar, DollarSign, CreditCard, User, Printer, Mail, X, Loader2, CheckCircle, Smartphone, Eye, RefreshCw, Camera, Upload, Image as ImageIcon, ChevronLeft, ChevronRight, Clock, Pencil, Trash2 } from 'lucide-react';

// Estado de la venta → etiqueta + estilo del badge.
function statusInfo(status: string): { label: string; cls: string } {
  switch (status) {
    case 'PAID': return { label: 'Pagado', cls: 'bg-green-100 text-green-700' };
    case 'PENDING': return { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' };
    case 'CANCELLED': return { label: 'Cancelado', cls: 'bg-red-100 text-red-700' };
    default: return { label: status || '—', cls: 'bg-gray-100 text-gray-700' };
  }
}

export default function SalesHistoryPage() {
  const { currentSession } = usePOS();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Venta seleccionada para ver su resumen + acciones.
  const [summarySale, setSummarySale] = useState<any | null>(null);

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

  // Anular una venta (devuelve stock, queda como Cancelada)
  const handleCancelSale = async (sale: any) => {
    const reason = window.prompt(`¿Anular la venta ${sale.orderNumber}? Se devolverá el stock.\nMotivo de la anulación:`);
    if (reason === null) return;
    if (!reason.trim()) {
      showToast('El motivo es requerido', 'error');
      return;
    }
    try {
      await posService.cancelSale(sale.id, reason.trim());
      showToast('Venta anulada', 'success');
      loadSales();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'No se pudo anular la venta', 'error');
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
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

  if (!currentSession) {
    return (
      <OpenSessionPrompt
        title="Sin Sesion de Caja"
        message="Abre una sesion de caja para ver el historial de ventas"
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando historial...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <History className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
            <p className="text-gray-600 mt-1">
              Ventas de la sesión actual - {currentSession.cashRegister?.name}
            </p>
          </div>
        </div>
        <button
          onClick={loadSales}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Total Ventas</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {currentSession.salesCount}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Total Vendido</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                ${currentSession.totalSales.toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Ticket Promedio</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                $
                {currentSession.salesCount > 0
                  ? Math.round(currentSession.totalSales / currentSession.salesCount).toLocaleString()
                  : 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500">Por Método</p>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1" title="Efectivo">
                  <DollarSign className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-sm font-semibold text-gray-700">
                    {sales.filter(s => s.paymentMethod === 'cash').length}
                  </span>
                </div>
                <div className="flex items-center gap-1" title="Transferencia">
                  <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-sm font-semibold text-gray-700">
                    {sales.filter(s => s.paymentMethod === 'transfer').length}
                  </span>
                </div>
                <div className="flex items-center gap-1" title="Mixto">
                  <span className="text-xs text-orange-600 font-semibold">M</span>
                  <span className="text-sm font-semibold text-gray-700">
                    {sales.filter(s => s.paymentMethod === 'mixed').length}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Ventas Realizadas</h2>
          <div className="flex items-center gap-1 flex-wrap">
            {([
              { key: 'all', label: 'Todas' },
              { key: 'PAID', label: 'Pagadas' },
              { key: 'PENDING', label: 'Pendientes' },
              { key: 'CANCELLED', label: 'Canceladas' },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => { setStatusFilter(f.key); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {sales.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">No hay ventas registradas en esta sesión</p>
            <p className="text-sm text-gray-500 mt-1">
              Las ventas que realices aparecerán aquí
            </p>
          </div>
        ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha/Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    # Orden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Productos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pago
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div className="text-sm">
                          <div className="text-gray-900">
                            {new Date(sale.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-gray-500">
                            {new Date(sale.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">
                        {sale.orderNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="text-sm text-gray-900 block">
                            {sale.posCustomer?.name || sale.customerName || 'Cliente general'}
                          </span>
                          {sale.posCustomer?.cedula && (
                            <span className="text-xs text-gray-500">
                              CC: {sale.posCustomer.cedula}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {sale.items?.length || 0} productos
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {sale.paymentMethod === 'cash' && (
                          <DollarSign className="w-4 h-4 text-green-600" />
                        )}
                        {sale.paymentMethod === 'card' && (
                          <CreditCard className="w-4 h-4 text-blue-600" />
                        )}
                        {sale.paymentMethod === 'transfer' && (
                          <Smartphone className="w-4 h-4 text-purple-600" />
                        )}
                        {sale.paymentMethod === 'mixed' && (
                          <div className="flex -space-x-1">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <Smartphone className="w-4 h-4 text-purple-600" />
                          </div>
                        )}
                        {sale.paymentMethod === 'debe' && (
                          <Clock className="w-4 h-4 text-amber-600" />
                        )}
                        <div className="text-sm">
                          <span className="text-gray-700 font-medium">
                            {sale.paymentMethod === 'cash' && 'Efectivo'}
                            {sale.paymentMethod === 'card' && 'Tarjeta'}
                            {sale.paymentMethod === 'transfer' && 'Transferencia'}
                            {sale.paymentMethod === 'mixed' && 'Mixto'}
                            {sale.paymentMethod === 'debe' && 'Fiado'}
                          </span>
                          {sale.cardType && (
                            <span className="text-xs text-gray-500 block capitalize">
                              {sale.cardType}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const s = statusInfo(sale.status);
                        return (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
                            {s.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        ${sale.total.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex justify-center">
                        <Button
                          variant="admin-secondary"
                          size="sm"
                          onClick={() => setSummarySale(sale)}
                          title="Ver resumen y acciones"
                        >
                          <Eye className="w-4 h-4" />
                          Resumen
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredSales.length > pageSize && (
            <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-700">
                Mostrando{' '}
                <span className="font-medium">{startIndex + 1}</span> a{' '}
                <span className="font-medium">{Math.min(endIndex, filteredSales.length)}</span> de{' '}
                <span className="font-medium">{filteredSales.length}</span> ventas
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      // Show first, last, current and adjacent pages
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - currentPage) <= 1) return true;
                      return false;
                    })
                    .reduce((acc: (number | string)[], page, idx, arr) => {
                      // Add ellipsis where there are gaps
                      if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((page, idx) =>
                      page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-500">
                          ...
                        </span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page as number)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
        )}
      </div>

      {/* Email Modal */}
      {emailModalSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 bg-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-semibold text-purple-800">
                    Enviar Recibo por Email
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setEmailModalSale(null);
                    setEmailInput('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Info de la venta */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Orden:</span>
                  <span className="font-mono font-medium">{emailModalSale.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Fecha:</span>
                  <span className="text-sm">
                    {new Date(emailModalSale.createdAt).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Total:</span>
                  <span className="text-lg font-bold text-gray-900">
                    ${Number(emailModalSale.total).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Email ya enviado */}
              {emailModalSale.customerEmail && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">
                      Recibo enviado anteriormente a: <strong>{emailModalSale.customerEmail}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Input de email */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {emailModalSale.customerEmail ? 'Reenviar a otro email:' : 'Email del cliente:'}
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendInvoice()}
                  autoFocus
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEmailModalSale(null);
                    setEmailInput('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendInvoice}
                  disabled={isSendingEmail || !emailInput.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Enviar Recibo
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      <PrintPreviewModal
        isOpen={!!printPreviewSale}
        onClose={() => setPrintPreviewSale(null)}
        saleId={printPreviewSale?.id || 0}
        orderNumber={printPreviewSale?.orderNumber}
      />

      {/* Evidence Modal */}
      {evidenceModalSale && (
        <div
          key={`evidence-modal-${evidenceModalSale.id}`}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-600" />
                  <h2 className="text-lg font-semibold text-amber-800">
                    Evidencia de Pago
                  </h2>
                </div>
                <button
                  onClick={handleCloseEvidenceModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Info de la venta */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Orden:</span>
                  <span className="font-mono font-medium">{evidenceModalSale.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600 text-sm">Método:</span>
                  <span className="text-sm font-medium text-purple-600">Transferencia</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Total:</span>
                  <span className="text-lg font-bold text-gray-900">
                    ${Number(evidenceModalSale.total).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Vista previa de imagen o cámara */}
              <div className="mb-4">
                {isLoadingEvidence ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 text-amber-500 animate-spin" />
                    <p className="text-gray-600">Cargando evidencia...</p>
                  </div>
                ) : isCameraActive ? (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full rounded-lg bg-black"
                      style={{ maxHeight: '300px' }}
                    />
                    <button
                      onClick={capturePhoto}
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-amber-500 hover:border-amber-600 flex items-center justify-center shadow-lg"
                    >
                      <div className="w-12 h-12 bg-amber-500 rounded-full" />
                    </button>
                  </div>
                ) : isUploadingEvidence ? (
                  <div className="border-2 border-dashed border-amber-300 rounded-lg p-8 text-center bg-amber-50">
                    <Loader2 className="w-12 h-12 mx-auto mb-3 text-amber-500 animate-spin" />
                    <p className="text-amber-700 font-medium">Subiendo evidencia...</p>
                    <p className="text-sm text-amber-600 mt-1">
                      Por favor espera
                    </p>
                  </div>
                ) : evidencePreview ? (
                  <div className="relative">
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
                      onClick={() => {
                        imageDataRef.current = null;
                        setEvidencePreview(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      title="Eliminar imagen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600 mb-2">No hay imagen de evidencia</p>
                    <p className="text-sm text-gray-500">
                      Sube una imagen o usa la cámara para capturar
                    </p>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              {!isCameraActive && !isLoadingEvidence && !isUploadingEvidence && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors cursor-pointer">
                    <Upload className="w-5 h-5" />
                    <span className="font-medium">Subir imagen</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={startCamera}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="font-medium">Usar cámara</span>
                  </button>
                </div>
              )}

              {isCameraActive && (
                <button
                  onClick={() => {
                    stopCamera();
                    setIsCameraActive(false);
                  }}
                  className="w-full mb-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar cámara
                </button>
              )}

              {/* Botones de guardar/cancelar */}
              <div className="flex gap-3">
                <button
                  onClick={handleCloseEvidenceModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUploadEvidence}
                  disabled={isUploadingEvidence || isLoadingEvidence || !evidencePreview}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploadingEvidence ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Guardar Evidencia
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumen de la venta + acciones */}
      {summarySale && (() => {
        const s = statusInfo(summarySale.status);
        const isCancelled = summarySale.status === 'CANCELLED';
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 font-mono">{summarySale.orderNumber}</h2>
                  <p className="text-xs text-gray-500">
                    {new Date(summarySale.createdAt).toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
                  <button onClick={() => setSummarySale(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3 overflow-y-auto">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 font-medium">
                    {summarySale.posCustomer?.name || summarySale.customerName || 'Cliente general'}
                  </span>
                  {summarySale.posCustomer?.cedula && (
                    <span className="text-gray-500">· CC {summarySale.posCustomer.cedula}</span>
                  )}
                </div>

                {/* Items */}
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
                  {(summarySale.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="text-gray-700 truncate">
                        {it.quantity}× {it.productName || it.product?.name || 'Producto'}
                      </span>
                      <span className="text-gray-900 font-medium whitespace-nowrap">
                        ${(Number(it.unitPrice ?? it.price ?? 0) * (it.quantity || 1)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Totales */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span><span>${Number(summarySale.subtotal).toLocaleString()}</span>
                  </div>
                  {summarySale.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Descuento</span><span>-${Number(summarySale.discount).toLocaleString()}</span>
                    </div>
                  )}
                  {summarySale.tax > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Impuesto</span><span>${Number(summarySale.tax).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-1">
                    <span>Total</span><span>${Number(summarySale.total).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Pago</span>
                    <span className="capitalize">
                      {summarySale.paymentMethod === 'cash' ? 'Efectivo' :
                       summarySale.paymentMethod === 'transfer' ? 'Transferencia' :
                       summarySale.paymentMethod === 'mixed' ? 'Mixto' :
                       summarySale.paymentMethod === 'debe' ? 'Fiado' : 'Tarjeta'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="px-5 py-4 border-t border-gray-200 space-y-2">
                {!isCancelled && (
                  <Button
                    variant="admin-primary"
                    fullWidth
                    onClick={() => { const id = summarySale.id; setSummarySale(null); navigate(`/pos/sale?edit=${id}`); }}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar venta
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="admin-secondary" size="sm" onClick={() => { const sale = summarySale; setSummarySale(null); handlePrintTicket(sale); }}>
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </Button>
                  <Button variant="admin-secondary" size="sm" onClick={() => { const sale = summarySale; setSummarySale(null); handleOpenEmailModal(sale); }}>
                    {summarySale.customerEmail ? <CheckCircle className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    Email
                  </Button>
                  {summarySale.paymentMethod === 'transfer' && (
                    <Button variant="admin-secondary" size="sm" onClick={() => { const sale = summarySale; setSummarySale(null); handleOpenEvidenceModal(sale); }}>
                      {summarySale.paymentEvidence ? <ImageIcon className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                      Evidencia
                    </Button>
                  )}
                  {!isCancelled && (
                    <Button variant="admin-danger" size="sm" onClick={() => { const sale = summarySale; setSummarySale(null); handleCancelSale(sale); }}>
                      <Trash2 className="w-4 h-4" />
                      Anular
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
