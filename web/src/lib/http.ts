/**
 * Cliente HTTP ÚNICO del front. Todas las llamadas al API pasan por aquí
 * (directamente o a través de services/api.service.ts, que expone el sobre completo).
 *
 * - Token: se lee de localStorage (marketplace_auth) en cada petición.
 * - 401 con token (y fuera del login): borra la sesión y dispara `auth:token-expired`.
 * - Errores: siempre `ApiError` con status, message del backend y `errors` (422 por campo).
 * - Respuestas vacías (204) o no-JSON no revientan con SyntaxError.
 * - Fallo de red: ApiError(0, "Error de conexión con el servidor").
 * - Rutas relativas "/uploads/..." se vuelven absolutas hacia el backend (configurable).
 */
import { API_ORIGIN, API_URL, AUTH_STORAGE_KEY } from './config';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** Parámetros de query: cualquier objeto plano (undefined, null y '' se omiten). */
export type QueryParams = object;

/** Paginación tal como la manda el API. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Sobre estándar del API Laravel: { success, message?, data?, pagination?, ... }. */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: PageMeta;
  meta?: Record<string, unknown>;
  [extra: string]: unknown;
}

/** Lista paginada normalizada (venga en `pagination`, en `meta` o anidada en `data`). */
export interface Paged<T> extends PageMeta {
  items: T[];
}

export interface RequestOptions {
  params?: QueryParams;
  /** Objeto (se envía como JSON) o FormData (se envía tal cual). */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Convierte "/uploads/..." en URL absoluta del backend. Por defecto true. */
  absolutizeUploads?: boolean;
}

/** Error de una petición al API. */
export class ApiError extends Error {
  readonly status: number;
  /** Errores de validación por campo (422): { email: ['El email es requerido'] }. */
  readonly errors?: Record<string, string[]>;
  /** Cuerpo de la respuesta (si era JSON). */
  readonly body?: unknown;

  constructor(status: number, message: string, errors?: Record<string, string[]>, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.body = body;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Mensaje legible de cualquier error (ApiError, Error o desconocido). */
export function errorMessage(e: unknown, fallback = 'Error en la solicitud'): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

// ---------------------------------------------------------------------------

/** Token de la sesión guardada, o null. */
export function getAuthToken(): string | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.token ?? null;
  } catch {
    return null;
  }
}

/** Arma el query string omitiendo undefined, null y ''. Sin parámetros útiles no agrega "?". */
export function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const qs = new URLSearchParams(
    Object.entries(params as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return qs ? `?${qs}` : '';
}

/** URL absoluta de un endpoint del API ("/orders" → "http://.../api/orders"). */
export function apiUrl(path: string, params?: QueryParams): string {
  const base = /^https?:\/\//.test(path) ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  return `${base}${buildQuery(params)}`;
}

// "/uploads/" que NO va precedido de algo que forme parte de una URL (letra, dígito, ".", ":", "/", "-"):
// así solo se reescriben rutas relativas del mismo origen y nunca URLs de otros dominios
// ni las que ya traen el origen del backend.
const RELATIVE_UPLOADS = /(^|[^\w.:/-])\/uploads\//g;

function absolutizeString(value: string): string {
  if (!value.includes('/uploads/')) return value;
  return value.replace(RELATIVE_UPLOADS, `$1${API_ORIGIN}/uploads/`);
}

/** Recorre la respuesta y vuelve absolutas las rutas relativas "/uploads/...". Muta el objeto. */
export function absolutizeUploads(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') obj[key] = absolutizeString(val);
    else if (val && typeof val === 'object') absolutizeUploads(val);
  }
}

const isLoginRequest = (path: string) => /\/auth\/login(\?|$)/.test(path);

function expireSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('auth:token-expired'));
}

interface Raw {
  response: Response;
  token: string | null;
}

async function send(method: HttpMethod, path: string, opts: RequestOptions, accept?: string): Promise<Raw> {
  const token = getAuthToken();
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(accept ? { Accept: accept } : {}),
    ...opts.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.body !== undefined && opts.body !== null) {
    body = isForm ? (opts.body as FormData) : JSON.stringify(opts.body);
  }

  try {
    const response = await fetch(apiUrl(path, opts.params), { method, headers, body, signal: opts.signal });
    return { response, token };
  } catch (e) {
    // Una cancelación (AbortController) se deja pasar tal cual para que quien llama la ignore.
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Error de conexión con el servidor');
  }
}

async function readJson(response: Response): Promise<{ json: unknown; isJson: boolean; empty: boolean }> {
  const text = await response.text();
  if (!text.trim()) return { json: null, isJson: false, empty: true };
  try {
    return { json: JSON.parse(text), isJson: true, empty: false };
  } catch {
    return { json: null, isJson: false, empty: false };
  }
}

/** Convierte una respuesta no-OK en ApiError (y cierra la sesión si el token expiró). */
function toError(path: string, status: number, token: string | null, json: unknown): ApiError {
  const body = (json && typeof json === 'object' ? json : {}) as { message?: unknown; errors?: unknown };
  const serverMessage = typeof body.message === 'string' && body.message ? body.message : undefined;
  const errors = body.errors && typeof body.errors === 'object' ? (body.errors as Record<string, string[]>) : undefined;

  if (status === 401) {
    // 401 CON token (fuera del login) = la sesión expiró: se limpia y AuthContext cierra sesión.
    if (token && !isLoginRequest(path)) {
      expireSession();
      return new ApiError(401, 'Sesión expirada. Por favor, inicia sesión nuevamente.', errors, json ?? undefined);
    }
    // 401 SIN token = login/registro rechazado: se muestra el motivo real del backend.
    return new ApiError(401, serverMessage || 'Correo o contraseña incorrectos', errors, json ?? undefined);
  }
  return new ApiError(status, serverMessage || 'Error en la solicitud', errors, json ?? undefined);
}

/** Petición que devuelve el sobre completo del API. 204/cuerpo vacío → { success: true }. */
async function envelope<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { response, token } = await send(method, path, opts);
  const { json, isJson, empty } = await readJson(response);
  if (isJson && opts.absolutizeUploads !== false) absolutizeUploads(json);

  if (!response.ok) throw toError(path, response.status, token, json);
  if (empty) return { success: true }; // 204 / cuerpo vacío
  if (!isJson) throw new ApiError(response.status, 'Respuesta inválida del servidor');
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return { success: true, data: json as T };
  return json as ApiEnvelope<T>;
}

/** Petición que devuelve solo `data` del sobre. */
async function request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
  const env = await envelope<T>(method, path, opts);
  return env.data as T;
}

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Normaliza cualquier forma de lista paginada del API a { items, page, limit, total, totalPages }. */
export function toPaged<T>(env: ApiEnvelope<unknown>): Paged<T> {
  let items: unknown = env.data;
  let meta: Record<string, unknown> | undefined = (env.pagination as Record<string, unknown> | undefined) ?? env.meta;

  // Algunos endpoints anidan: data: { data|items: [...], meta|pagination: {...} }
  if (items && !Array.isArray(items) && typeof items === 'object') {
    const inner = items as Record<string, unknown>;
    const list = inner.items ?? inner.data;
    if (Array.isArray(list)) {
      meta = (inner.pagination ?? inner.meta ?? meta) as Record<string, unknown> | undefined;
      items = list;
    }
  }
  const list = (Array.isArray(items) ? items : []) as T[];
  const m = meta ?? {};
  const limit = num(m.limit ?? m.perPage ?? m.per_page, list.length);
  const total = num(m.total, list.length);
  return {
    items: list,
    page: num(m.page ?? m.currentPage ?? m.current_page, 1),
    limit,
    total,
    totalPages: num(m.totalPages ?? m.lastPage ?? m.last_page, limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1),
  };
}

/** Descarga el cuerpo como Blob (PDF, imágenes), con token. */
async function blob(path: string, opts: RequestOptions & { method?: HttpMethod } = {}): Promise<Blob> {
  const { response, token } = await send(opts.method ?? 'GET', path, opts);
  if (!response.ok) {
    const { json } = await readJson(response);
    throw toError(path, response.status, token, json);
  }
  return response.blob();
}

export interface HttpClient {
  envelope: <T>(method: HttpMethod, path: string, opts?: RequestOptions) => Promise<ApiEnvelope<T>>;
  request: <T>(method: HttpMethod, path: string, opts?: RequestOptions) => Promise<T>;
  get: <T>(path: string, params?: QueryParams, opts?: RequestOptions) => Promise<T>;
  getPaged: <T>(path: string, params?: QueryParams, opts?: RequestOptions) => Promise<Paged<T>>;
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => Promise<T>;
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => Promise<T>;
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => Promise<T>;
  delete: <T = void>(path: string, opts?: RequestOptions) => Promise<T>;
  upload: <T>(path: string, form: FormData, opts?: RequestOptions & { method?: 'POST' | 'PUT' | 'PATCH' }) => Promise<T>;
  blob: (path: string, opts?: RequestOptions & { method?: HttpMethod }) => Promise<Blob>;
  /** Cliente con otras opciones por defecto (p. ej. { absolutizeUploads: false }). */
  withDefaults: (defaults: RequestOptions) => HttpClient;
}

function createClient(defaults: RequestOptions = {}): HttpClient {
  const merge = (opts?: RequestOptions): RequestOptions => ({
    ...defaults,
    ...opts,
    headers: { ...defaults.headers, ...opts?.headers },
  });
  return {
    envelope: (method, path, opts) => envelope(method, path, merge(opts)),
    request: (method, path, opts) => request(method, path, merge(opts)),
    get: (path, params, opts) => request('GET', path, merge({ ...opts, params })),
    getPaged: async <T,>(path: string, params?: QueryParams, opts?: RequestOptions) =>
      toPaged<T>(await envelope('GET', path, merge({ ...opts, params }))),
    post: (path, body, opts) => request('POST', path, merge({ ...opts, body })),
    put: (path, body, opts) => request('PUT', path, merge({ ...opts, body })),
    patch: (path, body, opts) => request('PATCH', path, merge({ ...opts, body })),
    delete: (path, opts) => request('DELETE', path, merge(opts)),
    upload: (path, form, opts) => request(opts?.method ?? 'POST', path, merge({ ...opts, body: form })),
    blob: (path, opts) => blob(path, { ...merge(opts), method: opts?.method }),
    withDefaults: (more) => createClient(merge(more)),
  };
}

export const http = createClient();
export default http;

/**
 * Cliente que NO reescribe las rutas "/uploads/...": las deja relativas, como las
 * consumían los servicios que antes usaban axios (POS, cajas, variantes, códigos de
 * barras, imágenes de diseño, anuncios, descuentos). Las imágenes del personalizador
 * se leen en <canvas> por el proxy /uploads del mismo origen y una URL absoluta al
 * backend (sin CORS en /uploads) las rompería.
 */
export const httpKeepUrls = http.withDefaults({ absolutizeUploads: false });
