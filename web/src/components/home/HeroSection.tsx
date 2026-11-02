import { useSettings } from '../../context/SettingsContext';
import { useCurrency } from '../../hooks/useCurrency';
import { useStoreData } from '../../hooks/useStoreData';
import { productsService } from '../../services/products.service';
import type { Product } from '../../types/product';
import { Skeleton } from '../ui';
import { HeroSlider } from './HeroSlider';
import { HeroSideCard } from './HeroSideCard';
import { buildHeroSlides, getDefaultHeroCards, heroInterval, MAX_HERO_SLIDES, resolveSideCards } from './heroModel';
import { fetchShowcase as fetchTab } from './storeQueries';

const fetchFeatured = () =>
  productsService.getAll({ featured: true, isActive: true, limit: MAX_HERO_SLIDES }).then((r) => r.data || []);

interface HeroSectionProps {
  className?: string;
}

/**
 * Hero "vitrina" de la portada: slider de diapositivas (configuradas o armadas con los productos
 * destacados) y hasta 3 tarjetas laterales con producto (Personaliza, Ofertas/Novedades…).
 * Los productos se piden con las mismas claves que la vitrina de abajo (`showcase:*`), así que
 * no se duplican peticiones.
 */
export const HeroSection = ({ className = '' }: HeroSectionProps) => {
  const { settings } = useSettings();
  const { format } = useCurrency();

  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const hero = settings.home?.hero;
  const enableCustomizer = settings.home?.enableCustomizer ?? true;

  const allCards = hero?.cards?.length ? hero.cards : getDefaultHeroCards(brandColors, enableCustomizer);
  const mainCard = allCards.find((c) => c.position === 'main' && c.isActive);
  const showSideCards = hero?.showSideCards ?? true;
  const sideCardsRaw = showSideCards
    ? allCards.filter((c) => c.position === 'side' && c.isActive).sort((a, b) => a.order - b.order).slice(0, 3)
    : [];

  const autoFromFeatured = hero?.autoSlidesFromFeatured !== false;
  const hasConfiguredSlides = !!mainCard?.slides?.some((s) => s.isActive);
  const needProducts = !!mainCard && ((!hasConfiguredSlides && autoFromFeatured) || sideCardsRaw.length > 0);

  const featured = useStoreData<Product[]>(needProducts && !hasConfiguredSlides && autoFromFeatured ? 'hero:featured' : null, fetchFeatured);
  const newest = useStoreData<Product[]>(needProducts ? 'showcase:new' : null, fetchTab('new'));
  const sale = useStoreData<Product[]>(sideCardsRaw.length > 0 ? 'showcase:sale' : null, fetchTab('sale'));

  const slides = mainCard ? buildHeroSlides({ mainCard, autoFromFeatured, featured: featured.data, newest: newest.data, format }) : [];
  const sideCards = resolveSideCards({ cards: sideCardsRaw, sale: sale.data, newest: newest.data, featured: featured.data, format });

  if (!mainCard) return null; // sin carta principal no hay hero

  // Mientras llegan los productos de las diapositivas automáticas se reserva el mismo alto.
  const waitingSlides = !hasConfiguredSlides && autoFromFeatured && (featured.loading || newest.loading);
  const mobileSide = hero?.sideCardsVisibleOnMobile ?? true;
  const scrollRow = sideCards.length > 2;
  const cols = sideCards.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  const colsMd = ['', 'md:grid-cols-1', 'md:grid-cols-2', 'md:grid-cols-3'][sideCards.length];

  return (
    <div className={`py-4 md:py-6 ${className}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col xl:flex-row gap-3 md:gap-4 xl:h-[420px]">
          {waitingSlides ? (
            <div className={`${sideCards.length ? 'xl:flex-[2]' : 'xl:flex-1'} min-w-0 h-[460px] sm:h-[480px] md:h-[380px] xl:h-full rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col-reverse md:flex-row`} aria-busy="true" aria-label="Cargando vitrina">
              <div className="flex-1 p-6 md:pl-16 space-y-3 flex flex-col justify-center">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-10 w-40" />
              </div>
              <div className="h-[200px] md:h-auto md:flex-1 p-5 md:p-8 flex items-center justify-center">
                <Skeleton className="h-full aspect-square rounded-2xl" />
              </div>
            </div>
          ) : (
            <HeroSlider
              slides={slides}
              intervalMs={heroInterval(hero)}
              brandColors={brandColors}
              className={`${sideCards.length ? 'xl:flex-[2]' : 'xl:flex-1'} min-w-0`}
            />
          )}

          {sideCards.length > 0 && (
            <div
              className={`${mobileSide ? (scrollRow ? 'flex' : 'grid') : 'hidden'} ${scrollRow ? 'overflow-x-auto snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible' : cols} ${colsMd} md:grid xl:flex xl:flex-col xl:flex-1 gap-3 md:gap-4 min-w-0`}
            >
              {sideCards.map((item) => (
                <HeroSideCard
                  key={item.card.id}
                  item={item}
                  className={`xl:flex-1 ${scrollRow ? 'w-[46%] flex-shrink-0 snap-start md:w-auto' : ''}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
