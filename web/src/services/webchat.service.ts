// Cliente del chat web público (sin auth de usuario).
// Mantiene el token de sesión en sessionStorage para sobrevivir recargas de página.

import type { Message, WebChatSendResult, WebChatSession } from '../types/messaging';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8000/api';
const TOKEN_KEY = 'vexa_webchat_token';
const CONVERSATION_KEY = 'vexa_webchat_conv';

interface StartParams {
  name?: string;
  email?: string;
  phone?: string;
}

interface WebChatRawResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export const webchatService = {
  getStoredToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  },

  getStoredConversationId(): number | null {
    const raw = sessionStorage.getItem(CONVERSATION_KEY);
    return raw ? Number(raw) : null;
  },

  clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(CONVERSATION_KEY);
  },

  async start(params: StartParams = {}): Promise<WebChatSession> {
    const response = await fetch(`${API_URL}/webchat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const json: WebChatRawResponse<WebChatSession> = await response.json();
    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || 'No se pudo iniciar el chat');
    }

    sessionStorage.setItem(TOKEN_KEY, json.data.sessionToken);
    sessionStorage.setItem(CONVERSATION_KEY, String(json.data.conversationId));
    return json.data;
  },

  async send(content: string): Promise<WebChatSendResult> {
    const token = this.getStoredToken();
    if (!token) throw new Error('Sesión de chat no inicializada');

    const response = await fetch(`${API_URL}/webchat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WebChat-Token': token,
      },
      body: JSON.stringify({ content }),
    });

    const json: WebChatRawResponse<WebChatSendResult> = await response.json();
    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.message || 'No se pudo enviar el mensaje');
    }
    return json.data;
  },

  async poll(sinceId?: number): Promise<{ conversationId: number; messages: Message[] }> {
    const token = this.getStoredToken();
    if (!token) throw new Error('Sesión de chat no inicializada');

    const url = new URL(`${API_URL}/webchat/poll`);
    if (sinceId !== undefined) url.searchParams.set('sinceId', String(sinceId));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'X-WebChat-Token': token },
    });

    const json: WebChatRawResponse<{ conversationId: number; messages: Message[] }> = await response.json();
    if (!response.ok || !json.success || !json.data) {
      // Si el token quedó inválido (por borrar la conversación), reset.
      if (response.status === 401) this.clearSession();
      throw new Error(json.message || 'No se pudieron cargar los mensajes');
    }
    return json.data;
  },
};

export default webchatService;
