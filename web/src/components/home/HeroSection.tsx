import { HeroCard } from './HeroCard';
import { useSettings } from '../../context/SettingsContext';
import type { HeroCard as HeroCardType } from '../../types/settings';

// Valores por defecto para el hero
const getDefaultHeroCards = (brandColors: { primary: string; secondary: string; accent: string }): HeroCardType[] => [
  {
    id: 'main',
    position: 'main',
    order: 0,
    title: 'Diseñado por ti,',
    titleLine2: 'hecho por Vexa',
    subtitle: 'Personaliza camisetas, hoodies y más con tus propios diseños.',
    showSubtitle: true,
    showBadge: false,
    buttons: [
      {
        id: 'btn-1',
        text: 'Crear diseño',
        link: '/customizer',
        style: 'primary',
        icon: 'palette',
        isActive: true,
      },
      {
        id: 'btn-2',
        text: 'Ver catálogo',
        link: '/catalog',
        style: 'secondary',
        icon: 'shoppingBag',
        isActive: true,
      },
    ],
    background: {
      type: 'gradient',
      overlayOpacity: 0,
    },
    isActive: true,
  },
  {
    id: 'side-1',
    position: 'side',
    order: 1,
    title: 'Personaliza',
    subtitle: 'Tu creatividad',
    showSubtitle: true,
    showBadge: false,
    buttons: [
      {
        id: 'btn-side-1',
        text: 'Personalizar',
        link: '/customizer',
        style: 'primary',
        isActive: true,
      },
    ],
    background: {
      type: 'gradient',
      gradientColors: {
        from: brandColors.secondary,
        to: brandColors.secondary,
      },
      overlayOpacity: 20,
    },
    isActive: true,
  },
  {
    id: 'side-2',
    position: 'side',
    order: 2,
    title: 'Lo más vendido',
    subtitle: 'Tendencias',
    showSubtitle: true,
    showBadge: false,
    buttons: [
      {
        id: 'btn-side-2',
        text: 'Ver más',
        link: '/catalog?featured=true',
        style: 'primary',
        isActive: true,
      },
    ],
    background: {
      type: 'gradient',
      gradientColors: {
        from: brandColors.accent,
        to: brandColors.accent,
      },
      overlayOpacity: 20,
    },
    isActive: true,
  },
];

interface HeroSectionProps {
  className?: string;
}

export const HeroSection = ({ className = '' }: HeroSectionProps) => {
  const { settings } = useSettings();

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  // Obtener configuración del hero
  const heroSettings = settings.home?.hero;

  // Usar cards configurados o los por defecto
  const allCards = heroSettings?.cards?.length > 0
    ? heroSettings.cards
    : getDefaultHeroCards(brandColors);

  // Separar carta principal y laterales
  const mainCard = allCards.find(c => c.position === 'main' && c.isActive);
  const sideCards = allCards
    .filter(c => c.position === 'side' && c.isActive)
    .sort((a, b) => a.order - b.order)
    .slice(0, 3); // Máximo 3 cartas laterales

  // Configuración de visibilidad
  const showSideCards = heroSettings?.showSideCards ?? true;

  if (!mainCard) {
    return null; // No mostrar hero si no hay carta principal
  }

  // Calcular la altura total del hero basada en cantidad de cartas
  const getHeroHeight = () => {
    if (!showSideCards || sideCards.length === 0) return 'md:h-[350px]';
    switch (sideCards.length) {
      case 1:
        return 'md:h-[350px]';
      case 2:
        return 'md:h-[380px]';
      case 3:
        return 'md:h-[420px]';
      default:
        return 'md:h-[350px]';
    }
  };

  return (
    <div className={`bg-gray-100 py-4 md:py-6 ${className}`}>
      <div className="max-w-7xl mx-auto px-4">
        {/* Bento Layout con Flexbox */}
        <div className={`flex flex-col md:flex-row gap-3 md:gap-4 ${getHeroHeight()}`}>
          {/* Main Card - Ocupa 2/3 del ancho y toda la altura */}
          <HeroCard
            card={mainCard}
            isMain
            className={`min-h-[220px] md:min-h-0 ${showSideCards && sideCards.length > 0 ? 'md:flex-[2]' : 'md:flex-1'} h-full`}
          />

          {/* Side Cards Container - Columna vertical */}
          {showSideCards && sideCards.length > 0 && (
            <div className="hidden md:flex md:flex-col md:flex-1 gap-3 md:gap-4">
              {sideCards.map((card) => (
                <HeroCard
                  key={card.id}
                  card={card}
                  className="flex-1"
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
