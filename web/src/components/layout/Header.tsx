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

  // Colores de marca dinámicos desde settings.appearance
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const showSlogan = settings.appearance?.showSlogan ?? true;
  const enableCustomizer = settings.home?.enableCustomizer ?? true;
  const gradientStyle = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;
  const gradientBgStyle = `linear-gradient(to bottom right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

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
      <header className="bg-white shadow-md fixed top-0 left-0 right-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 md:py-4">
          <div className="flex items-center justify-between gap-2 md:gap-3">
            {/* Logo - Desktop */}
            <Link to="/" className="hidden md:flex items-center gap-3 group">
              {/* Logo o Icono por defecto */}
              {settings.general.logo ? (
                <img
                  src={settings.general.logo}
                  alt={settings.general.siteName}
                  className="h-12 max-w-[80px] object-contain"
                />
              ) : (
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity"
                    style={{ background: gradientBgStyle }}
                  />
                  <div
                    className="relative p-3 rounded-2xl"
                    style={{ background: gradientBgStyle }}
                  >
                    <Shirt className="w-7 h-7 text-white" strokeWidth={2.5} />
                  </div>
                </div>
              )}
              {/* Nombre y Slogan siempre visibles */}
              <div className="flex flex-col">
                <span
                  className="text-2xl font-black bg-clip-text text-transparent"
                  style={{
                    backgroundImage: gradientStyle,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {settings.general.siteName || 'StylePrint'}
                </span>
                {showSlogan && settings.general.slogan && (
                  <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">
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
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-lg blur-md opacity-50"
                    style={{ background: gradientBgStyle }}
                  />
                  <div
                    className="relative p-1.5 rounded-lg"
                    style={{ background: gradientBgStyle }}
                  >
                    <Shirt className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                </div>
              )}
              {/* Nombre en mobile */}
              <span
                className="text-lg font-black bg-clip-text text-transparent"
                style={{
                  backgroundImage: gradientStyle,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
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
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Navigation - Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  isActive('/')
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Home className="w-4 h-4" strokeWidth={isActive('/') ? 2.5 : 2} />
                Inicio
              </Link>

              {/* Mega Menu Categorías */}
              <CategoriesMenu />
              {enableCustomizer && (
                <Link
                  to="/customize"
                  className="flex items-center gap-2 px-6 py-2.5 ml-2 rounded-lg font-bold text-sm text-white hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  style={{ background: gradientStyle }}
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
                    className="w-64 pl-12 pr-4 py-2.5 bg-gray-100 rounded-full text-sm font-medium text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white transition-all"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowSearchDesktop(true)}
                  aria-label="Buscar"
                  className="p-2.5 rounded-lg hover:bg-gray-100 transition-all group"
                >
                  <Search
                    className="w-6 h-6 text-gray-700 group-hover:text-gray-900 transition-colors"
                    strokeWidth={2}
                  />
                </button>
              )}

              {/* Favoritos — en el header solo para invitados (logueados lo ven en su menú) */}
              {!isAuthenticated && (
                <Link
                  to="/favorites"
                  aria-label="Favoritos"
                  className={`relative p-2.5 rounded-lg transition-all group ${
                    isActive('/favorites') ? 'bg-gray-100' : 'hover:bg-gray-100'
                  }`}
                >
                  <Heart
                    className={`w-6 h-6 transition-colors ${
                      isActive('/favorites') ? 'text-red-500 fill-red-500' : 'text-gray-700 group-hover:text-gray-900'
                    }`}
                    strokeWidth={2}
                  />
                  {favoritesCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
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
                className={`relative p-2.5 rounded-lg transition-all group ${
                  isActive('/cart') ? 'bg-gray-100' : 'hover:bg-gray-100'
                }`}
              >
                <ShoppingCart
                  className={`w-6 h-6 transition-colors ${
                    isActive('/cart') ? 'text-gray-900' : 'text-gray-700 group-hover:text-gray-900'
                  }`}
                  strokeWidth={isActive('/cart') ? 2.5 : 2}
                />
                {cart.totalItems > 0 && (
                  <span
                    className="absolute -top-1 -right-1 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md"
                    style={{ background: brandColors.primary }}
                  >
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg pb-safe">
        <div className="flex items-center justify-around px-2 py-2">
          {/* Inicio */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${
              isActive('/')
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Home
              className="w-6 h-6"
              strokeWidth={isActive('/') ? 2.5 : 2}
              fill={isActive('/') ? 'currentColor' : 'none'}
            />
            <span className="text-xs font-semibold">Inicio</span>
          </Link>

          {/* Catálogo */}
          <Link
            to="/catalog"
            className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${
              isActive('/catalog')
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Package
              className="w-6 h-6"
              strokeWidth={isActive('/catalog') ? 2.5 : 2}
            />
            <span className="text-xs font-semibold">Catálogo</span>
          </Link>

          {/* Personalizar - Botón Central Destacado (solo si está habilitado) */}
          {enableCustomizer && (
            <Link
              to="/customize"
              className="flex flex-col items-center justify-center -mt-6"
            >
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-full blur-lg opacity-50"
                  style={{ background: gradientBgStyle }}
                ></div>
                <div
                  className="relative p-4 rounded-full shadow-xl"
                  style={{ background: gradientBgStyle }}
                >
                  <Palette className="w-7 h-7 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <span
                className="text-xs font-bold mt-1"
                style={{ color: brandColors.primary }}
              >
                Diseñar
              </span>
            </Link>
          )}

          {/* Carrito */}
          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all relative ${
              isActive('/cart')
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShoppingCart
              className="w-6 h-6"
              strokeWidth={isActive('/cart') ? 2.5 : 2}
            />
            <span className="text-xs font-semibold">Carrito</span>
            {cart.totalItems > 0 && (
              <span
                className="absolute top-1 right-2 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md"
                style={{ background: brandColors.primary }}
              >
                {cart.totalItems}
              </span>
            )}
          </Link>

          {/* Perfil - Mobile */}
          <button
            onClick={handleProfileClickMobile}
            className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${
              isActive('/profile')
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <User
              className="w-6 h-6"
              strokeWidth={isActive('/profile') ? 2.5 : 2}
            />
            <span className="text-xs font-semibold">Perfil</span>
          </button>
        </div>
      </nav>
    </>
  );
};
