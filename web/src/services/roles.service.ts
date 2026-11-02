import api from './api.service';
import type { Permission } from '../types/roles';

export interface ApiRole {
  id: number;
  name: string;
  description: string;
  /** Claves de permiso (el catálogo del API es el mismo que types/roles.ts). */
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
  _count?: {
    users: number;
  };
  users?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleInput {
  name: string;
  description: string;
  permissions: string[];
  isActive?: boolean;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface RolesFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  includeUsers?: boolean;
}

export interface RolesResponse {
  data: ApiRole[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PermissionsResponse {
  permissions: string[];
  groups: Record<string, string[]>;
}

export interface RoleStats {
  totalRoles: number;
  activeRoles: number;
  inactiveRoles: number;
  distribution: {
    id: number;
    name: string;
    isSystem: boolean;
    isActive: boolean;
    userCount: number;
  }[];
}

export const rolesService = {
  // Obtener todos los roles
  async getAll(filters?: RolesFilters): Promise<RolesResponse> {
    const response = await api.get<ApiRole[]>('/roles', filters);
    return {
      data: response.data || [],
      pagination: response.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };
  },

  // Obtener rol por ID
  async getById(id: number, includeUsers = false): Promise<ApiRole | null> {
    try {
      const response = await api.get<ApiRole>(`/roles/${id}`, { includeUsers });
      return response.data || null;
    } catch {
      return null;
    }
  },

  // Crear rol
  async create(data: CreateRoleInput): Promise<ApiRole> {
    const response = await api.post<ApiRole>('/roles', data);
    if (!response.data) throw new Error(response.message || 'Error creando rol');
    return response.data;
  },

  // Actualizar rol
  async update(id: number, data: UpdateRoleInput): Promise<ApiRole> {
    const response = await api.put<ApiRole>(`/roles/${id}`, data);
    if (!response.data) throw new Error(response.message || 'Error actualizando rol');
    return response.data;
  },

  // Eliminar rol
  async delete(id: number): Promise<void> {
    await api.delete(`/roles/${id}`);
  },

  // Asignar rol a usuario
  async assignToUser(userId: string, roleId: number): Promise<void> {
    await api.post('/roles/assign', { userId, roleId });
  },

  // Obtener permisos disponibles
  async getPermissions(): Promise<PermissionsResponse> {
    const response = await api.get<PermissionsResponse>('/roles/permissions');
    return response.data || { permissions: [], groups: {} };
  },

  // Obtener estadisticas de roles
  async getStats(): Promise<RoleStats> {
    const response = await api.get<RoleStats>('/roles/stats');
    return (
      response.data || {
        totalRoles: 0,
        activeRoles: 0,
        inactiveRoles: 0,
        distribution: [],
      }
    );
  },
};

export default rolesService;
