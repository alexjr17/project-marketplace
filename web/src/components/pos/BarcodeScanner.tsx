import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Loader2, SwitchCamera, CheckCircle } from 'lucide-react';
import { Button } from '../ui';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

// Número de lecturas consecutivas requeridas para confirmar
const REQUIRED_CONFIRMATIONS = 3;

export default function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [confirmationCount, setConfirmationCount] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCodeRef = useRef<string | null>(null);
  const confirmCountRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setDetectedCode(null);
      setConfirmationCount(0);
      lastCodeRef.current = null;
      confirmCountRef.current = 0;
      initScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const initScanner = async () => {
    try {
      setError(null);
      setIsScanning(true);

      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);

        // Prefer back camera
        const backCameraIndex = devices.findIndex(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera')
        );
        const cameraIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
        setCurrentCameraIndex(cameraIndex);

        await startScanning(devices[cameraIndex].id);
      } else {
        setError('No se encontraron cámaras disponibles');
        setIsScanning(false);
      }
    } catch (err: any) {
      console.error('Error initializing scanner:', err);
      setError(err.message || 'Error al inicializar la cámara');
      setIsScanning(false);
    }
  };

  // Validar que el código tenga formato de código de barras válido
  const isValidBarcode = (code: string): boolean => {
    // Mínimo 4 caracteres, solo alfanuméricos y guiones
    if (code.length < 4) return false;
    // Patrón típico de códigos de barras (números o alfanuméricos)
    return /^[A-Za-z0-9\-]+$/.test(code);
  };

  const handleCodeDetected = (decodedText: string) => {
    // Validar formato básico
    if (!isValidBarcode(decodedText)) {
      return;
    }

    // Si es el mismo código que el anterior, incrementar contador
    if (decodedText === lastCodeRef.current) {
      confirmCountRef.current += 1;
      setConfirmationCount(confirmCountRef.current);
      setDetectedCode(decodedText);

      // Si alcanzamos las confirmaciones requeridas, aceptar
      if (confirmCountRef.current >= REQUIRED_CONFIRMATIONS) {
        handleScanSuccess(decodedText);
      }
    } else {
      // Nuevo código, reiniciar contador
      lastCodeRef.current = decodedText;
      confirmCountRef.current = 1;
      setConfirmationCount(1);
      setDetectedCode(decodedText);
    }
  };

  const startScanning = async (cameraId: string) => {
    try {
      // Stop previous scanner if exists
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // Ignore stop errors
        }
      }

      // Create new scanner
      scannerRef.current = new Html5Qrcode('barcode-scanner-container');

      await scannerRef.current.start(
        cameraId,
        {
          fps: 5, // Reducido para dar más tiempo al usuario
          qrbox: { width: 220, height: 120 }, // Zona más pequeña, más precisa
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // Error callback (ignore - scanning continues)
        }
      );

      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      setError('Error al iniciar el escáner');
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Ignore errors on stop
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanSuccess = (barcode: string) => {
    // Stop scanner and return result
    stopScanner();
    onScan(barcode);
    onClose();
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;

    // Reset confirmation when switching camera
    lastCodeRef.current = null;
    confirmCountRef.current = 0;
    setDetectedCode(null);
    setConfirmationCount(0);

    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanning(cameras[nextIndex].id);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Encabezado */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-app-100"><Camera className="w-5 h-5 text-app-600" /></div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Escanear código</h2>
              <p className="text-xs text-gray-500">Centra el código y mantén firme</p>
            </div>
          </div>
          <button onClick={handleClose} title="Cerrar" className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Área del escáner */}
        <div className="p-4">
          <div
            ref={containerRef}
            id="barcode-scanner-container"
            className="w-full bg-black rounded-lg overflow-hidden"
            style={{ minHeight: '300px' }}
          />

          {/* Progreso de confirmación */}
          {detectedCode && confirmationCount > 0 && confirmationCount < REQUIRED_CONFIRMATIONS && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-amber-900 truncate">Confirmando: {detectedCode}</p>
                <span className="text-xs text-amber-700">{confirmationCount}/{REQUIRED_CONFIRMATIONS}</span>
              </div>
              <div className="w-full bg-amber-200 rounded-full h-1.5">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${(confirmationCount / REQUIRED_CONFIRMATIONS) * 100}%` }}
                />
              </div>
              <p className="text-xs text-amber-700 mt-1">Mantén el código centrado…</p>
            </div>
          )}

          {/* Detectado (se ve un instante antes de cerrar) */}
          {confirmationCount >= REQUIRED_CONFIRMATIONS && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">¡Código detectado!</p>
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!isScanning && !error && (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-6 h-6 text-app-600 animate-spin" />
              <span className="ml-2 text-sm">Iniciando cámara…</span>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="secondary" size="lg" fullWidth onClick={handleClose}>Cancelar</Button>
          {cameras.length > 1 && (
            <Button variant="outline" size="lg" fullWidth icon={<SwitchCamera className="w-4 h-4" />} onClick={switchCamera}>
              Cambiar cámara
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
