import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Search, Home, Package, Palette, Shirt, User, Heart, X, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useCatalogs } from '../../context/CatalogsContext';
import { UserMenu } from '../auth/UserMenu';
import { LoginModal } from '../auth/LoginModal';
import { MobileUserMenu } from '../auth/MobileUserMenu';
import AppSwitcher from '../common/AppSwitcher';
import { CategoriesMenu } from './CategoriesMenu';
import { NotificationBell } from '../notifications/NotificationBell';

/** Buscador del encabezado: envía a /catalog?search=<texto>. */
function HeaderSearch({ autoFocus = false, onDone, className = '' }: { autoFocus?: boolean; onDone?: () => void; className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const current = location.pathname === '/catalog' ? params.get('search') ?? '' : '';
  const [q, setQ] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  // Al volver al catálogo con otra búsqueda (o salir de él) el campo refleja la URL.
  useEffect(() => { setQ(current); }, [current]);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    navigate(text ? `/catalog?search=${encodeURIComponent(text)}` : '/catalog');
    inputRef.current?.blur();
    onDone?.();
  };

  return (
    <form role="search" onSubmit={submit} className={`relative ${className}`}>
      <label htmlFor={autoFocus ? 'header-search-mobile' : 'header-search'} className="sr-only">Buscar productos</label>
      <input
        ref={inputRef}
        id={autoFocus ? 'header-search-mobile' : 'header-search'}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onDone?.(); }}
        placeholder="Buscar productos…"
        enterKeyHint="search"
        autoComplete="off"
        className="w-full h-11 pl-5 pr-14 bg-white/80 border border-black/10 rounded-full text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-app-500 focus:ring-2 focus:ring-app-200 transition-colors [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="submit"
        title="Buscar"
        aria-label="Buscar"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-11 rounded-full flex items-center justify-center bg-app-600 text-white hover:bg-app-700 transition-colors"
      >
        <Search className="w-4 h-4" strokeWidth={2.25} />
      </button>
    </form>
  );
}

export const Header = () => {
  const location = useLocation();
  const [params] = useSearchParams();
  const { cart } = useCart();
  const { count: favoritesCount } = useFavorites();
  const { isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const { categories } = useCatalogs();
  const [mobileSearch, setMobileSearch] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [showMobileUserMenu, setShowMobileUserMenu] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const [wideLogo, setWideLogo] = useState(false);

  // El acento de la tienda es el color de marca primario (clases app-*, ver AppTheme).
  const showSlogan = settings.appearance?.showSlogan ?? true;
  const enableCustomizer = settings.home?.enableCustomizer ?? true;
  const siteName = settings.general.siteName || 'StylePrint';
  // Fondo del encabezado: el de Ajustes > Apariencia o el "papel" de la tienda (algo translúcido).
  const headerBg = settings.appearance?.headerBgColor && settings.appearance.headerBgColor.toLowerCase() !== '#ffffff'
    ? settings.appearance.headerBgColor
    : 'rgb(var(--paper) / 0.92)';
  // Banda de categorías en el celular: se desliza de lado. Un degradado con flecha avisa que hay más
  // a la derecha (o a la izquierda si ya se deslizó) y desaparece al llegar al borde.
  const catScroll = useRef<HTMLDivElement>(null);
  const [catMore, setCatMore] = useState({ left: false, right: false });
  const measureCats = () => {
    const el = catScroll.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setCatMore((m) => (m.left === left && m.right === right ? m : { left, right }));
  };
  useEffect(() => {
    const el = catScroll.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measureCats());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  const scrollCats = (dir: 1 | -1) => catScroll.current?.scrollBy({ left: dir * catScroll.current.clientWidth * 0.7, behavior: 'smooth' });
  const iconBtn = (active: boolean) =>
    `relative p-2 rounded-lg transition-colors ${active ? 'bg-app-50 text-app-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`;
  const countBadge = 'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ring-2 ring-white';

  // Fila de categorías: las activas del catálogo + Ofertas + Personaliza.
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  // Las categorías llegan después: al cambiar la lista se vuelve a medir (en el siguiente cuadro).
  useEffect(() => {
    const id = requestAnimationFrame(measureCats);
    return () => cancelAnimationFrame(id);
  }, [activeCategories.length, enableCustomizer]);
  const onCatalog = location.pathname === '/catalog';
  const currentCategory = onCatalog ? params.get('category') : null;
  const onSale = onCatalog && (params.get('onSale') === '1' || params.get('onSale') === 'true');
  // Enlace de la banda de categorías: subrayado en la sección activa.
  const tab = (active: boolean) =>
    `relative flex-shrink-0 inline-flex items-center gap-1.5 h-11 px-3 text-sm font-medium whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full ${
      active ? 'text-gray-900 font-semibold after:bg-accent' : 'text-gray-600 hover:text-gray-900 after:bg-transparent hover:after:bg-gray-300'
    }`;
  const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: settings.general.currency || 'COP', maximumFractionDigits: 0 }).format(n || 0);

  // Cerrar el buscador móvil al cambiar de página.
  useEffect(() => { setMobileSearch(false); }, [location.pathname, location.search]);

  const handleProfileClickMobile = () => {
    if (isAuthenticated) {
      setShowMobileUserMenu(!showMobileUserMenu);
    } else {
      setLoginMode('login');
      setShowLoginModal(true);
    }
  };

  // Un logotipo ancho (ícono + nombre) se muestra solo; un ícono va junto al nombre.
  const logo = (size: 'md' | 'sm') =>
    settings.general.logo ? (
      <img
        src={settings.general.logo}
        alt={siteName}
        onLoad={(e) => setWideLogo(e.currentTarget.naturalWidth / Math.max(1, e.currentTarget.naturalHeight) > 2.2)}
        className={wideLogo
          ? (size === 'md' ? 'h-8 w-auto max-w-[200px] object-contain' : 'h-7 w-auto max-w-[140px] object-contain')
          : (size === 'md' ? 'h-10 max-w-[80px] object-contain' : 'h-8 max-w-[40px] object-contain')}
      />
    ) : (
      <div className={`${size === 'md' ? 'p-2' : 'p-1.5'} rounded-lg bg-app-600`}>
        <Shirt className={`${size === 'md' ? 'w-6 h-6' : 'w-5 h-5'} text-white`} strokeWidth={2.25} />
      </div>
    );

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 shadow-[0_1px_0_0_rgb(0_0_0/0.08)] backdrop-blur-md"
        style={{ backgroundColor: headerBg }}
      >
        {/* Fila principal: logo · buscador · acciones */}
        <div className="max-w-7xl mx-auto px-3 md:px-6">
          <div className="flex items-center gap-3 md:gap-6 h-14 md:h-[72px]">
            <Link to="/" className="flex items-center gap-2 md:gap-2.5 flex-shrink-0 min-w-0" aria-label={`${siteName} — inicio`}>
              <span className="hidden md:block">{logo('md')}</span>
              <span className="md:hidden">{logo('sm')}</span>
              <span className={`flex flex-col leading-tight min-w-0 ${wideLogo ? 'sr-only' : ''}`}>
                <span className="text-base md:text-xl font-bold tracking-tight text-gray-900 truncate max-w-[140px] md:max-w-[200px]">{siteName}</span>
                {showSlogan && settings.general.slogan && (
                  <span className="hidden lg:block text-[10px] text-gray-500 font-medium tracking-wider uppercase truncate max-w-[200px]">
                    {settings.general.slogan}
                  </span>
                )}
              </span>
            </Link>

            {/* Buscador (escritorio): protagonista y centrado */}
            <HeaderSearch className="hidden md:block flex-1 max-w-2xl mx-auto" />

            <div className="ml-auto md:ml-0 flex items-center gap-0.5 md:gap-1 flex-shrink-0">
              {/* Buscador (celular): el icono abre el campo */}
              <button
                type="button"
                onClick={() => setMobileSearch((v) => !v)}
                aria-label={mobileSearch ? 'Cerrar búsqueda' : 'Buscar'}
                title={mobileSearch ? 'Cerrar búsqueda' : 'Buscar'}
                aria-expanded={mobileSearch}
                className={`md:hidden ${iconBtn(mobileSearch)}`}
              >
                {mobileSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
              </button>

              <Link to="/favorites" aria-label="Favoritos" title="Favoritos" className={iconBtn(isActive('/favorites'))}>
                <Heart className={`w-5 h-5 ${isActive('/favorites') ? 'text-red-500 fill-red-500' : ''}`} />
                {favoritesCount > 0 && <span className={`${countBadge} bg-red-500 text-white`}>{favoritesCount}</span>}
              </Link>

              <span className="hidden md:contents">
                <NotificationBell />
              </span>

              {/* Carrito: con el total visible en pantallas grandes */}
              <Link
                to="/cart"
                aria-label={`Carrito, ${cart.totalItems} productos`}
                title="Carrito"
                className={`hidden md:inline-flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${isActive('/cart') ? 'bg-app-50 text-app-700' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <span className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  {cart.totalItems > 0 && <span className={`${countBadge} -top-2 -right-2.5 bg-accent text-accent-ink`}>{cart.totalItems}</span>}
                </span>
                <span className="hidden lg:flex flex-col leading-tight text-left pl-1">
                  <span className="text-[11px] text-gray-500">Carrito</span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatMoney(cart.subtotal)}</span>
                </span>
              </Link>

              <span className="hidden md:block mx-1 h-6 w-px bg-gray-200" aria-hidden />

              <span className="hidden md:contents">
                <AppSwitcher variant="icon" />
                <UserMenu
                  onLoginClick={() => { setLoginMode('login'); setShowLoginModal(true); }}
                  onRegisterClick={() => { setLoginMode('register'); setShowLoginModal(true); }}
                />
              </span>
            </div>
          </div>

          {/* Buscador desplegado (celular) */}
          {mobileSearch && (
            <div className="md:hidden pb-2.5">
              <HeaderSearch autoFocus onDone={() => setMobileSearch(false)} />
            </div>
          )}
        </div>

        {/* Banda de categorías: ancho completo con su propia línea; el contenido se alinea con el logo */}
        <nav aria-label="Categorías" className="border-t border-gray-100">
          <div className="relative max-w-7xl mx-auto px-3 md:px-6">
            {/* En escritorio sin overflow: el menú desplegable de Categorías no se recorta */}
            <div ref={catScroll} onScroll={measureCats} className="flex items-center gap-1 md:gap-0.5 overflow-x-auto md:overflow-visible scrollbar-hide h-11">
              <span className="hidden md:block flex-shrink-0 pr-2 mr-1 border-r border-gray-200">
                <CategoriesMenu />
              </span>
              {activeCategories.map((c) => (
                <Link key={c.id} to={`/catalog?category=${encodeURIComponent(c.slug)}`} className={tab(currentCategory === c.slug)}>
                  {c.name}
                </Link>
              ))}
              <Link to="/catalog?onSale=1" className={tab(onSale)}>
                <Percent className="w-4 h-4" />
                Ofertas
              </Link>
              {enableCustomizer && (
                <Link
                  to="/customize"
                  className={`flex-shrink-0 md:ml-auto inline-flex items-center gap-2 h-8 px-4 rounded-full text-sm font-semibold whitespace-nowrap text-white transition-colors ${
                    isActive('/customize') ? 'bg-app-800' : 'bg-app-600 hover:bg-app-800'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
                  Personaliza tu diseño
                </Link>
              )}
            </div>
            {/* Hay más categorías: degradado + flecha (solo celular) */}
            {catMore.left && (
              <button
                type="button"
                onClick={() => scrollCats(-1)}
                aria-label="Ver categorías anteriores"
                className="md:hidden absolute left-0 inset-y-0 w-12 flex items-center justify-start pl-1 text-gray-700"
                style={{ background: `linear-gradient(to right, ${headerBg} 40%, transparent)` }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {catMore.right && (
              <button
                type="button"
                onClick={() => scrollCats(1)}
                aria-label="Ver más categorías"
                className="md:hidden absolute right-0 inset-y-0 w-14 flex items-center justify-end pr-1 text-gray-700"
                style={{ background: `linear-gradient(to left, ${headerBg} 45%, transparent)` }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </nav>
      </header>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} initialMode={loginMode} />

      <MobileUserMenu
        isOpen={showMobileUserMenu}
        onClose={() => setShowMobileUserMenu(false)}
        onLoginClick={() => { setShowMobileUserMenu(false); setLoginMode('login'); setShowLoginModal(true); }}
        onRegisterClick={() => { setShowMobileUserMenu(false); setLoginMode('register'); setShowLoginModal(true); }}
      />

      {/* Barra inferior (solo celular) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-paper/95 backdrop-blur-md border-t border-black/10 pb-safe">
        <div className="flex items-center justify-around px-2 py-1.5">
          <Link to="/" className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${isActive('/') ? 'text-app-700' : 'text-gray-500 hover:text-gray-900'}`}>
            <Home className="w-6 h-6" strokeWidth={isActive('/') ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">Inicio</span>
          </Link>

          <Link to="/catalog" className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${isActive('/catalog') ? 'text-app-700' : 'text-gray-500 hover:text-gray-900'}`}>
            <Package className="w-6 h-6" strokeWidth={isActive('/catalog') ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">Catálogo</span>
          </Link>

          {enableCustomizer && (
            <Link to="/customize" className="flex flex-col items-center justify-center -mt-5">
              <div className="p-3.5 rounded-full bg-app-600 ring-4 ring-paper shadow-md">
                <Palette className="w-6 h-6 text-accent" strokeWidth={2.25} />
              </div>
              <span className="text-[11px] font-semibold mt-0.5 text-app-700">Diseñar</span>
            </Link>
          )}

          <Link to="/cart" className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative ${isActive('/cart') ? 'text-app-700' : 'text-gray-500 hover:text-gray-900'}`}>
            <ShoppingCart className="w-6 h-6" strokeWidth={isActive('/cart') ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">Carrito</span>
            {cart.totalItems > 0 && <span className={`${countBadge} top-0 right-1.5 bg-accent text-accent-ink`}>{cart.totalItems}</span>}
          </Link>

          <button
            type="button"
            onClick={handleProfileClickMobile}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${isActive('/profile') ? 'text-app-700' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <User className="w-6 h-6" strokeWidth={isActive('/profile') ? 2.25 : 1.75} />
            <span className="text-[11px] font-medium">Perfil</span>
          </button>
        </div>
      </nav>
    </>
  );
};
