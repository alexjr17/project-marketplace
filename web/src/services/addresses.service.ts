import api from './api.service';

/** Dirección de envío del usuario autenticado. */
export interface Address {
  id: number;
  label: string;
  address: string;
  city: string;
  department?: string | null;
  postalCode?: string | null;
  country: string;
  isDefault: boolean;
}

/** Datos para crear o actualizar una dirección. */
export interface AddressInput {
  label: string;
  address: string;
  city: string;
  department?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

/**
 * Direcciones del usuario autenticado. Usa los endpoints /users/addresses,
 * que operan siempre sobre el usuario del token (no requieren userId).
 */
export const addressesService = {
  // Listar mis direcciones (la predeterminada va primero).
  async list(): Promise<Address[]> {
    const res = await api.get<Address[]>('/users/addresses');
    return res.data || [];
  },

  // Crear una dirección.
  async create(data: AddressInput): Promise<Address> {
    const res = await api.post<Address>('/users/addresses', data);
    if (!res.data) throw new Error(res.message || 'Error al crear la dirección');
    return res.data;
  },

  // Actualizar una dirección.
  async update(id: number, data: AddressInput): Promise<Address> {
    const res = await api.put<Address>(`/users/addresses/${id}`, data);
    if (!res.data) throw new Error(res.message || 'Error al actualizar la dirección');
    return res.data;
  },

  // Eliminar una dirección.
  async remove(id: number): Promise<void> {
    await api.delete(`/users/addresses/${id}`);
  },

  // Marcar una dirección como predeterminada.
  async setDefault(id: number): Promise<Address> {
    const res = await api.patch<Address>(`/users/addresses/${id}/default`);
    if (!res.data) throw new Error(res.message || 'Error al marcar como predeterminada');
    return res.data;
  },
};

export default addressesService;
