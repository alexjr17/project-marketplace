import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Role } from '../types/roles';
import { rolesService } from '../services/roles.service';
import type { ApiRole, CreateRoleInput, UpdateRoleInput } from '../services/roles.service';
import { useAuth } from './AuthContext';

interface RolesContextType {
  roles: Role[];
  isLoading: boolean;
  error: string | null;
  getRoleById: (id: number) => Promise<Role | undefined>;
  createRole: (role: Omit<Role, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>) => Promise<Role>;
  updateRole: (id: number, updates: Partial<Omit<Role, 'id' | 'isSystem'>>) => Promise<void>;
  deleteRole: (id: number) => Promise<boolean>;
  getAvailableRolesForAssignment: () => Role[];
  assignRoleToUser: (userId: string, roleId: number) => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const RolesContext = createContext<RolesContextType | undefined>(undefined);

// Mapear API Role a Role local
const mapApiRoleToRole = (apiRole: ApiRole): Role => {
  return {
    id: apiRole.id,
    name: apiRole.name,
    description: apiRole.description,
    permissions: apiRole.permissions,
    isSystem: apiRole.isSystem,
    isActive: apiRole.isActive,
    createdAt: new Date(apiRole.createdAt),
    updatedAt: new Date(apiRole.updatedAt),
  };
};

export const RolesProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, user, hasPermission } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Los roles solo los consulta quien los administra (la API los limita a roles.view; antes
  // cualquier usuario del panel los pedía y recibía 403 en cada pantalla).
  const isAdmin = Boolean(isAuthenticated && user && hasPermission('roles.view'));

  // Cargar roles desde la API (solo para admins)
  const loadRoles = useCallback(async () => {
    // Solo cargar si está autenticado y es admin
    if (!isAdmin) {
      setRoles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await rolesService.getAll({ limit: 100 });
      setRoles(response.data.map(mapApiRoleToRole));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando roles';
      setError(message);
      console.error('Error loading roles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Cargar al montar (solo si es admin)
  useEffect(() => {
    if (isAdmin) {
      loadRoles();
    }
  }, [isAdmin, loadRoles]);

  const getRoleById = async (id: number): Promise<Role | undefined> => {
    // Primero buscar en cache local
    const cached = roles.find((r) => r.id === id);
    if (cached) return cached;

    // Si no esta en cache, buscar en API
    try {
      const apiRole = await rolesService.getById(id);
      if (apiRole) {
        return mapApiRoleToRole(apiRole);
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const createRole = async (
    roleData: Omit<Role, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>
  ): Promise<Role> => {
    const input: CreateRoleInput = {
      name: roleData.name,
      description: roleData.description,
      permissions: roleData.permissions,
      isActive: roleData.isActive,
    };

    const created = await rolesService.create(input);
    const newRole = mapApiRoleToRole(created);
    setRoles((prev) => [...prev, newRole]);
    return newRole;
  };

  const updateRole = async (
    id: number,
    updates: Partial<Omit<Role, 'id' | 'isSystem'>>
  ): Promise<void> => {
    const role = roles.find((r) => r.id === id);

    // No permitir editar roles del sistema
    if (!role || role.isSystem) {
      throw new Error('No se puede editar un rol del sistema');
    }

    const input: UpdateRoleInput = {
      name: updates.name,
      description: updates.description,
      permissions: updates.permissions,
      isActive: updates.isActive,
    };

    const updated = await rolesService.update(id, input);
    setRoles((prev) => prev.map((r) => (r.id === id ? mapApiRoleToRole(updated) : r)));
  };

  const deleteRole = async (id: number): Promise<boolean> => {
    const role = roles.find((r) => r.id === id);

    // No permitir eliminar roles del sistema
    if (!role || role.isSystem) {
      throw new Error('No se puede eliminar un rol del sistema');
    }

    await rolesService.delete(id);
    setRoles((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  // Obtener roles que se pueden asignar a usuarios administrativos
  // Estructura: roleId 1 = SuperAdmin, roleId 2 = Cliente, roleId 3+ = Admins
  const getAvailableRolesForAssignment = (): Role[] => {
    // Excluir SuperAdmin (1) y Cliente (2) - solo mostrar roles 3+
    return roles.filter((r) => r.id !== 1 && r.id !== 2 && r.isActive);
  };

  const assignRoleToUser = async (userId: string, roleId: number): Promise<void> => {
    await rolesService.assignToUser(userId, roleId);
  };

  const refreshRoles = async (): Promise<void> => {
    await loadRoles();
  };

  return (
    <RolesContext.Provider
      value={{
        roles,
        isLoading,
        error,
        getRoleById,
        createRole,
        updateRole,
        deleteRole,
        getAvailableRolesForAssignment,
        assignRoleToUser,
        refreshRoles,
      }}
    >
      {children}
    </RolesContext.Provider>
  );
};

export const useRoles = () => {
  const context = useContext(RolesContext);
  if (context === undefined) {
    throw new Error('useRoles must be used within a RolesProvider');
  }
  return context;
};
