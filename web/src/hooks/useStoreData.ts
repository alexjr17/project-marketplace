import { useEffect, useRef, useState } from 'react';
import { cachedRequest } from '../lib/requestCache';

/**
 * Carga datos de un bloque de la tienda con una clave PRIMITIVA (string). El efecto solo
 * depende de la clave, así que recrear objetos de configuración no vuelve a pedir; y como
 * pasa por `cachedRequest`, montar el bloque dos veces (StrictMode) tampoco duplica la
 * petición. Con `key = null` no pide nada (bloque oculto o pestaña sin abrir).
 */
export function useStoreData<T>(key: string | null, fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: unknown }>({ key: null, data: null, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    cachedRequest(key, () => fetcherRef.current())
      .then((data) => { if (alive) setState({ key, data, error: null }); })
      .catch((error) => { if (alive) setState({ key, data: null, error }); });
    return () => { alive = false; };
  }, [key]);

  const ready = key !== null && state.key === key;
  return { data: ready ? state.data : null, error: ready ? state.error : null, loading: key !== null && !ready };
}
