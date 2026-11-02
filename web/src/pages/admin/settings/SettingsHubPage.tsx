import { Link } from 'react-router-dom';
import { ChevronRight, Settings } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { Page, PageHeader, EmptyState } from '../../../components/ui';
import { SETTINGS_NAV, canSee, entryPath, visibleTabs } from '../../../components/admin/adminNav';

/** Centro de Configuración: una tarjeta por grupo (Tienda, Pagos, Envíos, Punto de venta, Equipo…). */
export function SettingsHubPage() {
  const { hasPermission } = useAuth();
  const groups = SETTINGS_NAV.filter((g) => canSee(g, hasPermission));

  return (
    <Page>
      <PageHeader icon={Settings} title="Configuración" subtitle="Ajustes de la tienda, pagos, envíos, punto de venta y equipo" />
      {groups.length === 0 ? (
        <EmptyState title="No tienes acceso a ninguna configuración" description="Pide a un administrador los permisos que necesitas." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g) => {
            const Icon = g.icon;
            const tabs = visibleTabs(g, hasPermission);
            return (
              <div key={g.label} className="flex flex-col rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-sm">
                <Link to={entryPath(g, hasPermission)} className="group flex items-start gap-3 p-5">
                  <span className="rounded-lg bg-app-50 p-2.5 text-app-600"><Icon className="w-5 h-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 font-semibold text-gray-900">
                      {g.label}
                      <ChevronRight className="w-4 h-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-app-600" />
                    </span>
                    <span className="mt-1 block text-sm text-gray-500">{g.description}</span>
                  </span>
                </Link>
                {tabs.length > 1 && (
                  <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 px-5 py-3">
                    {tabs.map((t) => (
                      <Link key={t.path} to={t.path} className="text-sm text-gray-600 hover:text-app-700">{t.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
