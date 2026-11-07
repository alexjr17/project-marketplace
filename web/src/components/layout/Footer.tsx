import { Link } from 'react-router-dom';
import { Sparkles, Mail, Phone, MapPin, Clock, Heart } from 'lucide-react';
import type { ComponentType } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useCatalogs } from '../../context/CatalogsContext';
import { STORE_CONTAINER } from '../shared/StoreContainer';
import { InstagramIcon, FacebookIcon, WhatsAppIcon, TwitterIcon } from '../icons/SocialIcons';

/** Icono de red social: enlace activo o deshabilitado si no está configurado. */
function SocialLink({ href, label, Icon }: { href?: string; label: string; Icon: ComponentType<{ className?: string }> }) {
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:text-app-700 hover:border-app-300 hover:bg-app-50 flex items-center justify-center transition-colors"
      title={label}
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
    </a>
  ) : (
    <span className="w-9 h-9 rounded-lg border border-gray-100 text-gray-300 flex items-center justify-center cursor-not-allowed" title={`${label} no configurado`}>
      <Icon className="w-4 h-4" />
    </span>
  );
}

const linkClass = 'text-sm text-gray-500 hover:text-gray-900 transition-colors';

export const Footer = () => {
  const { settings } = useSettings();
  const { user } = useAuth();

  // Cliente (roleId 2) NUNCA es admin
  const isAdminUser = user && user.roleId !== 2;

  const showSocialInFooter = settings.appearance?.showSocialInFooter ?? true;
  const showScheduleInFooter = settings.appearance?.showScheduleInFooter ?? true;
  const social = settings.general.socialLinks;
  const { categories } = useCatalogs();
  const shopCategories = categories.filter((c) => c.isActive).slice(0, 6);
  const enableCustomizer = settings.home?.enableCustomizer ?? true;
  const legalLinks = [
    { to: '/legal/terms', label: 'Términos y condiciones', active: settings.legal?.termsAndConditions?.isActive },
    { to: '/legal/privacy', label: 'Política de privacidad', active: settings.legal?.privacyPolicy?.isActive },
    { to: '/legal/returns', label: 'Política de devoluciones', active: settings.legal?.returnsPolicy?.isActive },
  ].filter((l) => l.active !== false);

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className={`${STORE_CONTAINER} py-10 md:py-12`}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr_1.2fr] gap-8">
          {/* Marca */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              {settings.general.logo ? (
                <img src={settings.general.logo} alt={settings.general.siteName} className="h-9 max-w-[60px] object-contain" />
              ) : (
                <div className="p-2 rounded-lg bg-app-600">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex flex-col leading-tight">
                <h3 className="font-bold text-base text-gray-900">{settings.general.siteName || 'StylePrint'}</h3>
                {settings.general.slogan && (
                  <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">{settings.general.slogan}</span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              {settings.general.siteDescription || 'Tu tienda de ropa personalizada. Dale vida a tu creatividad con diseños únicos.'}
            </p>
            {showSocialInFooter && (
              <div className="flex gap-2">
                <SocialLink href={social?.instagram} label="Instagram" Icon={InstagramIcon} />
                <SocialLink href={social?.facebook} label="Facebook" Icon={FacebookIcon} />
                <SocialLink href={social?.twitter} label="X (Twitter)" Icon={TwitterIcon} />
                <SocialLink href={social?.whatsapp ? `https://wa.me/${social.whatsapp.replace(/\D/g, '')}` : undefined} label="WhatsApp" Icon={WhatsAppIcon} />
              </div>
            )}
          </div>

          {/* Comprar: las categorías activas del catálogo */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-3">Comprar</h3>
            <ul className="space-y-2">
              {shopCategories.map((c) => (
                <li key={c.id}><Link to={`/catalog?category=${encodeURIComponent(c.slug)}`} className={linkClass}>{c.name}</Link></li>
              ))}
              <li><Link to="/catalog?onSale=1" className={linkClass}>Ofertas</Link></li>
              <li><Link to="/catalog" className={linkClass}>Todo el catálogo</Link></li>
            </ul>
          </div>

          {/* Tu cuenta */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-3">Tu cuenta</h3>
            <ul className="space-y-2">
              <li><Link to="/my-orders" className={linkClass}>Mis pedidos</Link></li>
              <li><Link to="/favorites" className={linkClass}>Favoritos</Link></li>
              <li><Link to="/cart" className={linkClass}>Carrito</Link></li>
              {enableCustomizer && <li><Link to="/customize" className={linkClass}>Personaliza tu diseño</Link></li>}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-3">Contacto</h3>
            <div className="space-y-2">
              {settings.general.contactEmail && (
                <a href={`mailto:${settings.general.contactEmail}`} className={`${linkClass} flex items-center gap-2`}>
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{settings.general.contactEmail}</span>
                </a>
              )}
              {settings.general.contactPhone && (
                <a href={`tel:${settings.general.contactPhone}`} className={`${linkClass} flex items-center gap-2`}>
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  {settings.general.contactPhone}
                </a>
              )}
              {settings.general.address && (
                <p className="text-sm text-gray-500 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{settings.general.address}, {settings.general.city}, {settings.general.country}</span>
                </p>
              )}
            </div>
          </div>

          {/* Horario y medios de pago */}
          {showScheduleInFooter && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-3">Horario de atención</h3>
              <div className="flex items-start gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p>Lun - Vie: 9:00 AM - 6:00 PM</p>
                  <p>Sábado: 10:00 AM - 4:00 PM</p>
                  <p className="text-gray-400">Domingo: Cerrado</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4 mb-2">Métodos de pago</p>
              <div className="flex gap-1.5 flex-wrap">
                {['VISA', 'MC', 'AMEX', 'PayPal'].map((m) => (
                  <span key={m} className="border border-gray-200 text-gray-500 px-2 py-0.5 rounded text-[10px] font-semibold">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="border-t border-gray-100 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p className="text-center md:text-left">
            © {new Date().getFullYear()} <span className="font-semibold text-gray-700">{settings.general.siteName || 'StylePrint'}</span>. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {legalLinks.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-gray-900 transition-colors">{l.label}</Link>
            ))}
          </div>
          <p className="flex items-center gap-1">
            Hecho con <Heart className="w-3 h-3 inline text-red-500 fill-red-500" /> para creativos
            {/* Enlace discreto al panel (solo administradores) */}
            {isAdminUser && (
              <Link to="/admin-panel" className="ml-1 text-gray-300 hover:text-gray-500 transition" title="Panel">•</Link>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
};
