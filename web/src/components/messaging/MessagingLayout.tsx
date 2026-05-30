import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  Inbox,
  LogOut,
  MessageSquare,
  Plug,
  Share2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import AppSwitcher from '../common/AppSwitcher';

const TABS = [
  { path: '/messaging/inbox', label: 'Bandeja', icon: Inbox },
  { path: '/messaging/posts', label: 'Publicaciones', icon: Share2 },
  { path: '/messaging/pages', label: 'Páginas', icon: FileText },
  { path: '/messaging/knowledge', label: 'Entrenar IA', icon: Sparkles },
  { path: '/messaging/channels', label: 'Canales', icon: Plug },
];

interface MessagingLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout propio de la app "Mensajería" — vive en /messaging/*.
 * No comparte el sidebar pesado de admin: barra superior con AppSwitcher,
 * marca y perfil, y debajo el contenido a pantalla completa.
 */
export default function MessagingLayout({ children }: MessagingLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const [profileOpen, setProfileOpen] = useState(false);

  const isTabActive = (path: string) => location.pathname.startsWith(path);

  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradient = `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})`;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Topbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <AppSwitcher />
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                style={{ background: gradient }}
              >
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-gray-900">Social Media</p>
              </div>
            </div>

            {/* Tabs internos */}
            <nav className="flex items-center gap-1 ml-2">
              {TABS.map((tab) => {
                const active = isTabActive(tab.path);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    style={active ? { background: gradient } : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ background: gradient }}
              >
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline text-sm font-medium text-gray-700 truncate max-w-[140px]">
                {user?.name}
              </span>
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Contenido a pantalla completa restante */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
