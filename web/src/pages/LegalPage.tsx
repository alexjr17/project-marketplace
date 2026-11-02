import { useParams, Link, useNavigate } from 'react-router-dom';
import { FileText, Shield, RefreshCw, Calendar } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import type { LegalSettings } from '../types/settings';
import { PageHeader } from '../components/shared/PageHeader';
import { Seo } from '../components/seo/Seo';
import { Button, Card, EmptyState } from '../components/ui';

// Mapeo de slugs a keys del objeto legal
const slugToKey: Record<string, keyof LegalSettings> = {
  terms: 'termsAndConditions',
  privacy: 'privacyPolicy',
  returns: 'returnsPolicy',
};

// Iconos por tipo de página
const pageIcons: Record<keyof LegalSettings, typeof FileText> = {
  termsAndConditions: FileText,
  privacyPolicy: Shield,
  returnsPolicy: RefreshCw,
};

const LEGAL_LINKS: { slug: string; label: string }[] = [
  { slug: 'terms', label: 'Términos y condiciones' },
  { slug: 'privacy', label: 'Política de privacidad' },
  { slug: 'returns', label: 'Política de devoluciones' },
];

// Estilos del contenido HTML (no hay plugin de tipografía en Tailwind).
const RICH_TEXT =
  'text-sm md:text-base text-gray-700 leading-relaxed ' +
  '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-8 [&_h1]:mb-3 ' +
  '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mt-8 [&_h2]:mb-3 ' +
  '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-6 [&_h3]:mb-2 ' +
  '[&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:my-1 ' +
  '[&_strong]:text-gray-900 [&_a]:text-app-700 [&_a]:underline [&>*:first-child]:mt-0';

export const LegalPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useSettings();
  const navigate = useNavigate();

  // Obtener la página legal correspondiente
  const pageKey = slug ? slugToKey[slug] : undefined;
  const legalPage = pageKey ? settings.legal[pageKey] : undefined;

  if (!legalPage || !legalPage.isActive) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Información legal" backLabel="Inicio" backTo="/" />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card padded={false}>
            <EmptyState
              icon={FileText}
              title="Página no encontrada"
              description="La página legal que buscas no existe o no está disponible."
              action={<Button variant="secondary" onClick={() => navigate('/')}>Volver al inicio</Button>}
            />
          </Card>
        </div>
      </div>
    );
  }

  const Icon = pageIcons[pageKey!];
  const formattedDate = new Date(legalPage.lastUpdated).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Seo title={legalPage.title} />
      <PageHeader title={legalPage.title} subtitle={`Última actualización: ${formattedDate}`} backLabel="Inicio" backTo="/" />

      <div className="max-w-5xl mx-auto px-4 py-6 lg:py-8 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Otras páginas legales */}
        <nav className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-2 lg:sticky lg:top-24" aria-label="Páginas legales">
          {LEGAL_LINKS.filter((l) => settings.legal[slugToKey[l.slug]]?.isActive).map((l) => {
            const active = l.slug === slug;
            const LinkIcon = pageIcons[slugToKey[l.slug]];
            return (
              <Link
                key={l.slug}
                to={`/legal/${l.slug}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-app-50 text-app-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <LinkIcon className="w-4 h-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <article className="lg:col-span-3 bg-white rounded-xl border border-gray-200">
          <header className="flex items-center gap-3 px-5 md:px-8 py-5 border-b border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-app-100 text-app-600 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{legalPage.title}</h2>
              <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3" />Última actualización: {formattedDate}</p>
            </div>
          </header>
          <div className={`px-5 md:px-8 py-6 ${RICH_TEXT}`} dangerouslySetInnerHTML={{ __html: legalPage.content }} />
          <footer className="border-t border-gray-100 px-5 md:px-8 py-4 text-xs text-gray-500">
            {settings.general.siteName} · Todos los derechos reservados
          </footer>
        </article>
      </div>
    </div>
  );
};
