import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Shirt, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AppSwitcher from '../common/AppSwitcher';
import { Avatar } from '../ui/Media';
import { Breadcrumbs } from '../ui/Display';
import { MFG_NAV, findMfgActive, type MfgNavItem } from './mfgNav';

const COLLAPSE_KEY = 'mfg_sidebar_collapsed';
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } };

/**
 * Armazón de la app Fábrica: menú lateral por secciones (sin acordeones, contraíble),
 * barra superior con migas, cambio de app y menú de usuario. La navegación sale de mfgNav.ts.
 * El <main> no tiene padding: cada pantalla va dentro de <Page>.
 */
export default function ManufacturingLayout({ children }: { children: ReactNode }) {
  const { user, role, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [profileOpen, setProfileOpen] = useState(false);

  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  const active = findMfgActive(pathname);

  useEffect(() => { setMobileOpen(false); setProfileOpen(false); }, [location.pathname]);

  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* sin almacenamiento */ }
    return !c;
  });

  const NavLinkItem = ({ item, compact }: { item: MfgNavItem; compact: boolean }) => {
    const Icon = item.icon;
    const isActive = active?.item === item;
    return (
      <Link
        to={item.path}
        title={compact ? item.label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`group relative flex items-center gap-3 rounded-lg h-9 text-sm transition-colors ${compact ? 'justify-center px-0' : 'px-3'} ${
          isActive ? 'bg-app-50 text-app-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-app-600" />}
        <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-app-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
        {!compact && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const sidebar = (compact: boolean) => (
    <>
      <div className={`flex h-16 items-center gap-3 border-b border-gray-100 flex-shrink-0 ${compact ? 'justify-center px-2' : 'px-4'}`}>
        <Link to="/manufacturing" className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-lg bg-app-600 text-white flex items-center justify-center flex-shrink-0"><Shirt className="w-5 h-5" /></span>
          {!compact && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-gray-900">Fábrica</span>
              <span className="block text-xs text-gray-500">Producción textil</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3" aria-label="Menú de Fábrica">
        {MFG_NAV.map((section, si) => {
          const items = section.items.filter((i) => !i.permission || hasPermission(i.permission));
          if (!items.length) return null;
          return (
            <div key={section.label} className={si ? 'mt-4' : ''}>
              {compact
                ? (si > 0 && <div className="mx-2 mb-2 border-t border-gray-100" />)
                : <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{section.label}</p>}
              <div className="space-y-0.5">{items.map((i) => <NavLinkItem key={i.path} item={i} compact={compact} />)}</div>
            </div>
          );
        })}
      </nav>
    </>
  );

  // Migas: Sección › Ítem › (Nuevo / Detalle)
  const crumbs: { label: string; to?: string }[] = [];
  if (active) {
    crumbs.push({ label: active.section });
    crumbs.push({ label: active.item.label, to: active.item.path });
    if (active.extra) crumbs.push({ label: active.extra });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Menú lateral (escritorio) */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 border-r border-gray-200 bg-white transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        {sidebar(collapsed)}
      </aside>

      {/* Menú lateral (celular) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <button type="button" onClick={() => setMobileOpen(false)} title="Cerrar menú" className="absolute right-2 top-4 p-2 rounded-lg text-gray-500 hover:bg-gray-100"><X className="w-5 h-5" /></button>
            {sidebar(false)}
            <div className="border-t border-gray-100 p-3"><AppSwitcher /></div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 md:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} title="Abrir menú" className="lg:hidden p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"><Menu className="w-5 h-5" /></button>
          <button type="button" onClick={toggleCollapsed} title={collapsed ? 'Expandir menú' : 'Contraer menú'} className="hidden lg:inline-flex p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100">
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <div className="min-w-0 flex-1">{crumbs.length > 0 && <Breadcrumbs items={crumbs} />}</div>

          <div className="hidden lg:block"><AppSwitcher /></div>

          <div className="relative">
            <button type="button" onClick={() => setProfileOpen((o) => !o)} aria-expanded={profileOpen} title="Mi cuenta" className="flex items-center gap-1.5 rounded-lg p-1 hover:bg-gray-100">
              <Avatar name={user?.name} size="sm" />
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
                    <p className="truncate text-xs text-gray-500">{user?.email}</p>
                    <span className="mt-2 inline-block rounded-full bg-app-100 px-2 py-0.5 text-xs font-medium text-app-700">{role?.name || 'Usuario'}</span>
                  </div>
                  <Link to="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><User className="w-4 h-4" /> Mi perfil</Link>
                  <button type="button" onClick={() => { setProfileOpen(false); logout(); }} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="w-4 h-4" /> Cerrar sesión</button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
