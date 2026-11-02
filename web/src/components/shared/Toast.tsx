import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const STYLES: Record<ToastType, { icon: typeof Info; cls: string; bar: string }> = {
  success: { icon: CheckCircle2, cls: 'text-green-600', bar: 'bg-green-500' },
  error: { icon: XCircle, cls: 'text-red-600', bar: 'bg-red-500' },
  warning: { icon: AlertTriangle, cls: 'text-amber-600', bar: 'bg-amber-500' },
  info: { icon: Info, cls: 'text-app-600', bar: 'bg-app-600' },
};

/** Aviso flotante: tarjeta blanca con icono de color según el tipo. Los errores duran más. */
export const Toast = ({ message, type = 'info', onClose, duration }: ToastProps) => {
  const ms = duration ?? (type === 'error' ? 6000 : 3500);
  useEffect(() => {
    if (ms <= 0) return;
    const timer = setTimeout(onClose, ms);
    return () => clearTimeout(timer);
  }, [ms, onClose]);

  const { icon: Icon, cls, bar } = STYLES[type];
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className="relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-3 shadow-lg animate-slide-in-right">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <Icon className={`mt-px h-5 w-5 flex-shrink-0 ${cls}`} />
      <p className="flex-1 text-sm text-gray-800">{message}</p>
      <button type="button" onClick={onClose} title="Cerrar" className="rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  onRemove: (id: string) => void;
}

export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => (
  <div className="fixed top-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2 sm:w-96">
    {toasts.map((toast) => (
      <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => onRemove(toast.id)} />
    ))}
  </div>
);
