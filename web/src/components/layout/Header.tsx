import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Search, Home, Package, Palette, Shirt, User, Heart } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { UserMenu } from '../auth/UserMenu';
import { LoginModal } from '../auth/LoginModal';
import { MobileUserMenu } from '../auth/MobileUserMenu';
import AppSwitcher from '../common/AppSwitcher';
import { CategoriesMenu } from './CategoriesMenu';
import { NotificationBell } from '../notifications/NotificationBell';
import { buttonClass } from '../ui';

export const Header = () => {
  const location = useLocation();
  const { cart } = useCart();
  const { count: favoritesCount } = useFavorites();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDesktop, setShowSearchDesktop] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [showMobileUserMenu, setShowMobileUserMenu] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // El acento de la tienda es el color de marca primario (clases app-*, ver AppTheme).
  const showSlogan = settings.appearance?.showSlogan ?? true;
  const enableCustomizer = settings.home?.enableCustomizer ?? true;
  const iconBtn = (active: boolean) =>
    `relative p-2 rounded-lg transition-colors ${active ? 'bg-app-50 text-app-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`;
  const countBadge = 'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ring-2 ring-white';

  const handleProfileClickMobile = () => {
    if (isAuthenticated) {
      setShowMobileUserMenu(!showMobileUserMenu);
    } else {
      setLoginMode('login');
      setShowLoginModal(true);
    }
  };

  return (
    <>
      {/* Desktop Header */}
      <header className="bg-white/95 backdrop-blur fixed top-0 left-0 right-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 md:py-3">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            {/* Logo - Desktop */}
            <Link to="/" className="hidden md:flex items-center gap-2.5 group flex-shrink-0">
              {/* Logo o Icono por defecto */}
              {settings.general.logo ? (
                <img
                  src={settings.general.logo}
                  alt={settings.general.siteName}
                  className="h-10 max-w-[80px] object-contain"
                />
              ) : (
                <div className="p-2 rounded-lg bg-app-600">
                  <Shirt className="w-6 h-6 text-white" strokeWidth={2.25} />
                </div>
              )}
              {/* Nombre y slogan */}
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-bold tracking-tight text-gray-900">
                  {settings.general.siteName || 'StylePrint'}
                </span>
                {showSlogan && settings.general.slogan && (
                  <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">
                    {settings.general.slogan}
                  </span>
                )}
              </div>
            </Link>

            {/* Logo - Mobile */}
            <Link to="/" className="md:hidden flex items-center gap-2">
              {/* Logo o Icono por defecto */}
              {settings.general.logo ? (
                <img
                  src={settings.general.logo}
                  alt={settings.general.siteName}
                  className="h-8 max-w-[40px] object-contain"
                />
              ) : (
                <div className="p-1.5 rounded-lg bg-app-600">
                  <Shirt className="w-5 h-5 text-white" strokeWidth={2.25} />
                </div>
              )}
              {/* Nombre en mobile */}
              <span className="text-base font-bold tracking-tight text-gray-900 truncate max-w-[110px]">
                {settings.general.siteName || 'StylePrint'}
              </span>
            </Link>

            {/* Search Bar - Mobile */}
            <div className="flex-1 md:hidden max-w-sm">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Search className="w-4 h-4" strokeWidth={2} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar"
                  className="w-full h-9 pl-9 pr-3 bg-gray-100 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-app-200 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Navigation - Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={`flex items-center gap-2 h-9 px-3 rounded-lg font-medium text-sm transition-colors ${
                  isActive('/')
                    ? 'bg-app-50 text-app-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Home className="w-4 h-4" />
                Inicio
              </Link>

              {/* Mega Menu Categorías */}
              <CategoriesMenu />
              {enableCustomizer && (
                <Link
                  to="/customize"
                  className={`${buttonClass('primary', 'sm')} ml-2 h-9`}
                >
                  <Palette className="w-4 h-4" />
                  Personalizar
                </Link>
              )}
            </nav>

            {/* Right Side Icons - Desktop */}
            <div className="hidden md:flex items-center gap-2">
              {/* Search Icon/Input */}
              {showSearchDesktop ? (
                <div className="relative animate-fade-in-up">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => {
                      if (!searchQuery) setShowSearchDesktop(false);
                    }}
                    placeholder="Buscar productos"
                    autoFocus
                    className="w-56 lg:w-64 h-9 pl-11 pr-4 bg-gray-100 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-app-200 focus:bg-white transition-colors"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSearchDesktop(true)}
                  aria-label="Buscar"
                  title="Buscar"
                  className={iconBtn(false)}
                >
                  <Search className="w-5 h-5" />
                </button>
              )}

              {/* Favoritos — en el header solo para invitados (logueados lo ven en su menú) */}
              {!isAuthenticated && (
                <Link
                  to="/favorites"
                  aria-label="Favoritos"
                  title="Favoritos"
                  className={iconBtn(isActive('/favorites'))}
                >
                  <Heart className={`w-5 h-5 ${isActive('/favorites') ? 'text-red-500 fill-red-500' : ''}`} />
                  {favoritesCount > 0 && (
                    <span className={`${countBadge} bg-red-500 text-white`}>
                      {favoritesCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Notifications */}
              <NotificationBell />

              {/* Cart Icon */}
              <Link
                to="/cart"
                aria-label="Carrito"
                title="Carrito"
                className={iconBtn(isActive('/cart'))}
              >
                <ShoppingCart className="w-5 h-5" />
                {cart.totalItems > 0 && (
                  <span className={`${countBadge} bg-app-600 text-white`}>
                    {cart.totalItems}
                  </span>
                )}
              </Link>

              {/* App Switcher */}
              <AppSwitcher />

              {/* User Menu */}
              <UserMenu
                onLoginClick={() => {
                  setLoginMode('login');
                  setShowLoginModal(true);
                }}
                onRegisterClick={() => {
                  setLoginMode('register');
                  setShowLoginModal(true);
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Login/Register Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        initialMode={loginMode}
      />

      {/* Mobile User Menu */}
      <MobileUserMenu
        isOpen={showMobileUserMenu}
        onClose={() => setShowMobileUserMenu(false)}
        onLoginClick={() => {
          setShowMobileUserMenu(false);
          setLoginMode('login');
          setShowLoginModal(true);
        }}
        onRegisterClick={() => {
          setShowMobileUserMenu(false);
          setLoginMode('register');
          setShowLoginModal(true);
        }}
      />

      {/* Bottom Navigation Bar - Solo Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 pb-safe">
        <div className="flex items-center justify-around px-2 py-1.5">
          {/* Inicio */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
              isActive('/') ? 'text-app-700' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Home className="w-6 h-6" strokeWidth={isActive('/') ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">Inicio</span>
          </Link>

          {/* Catálogo */}
          <Link
            to="/catalog"
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
              isActive('/catalog') ? 'text-app-700' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Package className="w-6 h-6" strokeWidth={isActive('/catalog') ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">Catálogo</span>
          </Link>

          {/* Personalizar - Botón Central Destacado (solo si está habilitado) */}
          {enableCustomizer && (
            <Link
              to="/customize"
              className="flex flex-col items-center justify-center -mt-5"
            >
              <div className="p-3.5 rounded-full bg-app-600 ring-4 ring-white shadow-md">
                <Palette className="w-6 h-6 text-white" strokeWidth={2.25} />
              </div>
              <span className="text-[11px] font-semibold mt-0.5 text-app-700">Diseñar</span>
            </Link>
          )}

          {/* Carrito */}
          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative ${
              isActive('/cart') ? 'text-app-700' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShoppingCart className="w-6 h-6" strokeWidth={isActive('/cart') ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">Carrito</span>
            {cart.totalItems > 0 && (
              <span className={`${countBadge} top-0 right-1.5 bg-app-600 text-white`}>
                {cart.totalItems}
              </span>
            )}
          </Link>

          {/* Perfil - Mobile */}
          <button
            onClick={handleProfileClickMobile}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
              isActive('/profile') ? 'text-app-700' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <User className="w-6 h-6" strokeWidth={isActive('/profile') ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">Perfil</span>
          </button>
        </div>
      </nav>
    </>
  );
};
