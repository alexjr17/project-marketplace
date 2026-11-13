import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronDown, FileText, Inbox, LogOut, MessageSquare, Palette, Plug, Share2, Sparkles, User, Wand2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import AppSwitcher from '../common/AppSwitcher';
import { Avatar } from '../ui/Media';
import type { Permission } from '../../types/roles';

const TABS: { path: string; label: string; icon: typeof Inbox; permission: Permission }[] = [
  { path: '/messaging/inbox', label: 'Bandeja', icon: Inbox, permission: 'messaging.inbox' },
  { path: '/messaging/posts', label: 'Publicaciones', icon: Share2, permission: 'messaging.posts' },
  { path: '/messaging/studio', label: 'Estudio', icon: Wand2, permission: 'messaging.posts' },
  { path: '/messaging/calendar', label: 'Calendario', icon: CalendarClock, permission: 'messaging.posts' },
  { path: '/messaging/brand', label: 'Marca', icon: Palette, permission: 'messaging.posts' },
  { path: '/messaging/pages', label: 'Páginas', icon: FileText, permission: 'messaging.pages' },
  { path: '/messaging/knowledge', label: 'Entrenar IA', icon: Sparkles, permission: 'messaging.knowledge' },
  { path: '/messaging/channels', label: 'Canales', icon: Plug, permission: 'messaging.channels' },
];

interface MessagingLayoutProps {
  children: React.ReactNode;
}

/**
 * Armazón de la app Social Media (/messaging/*): barra superior con la marca de la app,
 * los módulos (según permisos), el selector de app y el menú del usuario.
 * En celular los módulos bajan a una segunda fila. El contenido ocupa el resto de la
 * altura: la bandeja usa toda la pantalla y las demás pantallas van en <Page>.
 */
export default function MessagingLayout({ children }: MessagingLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, logout, hasPermission } = useAuth();
  const { settings } = useSettings();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  const isTabActive = (path: string) => location.pathname.startsWith(path);
  // Solo los módulos a los que el rol tiene permiso
  const visibleTabs = TABS.filter((t) => hasPermission(t.permission));
  const siteName = settings.general?.siteName || 'Mi tienda';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabLink = (tab: (typeof TABS)[number], mobile: boolean) => {
    const active = isTabActive(tab.path);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.path}
        to={tab.path}
        aria-current={active ? 'page' : undefined}
        className={
          mobile
            ? `flex-1 min-w-[4.5rem] flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium border-b-2 transition-colors ${
                active ? 'border-app-600 text-app-700' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`
            : `flex items-center gap-2 h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-app-50 text-app-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
        }
      >
        <Icon className={`${mobile ? 'w-5 h-5' : 'w-[18px] h-[18px]'} ${active ? 'text-app-600' : 'text-gray-400'}`} />
        <span className="whitespace-nowrap">{tab.label}</span>
      </Link>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Barra superior */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="flex h-16 items-center gap-3 px-3 md:px-4">
          <Link to="/messaging" className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
            {settings.general?.logo
              ? <img src={settings.general.logo} alt="" className="w-9 h-9 rounded-lg object-contain flex-shrink-0" />
              : <span className="w-9 h-9 rounded-lg bg-app-600 text-white flex items-center justify-center flex-shrink-0"><MessageSquare className="w-5 h-5" /></span>}
            <span className="hidden sm:block min-w-0">
              <span className="block truncate text-sm font-semibold text-gray-900 max-w-[10rem]">{siteName}</span>
              <span className="block text-xs text-gray-500">Social Media</span>
            </span>
          </Link>

          {/* Módulos (escritorio) */}
          <nav className="hidden md:flex items-center gap-1 ml-2 pl-3 border-l border-gray-200 min-w-0 overflow-x-auto" aria-label="Menú de Social Media">
            {visibleTabs.map((tab) => tabLink(tab, false))}
          </nav>

          <div className="flex-1" />

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
                    <span className="mt-2 inline-block rounded-full bg-app-100 px-2 py-0.5 text-xs font-medium text-app-700">{role?.name || 'Usuario'}</span>
                  </div>
                  <div className="xl:hidden px-2 py-2 border-b border-gray-100"><AppSwitcher variant="sidebar" /></div>
                  <Link to="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><User className="w-4 h-4" /> Mi perfil</Link>
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"><LogOut className="w-4 h-4" /> Cerrar sesión</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Módulos (celular) */}
        {visibleTabs.length > 0 && (
          <nav className="md:hidden flex overflow-x-auto border-t border-gray-100" aria-label="Menú de Social Media">
            {visibleTabs.map((tab) => tabLink(tab, true))}
          </nav>
        )}
      </header>

      {/* Contenido */}
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
