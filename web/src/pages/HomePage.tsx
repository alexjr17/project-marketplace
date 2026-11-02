import { useMemo } from 'react';
import { FeaturedProducts } from '../components/products/FeaturedProducts';
import { HeroSection } from '../components/home/HeroSection';
import { PromoBanner } from '../components/home/PromoBanner';
import { TrustStrip } from '../components/home/TrustStrip';
import { CategoryTiles } from '../components/home/CategoryTiles';
import { ProductShowcase } from '../components/home/ProductShowcase';
import { HowItWorks } from '../components/home/HowItWorks';
import { ReviewsSection } from '../components/home/ReviewsSection';
import { HomeCTA } from '../components/home/HomeCTA';
import { useSettings } from '../context/SettingsContext';
import { homeBlock } from '../types/settings';
import { Seo } from '../components/seo/Seo';

/**
 * Portada de la tienda ("Tienda guiada"): hero, beneficios, categorías, vitrina con pestañas,
 * personaliza en 3 pasos, secciones y banners configurados, reseñas reales y CTA final.
 * Todo se configura en Ajustes > Página de inicio.
 */
export const HomePage = () => {
  const { settings } = useSettings();
  const home = settings.home;

  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradient = `linear-gradient(to bottom right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  const enableCustomizer = home?.enableCustomizer ?? true;
  const showFeatures = home?.showFeatures ?? true;
  const features = useMemo(
    () => (home?.features ?? []).filter((f) => f.isActive).sort((a, b) => a.order - b.order),
    [home?.features],
  );

  // Secciones de productos y banners configurados, intercalados por su orden.
  const content = useMemo(() => {
    const sections = (home?.productSections ?? []).filter((s) => s.isActive).map((s) => ({ type: 'section' as const, data: s }));
    const banners = (home?.promoBanners ?? []).filter((b) => b.isActive).map((b) => ({ type: 'banner' as const, data: b }));
    return [...sections, ...banners].sort((a, b) => a.data.order - b.data.order);
  }, [home?.productSections, home?.promoBanners]);

  const categories = homeBlock(home, 'categories');
  const showcase = homeBlock(home, 'showcase');
  const howItWorks = homeBlock(home, 'howItWorks');
  const reviews = homeBlock(home, 'reviews');

  return (
    <div className="bg-gray-50 min-h-screen">
      <Seo />

      <HeroSection />

      {showFeatures && <TrustStrip features={features} />}

      {categories.isActive && <CategoryTiles title={categories.title} subtitle={categories.subtitle} />}

      {showcase.isActive && <ProductShowcase title={showcase.title} subtitle={showcase.subtitle} />}

      {enableCustomizer && howItWorks.isActive && <HowItWorks title={howItWorks.title} subtitle={howItWorks.subtitle} />}

      {content.map((item) =>
        item.type === 'section' ? (
          <FeaturedProducts key={`section-${item.data.id}`} section={item.data} />
        ) : (
          <div key={`banner-${item.data.id}`} className="py-4 md:py-6">
            <div className="max-w-7xl mx-auto px-4">
              <PromoBanner banner={item.data} />
            </div>
          </div>
        ),
      )}

      {reviews.isActive && <ReviewsSection title={reviews.title} subtitle={reviews.subtitle} />}

      {home?.cta && <HomeCTA cta={home.cta} gradient={gradient} enableCustomizer={enableCustomizer} />}
    </div>
  );
};
