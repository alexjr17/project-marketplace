/**
 * Estado con deshacer y rehacer (Ctrl+Z / Ctrl+Y). Los cambios seguidos del mismo control (un
 * deslizador, escribir en un campo) se juntan en un solo paso si llegan con la misma `merge`.
 */
import { useCallback, useRef, useState } from 'react';

const LIMIT = 60;
const MERGE_MS = 900;

export function useHistory<T>(initial: T | (() => T)) {
  const [h, setH] = useState(() => ({ past: [] as T[], present: typeof initial === 'function' ? (initial as () => T)() : initial, future: [] as T[] }));
  const last = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });

  const set = useCallback((next: T | ((cur: T) => T), merge?: string) => {
    // Se decide fuera del actualizador (React puede llamarlo dos veces en desarrollo).
    const now = Date.now();
    const join = !!merge && last.current.key === merge && now - last.current.at < MERGE_MS;
    last.current = { key: merge ?? null, at: now };
    setH((cur) => {
      const value = typeof next === 'function' ? (next as (c: T) => T)(cur.present) : next;
      if (Object.is(value, cur.present)) return cur;
      return { past: join && cur.past.length ? cur.past : [...cur.past, cur.present].slice(-LIMIT), present: value, future: [] };
    });
  }, []);

  /** Valor nuevo sin historial (al cambiar de producto o de guion completo se puede deshacer igual). */
  const reset = useCallback((value: T, keepHistory = false) => {
    last.current = { key: null, at: 0 };
    setH((cur) => (keepHistory ? { past: [...cur.past, cur.present].slice(-LIMIT), present: value, future: [] } : { past: [], present: value, future: [] }));
  }, []);

  const undo = useCallback(() => {
    last.current = { key: null, at: 0 };
    setH((cur) => (cur.past.length ? { past: cur.past.slice(0, -1), present: cur.past[cur.past.length - 1], future: [cur.present, ...cur.future] } : cur));
  }, []);

  const redo = useCallback(() => {
    last.current = { key: null, at: 0 };
    setH((cur) => (cur.future.length ? { past: [...cur.past, cur.present], present: cur.future[0], future: cur.future.slice(1) } : cur));
  }, []);

  return { value: h.present, set, reset, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0 };
}
