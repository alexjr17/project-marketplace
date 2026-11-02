import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { User, Package, LogOut, X, ShoppingCart, LayoutGrid, Heart, MessageSquare } from 'lucide-react';
import { useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { resolveAppColor, type AppKey } from '../../theme/appTheme';
import { Button } from '../ui';

interface MobileUserMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export const MobileUserMenu = ({ isOpen, onClose, onLoginClick, onRegisterClick }: MobileUserMenuProps) => {
  const { user, isAuthenticated, logout, hasPermission, isAdmin } = useAuth();
  const { count: favoritesCount } = useFavorites();
  const { settings } = useSettings();
  // Icono de cada app en su color configurado (Ajustes → Apariencia).
  const appIconStyle = (app: AppKey) => {
    const c = resolveAppColor(app, settings.appearance);
    return { backgroundColor: `${c}1a`, color: c };
  };
  const itemClass = 'flex items-center gap-3 px-3 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors text-sm font-medium';

  // Acceso al panel admin según permisos (admin.access o módulos admin)
  const isAdminUser = isAdmin;
  const hasPosAccess = hasPermission('pos.access');
  const hasMessagingAccess = hasPermission('messaging.access');

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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-xl animate-slide-up max-h-[80vh] overflow-y-auto pb-safe">
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-3.5 border-b border-gray-100 rounded-t-2xl flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            {isAuthenticated ? 'Mi cuenta' : 'Menú'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isAuthenticated && user ? (
            <>
              {/* User Info */}
              <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-lg border border-gray-200">
                <div className="w-10 h-10 rounded-full bg-app-100 text-app-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-bold">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>

              {/* Menu Options */}
              <div className="space-y-1">
                <Link
                  to="/profile"
                  onClick={handleLinkClick}
                  className={itemClass}
                >
                  <User className="w-5 h-5 text-gray-400" />
                  <span>Mi perfil</span>
                </Link>

                <Link
                  to="/my-orders"
                  onClick={handleLinkClick}
                  className={itemClass}
                >
                  <Package className="w-5 h-5 text-gray-400" />
                  <span>Mis pedidos</span>
                </Link>

                <Link
                  to="/favorites"
                  onClick={handleLinkClick}
                  className={`${itemClass} justify-between`}
                >
                  <span className="flex items-center gap-3">
                    <Heart className="w-5 h-5 text-gray-400" />
                    Mis favoritos
                  </span>
                  {favoritesCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                      {favoritesCount}
                    </span>
                  )}
                </Link>

                {/* Aplicaciones disponibles */}
                {(hasPosAccess || isAdminUser || hasMessagingAccess) && (
                  <>
                    <div className="my-3 border-t border-gray-200"></div>
                    <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Aplicaciones
                    </p>

                    {/* Punto de Venta */}
                    {hasPosAccess && (
                      <Link
                        to="/pos"
                        onClick={handleLinkClick}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="p-2 rounded-lg" style={appIconStyle('pos')}>
                          <ShoppingCart className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-gray-900">Punto de Venta</span>
                          <p className="text-xs text-gray-500">Gestión de ventas y caja</p>
                        </div>
                      </Link>
                    )}

                    {/* Social Media */}
                    {hasMessagingAccess && (
                      <Link
                        to="/messaging"
                        onClick={handleLinkClick}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="p-2 rounded-lg" style={appIconStyle('messaging')}>
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-gray-900">Social Media</span>
                          <p className="text-xs text-gray-500">Inbox y publicaciones</p>
                        </div>
                      </Link>
                    )}

                    {/* Panel de Administración */}
                    {isAdminUser && (
                      <Link
                        to="/admin-panel"
                        onClick={handleLinkClick}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="p-2 rounded-lg" style={appIconStyle('admin')}>
                          <LayoutGrid className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-gray-900">Administración</span>
                          <p className="text-xs text-gray-500">Panel de administración</p>
                        </div>
                      </Link>
                    )}
                  </>
                )}

                <div className="my-3 border-t border-gray-200"></div>

                <button
                  onClick={handleLogout}
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Not Authenticated */}
              <div className="py-4 mb-2 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-app-100 text-app-600 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <p className="text-base font-semibold text-gray-900">Bienvenido</p>
                <p className="text-sm text-gray-500">Inicia sesión para continuar</p>
              </div>

              <div className="space-y-2">
                <Button size="lg" fullWidth onClick={onLoginClick}>Iniciar sesión</Button>
                <Button size="lg" fullWidth variant="secondary" onClick={onRegisterClick}>Crear cuenta</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
