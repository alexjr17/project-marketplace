import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** danger = eliminar / acción irreversible (botón rojo). */
  tone?: 'danger' | 'default';
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Reemplaza al confirm() del navegador: `if (!(await confirm({ title: '¿Eliminar…?', tone: 'danger' }))) return;` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    const parsed = typeof o === 'string' ? { title: o } : o;
    setOpts(parsed);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const close = (v: boolean) => { resolver.current?.(v); setOpts(null); };
  const danger = opts?.tone === 'danger';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/50" onClick={() => close(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5 animate-fade-in">
            <div className="flex gap-3">
              <div className={`p-2 rounded-full h-fit ${danger ? 'bg-red-100 text-red-600' : 'bg-app-100 text-app-600'}`}>
                {danger ? <AlertTriangle className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">{opts.title}</h3>
                {opts.message && <div className="text-sm text-gray-600 mt-1">{opts.message}</div>}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
              <Button variant="secondary" onClick={() => close(false)}>{opts.cancelText ?? 'Cancelar'}</Button>
              <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{opts.confirmText ?? (danger ? 'Eliminar' : 'Aceptar')}</Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
  return ctx;
}
