export type UserRole = 'user' | 'admin' | 'superadmin';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface UserAddress {
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  /** roleId real (numérico) del backend; necesario para mostrar/editar el rol */
  roleId?: number;
  /** Nombre del rol asignado (p. ej. "Cajero y Productos") */
  roleName?: string;
  status: UserStatus;
  phone?: string;
  cedula?: string;
  avatar?: string;
  address?: UserAddress;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPassword extends User {
  password: string;
}

/** Datos de perfil del usuario autenticado (cédula, teléfono, dirección). */
export interface UserProfile {
  cedula?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

/** Usuario tal como lo devuelven /auth/login, /auth/register y /auth/me. */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  roleId: number;
  role: string;
  permissions: string[];
  status: string;
  profile?: UserProfile;
}

/** Usuario de la sesión, ya adaptado por AuthContext (useAuth().user). */
export interface SessionUser {
  id: number;
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

/** Rol de la sesión (useAuth().role): solo lo necesario para revisar permisos. */
export interface SessionRole {
  id: number;
  name: string;
  permissions: string[];
}
