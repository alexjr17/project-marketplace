import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCheck,
  Loader2,
  MessageSquare,
  Search,
  Send,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import messagingService from '../../services/messaging.service';
import type {
  Conversation,
  ConversationStatus,
  Message,
} from '../../types/messaging';
import { useSettings } from '../../context/SettingsContext';

const STATUS_OPTIONS: { value: ConversationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'resolved', label: 'Resueltas' },
  { value: 'closed', label: 'Cerradas' },
];

/**
 * Identidad visual por canal — colores cercanos a la marca original de cada
 * app, sin copiar logos. Sirve para que el operador sepa "en qué app estoy"
 * de un vistazo: cabecera del chat, burbujas salientes y badge en la lista.
 */
const CHANNEL_STYLES: Record<string, {
  name: string;
  gradient: string;       // gradient para burbuja saliente / cabecera
  solid: string;          // color sólido (avatares, badges)
  badgeBg: string;        // tag pequeño en lista de conversaciones
  badgeText: string;
  emoji: string;          // pequeño identificador en lista
}> = {
  messenger: {
    name: 'Messenger',
    gradient: 'linear-gradient(135deg, #0084FF 0%, #0064D1 100%)',
    solid: '#0084FF',
    badgeBg: '#dbeafe',
    badgeText: '#0064D1',
    emoji: '💬',
  },
  whatsapp: {
    name: 'WhatsApp',
    gradient: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
    solid: '#25D366',
    badgeBg: '#dcfce7',
    badgeText: '#15803d',
    emoji: '🟢',
  },
  instagram: {
    name: 'Instagram',
    gradient: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)',
    solid: '#DD2A7B',
    badgeBg: '#fce7f3',
    badgeText: '#9d174d',
    emoji: '📷',
  },
  sms: {
    name: 'SMS',
    gradient: 'linear-gradient(135deg, #6B7280 0%, #374151 100%)',
    solid: '#6B7280',
    badgeBg: '#f3f4f6',
    badgeText: '#374151',
    emoji: '✉️',
  },
  webchat: {
    name: 'Chat Web',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
    solid: '#7c3aed',
    badgeBg: '#ede9fe',
    badgeText: '#6d28d9',
    emoji: '🌐',
  },
  email: {
    name: 'Email',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    solid: '#f59e0b',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    emoji: '📧',
  },
};

const channelStyle = (type?: string) => CHANNEL_STYLES[type ?? ''] ?? CHANNEL_STYLES.webchat;

const CONVERSATIONS_POLL_MS = 15000;
const MESSAGES_POLL_MS = 5000;

export const InboxPage = () => {
  const { settings } = useSettings();
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | 'all'>('open');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Modal de preview para imagen/video al click
  const [preview, setPreview] = useState<{ type: 'image' | 'video'; url: string } | null>(null);

  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<number>(0);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  // Cargar lista de conversaciones (al inicio, al cambiar filtro y por polling)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await messagingService.listConversations({
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search.trim() || undefined,
          perPage: 50,
        });
        if (!cancelled) {
          setConversations(result.data);
          setLoadingConversations(false);
        }
      } catch (err) {
        console.error('[Inbox] Error cargando conversaciones:', err);
        if (!cancelled) setLoadingConversations(false);
      }
    };

    setLoadingConversations(true);
    load();
    const interval = setInterval(load, CONVERSATIONS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [statusFilter, search]);

  // Cargar mensajes de la conversación seleccionada + polling
  useEffect(() => {
    if (selectedId === null) {
      setMessages([]);
      lastMessageIdRef.current = 0;
      return;
    }

    let cancelled = false;

    const loadInitial = async () => {
      setLoadingMessages(true);
      try {
        const all = await messagingService.getMessages(selectedId);
        if (!cancelled) {
          setMessages(all);
          lastMessageIdRef.current = all.length > 0 ? all[all.length - 1].id : 0;
          await messagingService.markRead(selectedId);
          setConversations((prev) =>
            prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c))
          );
        }
      } catch (err) {
        console.error('[Inbox] Error cargando mensajes:', err);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };

    const pollDelta = async () => {
      try {
        const fresh = await messagingService.getMessages(selectedId, lastMessageIdRef.current);
        if (cancelled || fresh.length === 0) return;
        setMessages((prev) => [...prev, ...fresh]);
        lastMessageIdRef.current = fresh[fresh.length - 1].id;
      } catch (err) {
        console.error('[Inbox] Error polling:', err);
      }
    };

    loadInitial();
    const interval = setInterval(pollDelta, MESSAGES_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedId]);

  // Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ESC cierra el modal de preview
  useEffect(() => {
    if (!preview) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [preview]);

  const handleSend = async () => {
    if (!selectedId || !composer.trim() || sending) return;
    setSending(true);
    try {
      const msg = await messagingService.sendMessage(selectedId, composer.trim());
      if (msg) {
        setMessages((prev) => [...prev, msg]);
        lastMessageIdRef.current = msg.id;
      }
      setComposer('');
    } catch (err) {
      console.error('[Inbox] Error enviando:', err);
      alert(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleSuggest = async () => {
    if (!selectedId || suggesting) return;
    setSuggesting(true);
    try {
      const suggestion = await messagingService.suggestReply(selectedId);
      setComposer(suggestion);
    } catch (err) {
      console.error('[Inbox] Error sugiriendo:', err);
      alert(err instanceof Error ? err.message : 'No se pudo generar la sugerencia');
    } finally {
      setSuggesting(false);
    }
  };

  const handleToggleAi = async () => {
    if (!selectedConversation) return;
    try {
      const updated = await messagingService.updateConversation(selectedConversation.id, {
        aiEnabled: !selectedConversation.aiEnabled,
      });
      if (updated) {
        setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch (err) {
      console.error('[Inbox] Error cambiando IA:', err);
    }
  };

  const handleChangeStatus = async (status: ConversationStatus) => {
    if (!selectedConversation) return;
    try {
      const updated = await messagingService.updateConversation(selectedConversation.id, { status });
      if (updated) {
        setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch (err) {
      console.error('[Inbox] Error cambiando estado:', err);
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-gray-50">

      {/* Dos paneles */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== Lista de conversaciones ===== */}
        <aside className="w-80 border-r border-gray-200 bg-white flex flex-col">
          {/* Filtros */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email o teléfono"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as 'color']: `${brandColors.primary}40` }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((opt) => {
                const active = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className="px-2.5 py-1 text-xs font-medium rounded-full border transition-all"
                    style={{
                      borderColor: active ? brandColors.primary : '#e5e7eb',
                      backgroundColor: active ? `${brandColors.primary}15` : 'transparent',
                      color: active ? brandColors.primary : '#6b7280',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Aún no hay conversaciones.</p>
                <p className="text-xs mt-1">Aparecerán aquí cuando un visitante escriba desde la tienda.</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const selected = conv.id === selectedId;
                const cStyle = channelStyle(conv.channel?.type);
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className="w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors relative"
                    style={selected ? { backgroundColor: `${cStyle.solid}12` } : undefined}
                  >
                    {/* Línea vertical lateral del color del canal — atajo visual */}
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: cStyle.gradient, opacity: selected ? 1 : 0.4 }}
                    />
                    <div className="flex items-start gap-3 pl-1">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold"
                        style={{ background: cStyle.gradient }}
                      >
                        {(conv.contact?.name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {conv.contact?.name || 'Visitante'}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: brandColors.secondary }}
                            >
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {conv.lastMessagePreview || 'Sin mensajes aún'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: cStyle.badgeBg, color: cStyle.badgeText }}
                          >
                            <span>{cStyle.emoji}</span> {cStyle.name}
                          </span>
                          {conv.aiEnabled && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 font-medium">
                              <Bot className="w-2.5 h-2.5" /> IA
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ===== Panel del chat ===== */}
        <main className="flex-1 flex flex-col bg-gray-50">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-6">
              <MessageSquare className="w-16 h-16 mb-3 opacity-40" />
              <p className="text-sm">Selecciona una conversación para verla.</p>
            </div>
          ) : (
            <>
              {/* Cabecera chat — color del canal en avatar + tira superior */}
              {(() => {
                const cStyle = channelStyle(selectedConversation.channel?.type);
                return (
                  <div className="border-b border-gray-200 relative">
                    <div className="h-1" style={{ background: cStyle.gradient }} />
                    <div className="bg-white px-6 py-3 flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                        style={{ background: cStyle.gradient }}
                      >
                        {(selectedConversation.contact?.name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                          {selectedConversation.contact?.name || 'Visitante'}
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: cStyle.badgeBg, color: cStyle.badgeText }}
                          >
                            {cStyle.emoji} {cStyle.name}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {selectedConversation.contact?.email || selectedConversation.contact?.phone || '—'}
                        </p>
                      </div>

                {/* Toggle IA */}
                <button
                  onClick={handleToggleAi}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                  style={{
                    borderColor: selectedConversation.aiEnabled ? brandColors.primary : '#e5e7eb',
                    backgroundColor: selectedConversation.aiEnabled ? `${brandColors.primary}10` : 'transparent',
                    color: selectedConversation.aiEnabled ? brandColors.primary : '#6b7280',
                  }}
                  title="Cuando se activa, el bot responde automáticamente los mensajes entrantes."
                >
                  <Bot className="w-3.5 h-3.5" />
                  {selectedConversation.aiEnabled ? 'Bot activo' : 'Activar bot'}
                </button>

                {/* Estado */}
                <select
                  value={selectedConversation.status}
                  onChange={(e) => handleChangeStatus(e.target.value as ConversationStatus)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as 'color']: `${brandColors.primary}40` }}
                >
                  <option value="open">Abierta</option>
                  <option value="pending">Pendiente</option>
                  <option value="resolved">Resuelta</option>
                  <option value="closed">Cerrada</option>
                </select>
                    </div>
                  </div>
                );
              })()}

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">
                    Aún no hay mensajes en esta conversación.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      brandColors={brandColors}
                      channelType={selectedConversation.channel?.type}
                      onPreview={(type, url) => setPreview({ type, url })}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="bg-white border-t border-gray-200 px-4 py-3">
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleSuggest}
                    disabled={suggesting}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    title="Sugerir respuesta con IA (mock por ahora)"
                  >
                    {suggesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" style={{ color: brandColors.primary }} />
                    )}
                    <span>Sugerir IA</span>
                  </button>

                  <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Escribe una respuesta… (Enter para enviar, Shift+Enter para nueva línea)"
                    rows={2}
                    className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ ['--tw-ring-color' as 'color']: `${brandColors.primary}40` }}
                  />

                  <button
                    onClick={handleSend}
                    disabled={!composer.trim() || sending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50 transition-opacity"
                    style={{ background: `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})` }}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modal de preview imagen/video */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 animate-in fade-in"
          onClick={() => setPreview(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPreview(null)}
          role="dialog"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreview(null);
            }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Cerrar"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
          <div
            className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {preview.type === 'image' ? (
              <img
                src={preview.url}
                alt="Vista previa"
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <video
                src={preview.url}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
              />
            )}
          </div>
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded"
            download
          >
            Abrir / descargar original
          </a>
        </div>
      )}
    </div>
  );
};

interface MessageBubbleProps {
  msg: Message;
  brandColors: { primary: string; secondary: string; accent: string };
  channelType?: string;
  onPreview?: (type: 'image' | 'video', url: string) => void;
}

const MessageBubble = ({ msg, brandColors, channelType, onPreview }: MessageBubbleProps) => {
  const isInbound = msg.direction === 'inbound';
  const isBot = msg.senderType === 'bot';
  const style = channelStyle(channelType);
  // Si por alguna razón no hay channelType, caemos al gradient de marca.
  const outboundGradient = channelType ? style.gradient : `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})`;

  // Inbound (contacto) → izquierda gris; Outbound humano → derecha color-del-canal; Outbound bot → derecha lila.
  const bubbleStyle = isInbound
    ? { backgroundColor: '#fff', color: '#111827', border: '1px solid #e5e7eb' }
    : isBot
      ? { backgroundColor: '#f5f3ff', color: '#5b21b6', border: '1px solid #ddd6fe' }
      : { background: outboundGradient, color: '#fff' };

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[75%] flex items-end gap-1.5">
        {isInbound && (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-3.5 h-3.5 text-gray-500" />
          </div>
        )}
        <div className="px-3 py-2 rounded-2xl text-sm shadow-sm" style={bubbleStyle}>
          {isBot && (
            <div className="flex items-center gap-1 text-[10px] opacity-80 font-medium mb-0.5">
              <Bot className="w-3 h-3" /> Bot
            </div>
          )}
          {msg.content && (
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
          )}
          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${msg.content ? 'mt-1.5' : ''}`}>
              {(msg.attachments as Array<{ type?: string; url?: string; name?: string; lat?: number; lng?: number }>).map((att, i) => (
                <Attachment key={i} att={att} isInbound={isInbound} onPreview={onPreview} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 mt-1 text-[10px] opacity-70 justify-end">
            {msg.createdAt && new Date(msg.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            {!isInbound && msg.status === 'read' && <CheckCheck className="w-3 h-3" />}
          </div>
        </div>
      </div>
    </div>
  );
};

interface AttachmentProps {
  att: { type?: string; url?: string; name?: string; lat?: number; lng?: number };
  isInbound: boolean;
  onPreview?: (type: 'image' | 'video', url: string) => void;
}

const Attachment = ({ att, isInbound, onPreview }: AttachmentProps) => {
  const linkColor = isInbound ? 'text-blue-600' : 'text-white underline';

  // Imágenes: thumbnail clickable → abre modal de preview.
  if (att.type === 'image' && att.url) {
    return (
      <button
        type="button"
        onClick={() => onPreview?.('image', att.url!)}
        className="block cursor-zoom-in"
      >
        <img
          src={att.url}
          alt="Imagen adjunta"
          className="max-w-[240px] max-h-[240px] rounded-lg object-cover border border-white/20 hover:opacity-90 transition-opacity"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
      </button>
    );
  }

  // Video: click abre modal con player grande.
  if (att.type === 'video' && att.url) {
    return (
      <button
        type="button"
        onClick={() => onPreview?.('video', att.url!)}
        className="relative cursor-zoom-in"
      >
        <video
          className="max-w-[240px] max-h-[240px] rounded-lg border border-white/20 pointer-events-none"
          preload="metadata"
        >
          <source src={att.url} />
        </video>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[8px] border-y-transparent ml-1" />
          </div>
        </div>
      </button>
    );
  }

  // Audio: player nativo.
  if (att.type === 'audio' && att.url) {
    return <audio controls className="max-w-[240px]" src={att.url} />;
  }

  // Ubicación: enlace a Google Maps.
  if (att.type === 'location' && att.lat !== undefined && att.lng !== undefined) {
    return (
      <a
        href={`https://www.google.com/maps?q=${att.lat},${att.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-xs font-medium ${linkColor}`}
      >
        📍 Ver ubicación
      </a>
    );
  }

  // Archivo o fallback: enlace de descarga.
  if (att.url) {
    return (
      <a
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        download={att.name}
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${linkColor} bg-white/10 px-2 py-1 rounded`}
      >
        📎 {att.name || 'Descargar archivo'}
      </a>
    );
  }

  return null;
};

export default InboxPage;
