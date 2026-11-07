import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { accentVars, paletteVars, resolveAppColor, type AppKey } from '../../theme/appTheme';

/**
 * Aplica el color de la app (variables --app-*) mientras su layout está montado.
 * Se ponen en <html> para que también lo hereden modales y menús flotantes.
 */
export function AppTheme({ app, children }: { app: AppKey; children: ReactNode }) {
  const { settings } = useSettings();
  const color = resolveAppColor(app, settings.appearance);
  const accent = settings.appearance?.brandColors?.accent || settings.general?.brandColors?.accent;

  useLayoutEffect(() => {
    const root = document.documentElement;
    // La tienda publica además el acento de la marca (detalles: insignias, subrayados, contador).
    const vars = app === 'store' ? { ...paletteVars(color), ...accentVars(accent) } : paletteVars(color);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.app = app;
    return () => {
      Object.keys(vars).forEach((k) => root.style.removeProperty(k));
      delete root.dataset.app;
    };
  }, [app, color, accent]);

  return <>{children}</>;
}
