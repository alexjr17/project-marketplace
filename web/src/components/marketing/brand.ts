/**
 * Ficha de la marca → marca lista para dibujar (logos cargados y tipografías de Google Fonts listas).
 */
import { useCallback, useEffect, useState } from 'react';
import { marketingService, type BrandKit } from '../../services/marketing.service';
import { loadImage } from './media';
import type { Brand } from './render';

const loadedFonts = new Set<string>(['Inter']);

/** Carga una tipografía de Google Fonts (si no está) y espera a que el navegador la tenga. */
export async function loadFont(family: string): Promise<void> {
  if (!family) return;
  if (!loadedFonts.has(family)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
    loadedFonts.add(family);
    await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 4000); });
  }
  try {
    await Promise.all([document.fonts.load(`800 40px "${family}"`), document.fonts.load(`500 40px "${family}"`)]);
  } catch { /* se usa la tipografía de respaldo */ }
}

export const colorOf = (kit: BrandKit, key: string, fallback: string) => kit.colors.find((c) => c.key === key)?.hex || fallback;

export async function brandFromKit(kit: BrandKit): Promise<Brand> {
  const [logo, logoOnDark, icon, iconOnDark] = await Promise.all([
    loadImage(kit.logos.wordmark), loadImage(kit.logos.wordmarkLight), loadImage(kit.logos.icon), loadImage(kit.logos.iconLight),
    loadFont(kit.fonts.heading), loadFont(kit.fonts.body),
  ]);
  return {
    name: kit.name,
    slogan: kit.slogan,
    primary: colorOf(kit, 'primary', '#1F1D1E'),
    accent: colorOf(kit, 'accent', '#ABD04C'),
    paper: colorOf(kit, 'paper', '#F3F3EE'),
    secondary: colorOf(kit, 'secondary', '#747474'),
    logo, logoOnDark, icon, iconOnDark,
    headingFont: kit.fonts.heading,
    bodyFont: kit.fonts.body,
    uppercase: kit.fonts.headingUppercase,
  };
}

/** Ficha de la marca y la marca lista para dibujar. */
export function useBrandKit() {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const reload = useCallback(async () => {
    const k = await marketingService.brand();
    setKit(k);
    setBrand(await brandFromKit(k));
    return k;
  }, []);
  useEffect(() => {
    let alive = true;
    marketingService.brand()
      .then(async (k) => { const b = await brandFromKit(k); if (alive) { setKit(k); setBrand(b); } })
      .catch(() => { /* sin ficha: el estudio espera */ });
    return () => { alive = false; };
  }, []);
  return { kit, brand, reload, setKit, setBrand };
}
