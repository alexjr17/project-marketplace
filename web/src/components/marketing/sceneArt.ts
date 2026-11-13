/**
 * Diseño de una escena puesto sobre el maniquí 3D: dentro de la zona de diseño elegida de la
 * plantilla (o una del pecho si la plantilla no tiene zonas), centrado y del tamaño pedido.
 */
import type { ArtArea, MannequinArt } from '../mannequin/art';
import { view3DOf, type View3D } from '../mannequin/models';
import type { SourceZone } from '../../services/marketing.service';
import type { Scene } from './timeline';

/** Zona del pecho para plantillas sin zonas cargadas (en % de la vista de frente). */
const CHEST: SourceZone = { id: 0, name: 'Pecho', view: 'frente', x: 32, y: 26, w: 36, h: 36, circle: false };

export function zoneOf(scene: Pick<Scene, 'zoneId'>, zones: SourceZone[]): SourceZone {
  return zones.find((z) => z.id === scene.zoneId) ?? zones.find((z) => view3DOf(z.view) === 'front') ?? zones[0] ?? CHEST;
}

export function sceneArt(scene: Scene, zones: SourceZone[], img: HTMLImageElement | null | undefined): { art: MannequinArt; frames: Partial<Record<View3D, ArtArea>> } {
  if (!scene.design || !img) return { art: {}, frames: {} };
  const z = zoneOf(scene, zones);
  const area: ArtArea = { x: z.x, y: z.y, w: z.w, h: z.h, circle: z.circle };
  const view = view3DOf(z.view);
  const k = Math.min(1, Math.max(0.3, scene.size));
  return {
    art: { [view]: { layers: [{ src: img, cx: area.x + area.w / 2, cy: area.y + area.h / 2, w: area.w * k, h: area.h * k, clip: area }] } },
    // La textura cubre solo la zona: el diseño sale más nítido.
    frames: { [view]: { x: area.x, y: area.y, w: area.w, h: area.h } },
  };
}
