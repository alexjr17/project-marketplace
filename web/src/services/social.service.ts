import api from './api.service';
import { http } from '../lib/http';
import { assetUrl as toAbsoluteUrl } from '../utils/assetUrl';
import type { SocialPlatform, SocialPost, SocialPostStatus } from '../types/messaging';

export interface SocialPostListParams {
  status?: SocialPostStatus;
  platform?: SocialPlatform;
  perPage?: number;
}

export interface SocialPostListResult {
  data: SocialPost[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

export interface CreatePostData {
  platform: SocialPlatform;
  content?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
}

class SocialService {
  async list(params: SocialPostListParams = {}): Promise<SocialPostListResult> {
    const response = await api.get<SocialPost[]>('/messaging/posts', params);
    const raw = response as unknown as {
      data: SocialPost[];
      pagination: SocialPostListResult['pagination'];
    };
    return {
      data: raw.data ?? [],
      pagination: raw.pagination ?? { page: 1, perPage: 20, total: 0, totalPages: 1 },
    };
  }

  async publishNow(data: CreatePostData): Promise<SocialPost | null> {
    const response = await api.post<SocialPost>('/messaging/posts/publish', data);
    return response.data ?? null;
  }

  async saveDraft(data: CreatePostData): Promise<SocialPost | null> {
    const response = await api.post<SocialPost>('/messaging/posts', data);
    return response.data ?? null;
  }

  async publishExisting(id: number): Promise<SocialPost | null> {
    const response = await api.post<SocialPost>(`/messaging/posts/${id}/publish`);
    return response.data ?? null;
  }

  async remove(id: number): Promise<void> {
    await api.delete(`/messaging/posts/${id}`);
  }

  /**
   * Sube una imagen al backend y devuelve la URL pública.
   * El backend la guarda en /public/uploads/{folder} y devuelve una ruta
   * relativa (`/uploads/...`). Aquí la convertimos a URL absoluta para que
   * la `<img>` la pueda mostrar en el preview.
   */
  async uploadImage(file: File, folder: string = 'general'): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);

    const data = await http.upload<{ url?: string }>('/uploads/image', formData);
    if (!data?.url) throw new Error('No se pudo subir la imagen');
    return toAbsoluteUrl(data.url); // "/uploads/general/abc.jpg" → URL completa
  }

  /**
   * Sube una imagen en base64 (formato `data:image/...;base64,...`) al backend
   * y devuelve la URL pública del archivo guardado. Útil para convertir las
   * imágenes que algunos productos guardan en formato base64 dentro de la BD
   * en URLs descargables por Meta/Facebook.
   */
  async uploadBase64(dataUrl: string, folder: string = 'general'): Promise<string> {
    const data = await http.post<{ url?: string }>('/uploads/base64', { image: dataUrl, folder });
    if (!data?.url) throw new Error('No se pudo subir la imagen base64');
    return toAbsoluteUrl(data.url);
  }
}

export const socialService = new SocialService();
export default socialService;
