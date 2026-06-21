import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Tag } from 'lucide-react';
import { getActiveAnnouncements, type Announcement } from '../../services/announcements.service';

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
function Cta({ a, className }: { a: Announcement; className?: string }) {
  if (!a.ctaText || !a.ctaUrl) return null;
  const internal = a.ctaUrl.startsWith('/');
  const cls = className ?? 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/30';
  return internal ? (
    <Link to={a.ctaUrl} className={cls}>{a.ctaText}</Link>
  ) : (
    <a href={a.ctaUrl} target="_blank" rel="noopener noreferrer" className={cls}>{a.ctaText}</a>
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
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    getActiveAnnouncements().then(setItems).catch(() => setItems([]));
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
      {bars.map((a) => (
        <div key={a.id} className={`${VARIANT_BAR[a.variant] || VARIANT_BAR.info} text-sm`}>
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
            {a.type === 'marquee' ? (
              <div className="flex-1 overflow-hidden">
                <div className="whitespace-nowrap animate-[annMarquee_18s_linear_infinite]">
                  {a.title && <strong className="mr-2">{a.title}</strong>}{a.message}
                  {a.couponCode ? <span className="ml-3">· Código: {a.couponCode}</span> : null}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
                {a.title && <strong>{a.title}</strong>}
                {a.message && <span className="opacity-95">{a.message}</span>}
                <Coupon code={a.couponCode} />
                <Cta a={a} />
              </div>
            )}
            {a.dismissible && (
              <button onClick={() => dismiss(a)} aria-label="Cerrar" className="flex-shrink-0 p-1 hover:bg-white/20 rounded">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Tarjetas flotantes (esquina inferior derecha) */}
      {floating.map((a, i) => (
        <div
          key={a.id}
          style={{ bottom: `${16 + i * 8}px` }}
          className="fixed right-4 z-40 w-72 max-w-[85vw] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up"
        >
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
              <Cta a={a} className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800" />
            </div>
          </div>
        </div>
      ))}

      {/* Popup / modal */}
      {popup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => dismiss(popup)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <button onClick={() => dismiss(popup)} aria-label="Cerrar" className="absolute top-2 right-2 z-10 p-1.5 bg-white/80 rounded-full text-gray-600 hover:bg-white">
              <X className="w-5 h-5" />
            </button>
            {popup.imageUrl && <img src={popup.imageUrl} alt={popup.title || ''} className="w-full max-h-60 object-cover" />}
            <div className="p-6 text-center">
              {popup.title && <h3 className="text-xl font-bold text-gray-900">{popup.title}</h3>}
              {popup.message && <p className="text-gray-600 mt-2">{popup.message}</p>}
              {popup.couponCode && (
                <div className="mt-4 flex justify-center"><Coupon code={popup.couponCode} dark /></div>
              )}
              {popup.ctaText && popup.ctaUrl && (
                <div className="mt-5" onClick={() => markSeen(popup)}>
                  <Cta a={popup} className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-pink-600 hover:opacity-90" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes annMarquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>
    </>
  );
}

export default AnnouncementsRenderer;
