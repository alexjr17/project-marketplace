import { Ban, Film, Image, Images, Palette, Paintbrush, Sun } from 'lucide-react';
import type { HeroCardBackground } from '../../types/settings';

/** Nombres e iconos de los tipos de fondo y de visual del hero (editor de la configuración). */
export const HERO_TYPE_LABELS: Record<string, string> = {
  none: 'Ninguno',
  light: 'Claro',
  brand: 'Marca suave',
  gradient: 'Gradiente',
  image: 'Imagen',
  video: 'Video',
  carousel: 'Carrusel',
};
export const HERO_TYPE_ICONS: Record<string, typeof Palette> = {
  none: Ban, light: Sun, brand: Paintbrush, gradient: Palette, image: Image, video: Film, carousel: Images,
};

/** Falta el contenido del tipo elegido (imagen, video o imágenes del carrusel)? Devuelve el mensaje. */
export function missingHeroContent(type: string, v: Partial<Omit<HeroCardBackground, 'type'>>, what: 'fondo' | 'visual' = 'fondo'): string | null {
  if (type === 'image' && what === 'fondo' && !v.imageUrl?.trim()) return 'Sube la imagen de fondo o elige otro fondo';
  if (type === 'video' && !v.videoUrl?.trim()) return `Pega el enlace del video del ${what} o elige otro tipo`;
  if (type === 'carousel' && !(v.carouselImages ?? []).some((u) => u?.trim())) return `Agrega al menos una imagen al carrusel del ${what}`;
  return null;
}
