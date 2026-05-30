import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Grid3x3, ShoppingCart, LayoutGrid, ChevronDown, MessageSquare } from 'lucide-react';

export default function AppSwitcher() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determinar aplicación actual
  const getCurrentApp = () => {
    if (location.pathname.startsWith('/pos')) return 'pos';
    if (location.pathname.startsWith('/admin-panel')) return 'admin';
    if (location.pathname.startsWith('/messaging')) return 'messaging';
    return 'store';
  };

  const currentApp = getCurrentApp();

  // Aplicaciones disponibles según permisos
  const apps = [
    {
      id: 'store',
      name: 'Tienda',
      icon: LayoutGrid,
      path: '/',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      available: true, // Todos pueden acceder
    },
    {
      id: 'pos',
      name: 'Punto de Venta',
      icon: ShoppingCart,
      path: '/pos',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      available: hasPermission('pos.access'),
    },
    {
      id: 'admin',
      name: 'Administración',
      icon: Grid3x3,
      path: '/admin-panel',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      available: user?.roleId !== 2, // Todos excepto clientes
    },
    {
      id: 'messaging',
      name: 'Social Media',
      icon: MessageSquare,
      path: '/messaging',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      available: user?.roleId !== 2, // Todos excepto clientes
    },
  ].filter((app) => app.available);

  const currentAppData = apps.find((app) => app.id === currentApp);

  if (!user || apps.length <= 1) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        title="Cambiar aplicación"
      >
        <div className={`p-1.5 rounded ${currentAppData?.bgColor}`}>
          {currentAppData && <currentAppData.icon className={`w-5 h-5 ${currentAppData.color}`} />}
        </div>
        <span className="hidden md:block font-medium text-gray-700">
          {currentAppData?.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 md:left-0 md:right-auto mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Cambiar a
          </div>
          {apps.map((app) => {
            const Icon = app.icon;
            const isCurrent = app.id === currentApp;

            return (
              <button
                key={app.id}
                onClick={() => {
                  navigate(app.path);
                  setIsOpen(false);
                }}
                disabled={isCurrent}
                className={`w-full flex items-center space-x-3 px-4 py-3 transition-colors ${
                  isCurrent
                    ? 'bg-gray-50 cursor-not-allowed'
                    : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <div className={`p-2 rounded-lg ${app.bgColor} flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${app.color}`} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-gray-900 truncate">{app.name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {app.id === 'store' && 'Navegar tienda'}
                    {app.id === 'pos' && 'Ventas y caja'}
                    {app.id === 'admin' && 'Administración'}
                    {app.id === 'messaging' && 'Inbox + publicaciones'}
                  </div>
                </div>
                {isCurrent && (
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" title="Aplicación actual" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
