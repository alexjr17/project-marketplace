import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  ShoppingCart,
  LayoutGrid,
  MessageSquare,
  ArrowRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface AppCard {
  id: string;
  name: string;
  tag: string;
  description: string;
  icon: LucideIcon;
  path: string;
  /** clases tailwind para el acento del card */
  ring: string;
  iconBg: string;
  iconColor: string;
  available: boolean;
}

/**
 * Pantalla "Selecciona la aplicación" — landing para usuarios de staff que no
 * tienen acceso a la Tienda. Muestra solo las apps a las que el rol tiene
 * acceso. Si solo hay una, entra directo.
 */
export default function AppSelectorPage() {
  const { user, hasPermission, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const apps = useMemo<AppCard[]>(() => {
    const all: AppCard[] = [
      {
        id: 'store',
        name: 'Tienda',
        tag: 'Venta online',
        description: 'Explora el catálogo y gestiona la tienda en línea.',
        icon: Store,
        path: '/',
        ring: 'hover:ring-blue-400/60',
        iconBg: 'bg-blue-500/15',
        iconColor: 'text-blue-300',
        available: hasPermission('store.access'),
      },
      {
        id: 'pos',
        name: 'Punto de Venta',
        tag: 'Caja registradora',
        description: 'Controla las ventas, la caja y los fiados de tu negocio.',
        icon: ShoppingCart,
        path: '/pos',
        ring: 'hover:ring-emerald-400/60',
        iconBg: 'bg-emerald-500/15',
        iconColor: 'text-emerald-300',
        available: hasPermission('pos.access'),
      },
      {
        id: 'admin',
        name: 'Administración',
        tag: 'Panel de gestión',
        description: 'Productos, pedidos, inventario, clientes y configuración.',
        icon: LayoutGrid,
        path: '/admin-panel',
        ring: 'hover:ring-purple-400/60',
        iconBg: 'bg-purple-500/15',
        iconColor: 'text-purple-300',
        available: isAdmin,
      },
      {
        id: 'messaging',
        name: 'Social Media',
        tag: 'Inbox + publicaciones',
        description: 'Conversaciones, canales conectados y publicaciones.',
        icon: MessageSquare,
        path: '/messaging',
        ring: 'hover:ring-pink-400/60',
        iconBg: 'bg-pink-500/15',
        iconColor: 'text-pink-300',
        available: hasPermission('messaging.access'),
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-700 flex flex-col">
      {/* Barra superior */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-white/90 font-semibold tracking-tight">
          {user?.roleName ? `Rol: ${user.roleName}` : 'Mi cuenta'}
        </span>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 sm:px-10 pb-12 max-w-6xl mx-auto w-full">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-white text-3xl sm:text-4xl font-extrabold leading-tight">
            Hola {firstName},
          </h1>
          <p className="text-white/85 text-2xl sm:text-3xl font-bold mt-1">
            Selecciona la aplicación que deseas usar
          </p>
        </div>

        {apps.length === 0 ? (
          <div className="bg-white/10 border border-white/15 rounded-2xl p-8 text-center text-white/90 max-w-lg">
            <p className="font-semibold text-lg mb-1">No tienes aplicaciones asignadas</p>
            <p className="text-white/70 text-sm">
              Tu rol no tiene acceso a ninguna aplicación. Contacta al administrador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {apps.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.id}
                  onClick={() => navigate(app.path)}
                  className={`group text-left bg-slate-900/60 backdrop-blur border border-white/10 rounded-2xl p-6 ring-1 ring-transparent transition-all hover:-translate-y-1 hover:bg-slate-900/80 ${app.ring}`}
                >
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">
                    {app.tag}
                  </span>
                  <div className="flex items-center gap-3 mt-4">
                    <div className={`p-2.5 rounded-xl ${app.iconBg}`}>
                      <Icon className={`w-6 h-6 ${app.iconColor}`} />
                    </div>
                    <h2 className="text-white text-2xl font-extrabold">{app.name}</h2>
                  </div>
                  <p className="text-white/65 text-sm mt-3 leading-relaxed min-h-[3rem]">
                    {app.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-full border-2 border-white/30 text-white group-hover:border-white group-hover:bg-white group-hover:text-slate-900 transition-colors">
                      <ArrowRight className="w-5 h-5" />
                    </span>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400/80" />
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400/60" />
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-400/40" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
