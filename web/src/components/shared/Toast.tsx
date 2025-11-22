import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast = ({ message, type = 'info', onClose, duration = 3000 }: ToastProps) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const colors = {
    success: 'bg-green-500 text-white shadow-lg shadow-green-500/30',
    error: 'bg-red-500 text-white shadow-lg shadow-red-500/30',
    warning: 'bg-amber-500 text-white shadow-lg shadow-amber-500/30',
    info: 'bg-gradient-primary text-white shadow-xl shadow-violet-500/40',
  };

  return (
    <div
      className={`flex items-center gap-3 px-5 py-4 rounded-xl ${colors[type]} animate-slide-in-right backdrop-blur-sm`}
    >
      {icons[type]}
      <p className="flex-1 font-medium">{message}</p>
      <button
        onClick={onClose}
        className="hover:opacity-75 transition-opacity p-1 hover:bg-white/10 rounded-lg"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Container para múltiples toasts
interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  onRemove: (id: string) => void;
}

export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};
