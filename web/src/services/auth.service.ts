import api from './api.service';
import type { AuthUser } from '../types/user';
import { AUTH_STORAGE_KEY } from '../lib/config';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export const authService = {
  // Login
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    if (!response.data) throw new Error(response.message || 'Error en el login');

    // Guardar en localStorage
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.data));

    return response.data;
  },

  // Registro
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    if (!response.data) throw new Error(response.message || 'Error en el registro');

    // Guardar en localStorage
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.data));

    return response.data;
  },

  // Obtener perfil
  async getProfile(): Promise<AuthUser> {
    // /auth/me responde { user: {...} } dentro de data.
    const response = await api.get<{ user: AuthUser }>('/auth/me');
    if (!response.data?.user) throw new Error('No autenticado');
    return response.data.user;
  },

  // Actualiza el usuario guardado (permisos frescos) sin tocar el token.
  updateStoredUser(user: AuthUser): void {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return;
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...JSON.parse(stored), user }));
    } catch {
      /* almacenamiento no disponible */
    }
  },

  // Actualizar perfil
  async updateProfile(data: Partial<AuthUser>): Promise<AuthUser> {
    const response = await api.put<AuthUser>('/auth/me', data);
    if (!response.data) throw new Error('Error actualizando perfil');

    // Actualizar en localStorage
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const auth = JSON.parse(stored);
      auth.user = { ...auth.user, ...response.data };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
    }

    return response.data;
  },

  // Cambiar contraseña
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/auth/change-password', { currentPassword, newPassword });
  },

  // Solicitar recuperación de contraseña
  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  // Validar token de reset (verificación básica de formato)
  // La validación real ocurre en el backend al resetear
  async validateResetToken(token: string, _email: string): Promise<boolean> {
    // Verificar que el token tenga formato válido (64 caracteres hex)
    if (!token || token.length !== 64) {
      return false;
    }
    // Si el token tiene formato correcto, asumimos que es válido
    // El backend validará el token real al hacer el reset
    return true;
  },

  // Restablecer contraseña
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, password: newPassword });
  },

  // Logout: revoca el token en el servidor y borra la sesión local. Antes solo se borraba
  // el localStorage y el token seguía válido. La petición toma el token al iniciarse, así
  // que se puede borrar el almacenamiento enseguida sin esperar la respuesta.
  logout(): void {
    if (localStorage.getItem(AUTH_STORAGE_KEY)) {
      void api.post('/auth/logout').catch(() => { /* sin red: el token igual vence */ });
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  // Obtener datos de auth del localStorage
  getStoredAuth(): AuthResponse | null {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  },

  // Verificar si está autenticado
  isAuthenticated(): boolean {
    return this.getStoredAuth() !== null;
  },

  // Verificar si es admin
  isAdmin(): boolean {
    const auth = this.getStoredAuth();
    return auth?.user?.roleId === 1;
  },

  // Verificar si tiene un permiso específico
  hasPermission(permission: string): boolean {
    const auth = this.getStoredAuth();
    return auth?.user?.permissions?.includes(permission) || false;
  },
};

export default authService;
