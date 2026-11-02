import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Clock, DollarSign, History, LogOut, ShoppingCart, User, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { usePOS } from '../../context/POSContext';
import AppSwitcher from '../common/AppSwitcher';
import { Avatar } from '../ui/Media';

interface POSLayoutProps {
  children: React.ReactNode;
}

// Navegación del Punto de Venta (pantalla de cajero: pocas opciones, siempre a la vista).
const NAV = [
  { path: '/pos/sale', label: 'Nueva venta', icon: ShoppingCart },
  { path: '/pos/history', label: 'Historial', icon: History },
  { path: '/pos/debts', label: 'Fiados', icon: Clock },
  { path: '/pos/customers', label: 'Clientes', icon: Users },
  { path: '/pos/cash', label: 'Caja', icon: DollarSign },
];

/**
 * Armazón del Punto de Venta: barra superior compacta con la marca de la app,
 * la navegación del cajero, el estado de la caja, el selector de app y el menú del usuario.
 * En pantallas chicas la navegación baja a una segunda fila con pestañas táctiles.
 * El contenido ocupa el resto de la altura (la venta usa toda la pantalla).
 */
export default function POSLayout({ children }: POSLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { settings } = useSettings();
  const { currentSession, isLoadingSession } = usePOS();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const siteName = settings.general?.siteName || 'Mi tienda';
  const isActive = (path: string) => location.pathname.startsWith(path);

  const navLink = (item: (typeof NAV)[number], mobile: boolean) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className={
          mobile
            ? `flex-1 min-w-[4.5rem] flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium border-b-2 transition-colors ${
                active ? 'border-app-600 text-app-700' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`
            : `flex items-center gap-2 h-10 px-3.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-app-50 text-app-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
        }
      >
        <Icon className={`${mobile ? 'w-5 h-5' : 'w-[18px] h-[18px]'} ${active ? 'text-app-600' : 'text-gray-400'}`} />
        <span className="whitespace-nowrap">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Barra superior */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="flex h-16 items-center gap-3 px-3 md:px-4">
          {/* Marca de la app */}
          <Link to="/pos/sale" className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
            {settings.general?.logo
              ? <img src={settings.general.logo} alt="" className="w-9 h-9 rounded-lg object-contain flex-shrink-0" />
              : <span className="w-9 h-9 rounded-lg bg-app-600 text-white flex items-center justify-center flex-shrink-0"><ShoppingCart className="w-5 h-5" /></span>}
            <span className="hidden sm:block min-w-0">
              <span className="block truncate text-sm font-semibold text-gray-900 max-w-[10rem]">{siteName}</span>
              <span className="block text-xs text-gray-500">Punto de venta</span>
            </span>
          </Link>

          {/* Navegación (escritorio y tableta horizontal) */}
          <nav className="hidden lg:flex items-center gap-1 ml-2 pl-3 border-l border-gray-200" aria-label="Menú del punto de venta">
            {NAV.map((item) => navLink(item, false))}
          </nav>

          <div className="flex-1" />

          {/* Estado de la caja */}
          <Link
            to="/pos/cash"
            title={currentSession ? 'Sesión de caja activa' : 'Sin sesión de caja: ábrela en Caja'}
            className={`flex items-center gap-2 h-9 px-3 rounded-full border text-xs font-medium transition-colors ${
              isLoadingSession && !currentSession
                ? 'border-gray-200 bg-gray-50 text-gray-600'
                : currentSession
                ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
                : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isLoadingSession && !currentSession ? 'bg-gray-400' : currentSession ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
            {isLoadingSession && !currentSession ? (
              <span className="whitespace-nowrap">Validando…</span>
            ) : currentSession ? (
              <span className="truncate max-w-[9rem] sm:max-w-[14rem]">
                <span className="sm:hidden">Caja activa</span>
                <span className="hidden sm:inline">{currentSession.cashRegister?.name || 'Caja activa'} · {currentSession.salesCount} ventas</span>
              </span>
            ) : (
              <span className="whitespace-nowrap">Sin sesión</span>
            )}
          </Link>

          <div className="hidden xl:block"><AppSwitcher /></div>

          {/* Usuario */}
          <div className="relative">
            <button type="button" onClick={() => setProfileOpen((o) => !o)} aria-expanded={profileOpen} title="Mi cuenta" className="flex items-center gap-1.5 rounded-lg p-1 hover:bg-gray-100">
              <Avatar name={user?.name} size="sm" />
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="truncate text-xs text-gray-500">{user?.email}</p>
                    <span className="mt-2 inline-block rounded-full bg-app-100 px-2 py-0.5 text-xs font-medium text-app-700">{role?.name || 'Cajero'}</span>
                  </div>
                  <div className="xl:hidden px-2 py-2 border-b border-gray-100"><AppSwitcher variant="sidebar" /></div>
                  <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><User className="w-4 h-4" /> Mi perfil</Link>
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"><LogOut className="w-4 h-4" /> Cerrar sesión</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navegación táctil (celular y tableta vertical) */}
        <nav className="lg:hidden flex overflow-x-auto border-t border-gray-100" aria-label="Menú del punto de venta">
          {NAV.map((item) => navLink(item, true))}
        </nav>
      </header>

      {/* Contenido: cada pantalla pone su padding (Page) */}
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
