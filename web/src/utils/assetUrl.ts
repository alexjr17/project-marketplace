// Resuelve la URL de imágenes/archivos servidos por el backend.
//
// El backend guarda las imágenes subidas con rutas RELATIVAS (ej.
// "/uploads/templates/x.png"). En desarrollo el proxy de Vite las redirige a
// la API, pero en producción (front en un dominio distinto al backend) una
// ruta relativa apuntaría al dominio del front y daría 404. Este helper las
// convierte en absolutas usando el origen del backend (VITE_API_URL sin "/api").
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '');

export function assetUrl(path?: string | null): string {
  if (!path) return '';
  // Ya absoluta (http, https, //cdn...), data: o blob: → se devuelve tal cual.
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `${API_BASE}/${path.replace(/^\/+/, '')}`;
}

export default assetUrl;
