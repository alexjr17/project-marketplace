// API Base Service
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Origen del backend (VITE_API_URL sin "/api"), para resolver imágenes.
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

// El backend devuelve rutas de imágenes RELATIVAS ("/uploads/..."). En
// producción el front está en otro dominio, así que esas rutas darían 404.
// Esta función recorre la respuesta y las convierte en absolutas hacia el
// backend. Es idempotente: ignora strings que ya contienen el origen.
function absolutizeUploads(node: any): void {
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (typeof val === 'string') {
      if (val.includes('/uploads/') && !val.includes(API_ORIGIN)) {
        node[key] = val.replace(/\/uploads\//g, `${API_ORIGIN}/uploads/`);
      }
    } else if (val && typeof val === 'object') {
      absolutizeUploads(val);
    }
  }
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private getToken(): string | null {
    const authData = localStorage.getItem('marketplace_auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        return parsed.token;
      } catch {
        return null;
      }
    }
    return null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = this.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();
      absolutizeUploads(data);

      if (!response.ok) {
        if (response.status === 401) {
          // Un 401 en una petición CON token = la sesión realmente expiró:
          // limpiamos y avisamos a AuthContext para cerrar sesión.
          if (token) {
            localStorage.removeItem('marketplace_auth');
            window.dispatchEvent(new CustomEvent('auth:token-expired'));
            throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
          }
          // Un 401 SIN token = login/registro rechazado: mostramos el motivo
          // real del backend (ej. "Credenciales inválidas"), no "sesión expirada".
          throw new Error(data.message || 'Correo o contraseña incorrectos');
        }
        throw new Error(data.message || 'Error en la solicitud');
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error de conexión con el servidor');
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const queryString = params
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';

    return this.request<T>(`${endpoint}${queryString}`);
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
export default api;
