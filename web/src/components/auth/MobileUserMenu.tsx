import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Package, Settings, LogOut, X } from 'lucide-react';
import { useEffect } from 'react';

interface MobileUserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const MobileUserMenu = ({ isOpen, onClose, onLoginClick, onRegisterClick }: MobileUserMenuProps) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = () => {
    logout();
    onClose();
  };

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="md:hidden fixed inset-0 bg-black/50 z-[60] animate-fade-in"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-2xl animate-slide-up max-h-[80vh] overflow-y-auto pb-safe">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 rounded-t-3xl flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isAuthenticated ? 'Mi Cuenta' : 'Menú'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isAuthenticated && user ? (
            <>
              {/* User Info */}
              <div className="px-4 py-4 bg-gradient-to-br from-violet-50 to-pink-50 rounded-2xl mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
                    <span className="text-white text-lg font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                </div>
                {isAdmin && (
                  <span className="inline-block px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                    Administrador
                  </span>
                )}
              </div>

              {/* Menu Options */}
              <div className="space-y-1">
                <Link
                  to="/profile"
                  onClick={handleLinkClick}
                  className="flex items-center gap-3 px-4 py-3.5 text-gray-700 hover:bg-violet-50 hover:text-violet-700 rounded-xl transition-colors font-medium"
                >
                  <User className="w-5 h-5" />
                  <span>Mi Perfil</span>
                </Link>

                <Link
                  to="/orders"
                  onClick={handleLinkClick}
                  className="flex items-center gap-3 px-4 py-3.5 text-gray-700 hover:bg-violet-50 hover:text-violet-700 rounded-xl transition-colors font-medium"
                >
                  <Package className="w-5 h-5" />
                  <span>Mis Pedidos</span>
                </Link>

                {isAdmin && (
                  <>
                    <div className="my-3 border-t border-gray-200"></div>
                    <Link
                      to="/admin-panel"
                      onClick={handleLinkClick}
                      className="flex items-center gap-3 px-4 py-3.5 text-orange-700 hover:bg-orange-50 rounded-xl transition-colors font-bold"
                    >
                      <Settings className="w-5 h-5" />
                      <span>Panel de Administración</span>
                    </Link>
                  </>
                )}

                <div className="my-3 border-t border-gray-200"></div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Not Authenticated */}
              <div className="px-4 py-6 bg-gradient-to-br from-violet-50 to-pink-50 rounded-2xl mb-4 text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">Bienvenido</p>
                <p className="text-sm text-gray-600">Inicia sesión para continuar</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={onLoginClick}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-pink-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  <User className="w-5 h-5" />
                  <span>Iniciar Sesión</span>
                </button>

                <button
                  onClick={onRegisterClick}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-violet-200 text-violet-700 rounded-xl font-bold hover:bg-violet-50 transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span>Crear Cuenta</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
