import api from './api.service';
import type {
  BotKnowledgeCategory,
  BotKnowledgeEntry,
  KnowledgeCategory,
} from '../types/messaging';

export interface KnowledgeInput {
  category: BotKnowledgeCategory;
  title: string;
  content: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CategoryInput {
  slug?: string;
  label: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TestResult {
  provider: string;
  reply: string;
}

class BotKnowledgeService {
  async list(): Promise<BotKnowledgeEntry[]> {
    const response = await api.get<BotKnowledgeEntry[]>('/messaging/knowledge');
    return response.data ?? [];
  }

  async create(data: KnowledgeInput): Promise<BotKnowledgeEntry | null> {
    const response = await api.post<BotKnowledgeEntry>('/messaging/knowledge', data);
    return response.data ?? null;
  }

  async update(id: number, data: Partial<KnowledgeInput>): Promise<BotKnowledgeEntry | null> {
    const response = await api.patch<BotKnowledgeEntry>(`/messaging/knowledge/${id}`, data);
    return response.data ?? null;
  }

  async remove(id: number): Promise<void> {
    await api.delete(`/messaging/knowledge/${id}`);
  }

  async test(text: string, contactName?: string): Promise<TestResult | null> {
    const response = await api.post<TestResult>('/messaging/knowledge/test', {
      text,
      contactName,
    });
    return response.data ?? null;
  }

  // ============ Categorías (editables) ============

  async listCategories(): Promise<KnowledgeCategory[]> {
    const response = await api.get<KnowledgeCategory[]>('/messaging/knowledge/categories');
    return response.data ?? [];
  }

  async createCategory(data: CategoryInput): Promise<KnowledgeCategory | null> {
    const response = await api.post<KnowledgeCategory>('/messaging/knowledge/categories', data);
    return response.data ?? null;
  }

  async updateCategory(id: number, data: Partial<CategoryInput>): Promise<KnowledgeCategory | null> {
    const response = await api.patch<KnowledgeCategory>(`/messaging/knowledge/categories/${id}`, data);
    return response.data ?? null;
  }

  async removeCategory(id: number): Promise<void> {
    await api.delete(`/messaging/knowledge/categories/${id}`);
  }
}

export const botKnowledgeService = new BotKnowledgeService();
export default botKnowledgeService;
