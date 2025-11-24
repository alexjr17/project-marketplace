import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Package, Settings, LogOut, ChevronDown } from 'lucide-react';

interface UserMenuProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const UserMenu = ({ onLoginClick, onRegisterClick }: UserMenuProps) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
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
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 rounded-lg hover:bg-gray-100 transition-all group"
        >
          <User
            className="w-6 h-6 text-gray-700 group-hover:text-violet-600 transition-colors"
            strokeWidth={2}
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
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Iniciar Sesión
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                onRegisterClick();
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors flex items-center gap-2"
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
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
            {isAdmin && (
              <span className="inline-block mt-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                Administrador
              </span>
            )}
          </div>

          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            Mi Perfil
          </Link>

          <Link
            to="/orders"
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            Mis Pedidos
          </Link>

          {isAdmin && (
            <>
              <div className="my-2 border-t border-gray-100"></div>
              <Link
                to="/admin-panel"
                onClick={() => setIsOpen(false)}
                className="w-full px-4 py-2.5 text-left text-sm text-orange-700 hover:bg-orange-50 transition-colors flex items-center gap-2 font-medium"
              >
                <Settings className="w-4 h-4" />
                Panel de Administración
              </Link>
            </>
          )}

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
