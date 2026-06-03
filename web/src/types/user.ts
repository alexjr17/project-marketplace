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
  address?: UserAddress;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPassword extends User {
  password: string;
}
