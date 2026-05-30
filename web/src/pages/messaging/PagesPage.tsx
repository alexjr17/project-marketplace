import { useEffect, useState } from 'react';
import { ExternalLink, Facebook, Instagram, Loader2, Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import messagingService from '../../services/messaging.service';
import type { Channel } from '../../types/messaging';

/**
 * Vista resumen de las páginas/cuentas conectadas. Por ahora es de solo lectura;
 * en fases siguientes desde aquí se podrá editar avatar/descripción de la Página
 * y leer métricas básicas.
 */
export const PagesPage = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await messagingService.listChannels();
        if (!cancelled) setChannels(list);
      } catch (err) {
        console.error('[Pages] Error cargando canales:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const messenger = channels.find((c) => c.type === 'messenger');
  const instagram = channels.find((c) => c.type === 'instagram');

  const pageId = (messenger?.config as { pageId?: string } | undefined)?.pageId;
  const pageName = (messenger?.config as { pageName?: string } | undefined)?.pageName;
  const igUsername = (instagram?.config as { username?: string } | undefined)?.username;
  const igBusinessId = (instagram?.config as { instagramBusinessAccountId?: string } | undefined)
    ?.instagramBusinessAccountId;

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Páginas y cuentas conectadas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Resumen de las páginas y perfiles que la app está usando. Para conectar o cambiar
            credenciales ve a{' '}
            <Link to="/messaging/channels" className="text-violet-600 hover:underline">
              Canales
            </Link>
            .
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Facebook Page */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-sky-500 text-white px-5 py-3 flex items-center gap-3">
                <Facebook className="w-5 h-5" />
                <span className="font-semibold">Página de Facebook</span>
              </div>
              <div className="p-5 space-y-2 text-sm">
                {pageId && pageName ? (
                  <>
                    <p>
                      <span className="text-gray-500">Nombre:</span>{' '}
                      <span className="font-medium text-gray-900">{pageName}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">ID:</span>{' '}
                      <span className="font-mono text-xs text-gray-700">{pageId}</span>
                    </p>
                    <a
                      href={`https://facebook.com/${pageId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Abrir en Facebook
                    </a>
                  </>
                ) : (
                  <EmptyHint
                    label="Aún no hay Página conectada."
                    hint="Configura las credenciales en el canal Messenger."
                  />
                )}
              </div>
            </div>

            {/* Instagram */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 text-white px-5 py-3 flex items-center gap-3">
                <Instagram className="w-5 h-5" />
                <span className="font-semibold">Cuenta de Instagram Business</span>
              </div>
              <div className="p-5 space-y-2 text-sm">
                {igBusinessId ? (
                  <>
                    {igUsername && (
                      <p>
                        <span className="text-gray-500">Usuario:</span>{' '}
                        <span className="font-medium text-gray-900">{igUsername}</span>
                      </p>
                    )}
                    <p>
                      <span className="text-gray-500">ID Business:</span>{' '}
                      <span className="font-mono text-xs text-gray-700">{igBusinessId}</span>
                    </p>
                  </>
                ) : (
                  <EmptyHint
                    label="Aún no hay cuenta de Instagram conectada."
                    hint="Configura las credenciales en el canal Instagram."
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyHint = ({ label, hint }: { label: string; hint: string }) => (
  <div className="text-sm text-gray-500">
    <p>{label}</p>
    <Link
      to="/messaging/channels"
      className="inline-flex items-center gap-1 mt-2 text-violet-600 hover:underline text-xs"
    >
      <Plug className="w-3 h-3" /> {hint}
    </Link>
  </div>
);

export default PagesPage;
