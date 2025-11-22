import { Link } from 'react-router-dom';
import { Sparkles, ShoppingBag, Palette, Package } from 'lucide-react';

export const HomePage = () => {
  return (
    <div className="overflow-x-hidden">
      {/* Hero Section - Creative Billboard Style - Full Width */}
      <div className="relative overflow-hidden shadow-2xl w-full h-[calc(100vh-180px)] md:h-[calc(100vh-72px)]">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500">
          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}></div>
          </div>

          {/* Floating T-shirt Illustrations */}
          <div className="absolute top-10 left-10 text-8xl opacity-10 animate-pulse-soft">👕</div>
          <div className="absolute bottom-10 right-10 text-9xl opacity-10 animate-pulse-soft" style={{ animationDelay: '1s' }}>🎨</div>
          <div className="absolute top-1/2 right-20 text-7xl opacity-10 animate-pulse-soft" style={{ animationDelay: '2s' }}>✨</div>
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 px-6 text-center h-full flex flex-col justify-center">
          {/* Badge */}
          <div className="mb-6 animate-fade-in-up">
            <span className="inline-block bg-white/20 backdrop-blur-md text-white px-6 py-3 rounded-full text-sm font-bold border-2 border-white/40 shadow-lg">
              <Sparkles className="w-4 h-4 inline mr-2" />
              100% Personalizable
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-5xl md:text-7xl font-display font-black mb-6 animate-fade-in-up text-white drop-shadow-2xl">
            Dale Vida a tu
            <br />
            <span className="text-amber-300">Creatividad</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl text-white mb-10 max-w-3xl mx-auto leading-relaxed font-medium drop-shadow-lg">
            Crea diseños únicos en camisetas y hoodies.
            <br />
            Sube tus imágenes y hazlas realidad.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/customize"
              className="bg-white text-violet-600 px-10 py-5 rounded-2xl text-xl font-bold hover:bg-amber-300 hover:text-white inline-flex items-center justify-center gap-3 transition-all hover:scale-110 shadow-2xl group"
            >
              <Palette className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              Personalizar Ahora
            </Link>
            <Link
              to="/catalog"
              className="bg-white/10 backdrop-blur-md border-2 border-white text-white px-10 py-5 rounded-2xl text-xl font-bold hover:bg-white hover:text-violet-600 inline-flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-lg"
            >
              <ShoppingBag className="w-6 h-6" />
              Ver Catálogo
            </Link>
          </div>

          {/* Bottom Accent */}
          <div className="mt-12 mb-6 md:mb-0 flex items-center justify-center gap-4 md:gap-8 text-white/80 text-xs md:text-sm font-semibold flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-300 rounded-full"></div>
              Sin mínimos
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-300 rounded-full"></div>
              Envío rápido
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-300 rounded-full"></div>
              Alta calidad
            </div>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Feature 1 - Personalización */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-white p-8 rounded-3xl border-2 border-violet-100 hover:border-violet-300 transition-all hover:-translate-y-2 hover:shadow-2xl">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur-md opacity-50"></div>
                <div className="relative bg-gradient-to-br from-violet-500 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center transform group-hover:rotate-6 transition-transform">
                  <Palette className="w-10 h-10 text-white" strokeWidth={2} />
                </div>
              </div>
              <h3 className="text-2xl font-black mb-3 text-gray-900 group-hover:text-violet-600 transition-colors">
                Personalización Fácil
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Editor visual intuitivo para crear diseños únicos en minutos
              </p>
            </div>
          </div>

          {/* Feature 2 - Alta Calidad */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-white p-8 rounded-3xl border-2 border-pink-100 hover:border-pink-300 transition-all hover:-translate-y-2 hover:shadow-2xl">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl blur-md opacity-50"></div>
                <div className="relative bg-gradient-to-br from-pink-500 to-rose-600 w-20 h-20 rounded-2xl flex items-center justify-center transform group-hover:rotate-6 transition-transform">
                  <Sparkles className="w-10 h-10 text-white" strokeWidth={2} />
                </div>
              </div>
              <h3 className="text-2xl font-black mb-3 text-gray-900 group-hover:text-pink-600 transition-colors">
                Alta Calidad
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Productos premium con impresión de alta resolución
              </p>
            </div>
          </div>

          {/* Feature 3 - Entrega Rápida */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
            <div className="relative bg-white p-8 rounded-3xl border-2 border-amber-100 hover:border-amber-300 transition-all hover:-translate-y-2 hover:shadow-2xl">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl blur-md opacity-50"></div>
                <div className="relative bg-gradient-to-br from-amber-500 to-orange-600 w-20 h-20 rounded-2xl flex items-center justify-center transform group-hover:rotate-6 transition-transform">
                  <Package className="w-10 h-10 text-white" strokeWidth={2} />
                </div>
              </div>
              <h3 className="text-2xl font-black mb-3 text-gray-900 group-hover:text-amber-600 transition-colors">
                Entrega Rápida
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Producción y envío en tiempo récord <span className="text-amber-600 font-semibold">(Próximamente)</span>
              </p>
            </div>
          </div>
        </div>

      {/* Productos Destacados */}
      <div className="mt-20">
        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-display font-black text-gray-900 mb-4">
            Productos <span className="bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 bg-clip-text text-transparent">Destacados</span>
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Descubre nuestras prendas más populares listas para personalizar
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              id: 1,
              name: 'Camiseta Premium',
              price: 29.99,
              gradient: 'from-violet-500 to-purple-600',
              bgColor: 'bg-violet-50',
              textColor: 'text-violet-600',
              emoji: '👕'
            },
            {
              id: 2,
              name: 'Hoodie Deluxe',
              price: 49.99,
              gradient: 'from-pink-500 to-rose-600',
              bgColor: 'bg-pink-50',
              textColor: 'text-pink-600',
              emoji: '🧥'
            },
            {
              id: 3,
              name: 'Polo Casual',
              price: 34.99,
              gradient: 'from-amber-500 to-orange-600',
              bgColor: 'bg-amber-50',
              textColor: 'text-amber-600',
              emoji: '👔'
            }
          ].map((product) => (
            <div key={product.id} className="group relative">
              {/* Glow Effect */}
              <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-300`}></div>

              {/* Card */}
              <div className="relative bg-white rounded-3xl overflow-hidden border-2 border-gray-100 hover:border-gray-200 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
                {/* Image Area */}
                <div className={`${product.bgColor} h-72 flex items-center justify-center relative overflow-hidden`}>
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M0 0h20v20H0V0zm20 20h20v20H20V20z'/%3E%3C/g%3E%3C/svg%3E")`,
                    }}></div>
                  </div>

                  {/* Product Icon */}
                  <div className="relative transform group-hover:scale-110 transition-transform duration-300">
                    <span className="text-9xl drop-shadow-2xl">{product.emoji}</span>
                  </div>

                  {/* Badge */}
                  <div className="absolute top-4 right-4">
                    <div className={`bg-gradient-to-br ${product.gradient} text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg`}>
                      Popular
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-2xl font-black text-gray-900 mb-2 group-hover:${product.textColor} transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    100% personalizable • Alta calidad • Envío rápido
                  </p>

                  {/* Price & CTA */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 line-through">$39.99</p>
                      <p className={`text-3xl font-black bg-gradient-to-br ${product.gradient} bg-clip-text text-transparent`}>
                        ${product.price}
                      </p>
                    </div>
                    <Link
                      to="/customize"
                      className={`bg-gradient-to-br ${product.gradient} text-white px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-violet-500/30 transition-all hover:scale-105 inline-flex items-center gap-2`}
                    >
                      Diseñar
                      <Palette className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <div className="text-center mt-12">
          <Link
            to="/catalog"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-violet-500/40 transition-all hover:scale-105 group"
          >
            Ver Catálogo Completo
            <ShoppingBag className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </Link>
        </div>
      </div>

      {/* CTA Section */}
      <div className="mt-20 relative group">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 rounded-3xl blur-2xl opacity-30 group-hover:opacity-40 transition-opacity"></div>

        {/* Card */}
        <div className="relative bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 rounded-3xl p-1 overflow-hidden">
          {/* Inner Content */}
          <div className="bg-white rounded-[22px] p-12 md:p-16 text-center relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}></div>
            </div>

            {/* Floating Emoji */}
            <div className="absolute top-8 right-8 text-6xl opacity-10 animate-pulse-soft">✨</div>
            <div className="absolute bottom-8 left-8 text-6xl opacity-10 animate-pulse-soft" style={{ animationDelay: '1s' }}>🎨</div>

            {/* Content */}
            <div className="relative z-10">
              {/* Badge */}
              <div className="mb-6 inline-block">
                <span className="bg-gradient-to-r from-violet-100 via-pink-100 to-amber-100 text-violet-700 px-6 py-2 rounded-full text-sm font-bold border-2 border-violet-200 shadow-md">
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  Crea sin límites
                </span>
              </div>

              {/* Title */}
              <h2 className="text-4xl md:text-5xl font-display font-black mb-4 bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 bg-clip-text text-transparent">
                ¿Listo para crear algo único?
              </h2>

              {/* Subtitle */}
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Empieza a diseñar tu prenda personalizada ahora y dale vida a tu creatividad
              </p>

              {/* CTA Button */}
              <Link
                to="/customize"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 text-white px-10 py-5 rounded-2xl text-xl font-bold hover:shadow-2xl hover:shadow-violet-500/50 transition-all hover:scale-105 group-hover:scale-110"
              >
                <Palette className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                Personalizar Ahora
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
