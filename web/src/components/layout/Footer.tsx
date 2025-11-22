import { Link } from 'react-router-dom';
import { Sparkles, Mail, Phone, MapPin, Clock, Heart } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white mt-auto relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-pink-600/10 to-amber-600/10 pointer-events-none"></div>

      {/* Pattern Overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 relative z-10">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 rounded-xl blur-md opacity-50"></div>
                <div className="relative bg-gradient-to-br from-violet-600 via-pink-500 to-amber-500 p-2 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <h3 className="font-black text-lg bg-gradient-to-r from-violet-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                StylePrint
              </h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              Tu tienda de ropa personalizada. Dale vida a tu creatividad con diseños únicos.
            </p>
            {/* Social Icons */}
            <div className="flex gap-2">
              <a href="#" className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center hover:scale-110 transition-transform">
                <span className="text-white text-xs font-bold">IG</span>
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center hover:scale-110 transition-transform">
                <span className="text-white text-xs font-bold">FB</span>
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center hover:scale-110 transition-transform">
                <span className="text-white text-xs font-bold">TW</span>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-sm mb-4 text-white">
              Enlaces Rápidos
            </h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-violet-400 text-xs transition-colors inline-flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-violet-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Inicio
                </Link>
              </li>
              <li>
                <Link to="/catalog" className="text-gray-400 hover:text-pink-400 text-xs transition-colors inline-flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-pink-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Catálogo
                </Link>
              </li>
              <li>
                <Link to="/customize" className="text-gray-400 hover:text-amber-400 text-xs transition-colors inline-flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-amber-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Personalizar
                </Link>
              </li>
              <li>
                <Link to="/cart" className="text-gray-400 hover:text-violet-400 text-xs transition-colors inline-flex items-center gap-2 group">
                  <span className="w-1 h-1 bg-violet-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  Carrito
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-bold text-sm mb-4 text-white">
              Contacto
            </h3>
            <div className="space-y-2">
              <a href="mailto:info@styleprint.com" className="text-gray-400 hover:text-violet-400 text-xs transition-colors flex items-center gap-2 group">
                <Mail className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                <span className="truncate">info@styleprint.com</span>
              </a>
              <p className="text-gray-400 text-xs flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
                +1 (234) 567-890
              </p>
              <p className="text-gray-400 text-xs flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>123 Creative St, Design City, DC 12345</span>
              </p>
            </div>
          </div>

          {/* Horarios */}
          <div>
            <h3 className="font-bold text-sm mb-4 text-white">
              Horario de Atención
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-gray-400">Lun - Vie: 9:00 AM - 6:00 PM</p>
                  <p className="text-gray-400">Sábado: 10:00 AM - 4:00 PM</p>
                  <p className="text-gray-500">Domingo: Cerrado</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <p className="text-xs text-gray-500 mb-2">Métodos de Pago</p>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="bg-gray-700/50 text-gray-400 px-2 py-1 rounded text-[10px] font-semibold">VISA</span>
                  <span className="bg-gray-700/50 text-gray-400 px-2 py-1 rounded text-[10px] font-semibold">MC</span>
                  <span className="bg-gray-700/50 text-gray-400 px-2 py-1 rounded text-[10px] font-semibold">AMEX</span>
                  <span className="bg-gray-700/50 text-gray-400 px-2 py-1 rounded text-[10px] font-semibold">PayPal</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700/50 pt-6">
          {/* Bottom Section */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500 text-center md:text-left">
              © 2025 <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-amber-400 bg-clip-text text-transparent font-bold">StylePrint</span>. Todos los derechos reservados.
            </p>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <Link to="#" className="hover:text-violet-400 transition-colors">Términos y Condiciones</Link>
              <span className="text-gray-700">|</span>
              <Link to="#" className="hover:text-pink-400 transition-colors">Política de Privacidad</Link>
              <span className="text-gray-700">|</span>
              <Link to="#" className="hover:text-amber-400 transition-colors">Política de Devoluciones</Link>
            </div>

            <p className="text-xs text-gray-500 flex items-center gap-1">
              Hecho con <Heart className="w-3 h-3 inline text-pink-400 fill-pink-400" /> para creativos
            </p>
          </div>

          {/* Enlace oculto para admin (Fase 1) */}
          <Link to="/admin-panel" className="text-xs text-gray-900 hover:text-gray-800 mt-2 inline-block transition">
            •
          </Link>
        </div>
      </div>
    </footer>
  );
};
