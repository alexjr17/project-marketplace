/**
 * Avisos de la app (éxito, error, info, advertencia). Es el ÚNICO sistema de avisos:
 * lo pinta ToastProvider (context/ToastContext). Se puede usar fuera de componentes:
 *   import toast from '../../lib/toast';  toast.success('Guardado');
 */
type Notify = (message: string) => void;
type Handlers = { success: Notify; error: Notify; info: Notify; warning: Notify };

const queue: [keyof Handlers, string][] = [];
let handlers: Handlers | null = null;

/** Lo llama ToastProvider al montarse; los avisos previos se muestran en ese momento. */
export function registerToastHandlers(h: Handlers | null) {
  handlers = h;
  if (h) queue.splice(0).forEach(([type, msg]) => h[type](msg));
}

const emit = (type: keyof Handlers) => (message: string) => {
  if (handlers) handlers[type](message);
  else queue.push([type, message]);
};

const toast = { success: emit('success'), error: emit('error'), info: emit('info'), warning: emit('warning') };

export default toast;
