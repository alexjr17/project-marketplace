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
}
export interface SourceCollection { id: string; name: string; count: number; products: SourceProduct[] }
export interface SourcePromotion {
  id: number; name: string; code: string | null; isAuto: boolean; type: string; value: number; label: string;
  appliesTo: string; minSubtotal: number | null; endsAt: string | null; products: SourceProduct[];
}
export interface SourceDesign { id: number; name: string; category: string | null; image: string | null }

export interface CopyResult { title: string; subtitle: string; cta: string; caption: string; hashtags: string[]; ai: boolean }

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

/** Ficha de la marca del estudio (logos, colores, tipografía, lema y voz). */
export interface BrandKit {
  name: string;
  slogan: string;
  description: string;
  logos: { wordmark: string; wordmarkLight: string; icon: string; iconLight: string };
  colors: Array<{ key: string; name: string; hex: string }>;
  fonts: { heading: string; body: string; headingUppercase: boolean };
  voice: { tone: CopyTone; personality: string; avoid: string; hashtags: string[] };
  fontOptions?: string[];
}

export const marketingService = {
  brand: () => http.get<BrandKit>('/messaging/marketing/brand'),
  saveBrand: (data: Partial<BrandKit>) => http.put<BrandKit>('/messaging/marketing/brand', data),
  sources: <T>(type: SourceType, q?: string) => http.get<T[]>('/messaging/marketing/sources', { type, q: q || undefined }),
  copy: (data: { kind: CreativeKind; source: string; tone?: CopyTone; brief?: string; items: unknown[] }) =>
    http.post<CopyResult>('/messaging/marketing/copy', data),
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
