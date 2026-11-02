import { useState, useEffect } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { Button, Spinner } from '../ui';
import * as posService from '../../services/pos.service';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: number;
  orderNumber?: string;
}

export const PrintPreviewModal = ({
  isOpen,
  onClose,
  saleId,
  orderNumber,
}: PrintPreviewModalProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (isOpen && saleId) {
      loadPdf();
    }

    return () => {
      // Cleanup blob URL when modal closes
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [isOpen, saleId]);

  const loadPdf = async () => {
    try {
      setLoading(true);
      const blob = await posService.getInvoicePDFBlob(saleId);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error('Error loading PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);

    try {
      // Close modal first
      onClose();

      // Use the printInvoicePDF service which fetches a fresh blob
      await posService.printInvoicePDF(saleId);
    } catch (error) {
      console.error('Error printing:', error);
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Factura_${orderNumber || saleId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Vista previa de factura</h2>
            {orderNumber && <p className="text-sm text-gray-500 mt-0.5">Factura #{orderNumber}</p>}
          </div>
          <button onClick={onClose} title="Cerrar" className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-hidden bg-gray-100 p-4">
          {loading ? (
            <Spinner label="Cargando factura…" className="h-full" />
          ) : pdfUrl ? (
            <div className="h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
              <iframe src={pdfUrl} className="w-full h-full min-h-[500px]" title="Vista previa de factura" />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-gray-500">Error al cargar la factura</p>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <Button variant="ghost" size="lg" icon={<Download className="w-4 h-4" />} onClick={handleDownload} disabled={!pdfUrl || loading}>
            Descargar
          </Button>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="secondary" size="lg" onClick={onClose}>Cancelar</Button>
            <Button size="lg" icon={<Printer className="w-4 h-4" />} onClick={handlePrint} isLoading={printing} disabled={!pdfUrl || loading}>
              {printing ? 'Imprimiendo…' : 'Imprimir'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
