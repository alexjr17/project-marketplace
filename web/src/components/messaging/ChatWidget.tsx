// Burbuja flotante de chat web en la tienda pública.
// - Si no hay sesión activa, pide nombre (y opcional email) e inicia la conversación.
// - Si ya hay sesión (sessionStorage), retoma el hilo.
// - Hace polling cada 4s para traer mensajes nuevos (incluida la respuesta del bot).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Minus, Send, User as UserIcon, X } from 'lucide-react';
import webchatService from '../../services/webchat.service';
import type { Message } from '../../types/messaging';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

const POLL_MS = 4000;

export const ChatWidget = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const brandColors = settings.appearance?.brandColors || settings.general.brandColors || {
    primary: '#7c3aed',
    secondary: '#ec4899',
    accent: '#f59e0b',
  };

  const [open, setOpen] = useState(false);
  const [sessionStarted, setSessionStarted] = useState<boolean>(!!webchatService.getStoredToken());
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastIdRef = useRef<number>(0);
  const endRef = useRef<HTMLDivElement>(null);

  const gradient = useMemo(
    () => `linear-gradient(135deg, ${brandColors.primary}, ${brandColors.secondary})`,
    [brandColors]
  );

  // Cargar histórico inicial al abrir si ya hay sesión
  useEffect(() => {
    if (!open || !sessionStarted) return;
    let cancelled = false;

    const initial = async () => {
      try {
        const { messages: list } = await webchatService.poll();
        if (cancelled) return;
        setMessages(list);
        lastIdRef.current = list.length > 0 ? list[list.length - 1].id : 0;
      } catch (err) {
        console.error('[ChatWidget] poll inicial:', err);
        // Si el token quedó inválido, resetear para que pida datos otra vez.
        if (err instanceof Error && err.message.includes('Sesión')) {
          webchatService.clearSession();
          setSessionStarted(false);
        }
      }
    };

    initial();
    const interval = setInterval(async () => {
      try {
        const { messages: fresh } = await webchatService.poll(lastIdRef.current);
        if (cancelled || fresh.length === 0) return;
        setMessages((prev) => [...prev, ...fresh]);
        lastIdRef.current = fresh[fresh.length - 1].id;
      } catch (err) {
        console.warn('[ChatWidget] poll delta:', err);
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, sessionStarted]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, open]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Cuéntanos tu nombre para empezar');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await webchatService.start({
        name: name.trim(),
        email: email.trim() || undefined,
      });
      setSessionStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el chat');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    setBusy(true);
    try {
      const { message, botReply } = await webchatService.send(text);
      setMessages((prev) => {
        const next = [...prev, message];
        if (botReply) next.push(botReply);
        return next;
      });
      lastIdRef.current = botReply ? botReply.id : message.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setBusy(false);
    }
  };

  // --- Burbuja cerrada ---
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-105 transition-transform"
        style={{ background: gradient }}
        title="Hablar con nosotros"
        aria-label="Abrir chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  // --- Panel abierto ---
  return (
    <div className="fixed bottom-6 right-6 z-40 w-[340px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between text-white" style={{ background: gradient }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">Hablemos</p>
            <p className="text-[11px] opacity-80">Te respondemos en minutos</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center"
            title="Minimizar"
            aria-label="Minimizar chat"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              webchatService.clearSession();
              setSessionStarted(false);
              setMessages([]);
              setOpen(false);
            }}
            className="w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center"
            title="Cerrar"
            aria-label="Cerrar chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cuerpo */}
      {!sessionStarted ? (
        <form onSubmit={handleStart} className="flex-1 flex flex-col justify-center px-5 gap-3">
          <p className="text-sm text-gray-600">Antes de empezar, ¿cómo te llamas?</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre *"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as 'color']: `${brandColors.primary}40` }}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (opcional)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as 'color']: `${brandColors.primary}40` }}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg py-2 text-white font-medium text-sm disabled:opacity-50"
            style={{ background: gradient }}
          >
            {busy ? 'Iniciando…' : 'Empezar chat'}
          </button>
          <p className="text-[10px] text-gray-400 text-center">
            Al iniciar aceptas que guardemos esta conversación para atenderte mejor.
          </p>
        </form>
      ) : (
        <>
          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-6">
                Escribe tu primer mensaje y te respondemos en breve.
              </p>
            )}
            {messages.map((m) => (
              <WidgetBubble key={m.id} msg={m} brandPrimary={brandColors.primary} brandSecondary={brandColors.secondary} />
            ))}
            <div ref={endRef} />
          </div>

          {error && (
            <div className="px-3 py-1.5 text-[11px] text-red-600 bg-red-50 border-t border-red-100">{error}</div>
          )}

          {/* Composer */}
          <form onSubmit={handleSend} className="border-t border-gray-200 px-2 py-2 flex items-end gap-2 bg-white">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as unknown as React.FormEvent);
                }
              }}
              rows={1}
              placeholder="Escribe un mensaje…"
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 max-h-24"
              style={{ ['--tw-ring-color' as 'color']: `${brandColors.primary}40` }}
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="w-9 h-9 rounded-full text-white flex items-center justify-center disabled:opacity-50"
              style={{ background: gradient }}
              title="Enviar"
              aria-label="Enviar mensaje"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

interface WidgetBubbleProps {
  msg: Message;
  brandPrimary: string;
  brandSecondary: string;
}

const WidgetBubble = ({ msg, brandPrimary, brandSecondary }: WidgetBubbleProps) => {
  // En el widget el "tú" es el cliente: inbound = a la derecha (mío), outbound = izquierda (empresa).
  const isMine = msg.direction === 'inbound';
  const isBot = msg.senderType === 'bot';

  const style = isMine
    ? { background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`, color: '#fff' }
    : isBot
      ? { backgroundColor: '#f5f3ff', color: '#5b21b6', border: '1px solid #ddd6fe' }
      : { backgroundColor: '#fff', color: '#111827', border: '1px solid #e5e7eb' };

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%] flex items-end gap-1.5">
        {!isMine && (
          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            {isBot ? <Bot className="w-3 h-3 text-purple-600" /> : <UserIcon className="w-3 h-3 text-gray-500" />}
          </div>
        )}
        <div className="px-3 py-2 rounded-2xl text-xs shadow-sm" style={style}>
          {isBot && <div className="text-[9px] font-medium opacity-80 mb-0.5">Asistente</div>}
          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;
