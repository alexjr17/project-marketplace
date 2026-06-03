import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, UserWithPassword, UserStatus } from '../types/user';
import { usersService } from '../services/users.service';
import type { ApiUser, CreateUserInput, UpdateUserInput } from '../services/users.service';
import { useAuth } from './AuthContext';

interface UsersContextType {
  users: User[];
  admins: User[];
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Users (Clientes)
  addUser: (user: Omit<UserWithPassword, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateUser: (id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  toggleUserStatus: (id: string) => Promise<void>;

  // Admins
  addAdmin: (
    admin: Omit<UserWithPassword, 'id' | 'createdAt' | 'updatedAt'> & { roleId?: number }
  ) => Promise<void>;
  updateAdmin: (
    id: string,
    updates: Partial<Omit<User, 'id' | 'createdAt'>> & { roleId?: number }
  ) => Promise<void>;
  deleteAdmin: (id: string) => Promise<void>;
  toggleAdminStatus: (id: string) => Promise<void>;

  // Helpers
  getUserById: (id: string) => Promise<User | undefined>;
  getAdminById: (id: string) => Promise<User | undefined>;
  refreshUsers: () => Promise<void>;
  setPage: (page: number) => void;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

// Mapear status de API a local
const mapApiStatus = (status: string): UserStatus => {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'INACTIVE':
      return 'inactive';
    case 'SUSPENDED':
      return 'suspended';
    default:
      return 'active';
  }
};

// Mapear status local a API
const mapLocalStatus = (status: UserStatus): 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' => {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'inactive':
      return 'INACTIVE';
    case 'suspended':
      return 'SUSPENDED';
    default:
      return 'ACTIVE';
  }
};

// Mapear API User a User local
// Estructura de roles:
// - roleId 1: SuperAdmin (sistema, no modificable)
// - roleId 2: Cliente (sistema, no modificable, SIN acceso admin)
// - roleId 3+: Roles administrativos personalizables (CON acceso admin)
const mapApiUserToUser = (apiUser: ApiUser): User => {
  // Determinar rol basado en roleId
  let role: 'user' | 'admin' | 'superadmin' = 'user';
  if (apiUser.roleId === 1) {
    role = 'superadmin';
  } else if (apiUser.roleId === 2) {
    role = 'user'; // Cliente - sin acceso admin
  } else if (apiUser.roleId >= 3) {
    role = 'admin'; // Roles 3+ son administrativos
  }

  return {
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.name,
    role,
    roleId: apiUser.roleId,
    roleName: typeof apiUser.role === 'string' ? apiUser.role : apiUser.role?.name,
    status: mapApiStatus(apiUser.status),
    phone: apiUser.phone,
    cedula: apiUser.cedula,
    avatar: apiUser.avatar,
    address: apiUser.addresses?.[0]
      ? {
          address: apiUser.addresses[0].address,
          city: apiUser.addresses[0].city,
          postalCode: apiUser.addresses[0].postalCode,
          country: apiUser.addresses[0].country,
        }
      : undefined,
    createdAt: new Date(apiUser.createdAt),
    updatedAt: new Date(apiUser.updatedAt),
  };
};

export const UsersProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user: authUser } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Verificar si es admin (roleId !== 2 significa que no es cliente)
  const isAdmin = isAuthenticated && authUser && authUser.roleId !== 2;

  // Cargar usuarios desde la API (solo para admins)
  const loadUsers = useCallback(async () => {
    // Solo cargar si está autenticado y es admin
    if (!isAdmin) {
      setAllUsers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await usersService.getAll({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      setAllUsers(response.data.map(mapApiUserToUser));
      setPagination(response.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando usuarios';
      setError(message);
      console.error('Error loading users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, pagination.page, pagination.limit]);

  // Cargar al montar (solo si es admin)
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin, loadUsers]);

  // Filtrar por rol
  const users = allUsers.filter((u) => u.role === 'user');
  const admins = allUsers.filter((u) => u.role === 'admin' || u.role === 'superadmin');

  // Metodos para Usuarios (Clientes)
  const addUser = async (
    userData: Omit<UserWithPassword, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    const input: CreateUserInput = {
      email: userData.email,
      password: userData.password,
      name: userData.name,
      phone: userData.phone,
      cedula: userData.cedula,
      roleId: 2, // Cliente (roleId 2 = sin acceso admin)
    };

    const created = await usersService.create(input);
    setAllUsers((prev) => [...prev, mapApiUserToUser(created)]);
  };

  const updateUser = async (
    id: string,
    updates: Partial<Omit<User, 'id' | 'createdAt'>>
  ): Promise<void> => {
    const input: UpdateUserInput = {
      name: updates.name,
      phone: updates.phone,
      cedula: updates.cedula,
      status: updates.status ? mapLocalStatus(updates.status) : undefined,
    };

    const updated = await usersService.update(id, input);
    setAllUsers((prev) => prev.map((u) => (u.id === id ? mapApiUserToUser(updated) : u)));
  };

  const deleteUser = async (id: string): Promise<void> => {
    await usersService.delete(id);
    setAllUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const toggleUserStatus = async (id: string): Promise<void> => {
    const user = allUsers.find((u) => u.id === id);
    if (!user) return;

    const newStatus = user.status === 'active' ? 'INACTIVE' : 'ACTIVE';
    const updated = await usersService.changeStatus(id, newStatus as 'ACTIVE' | 'INACTIVE');
    setAllUsers((prev) => prev.map((u) => (u.id === id ? mapApiUserToUser(updated) : u)));
  };

  // Metodos para Administradores
  const addAdmin = async (
    adminData: Omit<UserWithPassword, 'id' | 'createdAt' | 'updatedAt'> & { roleId?: number }
  ): Promise<void> => {
    const input: CreateUserInput = {
      email: adminData.email,
      password: adminData.password,
      name: adminData.name,
      phone: adminData.phone,
      cedula: adminData.cedula,
      roleId: adminData.roleId || 3, // Administrador por defecto (roleId 3+ = con acceso admin)
    };

    const created = await usersService.create(input);
    setAllUsers((prev) => [...prev, mapApiUserToUser(created)]);
  };

  const updateAdmin = async (
    id: string,
    updates: Partial<Omit<User, 'id' | 'createdAt'>> & { roleId?: number }
  ): Promise<void> => {
    const input: UpdateUserInput = {
      name: updates.name,
      phone: updates.phone,
      cedula: updates.cedula,
      roleId: updates.roleId,
      status: updates.status ? mapLocalStatus(updates.status) : undefined,
    };

    const updated = await usersService.update(id, input);
    setAllUsers((prev) => prev.map((u) => (u.id === id ? mapApiUserToUser(updated) : u)));
  };

  const deleteAdmin = async (id: string): Promise<void> => {
    // No permitir eliminar superadmin
    const admin = allUsers.find((u) => u.id === id);
    if (admin?.role === 'superadmin') {
      throw new Error('No se puede eliminar el superadmin');
    }

    await usersService.delete(id);
    setAllUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const toggleAdminStatus = async (id: string): Promise<void> => {
    const admin = allUsers.find((u) => u.id === id);
    if (!admin) return;

    // No permitir desactivar superadmin
    if (admin.role === 'superadmin') {
      throw new Error('No se puede desactivar el superadmin');
    }

    const newStatus = admin.status === 'active' ? 'INACTIVE' : 'ACTIVE';
    const updated = await usersService.changeStatus(id, newStatus as 'ACTIVE' | 'INACTIVE');
    setAllUsers((prev) => prev.map((u) => (u.id === id ? mapApiUserToUser(updated) : u)));
  };

  // Helpers
  const getUserById = async (id: string): Promise<User | undefined> => {
    // Primero buscar en cache local
    const cached = allUsers.find((u) => u.id === id && u.role === 'user');
    if (cached) return cached;

    // Si no esta en cache, buscar en API
    try {
      const apiUser = await usersService.getById(id);
      if (apiUser) {
        return mapApiUserToUser(apiUser);
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const getAdminById = async (id: string): Promise<User | undefined> => {
    // Primero buscar en cache local
    const cached = allUsers.find(
      (u) => u.id === id && (u.role === 'admin' || u.role === 'superadmin')
    );
    if (cached) return cached;

    // Si no esta en cache, buscar en API
    try {
      const apiUser = await usersService.getById(id);
      if (apiUser) {
        return mapApiUserToUser(apiUser);
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const refreshUsers = async (): Promise<void> => {
    await loadUsers();
  };

  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  return (
    <UsersContext.Provider
      value={{
        users,
        admins,
        isLoading,
        error,
        pagination,
        addUser,
        updateUser,
        deleteUser,
        toggleUserStatus,
        addAdmin,
        updateAdmin,
        deleteAdmin,
        toggleAdminStatus,
        getUserById,
        getAdminById,
        refreshUsers,
        setPage,
      }}
    >
      {children}
    </UsersContext.Provider>
  );
};

export const useUsers = () => {
  const context = useContext(UsersContext);
  if (context === undefined) {
    throw new Error('useUsers must be used within a UsersProvider');
  }
  return context;
};
