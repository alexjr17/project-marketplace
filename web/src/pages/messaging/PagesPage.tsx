import { useEffect, useState } from 'react';
import { ExternalLink, Facebook, FileText, Instagram, Plug } from 'lucide-react';
import { Badge, Card, CardTitle, DescriptionList, Page, PageHeader, Spinner } from '../../components/ui';
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
    <Page className="max-w-4xl mx-auto">
      <PageHeader
        icon={FileText}
        title="Páginas y cuentas"
        subtitle={<>Páginas y perfiles que usa la app. Para conectar o cambiar credenciales ve a <Link to="/messaging/channels" className="text-app-700 font-medium hover:underline">Canales</Link>.</>}
      />

      {loading ? (
        <Spinner label="Cargando cuentas…" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Página de Facebook */}
          <Card>
            <CardTitle icon={Facebook} actions={<Badge tone={pageId && pageName ? 'green' : 'gray'}>{pageId && pageName ? 'Conectada' : 'Sin conectar'}</Badge>}>
              Página de Facebook
            </CardTitle>
            {pageId && pageName ? (
              <div className="space-y-4">
                <DescriptionList cols={1} items={[
                  { label: 'Nombre', value: pageName },
                  { label: 'ID', value: <span className="font-mono text-xs">{pageId}</span> },
                ]} />
                <a href={`https://facebook.com/${pageId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-app-700 hover:underline">
                  <ExternalLink className="w-4 h-4" /> Abrir en Facebook
                </a>
              </div>
            ) : (
              <EmptyHint label="Aún no hay Página conectada." hint="Configura las credenciales en el canal Messenger." />
            )}
          </Card>

          {/* Instagram */}
          <Card>
            <CardTitle icon={Instagram} actions={<Badge tone={igBusinessId ? 'green' : 'gray'}>{igBusinessId ? 'Conectada' : 'Sin conectar'}</Badge>}>
              Instagram Business
            </CardTitle>
            {igBusinessId ? (
              <DescriptionList cols={1} items={[
                ...(igUsername ? [{ label: 'Usuario', value: igUsername }] : []),
                { label: 'ID Business', value: <span className="font-mono text-xs">{igBusinessId}</span> },
              ]} />
            ) : (
              <EmptyHint label="Aún no hay cuenta de Instagram conectada." hint="Configura las credenciales en el canal Instagram." />
            )}
          </Card>
        </div>
      )}
    </Page>
  );
};

const EmptyHint = ({ label, hint }: { label: string; hint: string }) => (
  <div className="text-sm text-gray-500">
    <p>{label}</p>
    <Link to="/messaging/channels" className="inline-flex items-center gap-1 mt-2 text-app-700 font-medium hover:underline text-sm">
      <Plug className="w-4 h-4" /> {hint}
    </Link>
  </div>
);

export default PagesPage;
