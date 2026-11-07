import { useSettings } from '../../../context/SettingsContext';
import { homeBlock } from '../../../types/settings';
import { Seo } from '../../seo/Seo';
import { ReviewsSection } from '../ReviewsSection';
import { CategoryIndex } from './CategoryIndex';
import { HeroCollection } from './HeroCollection';
import { useReducedMotion, useSmoothScroll } from './motion';
import { ShopTabs } from './ShopTabs';
import { StreetWall } from './StreetWall';
import { StudioBand } from './StudioBand';
import { TagBento } from './TagBento';
import { TagMarquee } from './TagMarquee';

/**
 * Portada de la tienda: primero lo que se vende (colección destacada, temáticas y productos),
 * después la personalización como valor añadido. Tiene su propio estilo, separado del kit del
 * panel (DESIGN_SYSTEM.md §9). Respeta los bloques de Ajustes > Página de inicio.
 */
export function HomePro() {
  const { settings } = useSettings();
  const home = settings.home;
  const reduced = useReducedMotion();
  useSmoothScroll(!reduced);

  const enableCustomizer = home?.enableCustomizer ?? true;
  const categories = homeBlock(home, 'categories');
  const showcase = homeBlock(home, 'showcase');
  const reviews = homeBlock(home, 'reviews');

  return (
    <div className="bg-white">
      <Seo />
      <HeroCollection reduced={reduced} />
      <TagMarquee reduced={reduced} />
      {showcase.isActive && <ShopTabs title={showcase.title || 'Lo más nuevo'} />}
      <TagBento title="Compra por temática" />
      {enableCustomizer && <StudioBand reduced={reduced} />}
      <StreetWall reduced={reduced} />
      {categories.isActive && <CategoryIndex />}
      {reviews.isActive && <ReviewsSection title={reviews.title} subtitle={reviews.subtitle} />}
    </div>
  );
}
