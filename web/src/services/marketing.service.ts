/**
 * App Social → Estudio de contenido y Calendario (API /messaging/marketing).
 */
import { http } from '../lib/http';
import type { HfAccounts } from './mannequinModels.service';

export type CreativeKind = 'post' | 'historia' | 'reel' | 'video360';
export type SourceType = 'producto' | 'coleccion' | 'promocion' | 'diseno' | 'plantilla';
export type CopyTone = 'cercano' | 'urgente' | 'elegante' | 'divertido' | 'inspirador';

export interface SourceProduct {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  price: number;
  listPrice: number;
  discountPercent: number;
  image: string | null;
  images?: string[];
  model3d?: string | null;
  colors?: string[];
  /** Nombre de cada color (mismo orden que `colors`). */
  colorNames?: string[];
  /** Zonas de diseño de la plantilla (en % de la vista): para el 3D y para montar diseños en sus fotos. */
  zones?: SourceZone[];
  /** Fotos de la plantilla por vista y por tipo de zona (plantillas personalizables). */
  viewImages?: { front?: string; back?: string; side?: string };
  zoneTypeImages?: Record<string, string>;
}
export interface SourceZone { id: number; name: string; view: string | null; x: number; y: number; w: number; h: number; circle: boolean }
export interface SourceCollection { id: string; name: string; count: number; products: SourceProduct[] }
export interface SourcePromotion {
  id: number; name: string; code: string | null; isAuto: boolean; type: string; value: number; label: string;
  appliesTo: string; minSubtotal: number | null; endsAt: string | null; products: SourceProduct[];
}
export interface SourceDesign { id: number; name: string; category: string | null; image: string | null }

export interface CopyResult {
  title: string; subtitle: string; cta: string; caption: string; hashtags: string[]; ai: boolean;
  /** Un texto por escena del video (si se pidieron). */
  scenes?: { title: string; subtitle: string }[];
}

export interface Creative {
  id: number;
  title: string;
  kind: CreativeKind;
  source: string;
  sourceIds: Array<number | string>;
  template: string | null;
  data: Record<string, unknown>;
  media: string;
  mediaType: 'image' | 'video';
  caption: string | null;
  hashtags: string[];
  createdAt: string;
}

export interface CalendarPost {
  id: number;
  platform: 'facebook' | 'instagram';
  type: string;
  content: string | null;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduledAt: string | null;
  publishedAt: string | null;
  externalUrl: string | null;
  error: string | null;
  date: string | null;
  thumb: string | null;
  thumbType: 'image' | 'video';
  title: string;
  createdByName?: string | null;
}

/** Recomendación de la Ayuda IA para una escena del video. */
export interface SceneAdvice {
  index: number;
  transition: string;
  transitionSeconds: number;
  sound: string;
  textAnim: string;
  motion: string | null;
  seconds: number;
  reason: string;
}
export interface VideoAdvice { ai: boolean; summary: string; tips: string[]; scenes: SceneAdvice[] }

/** Ficha de la marca del estudio (logos, colores, tipografía, lema y voz). */
export interface BrandKit {
  name: string;
  slogan: string;
  description: string;
  logos: { full: string; fullLight: string; wordmark: string; wordmarkLight: string; icon: string; iconLight: string };
  colors: Array<{ key: string; name: string; hex: string }>;
  fonts: { heading: string; body: string; headingUppercase: boolean };
  voice: { tone: CopyTone; personality: string; avoid: string; hashtags: string[] };
  fontOptions?: string[];
}

export const marketingService = {
  brand: () => http.get<BrandKit>('/messaging/marketing/brand'),
  saveBrand: (data: Partial<BrandKit>) => http.put<BrandKit>('/messaging/marketing/brand', data),
  sources: <T>(type: SourceType, q?: string) => http.get<T[]>('/messaging/marketing/sources', { type, q: q || undefined }),
  copy: (data: { kind: CreativeKind; source: string; tone?: CopyTone; brief?: string; items: unknown[]; scenes?: { kind: string; about: string }[] }) =>
    http.post<CopyResult>('/messaging/marketing/copy', data),
  videoAdvice: (data: {
    tone?: CopyTone; brief?: string; ratio?: string; hasMusic: boolean; endCard: boolean;
    scenes: { kind: string; about: string; title: string; seconds: number; transition: string; sound: string | null; motion: string | null }[];
  }) => http.post<VideoAdvice>('/messaging/marketing/video-advice', data),
  garmentFront: (data: { idea: string; mannequin: boolean; background: 'oscuro' | 'claro' }) =>
    http.post<{ url: string; path: string }>('/messaging/marketing/ai-garment/front', data),
  garmentView: (data: { path: string; view: 'back' | 'left'; mannequin: boolean }) =>
    http.post<{ url: string; path: string }>('/messaging/marketing/ai-garment/view', data),
  /** La foto de un producto sin su fondo (queda guardada en el servidor). */
  productCutout: (url: string) => http.post<{ url: string; cached: boolean }>('/messaging/marketing/product-cutout', { url }),
  garmentCutout: (path: string) => http.post<{ url: string; path: string }>('/messaging/marketing/ai-garment/cutout', { path }),
  garmentMirror: (path: string) => http.post<{ url: string; path: string }>('/messaging/marketing/ai-garment/mirror', { path }),
  /** Plantilla personalizable nueva (API de plantillas: pide permiso para administrarlas). */
  createTemplate: (data: { name: string; description: string; basePrice: number; images: { front: string; back?: string; side?: string }; zoneTypeImages: Record<string, string>; tags: string[] }) =>
    http.post<{ id: number }>('/templates', data),
  createZone: (templateId: number, data: { zoneTypeId: number; name: string; positionX: number; positionY: number; maxWidth: number; maxHeight: number; shape: string; sortOrder: number; isEditable: boolean }) =>
    http.post<{ id: number }>(`/template-zones/template/${templateId}`, data),
  zoneTypes: () => http.get<{ id: number; name: string; slug: string }[]>('/zone-types'),
  aiBackdrop: (data: { style: string; idea?: string; palette: string[]; designs: string[]; ratio: string }) =>
    http.post<{ url: string; path: string; prompt: string; concept: string }>('/messaging/marketing/ai-backdrop', data),
  aiImage: (data: { prompt: string; kind: 'diseno' | 'fondo' | 'foto' | 'prenda'; ratio?: string }) =>
    http.post<{ url: string; path: string; prompt: string }>('/messaging/marketing/ai-image', data),
  voices: () => http.get<{ id: string; name: string }[]>('/messaging/marketing/narration/voices'),
  narrationScript: (data: { tone?: CopyTone; brief?: string; scenes: { kind: string; about: string; title: string; seconds: number }[] }) =>
    http.post<{ ai: boolean; lines: string[] }>('/messaging/marketing/narration/script', data),
  speak: (data: { text: string; voice: string; rate: number }) => http.blob('/messaging/marketing/narration/speak', { method: 'POST', body: data }),
  creatives: (kind?: CreativeKind) => http.get<Creative[]>('/messaging/marketing/creatives', kind ? { kind } : undefined),
  saveCreative: (meta: {
    title: string; kind: CreativeKind; source: string; sourceIds: Array<number | string>; template: string;
    data: Record<string, unknown>; caption: string; hashtags: string[];
  }, media: Blob, fileName: string) => {
    const form = new FormData();
    form.append('title', meta.title);
    form.append('kind', meta.kind);
    form.append('source', meta.source);
    form.append('sourceIds', JSON.stringify(meta.sourceIds));
    form.append('template', meta.template);
    form.append('data', JSON.stringify(meta.data));
    form.append('caption', meta.caption);
    form.append('hashtags', JSON.stringify(meta.hashtags));
    form.append('media', media, fileName);
    return http.upload<Creative>('/messaging/marketing/creatives', form);
  },
  updateCreative: (id: number, data: { title?: string; caption?: string; hashtags?: string[] }) => http.patch<Creative>(`/messaging/marketing/creatives/${id}`, data),
  deleteCreative: (id: number) => http.delete<null>(`/messaging/marketing/creatives/${id}`),
  publish: (data: { creativeIds: number[]; platforms: Array<'facebook' | 'instagram'>; caption?: string; scheduledAt?: string | null }) =>
    http.post<CalendarPost[]>('/messaging/marketing/publish', data),
  calendar: (month: string) => http.get<CalendarPost[]>('/messaging/marketing/calendar', { month }),
  reschedule: (postId: number, scheduledAt: string) => http.patch<CalendarPost>(`/messaging/marketing/posts/${postId}/schedule`, { scheduledAt }),
  cancel: (postId: number) => http.delete<null>(`/messaging/posts/${postId}`),
  accounts: (fresh = false) => http.get<HfAccounts>('/messaging/marketing/accounts', fresh ? { fresh: 1 } : undefined),
};
