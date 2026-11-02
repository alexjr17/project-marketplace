import { Link } from 'react-router-dom';
import { Sparkles, ShoppingBag, Palette, Package, Truck, Shield, Heart, Star, Zap, Gift, Percent, Quote, ChevronRight } from 'lucide-react';
import { FeaturedProducts } from '../components/products/FeaturedProducts';
import { HeroSection } from '../components/home/HeroSection';
import { PromoBanner } from '../components/home/PromoBanner';
import { useSettings } from '../context/SettingsContext';
import { Seo } from '../components/seo/Seo';

// Mapeo de iconos por ID
const iconMap: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  palette: Palette,
  sparkles: Sparkles,
  package: Package,
  truck: Truck,
  shield: Shield,
  heart: Heart,
  star: Star,
  zap: Zap,
  gift: Gift,
  percent: Percent,
};

// Testimonios estáticos (en producción vendrían de API/settings)
const testimonials = [
  {
    id: 1,
    name: 'María González',
    role: 'Emprendedora',
    avatar: 'https://i.pravatar.cc/100?img=1',
    text: 'La calidad de las camisetas superó mis expectativas. El proceso de personalización fue súper fácil y rápido.',
    rating: 5,
  },
  {
    id: 2,
    name: 'Carlos Rodríguez',
    role: 'Diseñador Gráfico',
    avatar: 'https://i.pravatar.cc/100?img=3',
    text: 'Como diseñador, valoro mucho la fidelidad del color. Vexa reproduce mis diseños exactamente como los imaginé.',
    rating: 5,
  },
  {
    id: 3,
    name: 'Ana Martínez',
    role: 'Community Manager',
    avatar: 'https://i.pravatar.cc/100?img=5',
    text: 'Pedí hoodies para todo mi equipo de trabajo. El envío fue rápido y todos quedaron encantados con la calidad.',
    rating: 5,
  },
];

export const HomePage = () => {
  const { settings } = useSettings();

  // Colores de marca dinámicos
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };
  const gradientBgStyle = `linear-gradient(to bottom right, ${brandColors.primary}, ${brandColors.secondary}, ${brandColors.accent})`;

  // Settings del Home
  const homeSettings = settings.home;
  const features = homeSettings?.features?.filter(f => f.isActive).sort((a, b) => a.order - b.order) || [];
  const showFeatures = homeSettings?.showFeatures ?? true;
  const cta = homeSettings?.cta;
  const productSections = homeSettings?.productSections?.filter(s => s.isActive).sort((a, b) => a.order - b.order) || [];
  const promoBanners = homeSettings?.promoBanners?.filter(b => b.isActive) || [];

  // Combinar secciones y banners, ordenados por order
  type ContentItem =
    | { type: 'section'; data: typeof productSections[0] }
    | { type: 'banner'; data: typeof promoBanners[0] };

  const allHomeContent: ContentItem[] = [
    ...productSections.map(s => ({ type: 'section' as const, data: s })),
    ...promoBanners.map(b => ({ type: 'banner' as const, data: b })),
  ].sort((a, b) => a.data.order - b.data.order);

  return (
    <div className="overflow-x-hidden bg-gray-50 min-h-screen">
      <Seo />
      {/* Hero Section - Configurable */}
      <HeroSection />

      {/* Trust Bar - Características en tarjetas individuales */}
      {showFeatures && features.length > 0 && (
        <div className="pt-1 pb-2">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-wrap gap-2 md:gap-3">
              {features.slice(0, 4).map((feature) => {
                const IconComponent = iconMap[feature.icon] || Sparkles;
                return (
                  <div
                    key={feature.id}
                    className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3 flex-1 min-w-[calc(50%-0.5rem)] md:min-w-0"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-app-50 text-app-600">
                      <IconComponent className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{feature.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-1 hidden sm:block">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Contenido del Home - Secciones y Banners ordenados */}
      {allHomeContent.length > 0 ? (
        allHomeContent.map((item) => {
          if (item.type === 'section') {
            return <FeaturedProducts key={`section-${item.data.id}`} section={item.data} />;
          } else {
            return (
              <div key={`banner-${item.data.id}`} className="py-4 md:py-6">
                <div className="max-w-7xl mx-auto px-4">
                  <PromoBanner banner={item.data} />
                </div>
              </div>
            );
          }
        })
      ) : (
        <FeaturedProducts />
      )}

      {/* Testimonios Section */}
      <section className="py-5 md:py-7">
        <div className="max-w-7xl mx-auto px-4">
          <div>
            {/* Encabezado */}
            <div className="mb-4">
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                Lo que dicen nuestros clientes
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Miles de personas ya crearon sus diseños únicos con Vexa
              </p>
            </div>

            {/* Testimonials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              {testimonials.map((testimonial) => (
                <div
                  key={testimonial.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col"
                >
                  <Quote className="w-5 h-5 mb-2 text-app-300" />

                  {/* Text */}
                  <p className="text-gray-700 mb-4 leading-relaxed text-sm flex-1">
                    "{testimonial.text}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
                      <p className="text-xs text-gray-500">{testimonial.role}</p>
                    </div>
                    {/* Rating */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final Section */}
      <section className="py-5 md:py-7 pb-10">
        <div className="max-w-7xl mx-auto px-4">
          <div
            className="rounded-xl p-6 md:p-10 text-center text-white overflow-hidden relative"
            style={{ background: gradientBgStyle }}
          >
            {/* Pattern Overlay */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}></div>
            </div>

            <div className="relative z-10">
              {/* Slogan */}
              <p className="text-sm md:text-base font-medium text-white/80 mb-2">
                Recuerda...
              </p>
              <h2 className="text-2xl md:text-4xl font-display font-black mb-4">
                Diseñado por ti, hecho por Vexa
              </h2>
              <p className="text-sm md:text-lg text-white/90 mb-6 max-w-xl mx-auto">
                {cta?.subtitle || 'Tu creatividad merece la mejor calidad. Empieza a diseñar ahora.'}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Link
                  to="/customize"
                  className="bg-white h-12 px-6 rounded-lg text-base font-semibold hover:bg-gray-50 inline-flex items-center gap-2 transition-colors shadow-sm text-app-700"
                >
                  <Palette className="w-5 h-5" />
                  Empezar a diseñar
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/catalog"
                  className="bg-white/10 border border-white/60 text-white h-12 px-6 rounded-lg text-base font-semibold hover:bg-white/20 inline-flex items-center gap-2 transition-colors"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Explorar productos
                </Link>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -left-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        </div>
      </section>
    </div>
  );
};
