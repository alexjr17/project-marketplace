import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Facebook,
  Globe,
  Instagram,
  Loader2,
  MessageCircle,
  Phone,
  Save,
  TestTube2,
} from 'lucide-react';
import messagingService from '../../services/messaging.service';
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
  accent: string; // gradient o color principal del card header
  badgeBg: string; // tag de "API: …"
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
    accent: 'from-violet-500 to-fuchsia-500',
    badgeBg: 'bg-violet-100 text-violet-700',
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
    accent: 'from-blue-600 to-sky-500',
    badgeBg: 'bg-blue-100 text-blue-700',
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
    accent: 'from-pink-500 via-rose-500 to-orange-500',
    badgeBg: 'bg-pink-100 text-pink-700',
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
    accent: 'from-emerald-500 to-green-600',
    badgeBg: 'bg-green-100 text-green-700',
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
    accent: 'from-gray-600 to-gray-800',
    badgeBg: 'bg-gray-200 text-gray-700',
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
    accent: 'from-amber-500 to-orange-500',
    badgeBg: 'bg-amber-100 text-amber-700',
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
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <header className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Conexiones de canales</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura las credenciales de cada API por separado. Cada canal funciona de forma
            independiente; activa solo los que tengas listos.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} onSaved={handleSaved} />
          ))
        )}
      </div>
    </div>
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
  const apiBaseUrl =
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/?$/, '') ||
    'http://localhost:8000';
  const webhookUrl = meta.webhookPath ? `${apiBaseUrl}${meta.webhookPath}` : null;

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

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left bg-gradient-to-r ${meta.accent} text-white`}
      >
        <div className="w-11 h-11 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base">{meta.title}</h2>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${meta.badgeBg}`}>
              {meta.apiBadge}
            </span>
            {channel.isActive ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/25">
                <CheckCircle2 className="w-3 h-3" /> Activo
              </span>
            ) : (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/20">Inactivo</span>
            )}
          </div>
          <p className="text-xs opacity-90 mt-0.5">{meta.subtitle}</p>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 flex-shrink-0" />}
      </button>

      {/* Cuerpo */}
      {expanded && (
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">{meta.intro}</p>

          {meta.docsUrl && (
            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-blue-600 hover:underline"
            >
              Ver documentación oficial →
            </a>
          )}

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <ToggleSwitch
              label="Canal activo"
              checked={isActive}
              onChange={setIsActive}
              hint="Si está apagado, el canal no recibe ni envía mensajes."
            />
            <ToggleSwitch
              label="Auto-respuesta con IA"
              checked={aiAutoReply}
              onChange={setAiAutoReply}
              hint="Cuando se activa, las nuevas conversaciones nacen con el bot encendido."
            />
          </div>

          {/* Webhook URL (solo Meta / Twilio) */}
          {webhookUrl && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                URL de webhook (pega esto en {meta.title})
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-gray-200 px-2 py-1.5 rounded font-mono break-all">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(webhookUrl)}
                  className="text-xs px-2 py-1.5 rounded border border-gray-200 hover:bg-white"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}

          {/* Campos de configuración */}
          {meta.fields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meta.fields.map((field) => {
                const value = (config[field.key] as string | undefined) ?? '';
                const isSecret = !!field.secret;
                const visible = !isSecret || shownSecrets[field.key];
                return (
                  <div key={field.key} className={field.key === 'verifyToken' || field.key === 'pageAccessToken' || field.key === 'permanentAccessToken' || field.key === 'appSecret' || field.key === 'authToken' ? 'md:col-span-2' : ''}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
                    <div className="relative">
                      <input
                        type={isSecret && !visible ? 'password' : 'text'}
                        value={value}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full pr-10 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 font-mono"
                      />
                      {isSecret && (
                        <button
                          type="button"
                          onClick={() => handleToggleSecret(field.key)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          title={visible ? 'Ocultar' : 'Mostrar'}
                        >
                          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    {field.hint && <p className="text-[11px] text-gray-500 mt-1">{field.hint}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Feedback */}
          {feedback && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${
                feedback.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
            {meta.fields.length > 0 && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="inline-flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
                Probar conexión
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

// ============================================================
// Switch reutilizable
// ============================================================

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}

const ToggleSwitch = ({ label, checked, onChange, hint }: ToggleProps) => (
  <label className="inline-flex items-start gap-2 cursor-pointer">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-violet-600' : 'bg-gray-300'
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
    <span className="text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {hint && <span className="block text-[11px] text-gray-500">{hint}</span>}
    </span>
  </label>
);

export default ChannelsPage;
