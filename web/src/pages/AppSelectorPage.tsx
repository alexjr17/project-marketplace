import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { APP_LABELS, resolveAppColor, type AppKey } from '../theme/appTheme';
import { AppTheme, Badge, Button, EmptyState } from '../components/ui';
import {
  Store,
  ShoppingCart,
  LayoutGrid,
  MessageSquare,
  Shirt,
  ArrowRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface AppCard {
  /** Clave de la app: define su nombre (APP_LABELS) y su color configurado (Ajustes → Apariencia). */
  id: AppKey;
  tag: string;
  description: string;
  icon: LucideIcon;
  path: string;
  available: boolean;
}

/**
 * Pantalla "Selecciona la aplicación" — landing para usuarios de staff que no
 * tienen acceso a la Tienda. Muestra solo las apps a las que el rol tiene
 * acceso. Si solo hay una, entra directo.
 */
export default function AppSelectorPage() {
  const { user, hasPermission, isAdmin, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  // Colores de marca dinámicos (vienen de la base de datos, como la tienda)
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradient = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  const apps = useMemo<AppCard[]>(() => {
    const all: AppCard[] = [
      {
        id: 'store',
        tag: 'Venta online',
        description: 'Explora el catálogo y gestiona la tienda en línea.',
        icon: Store,
        path: '/',
        available: hasPermission('store.access'),
      },
      {
        id: 'pos',
        tag: 'Caja registradora',
        description: 'Controla las ventas, la caja y los fiados de tu negocio.',
        icon: ShoppingCart,
        path: '/pos',
        available: hasPermission('pos.access'),
      },
      {
        id: 'admin',
        tag: 'Panel de gestión',
        description: 'Productos, pedidos, inventario, clientes y configuración.',
        icon: LayoutGrid,
        path: '/admin-panel',
        available: isAdmin,
      },
      {
        id: 'messaging',
        tag: 'Inbox + publicaciones',
        description: 'Conversaciones, canales conectados y publicaciones.',
        icon: MessageSquare,
        path: '/messaging',
        available: hasPermission('messaging.access'),
      },
      {
        id: 'manufacturing',
        tag: 'Producción',
        description: 'Referencias, órdenes de producción, códigos de barras y despachos.',
        icon: Shirt,
        path: '/manufacturing',
        available: hasPermission('manufacturing.access'),
      },
    ];
    return all.filter((a) => a.available);
  }, [hasPermission, isAdmin]);

  // Si solo tiene una app, entrar directo.
  useEffect(() => {
    if (apps.length === 1) {
      navigate(apps[0].path, { replace: true });
    }
  }, [apps, navigate]);

  const firstName = user?.name?.split(' ').slice(0, 2).join(' ') || 'de nuevo';
  const siteName = settings.general?.siteName || 'Mi cuenta';
  const logo = settings.general?.logo;

  return (
    <AppTheme app="store">
      <div className="min-h-screen w-full flex flex-col bg-gray-50">
        {/* Franja de marca */}
        <div className="h-1 w-full" style={{ background: gradient }} />

        {/* Barra superior */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {logo ? (
                <img src={logo} alt={siteName} className="h-8 w-auto max-w-[140px] object-contain" />
              ) : (
                <span className="font-semibold text-gray-900 truncate">{siteName}</span>
              )}
              {user?.roleName && <Badge>{user.roleName}</Badge>}
            </div>
            <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut className="w-4 h-4" />}>
              Cerrar sesión
            </Button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-10 sm:py-16">
          <div className="mb-8">
            <p className="text-sm text-gray-500">Hola {firstName}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">Selecciona la aplicación que deseas usar</h1>
          </div>

          {apps.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200">
              <EmptyState
                icon={LayoutGrid}
                title="No tienes aplicaciones asignadas"
                description="Tu rol no tiene acceso a ninguna aplicación. Contacta al administrador."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {apps.map((app) => {
                const Icon = app.icon;
                const color = resolveAppColor(app.id, settings.appearance);
                return (
                  <button
                    type="button"
                    key={app.id}
                    onClick={() => navigate(app.path)}
                    className="group relative text-left bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{ ['--tw-ring-color' as string]: color }}
                  >
                    <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}1a`, color }}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{app.tag}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mt-4">{APP_LABELS[app.id]}</h2>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed min-h-[2.5rem]">{app.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium" style={{ color }}>
                      Entrar
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </AppTheme>
  );
}
