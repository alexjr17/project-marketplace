import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui';
import { User, Package, LogOut, ChevronDown, Heart } from 'lucide-react';
import { useFavorites } from '../../context/FavoritesContext';

interface UserMenuProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const UserMenu = ({ onLoginClick, onRegisterClick }: UserMenuProps) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { count: favoritesCount } = useFavorites();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);


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
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Mi cuenta"
          aria-label="Mi cuenta"
          className={`p-2 rounded-lg transition-colors ${isOpen ? 'bg-app-50 text-app-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
        >
          <User className="w-5 h-5" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 animate-fade-in-up">
            <div className="px-4 pt-2 pb-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">Bienvenido</p>
              <p className="text-xs text-gray-500 mt-0.5">Inicia sesión para continuar</p>
            </div>
            <div className="p-3 space-y-2">
              <Button fullWidth onClick={() => { setIsOpen(false); onLoginClick(); }}>Iniciar sesión</Button>
              <Button fullWidth variant="secondary" onClick={() => { setIsOpen(false); onRegisterClick(); }}>Crear cuenta</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Mi cuenta"
        className="flex items-center gap-1.5 p-1 pr-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-app-100 text-app-700">
          <span className="text-sm font-semibold">
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
            Mi perfil
          </Link>

          <Link
            to="/my-orders"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            Mis pedidos
          </Link>

          <Link
            to="/favorites"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Mis favoritos
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
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};
