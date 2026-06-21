import { useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';

interface SeoProps {
  title?: string;
  description?: string;
  /** Solo se usa como og:image si es una URL http(s) (las imágenes base64 no sirven para compartir). */
  image?: string;
  type?: 'website' | 'product' | 'article';
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function isHttpUrl(s?: string): s is string {
  return !!s && /^https?:\/\//i.test(s);
}

function clean(text?: string, max = 160): string {
  if (!text) return '';
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

/**
 * Actualiza título y meta tags (description, Open Graph, Twitter, canonical)
 * por página. Client-side: mejora Google y el título de pestaña. Para vistas
 * previas de redes (WhatsApp/FB) que no ejecutan JS, sirven los defaults del
 * index.html (requeriría prerender/SSR para previews por producto).
 */
export function Seo({ title, description, image, type = 'website' }: SeoProps) {
  const { settings } = useSettings();
  const siteName = settings.general?.siteName || 'Vexa';
  const desc = clean(description) || clean(settings.general?.siteDescription);
  const ogImage = isHttpUrl(image) ? image : (isHttpUrl(settings.general?.logo) ? settings.general!.logo! : '');

  useEffect(() => {
    document.title = title ? `${title} · ${siteName}` : siteName;

    if (desc) upsertMeta('name', 'description', desc);
    upsertMeta('property', 'og:site_name', siteName);
    upsertMeta('property', 'og:title', title || siteName);
    if (desc) upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:url', window.location.href);
    if (ogImage) upsertMeta('property', 'og:image', ogImage);

    upsertMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', title || siteName);
    if (desc) upsertMeta('name', 'twitter:description', desc);
    if (ogImage) upsertMeta('name', 'twitter:image', ogImage);

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = window.location.href.split('?')[0].split('#')[0];
  }, [title, desc, ogImage, type, siteName]);

  return null;
}

export default Seo;
