import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'marketplace_auth';

// Mock users for Phase 1 (sin backend)
const MOCK_USERS: Array<User & { password: string }> = [
  {
    id: '1',
    email: 'admin@marketplace.com',
    password: 'admin123',
    name: 'Administrador',
    role: 'admin',
    createdAt: new Date(),
  },
  {
    id: '2',
    email: 'user@marketplace.com',
    password: 'user123',
    name: 'Usuario Demo',
    role: 'user',
    createdAt: new Date(),
  },
];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
        };
      } catch (e) {
        console.error('Error loading auth from localStorage:', e);
      }
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<void> => {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 500));

    const foundUser = MOCK_USERS.find(
      u => u.email === email && u.password === password
    );

    if (!foundUser) {
      throw new Error('Email o contraseña incorrectos');
    }

    const { password: _, ...userWithoutPassword } = foundUser;
    setUser(userWithoutPassword);
  };

  const register = async (email: string, password: string, name: string): Promise<void> => {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verificar si el email ya existe
    const emailExists = MOCK_USERS.some(u => u.email === email);
    if (emailExists) {
      throw new Error('Este email ya está registrado');
    }

    // Crear nuevo usuario (en memoria, se perderá al recargar)
    const newUser: User = {
      id: Date.now().toString(),
      email,
      name,
      role: 'user',
      createdAt: new Date(),
    };

    // En producción esto iría al backend
    MOCK_USERS.push({ ...newUser, password });
    setUser(newUser);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
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
