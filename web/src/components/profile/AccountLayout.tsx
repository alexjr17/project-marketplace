import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Heart, Package, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StoreContainer } from '../shared/StoreContainer';

const LINKS = [
  { to: '/profile', label: 'Mi perfil', icon: User },
  { to: '/my-orders', label: 'Mis pedidos', icon: Package },
  { to: '/favorites', label: 'Favoritos', icon: Heart },
];

/**
 * Páginas de "Mi cuenta" (perfil, pedidos, favoritos): menú de la cuenta a la izquierda en
 * escritorio y como pestañas deslizables en celular. Sin sesión, solo el contenido.
 */
export function AccountLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <StoreContainer>{children}</StoreContainer>;

  const item = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      active ? 'bg-app-50 text-app-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  return (
    <StoreContainer>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4 lg:gap-6 items-start">
        <nav
          aria-label="Mi cuenta"
          className="bg-white rounded-xl border border-gray-200 p-1.5 flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide lg:sticky"
          style={{ top: 'calc(var(--store-header-h, 120px) + 1rem)' }}
        >
          <div className="hidden lg:flex items-center gap-2.5 px-2.5 py-2 mb-1 border-b border-gray-100">
            <span className="w-8 h-8 rounded-full bg-app-100 text-app-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900 truncate">{user.name}</span>
              <span className="block text-xs text-gray-500 truncate">{user.email}</span>
            </span>
          </div>
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `${item(isActive)} px-3 py-2 flex-shrink-0`}>
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </StoreContainer>
  );
}
