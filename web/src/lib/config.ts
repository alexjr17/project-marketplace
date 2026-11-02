/**
 * Configuración de conexión con el API. Es el ÚNICO lugar donde se lee VITE_API_URL:
 * el cliente HTTP (lib/http.ts), las imágenes (utils/assetUrl.ts) y cualquier URL
 * hacia el backend salen de aquí.
 */

/** Base del API, p. ej. "http://localhost:8000/api" (sin "/" final). */
export const API_URL: string = String(import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');

/** Origen del backend (API_URL sin "/api"), para archivos servidos en /uploads. */
export const API_ORIGIN: string = API_URL.replace(/\/api$/, '');

/** Clave de localStorage donde authService guarda { token, user }. */
export const AUTH_STORAGE_KEY = 'marketplace_auth';
