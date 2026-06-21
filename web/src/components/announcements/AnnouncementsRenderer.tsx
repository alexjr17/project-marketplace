import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Tag } from 'lucide-react';
import { getActiveAnnouncements, type Announcement } from '../../services/announcements.service';
import { useSettings } from '../../context/SettingsContext';

const SIZE_CLASS: Record<string, string> = {
  sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl',
};

const VARIANT_BAR: Record<string, string> = {
  info: 'bg-blue-600 text-white',
  promo: 'bg-gradient-to-r from-violet-600 to-pink-600 text-white',
  warning: 'bg-amber-500 text-white',
  success: 'bg-green-600 text-white',
  dark: 'bg-gray-900 text-white',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function seenKey(a: Announcement) {
  return `ann_seen_${a.id}`;
}
function wasSeen(a: Announcement): boolean {
  if (a.frequency === 'session') return sessionStorage.getItem(seenKey(a)) === '1';
  if (a.frequency === 'daily') return localStorage.getItem(seenKey(a)) === todayStr();
  return false; // always
}
function markSeen(a: Announcement) {
  if (a.frequency === 'session') sessionStorage.setItem(seenKey(a), '1');
  else if (a.frequency === 'daily') localStorage.setItem(seenKey(a), todayStr());
}
function matchesPage(a: Announcement, path: string): boolean {
  if (a.target === 'home') return path === '/';
  if (a.target === 'catalog') return path.startsWith('/catalog');
  return true;
}

/** Botón/enlace de llamado a la acción. */
function Cta({ a, className, style }: { a: Announcement; className?: string; style?: CSSProperties }) {
  if (!a.ctaText || !a.ctaUrl) return null;
  const internal = a.ctaUrl.startsWith('/');
  const cls = className ?? 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/30';
  return internal ? (
    <Link to={a.ctaUrl} className={cls} style={style}>{a.ctaText}</Link>
  ) : (
    <a href={a.ctaUrl} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{a.ctaText}</a>
  );
}

function Coupon({ code, dark = false }: { code?: string | null; dark?: boolean }) {
  if (!code) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border border-dashed ${dark ? 'border-gray-400 text-gray-700 bg-gray-100' : 'border-white/60 bg-white/15'}`}>
      <Tag className="w-3 h-3" /> {code}
    </span>
  );
}

export function AnnouncementsRenderer() {
  const location = useLocation();
  const { settings } = useSettings();
  const brand = settings.appearance?.brandColors || settings.general?.brandColors || {
    primary: '#7c3aed', secondary: '#ec4899', accent: '#f59e0b',
  };
  const brandGradient = `linear-gradient(to right, ${brand.primary}, ${brand.secondary})`;

  // Color: 1) color propio del anuncio, 2) "promo" = degradado de marca, 3) preset.
  const barProps = (a: Announcement): { className: string; style?: CSSProperties } => {
    if (a.bgColor) {
      return { className: 'text-sm', style: { backgroundColor: a.bgColor, color: a.textColor || '#fff' } };
    }
    if (a.variant === 'promo') {
      return { className: 'text-sm text-white', style: { backgroundImage: brandGradient } };
    }
    return { className: `${VARIANT_BAR[a.variant] || VARIANT_BAR.info} text-sm` };
  };

  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [navH, setNavH] = useState(0); // alto del nav inferior móvil

  useEffect(() => {
    getActiveAnnouncements().then(setItems).catch(() => setItems([]));
    const measure = () => {
      setIsMobile(window.innerWidth < 768);
      const nav = Array.from(document.querySelectorAll('nav')).find((n) => {
        const s = getComputedStyle(n);
        return s.position === 'fixed' && s.bottom === '0px';
      });
      setNavH(nav ? Math.round(nav.getBoundingClientRect().height) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const dismiss = (a: Announcement) => {
    markSeen(a);
    setDismissed((prev) => new Set(prev).add(a.id));
  };

  const visible = items.filter(
    (a) => matchesPage(a, location.pathname) && !wasSeen(a) && !dismissed.has(a.id)
  );

  const bars = visible.filter((a) => a.type === 'bar' || a.type === 'marquee');
  const floating = visible.filter((a) => a.type === 'floating');
  const popup = visible.find((a) => a.type === 'popup');

  return (
    <>
      {/* Barras / marquesina (en flujo, debajo del header) */}
      {bars.map((a) => {
        const bp = barProps(a);
        return (
        <div
          key={a.id}
          className={`${bp.className} overflow-hidden animate-[annSlideDown_.5s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none`}
          style={bp.style}
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
            {a.type === 'marquee' ? (
              <div className="flex-1 overflow-hidden">
                {/* Loop continuo: 2 copias y se desplaza -50% (sin huecos).
                    Se pausa al pasar el cursor y se detiene si el sistema
                    pide reducir movimiento (evita marear). */}
                <div className="inline-flex w-max whitespace-nowrap animate-[annMarquee_30s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:w-full motion-reduce:justify-center">
                  {[0, 1].map((k) => (
                    <span key={k} className="px-6 flex items-center gap-2" aria-hidden={k === 1} {...(k === 1 ? { 'data-dup': true } : {})}>
                      {a.title && <strong>{a.title}</strong>}
                      {a.message && <span>{a.message}</span>}
                      {a.couponCode ? <span className="font-semibold">· Cupón: {a.couponCode}</span> : null}
                      <Cta a={a} />
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center">
                {a.title && <strong className="font-bold">{a.title}</strong>}
                {a.message && <span className="opacity-95">{a.message}</span>}
                <Coupon code={a.couponCode} />
                <Cta a={a} className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-white text-gray-900 hover:bg-white/90 shadow-sm" />
              </div>
            )}
            {a.dismissible && (
              <button onClick={() => dismiss(a)} aria-label="Cerrar" className="flex-shrink-0 p-1 hover:bg-white/20 rounded">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        );
      })}

      {/* Tarjetas flotantes:
          - Móvil: banner a ancho total pegado sobre el nav inferior, con ✕.
          - Escritorio: tarjeta en la esquina inferior derecha. */}
      {floating.map((a, i) =>
        isMobile ? (
          <div key={a.id} className="fixed inset-x-0 z-40" style={{ bottom: navH + i * 96 }}>
            <div className="relative bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.12)] border-t border-x border-gray-100 overflow-hidden animate-[annSlideUp_.45s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
              <div className="h-1 w-full" style={{ backgroundImage: brandGradient }} />
              {a.dismissible && (
                <button onClick={() => dismiss(a)} aria-label="Cerrar" className="absolute top-1.5 right-1.5 z-10 p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-3 p-3 pr-7">
                {a.imageUrl && <img src={a.imageUrl} alt={a.title || ''} loading="lazy" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  {a.title && <p className="font-semibold text-sm text-gray-900 truncate">{a.title}</p>}
                  {a.message && <p className="text-xs text-gray-600 line-clamp-2">{a.message}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {a.couponCode && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border border-dashed" style={{ color: brand.primary, borderColor: brand.primary }}>
                        <Tag className="w-3 h-3" /> {a.couponCode}
                      </span>
                    )}
                    {a.ctaText && a.ctaUrl && (
                      <Cta a={a} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundImage: brandGradient }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            key={a.id}
            style={{ marginBottom: i * 88 }}
            className="fixed right-4 bottom-4 z-40 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/10 border border-gray-100 overflow-hidden animate-[annSlideUp_.5s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
          >
            <div className="h-1.5 w-full" style={{ backgroundImage: brandGradient }} />
            {a.imageUrl && <img src={a.imageUrl} alt={a.title || ''} loading="lazy" className="w-full h-28 object-cover" />}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                {a.title && <p className="font-semibold text-gray-900 text-sm">{a.title}</p>}
                {a.dismissible && (
                  <button onClick={() => dismiss(a)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 -mt-1">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {a.message && <p className="text-xs text-gray-600 mt-1">{a.message}</p>}
              <div className="flex items-center gap-2 mt-2">
                <Coupon code={a.couponCode} dark />
                <Cta a={a} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90" style={{ backgroundColor: brand.primary }} />
              </div>
            </div>
          </div>
        )
      )}

      {/* Popup / modal */}
      {popup && (() => {
        const p = popup;
        const lay = p.layout || 'standard';
        const cardCls = `relative bg-white rounded-2xl shadow-2xl w-full overflow-hidden ${SIZE_CLASS[p.size || 'md'] || SIZE_CLASS.md} animate-[annPopIn_.4s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none`;

        const closeBtn = (
          <button onClick={() => dismiss(p)} aria-label="Cerrar" className="absolute top-3 right-3 z-10 p-1.5 bg-white/90 rounded-full text-gray-600 hover:bg-white shadow">
            <X className="w-5 h-5" />
          </button>
        );
        const coupon = (onDark: boolean) => p.couponCode ? (
          <span
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-base font-extrabold border-2 border-dashed"
            style={onDark
              ? { color: '#fff', borderColor: 'rgba(255,255,255,.7)', backgroundColor: 'rgba(255,255,255,.12)' }
              : { color: brand.primary, borderColor: brand.primary, backgroundColor: `${brand.primary}1a` }}
          >
            <Tag className="w-4 h-4" /> {p.couponCode}
          </span>
        ) : null;
        const cta = p.ctaText && p.ctaUrl ? (
          <span onClick={() => markSeen(p)}>
            <Cta a={p} className="inline-flex items-center px-6 py-2.5 rounded-lg text-sm font-bold text-white shadow-lg hover:opacity-90" style={{ backgroundImage: brandGradient }} />
          </span>
        ) : null;

        // En móvil: banner inferior tipo alerta (sobre el menú de abajo), no bloquea.
        if (isMobile) {
          return (
            <div className="fixed inset-x-0 z-[60]" style={{ bottom: navH }}>
              <div className="relative bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.12)] border-t border-x border-gray-100 overflow-hidden animate-[annSlideUp_.45s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
                <div className="h-1 w-full" style={{ backgroundImage: brandGradient }} />
                <button onClick={() => dismiss(p)} aria-label="Cerrar" className="absolute top-1.5 right-1.5 z-10 p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 p-3 pr-7">
                  {p.imageUrl && <img src={p.imageUrl} alt={p.title || ''} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    {p.title && <p className="font-semibold text-sm text-gray-900 truncate">{p.title}</p>}
                    {p.message && <p className="text-xs text-gray-600 line-clamp-2">{p.message}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {p.couponCode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border border-dashed" style={{ color: brand.primary, borderColor: brand.primary }}>
                          <Tag className="w-3 h-3" /> {p.couponCode}
                        </span>
                      )}
                      {p.ctaText && p.ctaUrl && (
                        <span onClick={() => markSeen(p)}>
                          <Cta a={p} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold text-white shadow" style={{ backgroundImage: brandGradient }} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 animate-[annFadeIn_.3s_ease-out] motion-reduce:animate-none" onClick={() => dismiss(p)} />

            {lay === 'image' ? (
              <div className={cardCls}>
                {closeBtn}
                {p.imageUrl && <img src={p.imageUrl} alt={p.title || ''} className="w-full max-h-[78vh] object-contain bg-gray-50" />}
                {(coupon(false) || cta) && (
                  <div className="absolute bottom-5 left-0 right-0 flex flex-col items-center gap-2 px-4">
                    {coupon(false)}
                    {cta}
                  </div>
                )}
              </div>
            ) : lay === 'overlay' ? (
              <div className={cardCls}>
                {closeBtn}
                <div className="relative min-h-[22rem]">
                  {p.imageUrl && <img src={p.imageUrl} alt={p.title || ''} className="absolute inset-0 w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
                  <div className="relative flex flex-col justify-end p-6 text-center text-white min-h-[22rem]">
                    {p.title && <h3 className="text-2xl font-bold">{p.title}</h3>}
                    {p.message && <p className="mt-2 text-white/90">{p.message}</p>}
                    {coupon(true) && <div className="mt-3 flex justify-center">{coupon(true)}</div>}
                    {cta && <div className="mt-4 flex justify-center">{cta}</div>}
                  </div>
                </div>
              </div>
            ) : (
              <div className={cardCls}>
                <div className="h-1.5 w-full" style={{ backgroundImage: brandGradient }} />
                {closeBtn}
                {p.imageUrl && (
                  <div className="w-full h-60 bg-gray-50 overflow-hidden">
                    <img src={p.imageUrl} alt={p.title || ''} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6 text-center">
                  {p.title && <h3 className="text-2xl font-bold text-gray-900">{p.title}</h3>}
                  {p.message && <p className="text-gray-600 mt-2">{p.message}</p>}
                  {coupon(false) && (
                    <div className="mt-4 flex flex-col items-center gap-1">
                      <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Tu cupón</span>
                      {coupon(false)}
                    </div>
                  )}
                  {cta && <div className="mt-5">{cta}</div>}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <style>{`
        @keyframes annMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes annSlideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes annSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes annFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes annPopIn { from { transform: scale(.96) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { [data-dup="true"] { display: none; } }
      `}</style>
    </>
  );
}

export default AnnouncementsRenderer;
