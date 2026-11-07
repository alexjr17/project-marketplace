/**
 * Configuración de conexión con el API. Es el ÚNICO lugar donde se lee VITE_API_URL:
 * el cliente HTTP (lib/http.ts), las imágenes (utils/assetUrl.ts) y cualquier URL
 * hacia el backend salen de aquí.
 */

/** Base del API, p. ej. "http://localhost:8000/api" (sin "/" final). */
export const API_URL: string = sameHost(String(import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, ''));

/**
 * En desarrollo el API se configura como "localhost". Si la página se abre desde otro equipo
 * de la red (p. ej. el teléfono en http://192.168.1.11:5173), "localhost" sería ese equipo:
 * se usa el mismo host con el que se abrió la página.
 */
function sameHost(url: string): string {
  if (typeof window === 'undefined') return url;
  const page = window.location.hostname;
  if (!page || page === 'localhost' || page === '127.0.0.1') return url;
  return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/, `$1${page}`);
}

/** Origen del backend (API_URL sin "/api"), para archivos servidos en /uploads. */
export const API_ORIGIN: string = API_URL.replace(/\/api$/, '');

/** Clave de localStorage donde authService guarda { token, user }. */
export const AUTH_STORAGE_KEY = 'marketplace_auth';
