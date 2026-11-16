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
  const k = Math.min(2, Math.max(0.3, scene.size));
  // Corrido a donde se movió (fracción de la vista, como en las fotos) y del tamaño pedido.
  const w = area.w * k, h = area.h * k;
  const cx = area.x + area.w / 2 + (scene.offsetX ?? 0) * 100, cy = area.y + area.h / 2 + (scene.offsetY ?? 0) * 100;
  // La textura cubre la zona y, si el diseño se sale de ella, también hasta donde llega (dentro de la vista).
  const x0 = Math.max(0, Math.min(area.x, cx - w / 2)), y0 = Math.max(0, Math.min(area.y, cy - h / 2));
  const x1 = Math.min(100, Math.max(area.x + area.w, cx + w / 2)), y1 = Math.min(100, Math.max(area.y + area.h, cy + h / 2));
  const frame = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const inside = x0 === area.x && y0 === area.y && x1 === area.x + area.w && y1 === area.y + area.h;
  return {
    // Dentro de su zona se recorta con la forma de la zona (redonda o no); si se sale, con el área.
    art: { [view]: { layers: [{ src: img, cx, cy, w, h, clip: inside ? area : { ...frame, circle: false } }] } },
    // La textura cubre solo esa área: el diseño sale nítido.
    frames: { [view]: frame },
  };
}
