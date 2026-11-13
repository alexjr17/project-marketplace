/**
 * Admin → Modelos 3D: maniquíes generados con IA (API /mannequin-models).
 * Estados: generando → revision (se revisa y ajusta) → publicado (se elige en las plantillas); o error.
 */
import { http } from '../lib/http';
import type { GeneratedModelConfig, ModelKind, PublishedModel3D } from '../components/mannequin/models';

/** borrador: la foto se arma y pule en el chat, todavía sin 3D. */
export type MannequinStatus = 'borrador' | 'generando' | 'revision' | 'publicado' | 'error';
export type MannequinSource = 'foto' | 'vistas' | 'texto';
export type MannequinView = 'front' | 'back' | 'left' | 'right';

export interface MannequinModel {
  id: number;
  key: string;
  name: string;
  status: MannequinStatus;
  source: MannequinSource;
  prompt: string | null;
  quality: 'normal' | 'alta';
  inputImages: Partial<Record<MannequinView, string>>;
  model: string | null;
  poster: string | null;
  config: GeneratedModelConfig;
  error: string | null;
  account: number | null;
  seconds: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** Plantillas que lo usan. */
  templates: number;
  createdAt: string;
}

export interface HfAccount {
  account: number;
  user: string | null;
  ok: boolean;
  /** Segundos de GPU por día y los que quedan hoy. */
  base: number;
  left: number;
  resetsAt: string | null;
  runsLimit: number;
  runsLeft: number;
  runsResetAt: string | null;
}

export interface HfAccounts {
  accounts: HfAccount[];
  /** Segundos que pide cada tipo de generación. */
  needs: { photo: number; views: number; text: number; edit: number };
  totalLeft: number;
}

/** Mensaje del chat para pulir el modelo: la instrucción y la foto que devolvió la IA. */
export interface MannequinEdit {
  id: number;
  prompt: string;
  status: 'procesando' | 'listo' | 'error';
  /** text: foto desde la descripción · base: desde una foto de referencia · edit: cambio · view: otra vista. */
  mode: 'text' | 'base' | 'edit' | 'view';
  /** En las vistas para el 3D: back, left o right. */
  view: 'back' | 'left' | 'right' | null;
  /** Primer mensaje del chat. */
  initial: boolean;
  image: string | null;
  base: string | null;
  error: string | null;
  account: number | null;
  seconds: number | null;
  /** Con esta foto se generó el 3D actual. */
  applied: boolean;
  createdAt: string;
}

/** Nuevo modelo: borrador con su primer mensaje en el chat (descripción y/o foto de referencia). */
export interface CreateMannequin {
  name: string;
  kind?: ModelKind;
  prompt?: string;
  /** Foto de referencia (data URL). */
  image?: string;
}

export const mannequinModelsService = {
  list: () => http.get<MannequinModel[]>('/mannequin-models'),
  get: (id: number) => http.get<MannequinModel>(`/mannequin-models/${id}`),
  accounts: (fresh = false) => http.get<HfAccounts>('/mannequin-models/accounts', fresh ? { fresh: 1 } : undefined),
  create: (data: CreateMannequin) => http.post<MannequinModel>('/mannequin-models', data),
  update: (id: number, data: { name?: string; config?: GeneratedModelConfig; poster?: string; published?: boolean }) =>
    http.put<MannequinModel>(`/mannequin-models/${id}`, data),
  retry: (id: number) => http.post<MannequinModel>(`/mannequin-models/${id}/retry`),
  remove: (id: number) => http.delete<null>(`/mannequin-models/${id}`),
  edits: (id: number) => http.get<MannequinEdit[]>(`/mannequin-models/${id}/edits`),
  addEdit: (id: number, data: { prompt?: string; image?: string; fromEditId?: number }) => http.post<MannequinEdit>(`/mannequin-models/${id}/edits`, data),
  /** 3D solo con esa foto (menos fiel atrás y a los lados). */
  applyEdit: (id: number, editId: number) => http.post<MannequinModel>(`/mannequin-models/${id}/edits/${editId}/apply`),
  /** Aprueba la foto de frente y arma la espalda y los lados. */
  approve: (id: number, editId: number) => http.post<MannequinEdit[]>(`/mannequin-models/${id}/edits/${editId}/approve`),
  redoView: (id: number, view: 'back' | 'left' | 'right', prompt?: string) => http.post<MannequinEdit>(`/mannequin-models/${id}/views/${view}`, { prompt }),
  /** Fotos reales del producto como las 4 vistas (no gastan GPU). */
  uploadViews: (id: number, images: Record<'front' | 'back' | 'left' | 'right', string>) =>
    http.post<MannequinEdit[]>(`/mannequin-models/${id}/views/upload`, { images }),
  /** 3D con las 4 vistas. */
  generateFromViews: (id: number) => http.post<MannequinModel>(`/mannequin-models/${id}/views/generate`),
  published: () => http.get<PublishedModel3D[]>('/mannequin-models/public'),
};
