import api from './api.service';

export interface ApiUser {
  id: number;
  email: string;
  name: string;
  phone?: string;
  cedula?: string;
  avatar?: string;
  roleId: number;
  // El backend (formatUser) devuelve el nombre del rol como string; otros
  // endpoints pueden devolver el objeto completo.
  role?: string | {
    id: number;
    name: string;
    permissions: string[];
  };
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  addresses?: ApiAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiAddress {
  id: number;
  label: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  cedula?: string;
  roleId?: number;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string;
  cedula?: string;
  avatar?: string;
  roleId?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface UsersFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  roleId?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UsersResponse {
  data: ApiUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const usersService = {
  // Obtener todos los usuarios
  async getAll(filters?: UsersFilters): Promise<UsersResponse> {
    const response = await api.get<ApiUser[]>('/users', filters);
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

  // Obtener usuario por ID
  async getById(id: number): Promise<ApiUser | null> {
    try {
      const response = await api.get<ApiUser>(`/users/${id}`);
      return response.data || null;
    } catch {
      return null;
    }
  },

  // Crear usuario
  async create(data: CreateUserInput): Promise<ApiUser> {
    const response = await api.post<ApiUser>('/users', data);
    if (!response.data) throw new Error(response.message || 'Error creando usuario');
    return response.data;
  },

  // Actualizar usuario
  async update(id: number, data: UpdateUserInput): Promise<ApiUser> {
    const response = await api.put<ApiUser>(`/users/${id}`, data);
    if (!response.data) throw new Error(response.message || 'Error actualizando usuario');
    return response.data;
  },

  // Eliminar usuario
  async delete(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  // Cambiar estado del usuario
  async changeStatus(id: number, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): Promise<ApiUser> {
    const response = await api.patch<ApiUser>(`/users/${id}/status`, { status });
    if (!response.data) throw new Error('Error cambiando estado');
    return response.data;
  },

  // Obtener direcciones del usuario
  async getAddresses(userId: number): Promise<ApiAddress[]> {
    try {
      const response = await api.get<ApiAddress[]>(`/users/${userId}/addresses`);
      return response.data || [];
    } catch {
      return [];
    }
  },

  // Agregar dirección
  async addAddress(
    userId: number,
    address: Omit<ApiAddress, 'id'>
  ): Promise<ApiAddress> {
    const response = await api.post<ApiAddress>(`/users/${userId}/addresses`, address);
    if (!response.data) throw new Error('Error agregando dirección');
    return response.data;
  },

  // Actualizar dirección
  async updateAddress(
    userId: number,
    addressId: number,
    data: Partial<ApiAddress>
  ): Promise<ApiAddress> {
    const response = await api.put<ApiAddress>(`/users/${userId}/addresses/${addressId}`, data);
    if (!response.data) throw new Error('Error actualizando dirección');
    return response.data;
  },

  // Eliminar dirección
  async deleteAddress(userId: number, addressId: number): Promise<void> {
    await api.delete(`/users/${userId}/addresses/${addressId}`);
  },
};

export default usersService;
