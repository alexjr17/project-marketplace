import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services';
import type { AuthResponse, User as ApiUser } from '../services/auth.service';

export interface UserProfile {
  phone?: string;
  cedula?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  roleId: number;
  roleName: string;
  permissions: string[];
  status: string;
  createdAt: Date;
  profile?: UserProfile;
}

export interface Role {
  id: number;
  name: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile> & { name?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  validateResetToken: (token: string, email: string) => Promise<boolean>;
  resetPassword: (token: string, email: string, password: string) => Promise<void>;
  // Helpers de permisos
  hasPermission: (permission: string) => boolean;
  hasModuleAccess: (module: string) => boolean;
  canAccessAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mapear usuario de API a usuario local
const mapApiUserToUser = (apiUser: ApiUser, storedAuth?: AuthResponse | null): User => {
  return {
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.name,
    phone: apiUser.phone,
    avatar: apiUser.avatar,
    roleId: apiUser.roleId,
    roleName: apiUser.role,
    permissions: apiUser.permissions || [],
    status: apiUser.status,
    createdAt: new Date(),
    profile: {
      phone: apiUser.phone || apiUser.profile?.phone,
      cedula: apiUser.profile?.cedula,
      address: apiUser.profile?.address,
      city: apiUser.profile?.city,
      postalCode: apiUser.profile?.postalCode,
      country: apiUser.profile?.country,
    },
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasRedirectedRef = useRef(false);

  // Cargar usuario desde localStorage al iniciar
  useEffect(() => {
    const storedAuth = authService.getStoredAuth();
    if (storedAuth?.user) {
      setUser(mapApiUserToUser(storedAuth.user, storedAuth));
    }
    setIsLoading(false);
  }, []);

  // Escuchar evento de token expirado para cerrar sesión automáticamente
  useEffect(() => {
    const handleTokenExpired = () => {
      // Evitar múltiples redirecciones
      if (hasRedirectedRef.current) return;
      hasRedirectedRef.current = true;

      // Limpiar estado de usuario
      setUser(null);

      // Redirigir a inicio si estamos en rutas protegidas
      const currentPath = window.location.pathname;
      // Si estamos en una ruta protegida, redirigir al inicio
      if (currentPath.includes('/admin-panel') || currentPath.includes('/pos') || currentPath.includes('/profile') || currentPath.includes('/my-orders')) {
        window.location.href = '/?session=expired';
      }

      // Reset flag después de un tiempo
      setTimeout(() => {
        hasRedirectedRef.current = false;
      }, 1000);
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);
    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
    };
  }, []);

  // Obtener rol del usuario
  const role: Role | null = user
    ? {
        id: user.roleId,
        name: user.roleName,
        permissions: user.permissions,
      }
    : null;

  // Login
  const login = async (email: string, password: string): Promise<void> => {
    const response = await authService.login({ email, password });
    setUser(mapApiUserToUser(response.user, response));
  };

  // Registro
  const register = async (
    email: string,
    password: string,
    name: string,
    phone?: string
  ): Promise<void> => {
    const response = await authService.register({ email, password, name, phone });
    setUser(mapApiUserToUser(response.user, response));
  };

  // Recuperar contraseña
  const requestPasswordReset = async (email: string): Promise<void> => {
    await authService.requestPasswordReset(email);
  };

  // Validar token de reset
  const validateResetToken = async (token: string, email: string): Promise<boolean> => {
    return authService.validateResetToken(token, email);
  };

  // Resetear contraseña
  const resetPassword = async (token: string, _email: string, password: string): Promise<void> => {
    await authService.resetPassword(token, password);
  };

  // Logout
  const logout = () => {
    authService.logout();
    setUser(null);
  };

  // Actualizar perfil
  const updateProfile = async (
    profileData: Partial<UserProfile> & { name?: string }
  ): Promise<void> => {
    const updated = await authService.updateProfile(profileData);
    setUser((prev) =>
      prev
        ? {
            ...prev,
            name: updated.name || prev.name,
            phone: updated.phone || prev.phone,
            avatar: updated.avatar || prev.avatar,
            profile: {
              ...prev.profile,
              phone: updated.phone || updated.profile?.phone || prev.profile?.phone,
              cedula: updated.profile?.cedula || prev.profile?.cedula,
              address: updated.profile?.address || prev.profile?.address,
              city: updated.profile?.city || prev.profile?.city,
              postalCode: updated.profile?.postalCode || prev.profile?.postalCode,
              country: updated.profile?.country || prev.profile?.country,
            },
          }
        : null
    );
  };

  // Refrescar usuario desde API
  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const apiUser = await authService.getProfile();
      setUser(mapApiUserToUser(apiUser));
    } catch {
      // Si falla, probablemente el token expiró
      logout();
    }
  }, []);

  // Verificar permiso
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      // SuperAdmin tiene todos los permisos
      if (user.roleId === 1) return true;
      return user.permissions.includes(permission);
    },
    [user]
  );

  // Verificar acceso a módulo
  const hasModuleAccess = useCallback(
    (module: string): boolean => {
      if (!user) return false;
      // SuperAdmin tiene acceso a todos los módulos
      if (user.roleId === 1) return true;
      // Verificar si tiene algún permiso del módulo
      return user.permissions.some((p) => p.startsWith(`${module}.`));
    },
    [user]
  );

  // Verificar acceso al admin
  // Estructura de roles:
  // - roleId 1: SuperAdmin (acceso total)
  // - roleId 2: Cliente (SIN acceso al panel admin)
  // - roleId 3+: Roles administrativos (CON acceso al panel admin)
  const canAccessAdmin = useCallback((): boolean => {
    if (!user) return false;
    // SuperAdmin (roleId 1): acceso total
    if (user.roleId === 1) return true;
    // Cliente (roleId 2) NO tiene acceso al panel admin
    if (user.roleId === 2) return false;
    // Roles administrativos: acceso explícito (admin.access) o cualquier
    // permiso de un módulo administrativo. Un rol enfocado (p. ej. solo POS)
    // sin permisos de admin no verá el panel.
    const ADMIN_PREFIXES = [
      'admin.', 'dashboard.', 'orders.', 'products.', 'catalogs.',
      'inventory.', 'production.', 'shipping.', 'users.', 'admins.', 'roles.', 'settings.',
    ];
    return user.permissions.some((p) => ADMIN_PREFIXES.some((pre) => p.startsWith(pre)));
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isSuperAdmin: user?.roleId === 1,
        isAdmin: canAccessAdmin(),
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        refreshUser,
        requestPasswordReset,
        validateResetToken,
        resetPassword,
        hasPermission,
        hasModuleAccess,
        canAccessAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
