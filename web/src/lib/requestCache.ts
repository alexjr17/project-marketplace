/**
 * Caché corta de peticiones de lectura por clave. Sirve para que un bloque de la tienda pida
 * sus datos UNA vez aunque el componente se monte dos veces (StrictMode en desarrollo, volver
 * a la portada, dos bloques con el mismo filtro): la segunda llamada reutiliza la promesa.
 *
 * Solo para lecturas públicas que pueden esperar unos segundos en refrescarse.
 */
const store = new Map<string, { at: number; promise: Promise<unknown> }>();

export function cachedRequest<T>(key: string, fetcher: () => Promise<T>, ttlMs = 60_000): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.promise as Promise<T>;

  const promise = fetcher().catch((err) => {
    // Un error no se queda en caché: el próximo intento vuelve a pedir.
    store.delete(key);
    throw err;
  });
  store.set(key, { at: now, promise });
  return promise;
}

/** Vacía la caché (p. ej. al cerrar sesión, porque el equipo ve otros datos). */
export function clearRequestCache(prefix = ''): void {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
