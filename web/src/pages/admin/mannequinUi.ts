/** Textos y formatos compartidos de las pantallas de Modelos 3D. */
import type { Tone } from '../../components/ui';
import type { ModelKind, View3D } from '../../components/mannequin/models';
import type { MannequinSource, MannequinStatus } from '../../services/mannequinModels.service';

export const STATUS: Record<MannequinStatus, { label: string; tone: Tone }> = {
  borrador: { label: 'Foto en el chat', tone: 'purple' },
  generando: { label: 'Generando', tone: 'blue' },
  revision: { label: 'En revisión', tone: 'yellow' },
  publicado: { label: 'Publicado', tone: 'green' },
  error: { label: 'Con error', tone: 'red' },
};

export const SOURCE: Record<MannequinSource, string> = { foto: 'Foto', vistas: '4 vistas', texto: 'Descripción' };

/** Tipos de modelo: cada uno con su maniquí grafito estándar. */
export const KINDS: { value: ModelKind; label: string; description: string }[] = [
  { value: 'maniqui', label: 'Prenda de arriba', description: 'Camiseta, buso, chaqueta… en el maniquí de torso.' },
  { value: 'cabeza', label: 'Gorra o sombrero', description: 'En una cabeza de maniquí con su palo y base.' },
  { value: 'piernas', label: 'Pantalón o short', description: 'En un maniquí de cadera y piernas.' },
  { value: 'objeto', label: 'Objeto', description: 'Bolso, taza, termo… solo, sin maniquí.' },
];
export const KIND_LABEL: Record<ModelKind, string> = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<ModelKind, string>;

/** Nombre de cada vista según el tipo (una gorra no tiene mangas). */
export const viewLabels = (kind: ModelKind): Record<View3D, string> => kind === 'maniqui'
  ? { front: 'Frente', back: 'Espalda', rightSleeve: 'Manga der.', leftSleeve: 'Manga izq.' }
  : { front: 'Frente', back: 'Atrás', rightSleeve: 'Lado der.', leftSleeve: 'Lado izq.' };

/** 245 → "4 min 5 s". */
export const duration = (s: number) => {
  const m = Math.floor(Math.max(0, s) / 60), r = Math.max(0, s) % 60;
  return m ? (r ? `${m} min ${r} s` : `${m} min`) : `${r} s`;
};


/** Achica una foto a 1024 px como máximo (la IA trabaja a esa medida) y la deja en PNG. */
export function shrinkImage(dataUrl: string, max = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
