import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  Globe,
  Instagram,
  MessageCircle,
  Phone,
  Plug,
  Save,
  TestTube2,
} from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Field, Page, PageHeader, Spinner, Switch, TextInput } from '../../components/ui';
import messagingService from '../../services/messaging.service';
import { API_ORIGIN } from '../../lib/config';
import type { Channel, ChannelConfig, ChannelType } from '../../types/messaging';

// ============================================================
// Esquema de campos por tipo de canal — define qué se le pide a
// cada producto/API de Meta (y a los demás). Cada bloque incluye:
//   - heading: cabecera de la sección
//   - intro: 1 línea explicando para qué sirve
//   - fields: campos del formulario (con marcado de "secret" para inputs tipo password)
// ============================================================

interface FieldDef {
  key: string;
  label: string;
  hint?: string;
  secret?: boolean;
  placeholder?: string;
}

interface ChannelMeta {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  apiBadge: string; // texto del tag
  docsUrl?: string;
  webhookPath?: string; // URL pública que Meta/twilio debe llamar
  fields: FieldDef[];
  intro: string;
}

const CHANNEL_META: Record<ChannelType, ChannelMeta> = {
  webchat: {
    title: 'Chat web',
    subtitle: 'Burbuja flotante en tu tienda',
    icon: Globe,
    apiBadge: 'Propio',
    intro: 'No requiere credenciales externas. Personaliza el saludo y los datos pedidos al visitante.',
    fields: [
      { key: 'greeting', label: 'Saludo inicial', placeholder: '¡Hola! ¿En qué te podemos ayudar?' },
    ],
  },
  messenger: {
    title: 'Facebook Messenger',
    subtitle: 'Mensajes a la página de Facebook',
    icon: Facebook,
    apiBadge: 'Meta · Graph API',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
    webhookPath: '/api/webhooks/messenger',
    intro:
      'Conecta tu Página de Facebook con la API de Messenger. Necesitas una App en Meta for Developers con el producto "Messenger" activado.',
    fields: [
      { key: 'appId', label: 'App ID', hint: 'developers.facebook.com → tu App → Configuración' },
      { key: 'appSecret', label: 'App Secret', secret: true },
      { key: 'pageId', label: 'Page ID', hint: 'ID numérico de la Página de Facebook' },
      { key: 'pageName', label: 'Nombre de la Página', placeholder: 'Ej. Vexa Tienda' },
      {
        key: 'pageAccessToken',
        label: 'Page Access Token',
        secret: true,
        hint: 'Token largo plazo de la Página (no el de usuario). Generado en Graph API Explorer o System User.',
      },
      {
        key: 'verifyToken',
        label: 'Verify Token (webhook)',
        hint: 'String secreto que inventas tú; debe coincidir con el que pegues al suscribir el webhook en Meta.',
      },
    ],
  },
  instagram: {
    title: 'Instagram Direct',
    subtitle: 'Mensajes directos de Instagram',
    icon: Instagram,
    apiBadge: 'Meta · Instagram Graph',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform/instagram',
    webhookPath: '/api/webhooks/messenger',
    intro:
      'Requiere cuenta de Instagram tipo Business o Creator, vinculada a una Página de Facebook. Reutiliza la App de Meta y suele compartir el Page Access Token con Messenger.',
    fields: [
      { key: 'appId', label: 'App ID' },
      { key: 'appSecret', label: 'App Secret', secret: true },
      { key: 'instagramBusinessAccountId', label: 'Instagram Business Account ID' },
      { key: 'username', label: 'Usuario de Instagram', placeholder: '@vexa.tienda' },
      { key: 'pageAccessToken', label: 'Page Access Token', secret: true, hint: 'El de la Página enlazada.' },
      { key: 'verifyToken', label: 'Verify Token (webhook)' },
    ],
  },
  whatsapp: {
    title: 'WhatsApp Business',
    subtitle: 'Cloud API de Meta',
    icon: MessageCircle,
    apiBadge: 'Meta · WhatsApp Cloud',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    webhookPath: '/api/webhooks/whatsapp',
    intro:
      'Requiere WhatsApp Business Account (WABA) verificada con tu negocio (NIT/RUT). Usa System User Token permanente, no el temporal del Graph Explorer.',
    fields: [
      { key: 'appId', label: 'App ID' },
      { key: 'appSecret', label: 'App Secret', secret: true },
      { key: 'wabaId', label: 'WhatsApp Business Account ID (WABA)' },
      { key: 'phoneNumberId', label: 'Phone Number ID' },
      { key: 'displayPhoneNumber', label: 'Número visible', placeholder: '+57 300 000 0000' },
      {
        key: 'permanentAccessToken',
        label: 'System User Access Token',
        secret: true,
        hint: 'Token permanente generado en Business Settings → Users → System Users.',
      },
      { key: 'verifyToken', label: 'Verify Token (webhook)' },
    ],
  },
  sms: {
    title: 'SMS',
    subtitle: 'Provider externo (no Meta)',
    icon: Phone,
    apiBadge: 'Twilio / Hablame / etc.',
    intro: 'Provider de SMS para mensajes salientes y entrantes (cuando lo soporte).',
    fields: [
      { key: 'provider', label: 'Proveedor', placeholder: 'twilio / hablame / labsmobile' },
      { key: 'accountSid', label: 'Account SID / Cuenta' },
      { key: 'authToken', label: 'Auth Token / API Key', secret: true },
      { key: 'fromNumber', label: 'Número de origen', placeholder: '+15555555555' },
    ],
  },
  email: {
    title: 'Email',
    subtitle: 'Correo entrante',
    icon: Globe,
    apiBadge: 'IMAP / SMTP',
    intro: 'Próximamente — recepción y envío de correos asociados a contactos.',
    fields: [],
  },
};

// ============================================================
// Página principal
// ============================================================

export const ChannelsPage = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await messagingService.listChannels();
        if (!cancelled) setChannels(list);
      } catch (err) {
        console.error('[ChannelsPage] Error cargando canales:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaved = (updated: Channel) => {
    setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  return (
    <Page className="max-w-4xl mx-auto">
      <PageHeader
        icon={Plug}
        title="Canales"
        subtitle="Configura las credenciales de cada API por separado. Activa solo los canales que tengas listos."
      />

      {loading ? (
        <Spinner label="Cargando canales…" />
      ) : channels.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState icon={Plug} title="No hay canales configurados" description="Los canales (chat web, Messenger, Instagram, WhatsApp…) aparecen aquí cuando el sistema los crea." />
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </Page>
  );
};

// ============================================================
// Tarjeta por canal
// ============================================================

interface ChannelCardProps {
  channel: Channel;
  onSaved: (channel: Channel) => void;
}

const ChannelCard = ({ channel, onSaved }: ChannelCardProps) => {
  const meta = CHANNEL_META[channel.type] || CHANNEL_META.email;
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>({ ...(channel.config as object) });
  const [isActive, setIsActive] = useState(channel.isActive);
  const [aiAutoReply, setAiAutoReply] = useState(channel.aiAutoReply);
  const [shownSecrets, setShownSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const Icon = meta.icon;
  const webhookUrl = meta.webhookPath ? `${API_ORIGIN}${meta.webhookPath}` : null;

  const handleFieldChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleSecret = (key: string) => {
    setShownSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await messagingService.updateChannel(channel.id, {
        isActive,
        aiAutoReply,
        config: config as ChannelConfig,
      });
      if (updated) {
        onSaved(updated);
        setFeedback({ ok: true, msg: 'Guardado correctamente.' });
      }
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await messagingService.testChannel(channel.id);
      setFeedback({ ok: result.status === 'ok', msg: result.note || 'Conexión validada.' });
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : 'Falló la prueba.' });
    } finally {
      setTesting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setFeedback({ ok: true, msg: 'Copiado al portapapeles.' });
  };

  const wide = (k: string) => ['verifyToken', 'pageAccessToken', 'permanentAccessToken', 'appSecret', 'authToken'].includes(k);

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Encabezado (abre / cierra) */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-4 px-4 md:px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-11 h-11 rounded-lg bg-app-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-app-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base text-gray-900">{meta.title}</h2>
            <Badge tone="gray">{meta.apiBadge}</Badge>
            {channel.isActive
              ? <Badge tone="green"><CheckCircle2 className="w-3 h-3" /> Activo</Badge>
              : <Badge tone="gray">Inactivo</Badge>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{meta.subtitle}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Cuerpo */}
      {expanded && (
        <div className="px-4 md:px-5 pb-5 pt-1 space-y-5 border-t border-gray-100">
          <div className="pt-4">
            <p className="text-sm text-gray-600">{meta.intro}</p>
            {meta.docsUrl && (
              <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-sm font-medium text-app-700 hover:underline">
                Ver documentación oficial <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Interruptores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <Switch label="Canal activo" description="Si está apagado, el canal no recibe ni envía mensajes." checked={isActive} onChange={setIsActive} />
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <Switch label="Auto-respuesta con IA" description="Las nuevas conversaciones nacen con el bot encendido." checked={aiAutoReply} onChange={setAiAutoReply} />
            </div>
          </div>

          {/* URL del webhook (Meta / Twilio) */}
          {webhookUrl && (
            <Field label={`URL de webhook (pégala en ${meta.title})`}>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 text-xs bg-gray-50 border border-gray-200 px-3 py-2.5 rounded-lg font-mono break-all text-gray-800">{webhookUrl}</code>
                <Button variant="secondary" icon={<Copy className="w-4 h-4" />} onClick={() => handleCopy(webhookUrl)}>Copiar</Button>
              </div>
            </Field>
          )}

          {/* Campos de configuración */}
          {meta.fields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meta.fields.map((field) => {
                const value = (config[field.key] as string | undefined) ?? '';
                const isSecret = !!field.secret;
                const visible = !isSecret || shownSecrets[field.key];
                return (
                  <Field key={field.key} label={field.label} hint={field.hint} className={wide(field.key) ? 'md:col-span-2' : ''}>
                    <div className="relative">
                      <TextInput
                        type={isSecret && !visible ? 'password' : 'text'}
                        value={value}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className={`font-mono ${isSecret ? 'pr-10' : ''}`}
                      />
                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => handleToggleSecret(field.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-700"
                          title={visible ? 'Ocultar' : 'Mostrar'}
                        >
                          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </Field>
                );
              })}
            </div>
          )}

          {feedback && <Alert tone={feedback.ok ? 'success' : 'error'}>{feedback.msg}</Alert>}

          {/* Acciones */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-gray-100">
            {meta.fields.length > 0 && (
              <Button variant="secondary" onClick={handleTest} isLoading={testing} icon={!testing ? <TestTube2 className="w-4 h-4" /> : undefined}>
                Probar conexión
              </Button>
            )}
            <Button onClick={handleSave} isLoading={saving} icon={!saving ? <Save className="w-4 h-4" /> : undefined}>
              Guardar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ChannelsPage;
