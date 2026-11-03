/**
 * Estado de los diseños del estudio con deshacer / rehacer.
 *
 * - Las acciones que cambian diseños guardan una foto en `past` (y vacían `future`).
 * - Un arrastre manda `begin` al empezar (guarda la foto) y luego `update` con
 *   `record: false` en cada movimiento: todo el arrastre se deshace de una vez.
 * - Cada cambio de posición/tamaño pasa por clampToZone: el diseño no sale del área imprimible.
 */
import { clampToZone, normalizeAngle, type StudioDesign, type StudioZone } from './customizerModel';

export const HISTORY_LIMIT = 50;

export interface StudioState {
  designs: StudioDesign[];
  selectedId: string | null;
  past: StudioDesign[][];
  future: StudioDesign[][];
}

export type StudioAction =
  | { type: 'load'; designs: StudioDesign[] }
  | { type: 'add'; design: StudioDesign; zone: StudioZone }
  | { type: 'update'; id: string; patch: Partial<Pick<StudioDesign, 'position' | 'size' | 'rotation' | 'opacity'>>; zone?: StudioZone; record?: boolean }
  | { type: 'begin' }
  | { type: 'remove'; id: string }
  | { type: 'select'; id: string | null }
  | { type: 'toFront'; id: string }
  | { type: 'duplicate'; id: string; zone: StudioZone; newId: string }
  | { type: 'moveToZone'; id: string; zone: StudioZone }
  | { type: 'undo' }
  | { type: 'redo' };

export const initialStudioState: StudioState = { designs: [], selectedId: null, past: [], future: [] };

const remember = (s: StudioState): Pick<StudioState, 'past' | 'future'> => ({
  past: [...s.past, s.designs].slice(-HISTORY_LIMIT),
  future: [],
});

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'load':
      return { designs: action.designs, selectedId: action.designs[0]?.id ?? null, past: [], future: [] };

    case 'add':
      return { ...state, ...remember(state), designs: [...state.designs, clampToZone(action.design, action.zone)], selectedId: action.design.id };

    case 'begin':
      return { ...state, ...remember(state) };

    case 'update': {
      const current = state.designs.find((d) => d.id === action.id);
      if (!current) return state;
      let next: StudioDesign = { ...current, ...action.patch };
      if (action.patch.rotation !== undefined) next.rotation = normalizeAngle(action.patch.rotation);
      if (action.patch.opacity !== undefined) next.opacity = Math.min(1, Math.max(0.1, action.patch.opacity));
      if (action.zone && (action.patch.position || action.patch.size)) next = clampToZone(next, action.zone);
      const designs = state.designs.map((d) => (d.id === action.id ? next : d));
      return action.record === false ? { ...state, designs } : { ...state, ...remember(state), designs };
    }

    case 'remove': {
      const designs = state.designs.filter((d) => d.id !== action.id);
      if (designs.length === state.designs.length) return state;
      return { ...state, ...remember(state), designs, selectedId: state.selectedId === action.id ? null : state.selectedId };
    }

    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };

    case 'toFront': {
      const d = state.designs.find((x) => x.id === action.id);
      if (!d || state.designs[state.designs.length - 1] === d) return state;
      return { ...state, ...remember(state), designs: [...state.designs.filter((x) => x.id !== action.id), d] };
    }

    case 'duplicate': {
      const d = state.designs.find((x) => x.id === action.id);
      if (!d) return state;
      const copy = clampToZone(
        { ...d, id: action.newId, viewSlug: action.zone.viewSlug, viewType: action.zone.viewSlug, zoneId: `view-${action.zone.viewSlug}`, templateZoneId: action.zone.id, zoneName: action.zone.name },
        action.zone,
      );
      return { ...state, ...remember(state), designs: [...state.designs, copy], selectedId: copy.id };
    }

    case 'moveToZone': {
      const d = state.designs.find((x) => x.id === action.id);
      if (!d || d.templateZoneId === action.zone.id) return state;
      const moved = clampToZone({ ...d, templateZoneId: action.zone.id, zoneName: action.zone.name }, action.zone);
      return { ...state, ...remember(state), designs: state.designs.map((x) => (x.id === action.id ? moved : x)) };
    }

    case 'undo': {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      const selectedId = prev.some((d) => d.id === state.selectedId) ? state.selectedId : prev[prev.length - 1]?.id ?? null;
      return { designs: prev, selectedId, past: state.past.slice(0, -1), future: [state.designs, ...state.future].slice(0, HISTORY_LIMIT) };
    }

    case 'redo': {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      const selectedId = next.some((d) => d.id === state.selectedId) ? state.selectedId : next[next.length - 1]?.id ?? null;
      return { designs: next, selectedId, past: [...state.past, state.designs].slice(-HISTORY_LIMIT), future: rest };
    }

    default:
      return state;
  }
}
