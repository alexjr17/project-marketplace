/**
 * Fachada del cliente HTTP (lib/http.ts) que devuelve el SOBRE completo del API
 * ({ success, message?, data?, pagination? }). La usan los servicios que leen
 * `response.data` / `response.pagination`. Token, 401, errores (ApiError) y rutas
 * /uploads los resuelve lib/http.ts: aquí no hay lógica propia.
 *
 * Para código nuevo se prefiere `http` (lib/http.ts), que devuelve `data` directo
 * y normaliza la paginación con `getPaged`.
 */
import { http, type ApiEnvelope, type QueryParams } from '../lib/http';

export type ApiResponse<T> = ApiEnvelope<T>;

export const api = {
  get: <T,>(endpoint: string, params?: QueryParams) => http.envelope<T>('GET', endpoint, { params }),
  post: <T,>(endpoint: string, body?: unknown) => http.envelope<T>('POST', endpoint, { body }),
  put: <T,>(endpoint: string, body?: unknown) => http.envelope<T>('PUT', endpoint, { body }),
  patch: <T,>(endpoint: string, body?: unknown) => http.envelope<T>('PATCH', endpoint, { body }),
  delete: <T,>(endpoint: string) => http.envelope<T>('DELETE', endpoint),
  /** GET que devuelve el cuerpo crudo como Blob (PDFs/imágenes), con el token incluido. */
  getBlob: (endpoint: string, params?: QueryParams) => http.blob(endpoint, { params }),
};

export default api;
