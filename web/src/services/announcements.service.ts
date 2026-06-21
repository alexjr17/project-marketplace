import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const authHeader = () => {
  const raw = localStorage.getItem('marketplace_auth');
  let token: string | null = null;
  if (raw) {
    try {
      token = JSON.parse(raw).token || null;
    } catch {
      token = null;
    }
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export type AnnouncementType = 'bar' | 'popup' | 'marquee' | 'floating';
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
  const res = await axios.get(`${API_URL}/announcements/active`);
  return res.data.data || [];
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const res = await axios.get(`${API_URL}/announcements`, { headers: authHeader() });
  return res.data.data || [];
}

export async function createAnnouncement(data: AnnouncementInput): Promise<Announcement> {
  const res = await axios.post(`${API_URL}/announcements`, data, { headers: authHeader() });
  return res.data.data;
}

export async function updateAnnouncement(id: number, data: AnnouncementInput): Promise<Announcement> {
  const res = await axios.put(`${API_URL}/announcements/${id}`, data, { headers: authHeader() });
  return res.data.data;
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await axios.delete(`${API_URL}/announcements/${id}`, { headers: authHeader() });
}
