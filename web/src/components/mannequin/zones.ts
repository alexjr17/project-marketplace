/** Zonas de la BD (template_zones) llevadas al maniquí 3D. */
import type { TemplateZone } from '../../services/template-zones.service';
import { normalizeZone } from '../customizer/customizerModel';
import type { ArtArea } from './art';
import { view3DOf, type View3D } from './models';

export interface Zone3D {
  id: number;
  name: string;
  view: View3D;
  /** Área en % del escenario de su vista. */
  area: ArtArea;
  price: number;
  isRequired: boolean;
  isBlocked: boolean;
}

const ORDER: Record<View3D, number> = { front: 0, back: 1, rightSleeve: 2, leftSleeve: 3 };

/** Zonas activas de una plantilla, en el orden frente → espalda → mangas. */
export function zones3DOf(raw: TemplateZone[] | null | undefined): Zone3D[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((z) => z.isActive !== false && z.isEditable !== false && z.zoneType?.slug)
    .map((z) => {
      const n = normalizeZone(z);
      return {
        id: n.id,
        name: n.name,
        view: view3DOf(z.zoneType?.slug),
        area: { x: n.x, y: n.y, w: n.width, h: n.height, circle: n.shape === 'circle' },
        price: n.price,
        isRequired: n.isRequired,
        isBlocked: n.isBlocked,
        order: ORDER[view3DOf(z.zoneType?.slug)] * 1000 + n.sortOrder,
      };
    })
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map((z) => ({ id: z.id, name: z.name, view: z.view, area: z.area, price: z.price, isRequired: z.isRequired, isBlocked: z.isBlocked }));
}
