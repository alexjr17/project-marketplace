import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { User, Package, LogOut, ChevronDown, Heart } from 'lucide-react';
import { useFavorites } from '../../context/FavoritesContext';

interface UserMenuProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const UserMenu = ({ onLoginClick, onRegisterClick }: UserMenuProps) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings } = useSettings();
  const { count: favoritesCount } = useFavorites();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradientBgStyle = `linear-gradient(to bottom right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2.5 rounded-full hover:bg-gray-100 transition-all group overflow-hidden"
        >
          <User
            className="w-6 h-6 text-gray-700 group-hover:text-white transition-colors relative z-10"
            strokeWidth={2}
          />
          {/* Fondo con gradiente dinámico en hover */}
          <div
            className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: gradientBgStyle }}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 animate-fade-in-up">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm text-gray-600">Bienvenido</p>
              <p className="text-xs text-gray-500 mt-1">Inicia sesión para continuar</p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                onLoginClick();
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Iniciar Sesión
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onRegisterClick();
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Registrarse
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 pr-3 rounded-lg hover:bg-gray-100 transition-all group"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: gradientBgStyle }}
        >
          <span className="text-white text-sm font-bold">
            {user?.name.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-600 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && user && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 animate-fade-in-up">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500 mt-1">{user.email}</p>
          </div>

          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            Mi Perfil
          </Link>

          <Link
            to="/my-orders"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            Mis Pedidos
          </Link>

          <Link
            to="/favorites"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Mis Favoritos
            </span>
            {favoritesCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {favoritesCount}
              </span>
            )}
          </Link>

          <div className="my-2 border-t border-gray-100"></div>

          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
};
