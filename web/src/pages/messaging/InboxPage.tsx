import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  MessageSquare,
  Send,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Button, EmptyState, SearchInput, SelectInput, Spinner, toast } from '../../components/ui';
import messagingService from '../../services/messaging.service';
import type {
  Conversation,
  ConversationStatus,
  Message,
} from '../../types/messaging';

const STATUS_OPTIONS: { value: ConversationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'resolved', label: 'Resueltas' },
  { value: 'closed', label: 'Cerradas' },
];

/**
 * Identidad por canal: un color cercano a la marca de cada app (sin logos) para
 * la etiqueta de la lista y la cabecera del chat. El resto de la vista usa el color de la app.
 */
const CHANNEL_STYLES: Record<string, { name: string; dot: string }> = {
  messenger: { name: 'Messenger', dot: '#0084FF' },
  whatsapp: { name: 'WhatsApp', dot: '#25D366' },
  instagram: { name: 'Instagram', dot: '#DD2A7B' },
  sms: { name: 'SMS', dot: '#6B7280' },
  webchat: { name: 'Chat web', dot: '#6B7280' },
  email: { name: 'Email', dot: '#f59e0b' },
};

const channelStyle = (type?: string) => CHANNEL_STYLES[type ?? ''] ?? CHANNEL_STYLES.webchat;

/** Etiqueta del canal (punto de color + nombre). */
const ChannelTag = ({ type }: { type?: string }) => {
  const c = channelStyle(type);
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.name}
    </span>
  );
};

const CONVERSATIONS_POLL_MS = 15000;
const MESSAGES_POLL_MS = 5000;

export const InboxPage = () => {
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
      toast.error(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
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
      toast.error(err instanceof Error ? err.message : 'No se pudo generar la sugerencia');
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

  const initial = (name?: string | null) => (name ?? '?').charAt(0).toUpperCase();

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
        {/* ===== Lista de conversaciones ===== */}
        <aside className={`w-full md:w-80 lg:w-96 border-r border-gray-200 bg-white flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          {/* Filtros */}
          <div className="p-3 border-b border-gray-100 space-y-2.5">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, email o teléfono" />
            <div className="flex gap-1 overflow-x-auto">
              {STATUS_OPTIONS.map((opt) => {
                const active = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={`h-8 px-3 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                      active ? 'border-app-600 bg-app-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
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
              <Spinner />
            ) : conversations.length === 0 ? (
              <EmptyState icon={MessageSquare} title="Aún no hay conversaciones" description="Aparecerán aquí cuando un cliente escriba por la tienda o por tus canales." />
            ) : (
              conversations.map((conv) => {
                const selected = conv.id === selectedId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`relative w-full text-left px-3 py-3 border-b border-gray-100 transition-colors ${selected ? 'bg-app-50' : 'hover:bg-gray-50'}`}
                  >
                    {selected && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-app-600" />}
                    <div className="flex items-start gap-3">
                      <span className="w-10 h-10 rounded-full bg-app-100 text-app-700 flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        {initial(conv.contact?.name)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                            {conv.contact?.name || 'Visitante'}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="min-w-[1.25rem] text-center text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-app-600 text-white">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessagePreview || 'Sin mensajes aún'}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <ChannelTag type={conv.channel?.type} />
                          {conv.aiEnabled && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-app-700 font-medium">
                              <Bot className="w-3 h-3" /> IA
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
        <section className={`flex-1 min-w-0 flex-col bg-gray-50 ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={MessageSquare} title="Selecciona una conversación" description="Elige un chat de la lista para leerlo y responder." />
            </div>
          ) : (
            <>
              {/* Cabecera del chat */}
              <div className="bg-white border-b border-gray-200 px-3 md:px-5 py-3 flex items-center gap-3 flex-wrap">
                <button type="button" onClick={() => setSelectedId(null)} title="Volver a la lista" className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="w-9 h-9 rounded-full bg-app-100 text-app-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {initial(selectedConversation.contact?.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm flex items-center gap-2 min-w-0">
                    <span className="truncate">{selectedConversation.contact?.name || 'Visitante'}</span>
                    <ChannelTag type={selectedConversation.channel?.type} />
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {selectedConversation.contact?.email || selectedConversation.contact?.phone || '—'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Bot automático */}
                  <button
                    onClick={handleToggleAi}
                    className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      selectedConversation.aiEnabled ? 'border-app-300 bg-app-50 text-app-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                    title="Cuando se activa, el bot responde automáticamente los mensajes entrantes."
                  >
                    <Bot className="w-4 h-4" />
                    {selectedConversation.aiEnabled ? 'Bot activo' : 'Activar bot'}
                  </button>

                  {/* Estado */}
                  <SelectInput
                    value={selectedConversation.status}
                    onChange={(e) => handleChangeStatus(e.target.value as ConversationStatus)}
                    className="!h-9 !w-auto text-xs"
                    aria-label="Estado de la conversación"
                  >
                    <option value="open">Abierta</option>
                    <option value="pending">Pendiente</option>
                    <option value="resolved">Resuelta</option>
                    <option value="closed">Cerrada</option>
                  </SelectInput>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 space-y-2">
                {loadingMessages ? (
                  <Spinner />
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">Aún no hay mensajes en esta conversación.</p>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} onPreview={(type, url) => setPreview({ type, url })} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Redactar */}
              <div className="bg-white border-t border-gray-200 p-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Escribe una respuesta… (Enter envía, Shift+Enter nueva línea)"
                    rows={2}
                    className="flex-1 min-w-0 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-app-200 focus:border-app-500"
                  />
                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSuggest}
                      isLoading={suggesting}
                      icon={!suggesting ? <Sparkles className="w-4 h-4 text-app-600" /> : undefined}
                      title="Sugerir respuesta con IA"
                    >
                      <span className="hidden sm:inline">Sugerir IA</span>
                    </Button>
                    <Button size="sm" onClick={handleSend} disabled={!composer.trim()} isLoading={sending} icon={!sending ? <Send className="w-4 h-4" /> : undefined}>
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Vista previa de imagen/video */}
      {preview && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPreview(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {preview.type === 'image' ? (
              <img src={preview.url} alt="Vista previa" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            ) : (
              <video src={preview.url} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg" />
            )}
          </div>
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
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
  onPreview?: (type: 'image' | 'video', url: string) => void;
}

const MessageBubble = ({ msg, onPreview }: MessageBubbleProps) => {
  const isInbound = msg.direction === 'inbound';
  const isBot = msg.senderType === 'bot';

  // Entrante (contacto) → izquierda blanca; saliente humano → derecha color de la app; bot → derecha suave.
  const bubbleCls = isInbound
    ? 'bg-white text-gray-900 border border-gray-200'
    : isBot
      ? 'bg-app-50 text-app-900 border border-app-200'
      : 'bg-app-600 text-white';

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[85%] md:max-w-[75%] flex items-end gap-1.5">
        {isInbound && (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <UserIcon className="w-3.5 h-3.5 text-gray-500" />
          </div>
        )}
        <div className={`px-3 py-2 rounded-2xl text-sm ${bubbleCls}`}>
          {isBot && (
            <div className="flex items-center gap-1 text-[11px] opacity-80 font-medium mb-0.5">
              <Bot className="w-3 h-3" /> Bot
            </div>
          )}
          {msg.content && <div className="whitespace-pre-wrap break-words">{msg.content}</div>}
          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
            <div className={`flex flex-wrap gap-1.5 ${msg.content ? 'mt-1.5' : ''}`}>
              {(msg.attachments as Array<{ type?: string; url?: string; name?: string; lat?: number; lng?: number }>).map((att, i) => (
                <Attachment key={i} att={att} light={isInbound || isBot} onPreview={onPreview} />
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
  /** Burbuja clara (entrante o bot): enlaces en el color de la app. */
  light: boolean;
  onPreview?: (type: 'image' | 'video', url: string) => void;
}

const Attachment = ({ att, light, onPreview }: AttachmentProps) => {
  const linkColor = light ? 'text-app-700 underline' : 'text-white underline';

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
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${linkColor} ${light ? 'bg-gray-100' : 'bg-white/10'} px-2 py-1 rounded`}
      >
        📎 {att.name || 'Descargar archivo'}
      </a>
    );
  }

  return null;
};

export default InboxPage;
