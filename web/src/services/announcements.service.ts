import { httpKeepUrls as client } from '../lib/http';

export type AnnouncementType =
  | 'bar'
  | 'popup'
  | 'marquee'
  | 'floating'
  | 'countdown'
  | 'toast';
export type AnnouncementVariant = 'info' | 'promo' | 'warning' | 'success' | 'dark';

export type AnnouncementLayout = 'standard' | 'image' | 'overlay';
export type AnnouncementSize = 'sm' | 'md' | 'lg' | 'xl';

export interface Announcement {
  id: number;
  type: AnnouncementType;
  layout?: AnnouncementLayout | null;
  size?: AnnouncementSize | null;
  title?: string | null;
  message?: string | null;
  imageUrl?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  couponCode?: string | null;
  variant: AnnouncementVariant;
  bgColor?: string | null;
  textColor?: string | null;
  isActive: boolean;
  dismissible: boolean;
  target: 'all' | 'home' | 'catalog';
  frequency: 'always' | 'session' | 'daily';
  priority: number;
  startsAt?: string | null;
  endsAt?: string | null;
}

export type AnnouncementInput = Omit<Announcement, 'id'>;

/** Anuncios activos (público, para la tienda). */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  return (await client.get<Announcement[]>('/announcements/active')) || [];
}

export async function listAnnouncements(): Promise<Announcement[]> {
  return (await client.get<Announcement[]>('/announcements')) || [];
}

export async function createAnnouncement(data: AnnouncementInput): Promise<Announcement> {
  return client.post<Announcement>('/announcements', data);
}

export async function updateAnnouncement(id: number, data: AnnouncementInput): Promise<Announcement> {
  return client.put<Announcement>(`/announcements/${id}`, data);
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await client.delete(`/announcements/${id}`);
}
