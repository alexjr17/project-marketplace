// Tipos del módulo de mensajería.
// Reflejan exactamente la forma del JSON que devuelve MessagingService::format*.

export type ChannelType = 'webchat' | 'messenger' | 'whatsapp' | 'instagram' | 'sms' | 'email';
export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageSenderType = 'contact' | 'user' | 'system' | 'bot';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface ChannelSummary {
  id: number;
  type: ChannelType;
  name: string;
}

// ============ Configuración por canal ============
// Cada tipo de canal tiene su propia forma de `config`. Se mantienen permisivos
// (string opcional) porque vienen del back como JSON libre.

export interface MetaAppCreds {
  appId?: string;
  appSecret?: string;
  verifyToken?: string;
}

export interface MessengerConfig extends MetaAppCreds {
  pageId?: string;
  pageName?: string;
  pageAccessToken?: string;
}

export interface InstagramConfig extends MetaAppCreds {
  instagramBusinessAccountId?: string;
  username?: string;
  pageAccessToken?: string;
}

export interface WhatsAppConfig extends MetaAppCreds {
  wabaId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  permanentAccessToken?: string;
}

export interface SmsConfig {
  provider?: 'twilio' | 'hablame' | 'labsmobile' | string;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export interface WebchatConfig {
  greeting?: string;
  requireEmail?: boolean;
}

export type ChannelConfig =
  | WebchatConfig
  | MessengerConfig
  | InstagramConfig
  | WhatsAppConfig
  | SmsConfig
  | Record<string, unknown>;

export interface Channel {
  id: number;
  type: ChannelType;
  name: string;
  isActive: boolean;
  aiAutoReply: boolean;
  config: ChannelConfig;
  createdAt: string | null;
  updatedAt: string | null;
}

// ============ Publicaciones ============

export type SocialPlatform = 'facebook' | 'instagram';
export type SocialPostType = 'text' | 'photo' | 'video' | 'link';
export type SocialPostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

// ============ Conocimiento del bot (IA) ============

// Slug libre (string) — las categorías son editables vía API.
export type BotKnowledgeCategory = string;

// Categoría completa traída desde la BD (editable por el admin).
export interface KnowledgeCategory {
  id: number;
  slug: string;
  label: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  entriesCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BotKnowledgeEntry {
  id: number;
  category: BotKnowledgeCategory;
  title: string;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SocialPost {
  id: number;
  channelId: number;
  platform: SocialPlatform;
  type: SocialPostType;
  content: string | null;
  mediaUrl: string | null;
  mediaUrls: string[];
  status: SocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalId: string | null;
  externalUrl: string | null;
  error: string | null;
  createdByUserId: number | null;
  createdByName: string | null;
  createdAt: string | null;
}

export interface ContactSummary {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface Conversation {
  id: number;
  channelId: number;
  channel: ChannelSummary | null;
  contactId: number;
  contact: ContactSummary | null;
  status: ConversationStatus;
  assigneeUserId: number | null;
  assigneeName?: string | null;
  aiEnabled: boolean;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string | null;
}

export interface Message {
  id: number;
  conversationId: number;
  direction: MessageDirection;
  senderType: MessageSenderType;
  senderUserId: number | null;
  content: string | null;
  attachments: unknown[] | null;
  status: MessageStatus;
  createdAt: string | null;
}

// ============ Chat web (widget público) ============

export interface WebChatSession {
  conversationId: number;
  sessionToken: string;
  aiEnabled: boolean;
  channel: { id: number; name: string; type: ChannelType };
}

export interface WebChatSendResult {
  message: Message;
  botReply: Message | null;
}
