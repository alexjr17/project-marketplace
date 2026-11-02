import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { PromoBanner as PromoBannerType, HeroCardBackground } from '../../types/settings';
import { useSettings } from '../../context/SettingsContext';

// Componente para el fondo con carrusel de imágenes
const CarouselBackground = ({
  images,
  interval = 5000,
}: {
  images: string[];
  interval?: number;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, interval);

    return () => clearInterval(timer);
  }, [images.length, interval]);

  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {images.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
            index === currentIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url(${image})` }}
        />
      ))}
    </div>
  );
};

// Helper para extraer ID de YouTube
const getYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Componente para el fondo de video
const VideoBackground = ({
  videoUrl,
  poster,
  muted = true,
  loop = true
}: {
  videoUrl: string;
  poster?: string;
  muted?: boolean;
  loop?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeId = getYouTubeId(videoUrl);

  useEffect(() => {
    if (videoRef.current && !youtubeId) {
      videoRef.current.play().catch(() => {});
    }
  }, [youtubeId]);

  if (youtubeId) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <iframe
          className="absolute top-1/2 left-1/2 w-[300%] h-[300%] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title="Video background"
        />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 w-full h-full object-cover"
      src={videoUrl}
      poster={poster}
      muted={muted}
      loop={loop}
      playsInline
      autoPlay
    />
  );
};

// Componente para renderizar el fondo según el tipo
const BannerBackground = ({
  background,
  brandColors
}: {
  background: HeroCardBackground;
  brandColors: { primary: string; secondary: string; accent: string };
}) => {
  const overlayOpacity = background.overlayOpacity ?? 20;

  const defaultGradient = `linear-gradient(to right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  const customGradient = background.gradientColors
    ? `linear-gradient(to right, ${background.gradientColors.from}, ${background.gradientColors.via || background.gradientColors.to}, ${background.gradientColors.to})`
    : defaultGradient;

  return (
    <>
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
        <VideoBackground
          videoUrl={background.videoUrl}
          poster={background.videoPoster}
          muted={background.videoMuted ?? true}
          loop={background.videoLoop ?? true}
        />
      )}

      {background.type === 'carousel' && background.carouselImages && background.carouselImages.length > 0 && (
        <CarouselBackground
          images={background.carouselImages.filter(img => img.trim() !== '')}
          interval={background.carouselInterval}
        />
      )}

      {overlayOpacity > 0 && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity / 100 }}
        />
      )}
    </>
  );
};

interface PromoBannerProps {
  banner: PromoBannerType;
  className?: string;
}

export const PromoBanner = ({ banner, className = '' }: PromoBannerProps) => {
  const { settings } = useSettings();

  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  // Altura según configuración
  const heightClasses = {
    small: 'h-[100px] md:h-[120px]',
    medium: 'h-[140px] md:h-[180px]',
    large: 'h-[180px] md:h-[240px]',
  };

  // Alineación del contenido
  const alignClasses = {
    left: 'items-start text-left',
    center: 'items-center text-center',
    right: 'items-end text-right',
  };

  const justifyClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden ${heightClasses[banner.height]} ${className}`}
    >
      {/* Fondo */}
      <BannerBackground background={banner.background} brandColors={brandColors} />

      {/* Contenido */}
      <div className={`relative z-10 h-full flex ${justifyClasses[banner.contentAlign]} px-6 md:px-10`}>
        <div className={`flex flex-col justify-center ${alignClasses[banner.contentAlign]} max-w-2xl`}>
          {/* Título */}
          <h2
            className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-1 md:mb-2"
            style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.7)' }}
          >
            {banner.title}
          </h2>

          {/* Subtítulo */}
          {banner.subtitle && (
            <p
              className="text-sm md:text-base text-white/90 mb-3"
              style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.6)' }}
            >
              {banner.subtitle}
            </p>
          )}

          {/* Botón */}
          {banner.buttonText && banner.buttonLink && (
            <Link
              to={banner.buttonLink}
              className="inline-flex items-center gap-2 bg-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg text-sm md:text-base font-semibold hover:bg-gray-100 transition-colors shadow-sm group"
              style={{ color: brandColors.primary }}
            >
              {banner.buttonText}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromoBanner;
