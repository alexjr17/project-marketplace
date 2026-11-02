import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Palette,
  ShoppingBag,
  Sparkles,
  Flame,
  Package,
  Truck,
  Shield,
  Heart,
  Star,
  Zap,
  Gift,
  Percent,
} from 'lucide-react';
import type { HeroCard as HeroCardType, HeroCardBackground } from '../../types/settings';
import { useSettings } from '../../context/SettingsContext';
import { HeroCarousel, HeroVideo } from './HeroMedia';

// Mapeo de iconos disponibles
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  palette: Palette,
  shoppingBag: ShoppingBag,
  sparkles: Sparkles,
  flame: Flame,
  chevronRight: ChevronRight,
  package: Package,
  truck: Truck,
  shield: Shield,
  heart: Heart,
  star: Star,
  zap: Zap,
  gift: Gift,
  percent: Percent,
};

interface HeroCardProps {
  card: HeroCardType;
  isMain?: boolean;
  className?: string;
}

// Componente para renderizar el fondo según el tipo
const CardBackground = ({
  background,
  brandColors
}: {
  background: HeroCardBackground;
  brandColors: { primary: string; secondary: string; accent: string };
}) => {
  const overlayOpacity = background.overlayOpacity ?? 20;

  // Gradiente por defecto usando colores de marca
  const defaultGradient = `linear-gradient(to bottom right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  // Gradiente personalizado si está definido
  const customGradient = background.gradientColors
    ? `linear-gradient(to bottom right, ${background.gradientColors.from}, ${background.gradientColors.via || background.gradientColors.to}, ${background.gradientColors.to})`
    : defaultGradient;

  return (
    <>
      {/* Fondo según el tipo */}
      {background.type === 'gradient' && (
        <div
          className="absolute inset-0"
          style={{ background: customGradient }}
        />
      )}

      {background.type === 'image' && background.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${background.imageUrl})` }}
        />
      )}

      {background.type === 'video' && background.videoUrl && (
        <HeroVideo
          url={background.videoUrl}
          poster={background.videoPoster}
          muted={background.videoMuted ?? true}
          loop={background.videoLoop ?? true}
        />
      )}

      {background.type === 'carousel' && background.carouselImages && background.carouselImages.length > 0 && (
        <HeroCarousel
          images={background.carouselImages.filter(img => img.trim() !== '')}
          intervalMs={background.carouselInterval}
          transition={background.carouselTransition}
        />
      )}

      {/* Overlay oscuro para mejorar legibilidad */}
      {overlayOpacity > 0 && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity / 100 }}
        />
      )}

      {/* Pattern decorativo */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
    </>
  );
};

export const HeroCard = ({ card, isMain = false, className = '' }: HeroCardProps) => {
  const { settings } = useSettings();

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  // Filtrar botones activos
  const activeButtons = card.buttons.filter(btn => btn.isActive);

  return (
    <div
      className={`relative rounded-xl overflow-hidden group ${className}`}
    >
      {/* Fondo */}
      <CardBackground background={card.background} brandColors={brandColors} />

      {/* Degradado para mejorar legibilidad del texto */}
      {isMain && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent z-[1]" />
      )}

      {/* Decorative Elements */}
      <div className="absolute -right-10 -bottom-10 w-40 h-40 md:w-60 md:h-60 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute -left-10 -top-10 w-32 h-32 md:w-40 md:h-40 bg-white/10 rounded-full blur-2xl" />

      {/* Contenido */}
      <div className={`relative z-10 h-full flex flex-col ${isMain ? 'justify-center p-5 md:p-8' : 'justify-between p-4'}`}>
        {/* Para cartas laterales: Icono arriba */}
        {!isMain && (() => {
          const IconComponent = iconMap[card.icon || 'sparkles'] || Sparkles;
          return (
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <IconComponent className="w-5 h-5 text-white" />
            </div>
          );
        })()}

        {/* Badge (solo carta principal) */}
        {isMain && card.showBadge && card.badge && (
          <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full w-fit mb-2">
            <Sparkles className="w-3 h-3" />
            {card.badge}
          </span>
        )}

        {/* Título */}
        {isMain ? (
          <h1
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-black text-white leading-tight mb-2 md:mb-3"
            style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' }}
          >
            <span className="block">{card.title}</span>
            {card.titleLine2 && (
              <span className="block text-white/95">{card.titleLine2}</span>
            )}
          </h1>
        ) : (
          /* Para cartas laterales: Texto abajo */
          <div className="drop-shadow-lg">
            {card.subtitle && card.showSubtitle && (
              <p className="text-white/90 text-xs font-medium drop-shadow">{card.subtitle}</p>
            )}
            <h3 className="text-white text-lg font-bold flex items-center gap-1.5 drop-shadow-lg">
              {card.title}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </h3>
          </div>
        )}

        {/* Subtítulo (solo en carta principal) */}
        {isMain && card.showSubtitle && card.subtitle && (
          <p
            className="text-sm md:text-base text-white/95 mb-4 max-w-md"
            style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}
          >
            {card.subtitle}
          </p>
        )}

        {/* Botones (solo en carta principal) */}
        {isMain && activeButtons.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeButtons.map((button) => {
              const IconComponent = button.icon ? iconMap[button.icon] : null;

              if (button.style === 'primary') {
                return (
                  <Link
                    key={button.id}
                    to={button.link}
                    className="bg-white px-4 py-2.5 md:px-5 md:py-3 rounded-lg md:rounded-xl text-sm md:text-base font-bold hover:bg-gray-100 inline-flex items-center gap-1.5 md:gap-2 transition-colors shadow-sm group/btn"
                    style={{ color: brandColors.primary }}
                  >
                    {IconComponent && <IconComponent className="w-4 h-4 md:w-5 md:h-5 group-hover/btn:rotate-12 transition-transform" />}
                    {button.text}
                    <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                );
              }

              return (
                <Link
                  key={button.id}
                  to={button.link}
                  className="bg-white/20 backdrop-blur-sm border border-white/30 text-white px-4 py-2.5 md:px-5 md:py-3 rounded-lg md:rounded-xl text-sm md:text-base font-bold hover:bg-white/30 inline-flex items-center gap-1.5 md:gap-2 transition-all"
                >
                  {IconComponent && <IconComponent className="w-4 h-4 md:w-5 md:h-5" />}
                  {button.text}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Si es carta lateral, hacerla clickeable como Link */}
      {!isMain && activeButtons.length > 0 && (
        <Link
          to={activeButtons[0].link}
          className="absolute inset-0 z-20"
          aria-label={card.title}
        />
      )}
    </div>
  );
};

export default HeroCard;
