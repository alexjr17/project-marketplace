import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Search, Home, Package, Palette, Shirt, User } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { UserMenu } from '../auth/UserMenu';
import { LoginModal } from '../auth/LoginModal';
import { MobileUserMenu } from '../auth/MobileUserMenu';

export const Header = () => {
  const location = useLocation();
  const { cart } = useCart();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDesktop, setShowSearchDesktop] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [showMobileUserMenu, setShowMobileUserMenu] = useState(false);

  const isActive = (path: string) => location.pathname === path;

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
      <header className="bg-white shadow-md sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 md:py-4">
          <div className="flex items-center justify-between gap-2 md:gap-3">
            {/* Logo - Desktop */}
            <Link to="/" className="hidden md:flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 p-3 rounded-2xl">
                  <Shirt className="w-7 h-7 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 bg-clip-text text-transparent">
                  StylePrint
                </span>
                <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">
                  Tu Estilo, Tu Diseño
                </span>
              </div>
            </Link>

            {/* Logo - Mobile (Solo Icono) */}
            <Link to="/" className="md:hidden flex items-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 rounded-lg blur-md opacity-50"></div>
                <div className="relative bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 p-1.5 rounded-lg">
                  <Shirt className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
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
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Navigation - Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  isActive('/')
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-gray-700 hover:bg-violet-50 hover:text-violet-600'
                }`}
              >
                <Home className="w-4 h-4" strokeWidth={isActive('/') ? 2.5 : 2} />
                Inicio
              </Link>
              <Link
                to="/catalog"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  isActive('/catalog')
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-700 hover:bg-pink-50 hover:text-pink-600'
                }`}
              >
                <Package className="w-4 h-4" strokeWidth={isActive('/catalog') ? 2.5 : 2} />
                Catálogo
              </Link>
              <Link
                to="/customize"
                className="flex items-center gap-2 px-6 py-2.5 ml-2 rounded-lg font-bold text-sm bg-gradient-to-r from-violet-600 to-pink-500 text-white hover:shadow-lg hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all"
              >
                <Palette className="w-4 h-4" />
                Personalizar
              </Link>
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
                    className="w-64 pl-12 pr-4 py-2.5 bg-gray-100 rounded-full text-sm font-medium text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowSearchDesktop(true)}
                  className="p-2.5 rounded-lg hover:bg-gray-100 transition-all group"
                >
                  <Search
                    className="w-6 h-6 text-gray-700 group-hover:text-violet-600 transition-colors"
                    strokeWidth={2}
                  />
                </button>
              )}

              {/* Cart Icon */}
              <Link
                to="/cart"
                className={`relative p-2.5 rounded-lg transition-all group ${
                  isActive('/cart') ? 'bg-violet-100' : 'hover:bg-gray-100'
                }`}
              >
                <ShoppingCart
                  className={`w-6 h-6 transition-colors ${
                    isActive('/cart') ? 'text-violet-600' : 'text-gray-700 group-hover:text-violet-600'
                  }`}
                  strokeWidth={isActive('/cart') ? 2.5 : 2}
                />
                {cart.totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-pink-500 to-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                    {cart.totalItems}
                  </span>
                )}
              </Link>

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
                ? 'text-violet-600'
                : 'text-gray-600 hover:text-violet-600'
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
                ? 'text-violet-600'
                : 'text-gray-600 hover:text-violet-600'
            }`}
          >
            <Package
              className="w-6 h-6"
              strokeWidth={isActive('/catalog') ? 2.5 : 2}
            />
            <span className="text-xs font-semibold">Catálogo</span>
          </Link>

          {/* Personalizar - Botón Central Destacado */}
          <Link
            to="/customize"
            className="flex flex-col items-center justify-center -mt-6"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 rounded-full blur-lg opacity-50"></div>
              <div className="relative bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 p-4 rounded-full shadow-xl">
                <Palette className="w-7 h-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <span className="text-xs font-bold text-violet-600 mt-1">Diseñar</span>
          </Link>

          {/* Carrito */}
          <Link
            to="/cart"
            className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all relative ${
              isActive('/cart')
                ? 'text-violet-600'
                : 'text-gray-600 hover:text-violet-600'
            }`}
          >
            <ShoppingCart
              className="w-6 h-6"
              strokeWidth={isActive('/cart') ? 2.5 : 2}
            />
            <span className="text-xs font-semibold">Carrito</span>
            {cart.totalItems > 0 && (
              <span className="absolute top-1 right-2 bg-pink-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                {cart.totalItems}
              </span>
            )}
          </Link>

          {/* Perfil - Mobile */}
          <button
            onClick={handleProfileClickMobile}
            className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-all ${
              isActive('/profile')
                ? 'text-violet-600'
                : 'text-gray-600 hover:text-violet-600'
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
