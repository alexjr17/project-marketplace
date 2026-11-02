import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { paletteVars, resolveAppColor, type AppKey } from '../../theme/appTheme';

/**
 * Aplica el color de la app (variables --app-*) mientras su layout está montado.
 * Se ponen en <html> para que también lo hereden modales y menús flotantes.
 */
export function AppTheme({ app, children }: { app: AppKey; children: ReactNode }) {
  const { settings } = useSettings();
  const color = resolveAppColor(app, settings.appearance);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const vars = paletteVars(color);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.app = app;
    return () => {
      Object.keys(vars).forEach((k) => root.style.removeProperty(k));
      delete root.dataset.app;
    };
  }, [app, color]);

  return <>{children}</>;
}
