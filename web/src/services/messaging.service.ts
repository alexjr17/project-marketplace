import api from './api.service';
import type {
  Channel,
  ChannelConfig,
  Conversation,
  ConversationStatus,
  Message,
} from '../types/messaging';

export interface ConversationListParams {
  status?: ConversationStatus;
  channelId?: number;
  assigneeUserId?: number;
  search?: string;
  perPage?: number;
}

export interface ConversationListResult {
  data: Conversation[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

export interface UpdateConversationData {
  status?: ConversationStatus;
  assigneeUserId?: number | null;
  aiEnabled?: boolean;
}

class MessagingService {
  async listConversations(params: ConversationListParams = {}): Promise<ConversationListResult> {
    const response = await api.get<Conversation[]>('/messaging/conversations', params);
    // El backend devuelve {success, data, pagination} sin envolver en .data extra.
    // Como ApiResponse<T> tipa .data como T, accedemos al raw response casteando.
    const raw = response as unknown as {
      data: Conversation[];
      pagination: ConversationListResult['pagination'];
    };
    return {
      data: raw.data ?? [],
      pagination: raw.pagination ?? { page: 1, perPage: 20, total: 0, totalPages: 1 },
    };
  }

  async getConversation(id: number): Promise<Conversation | null> {
    const response = await api.get<Conversation>(`/messaging/conversations/${id}`);
    return response.data ?? null;
  }

  async getMessages(conversationId: number, sinceId?: number): Promise<Message[]> {
    const response = await api.get<Message[]>(
      `/messaging/conversations/${conversationId}/messages`,
      sinceId !== undefined ? { sinceId } : undefined
    );
    return response.data ?? [];
  }

  async sendMessage(conversationId: number, content: string): Promise<Message | null> {
    const response = await api.post<Message>(
      `/messaging/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data ?? null;
  }

  async suggestReply(conversationId: number): Promise<string> {
    const response = await api.post<{ suggestion: string }>(
      `/messaging/conversations/${conversationId}/suggest`
    );
    return response.data?.suggestion ?? '';
  }

  async updateConversation(id: number, data: UpdateConversationData): Promise<Conversation | null> {
    const response = await api.patch<Conversation>(`/messaging/conversations/${id}`, data);
    return response.data ?? null;
  }

  async markRead(id: number): Promise<Conversation | null> {
    const response = await api.post<Conversation>(`/messaging/conversations/${id}/read`);
    return response.data ?? null;
  }

  // ============ Canales ============

  async listChannels(): Promise<Channel[]> {
    const response = await api.get<Channel[]>('/messaging/channels');
    return response.data ?? [];
  }

  async updateChannel(
    id: number,
    data: { name?: string; isActive?: boolean; aiAutoReply?: boolean; config?: ChannelConfig }
  ): Promise<Channel | null> {
    const response = await api.patch<Channel>(`/messaging/channels/${id}`, data);
    return response.data ?? null;
  }

  async testChannel(id: number): Promise<{ status: string; note?: string }> {
    const response = await api.post<{ status: string; note?: string }>(`/messaging/channels/${id}/test`);
    return response.data ?? { status: 'error' };
  }
}

export const messagingService = new MessagingService();
export default messagingService;
