/**
 * Color por aplicación. Cada app (Tienda, Administración, POS, Mensajería,
 * Fábrica) tiene su color de acento, configurable en Ajustes > Apariencia.
 * El color se publica como variables CSS --app-50 … --app-900 ("r g b") y las
 * vistas lo usan con las clases de Tailwind `app-*` (bg-app-600, text-app-700…).
 */
export type AppKey = 'store' | 'admin' | 'pos' | 'messaging' | 'manufacturing';

export type AppColors = Record<Exclude<AppKey, 'store'>, string>;

/** Colores por defecto (el de la Tienda es el color de marca primario). */
export const DEFAULT_APP_COLORS: AppColors = {
  admin: '#4f46e5', // índigo: gestión de la tienda
  pos: '#059669', // esmeralda: caja y ventas
  messaging: '#db2777', // rosa: redes y mensajería
  manufacturing: '#ea580c', // naranja: fábrica
};

export const DEFAULT_STORE_COLOR = '#7c3aed';

export const APP_LABELS: Record<AppKey, string> = {
  store: 'Tienda',
  admin: 'Administración',
  pos: 'Punto de Venta',
  messaging: 'Social Media',
  manufacturing: 'Fábrica',
};

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
// El color configurado es el tono 600 (botones). Los claros se mezclan con blanco
// y los oscuros con negro.
const MIX: Record<(typeof SHADES)[number], [number, 'w' | 'b']> = {
  50: [0.95, 'w'], 100: [0.88, 'w'], 200: [0.75, 'w'], 300: [0.55, 'w'], 400: [0.35, 'w'],
  500: [0.15, 'w'], 600: [0, 'w'], 700: [0.15, 'b'], 800: [0.3, 'b'], 900: [0.45, 'b'],
};

const parseHex = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};

/** Variables CSS de la paleta generada a partir de un color (#rrggbb). */
export function paletteVars(hex: string, fallback = DEFAULT_STORE_COLOR): Record<string, string> {
  const rgb = parseHex(hex) ?? parseHex(fallback)!;
  const vars: Record<string, string> = {};
  for (const s of SHADES) {
    const [amt, to] = MIX[s];
    const target = to === 'w' ? 255 : 0;
    vars[`--app-${s}`] = rgb.map((c) => Math.round(c + (target - c) * amt)).join(' ');
  }
  return vars;
}

/** Color efectivo de una app según la configuración guardada. */
export function resolveAppColor(
  app: AppKey,
  appearance?: { appColors?: Partial<AppColors>; brandColors?: { primary?: string } },
): string {
  if (app === 'store') return appearance?.brandColors?.primary || DEFAULT_STORE_COLOR;
  return appearance?.appColors?.[app] || DEFAULT_APP_COLORS[app];
}
