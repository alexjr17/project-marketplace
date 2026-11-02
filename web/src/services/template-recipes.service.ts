import { http, isApiError } from '../lib/http';

export interface TemplateRecipe {
  id: number;
  variantId: number;
  inputVariantId: number;
  quantity: number;
  variant: {
    id: number;
    sku: string;
    color: {
      id: number;
      name: string;
      slug: string;
      hexCode: string;
    } | null;
    size: {
      id: number;
      name: string;
      abbreviation: string;
    } | null;
    product: {
      id: number;
      name: string;
      sku: string;
    };
  };
  inputVariant: {
    id: number;
    sku: string;
    currentStock: number;
    unitCost: number;
    color: {
      id: number;
      name: string;
      slug: string;
      hexCode: string;
    } | null;
    size: {
      id: number;
      name: string;
      abbreviation: string;
    } | null;
    input: {
      id: number;
      code: string;
      name: string;
      unitOfMeasure: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariantStock {
  variantId: number;
  sku: string;
  color: string;
  size: string;
  recipe: {
    inputName: string;
    inputColor: string;
    inputSize: string;
    inputStock: number;
    quantity: number;
  } | null;
  availableStock: number;
}

export interface CreateTemplateRecipeInput {
  variantId: number;
  inputVariantId: number;
  quantity?: number;
}

export interface VariantStockInfo {
  variantId: number | null;
  sku?: string;
  availableStock: number;
  recipe?: { inputName: string; inputStock: number; quantity: number }[] | null;
}

class TemplateRecipesService {
  private baseUrl = '/template-recipes';

  /**
   * Crear o actualizar receta para una variante de template
   */
  async createRecipe(data: CreateTemplateRecipeInput): Promise<TemplateRecipe> {
    return http.post<TemplateRecipe>(this.baseUrl, data);
  }

  /**
   * Obtener receta de una variante específica
   */
  async getRecipe(variantId: number): Promise<TemplateRecipe | null> {
    try {
      return (await http.get<TemplateRecipe | null>(`${this.baseUrl}/variant/${variantId}`)) ?? null;
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Obtener todas las recetas de un template
   */
  async getRecipesByProduct(productId: number): Promise<TemplateRecipe[]> {
    return (await http.get<TemplateRecipe[]>(`${this.baseUrl}/product/${productId}`)) ?? [];
  }

  /**
   * Obtener stock disponible para todas las variantes de un template
   */
  async getAvailableStock(productId: number): Promise<TemplateVariantStock[]> {
    const data = await http.get<TemplateVariantStock[]>(`${this.baseUrl}/product/${productId}/stock`);
    return Array.isArray(data) ? data : [];
  }

  /**
   * Eliminar receta de una variante
   */
  async deleteRecipe(variantId: number): Promise<void> {
    await http.delete(`${this.baseUrl}/variant/${variantId}`);
  }

  /**
   * Quitar un insumo concreto de la receta de una variante
   */
  async deleteRecipeInput(variantId: number, inputVariantId: number): Promise<void> {
    await http.delete(`${this.baseUrl}/variant/${variantId}/input/${inputVariantId}`);
  }

  /**
   * Asociar insumos a un template. El API responde la forma cruda { created, message }.
   */
  async associateInputs(productId: number, inputIds: number[]): Promise<{ created: number; message?: string }> {
    const res = await http.envelope<never>('POST', `${this.baseUrl}/product/${productId}/associate`, { body: { inputIds } });
    return { created: Number(res.created ?? 0), message: res.message };
  }

  /**
   * Obtener IDs de insumos asociados a un template. El API responde la forma cruda { inputIds }.
   */
  async getAssociatedInputIds(productId: number): Promise<number[]> {
    const res = await http.envelope<never>('GET', `${this.baseUrl}/product/${productId}/inputs`);
    return Array.isArray(res.inputIds) ? (res.inputIds as number[]) : [];
  }

  /**
   * Obtener stock de una variante específica por color y talla
   * Soporta búsqueda por colorId/sizeId O por colorHex/sizeName
   */
  async getVariantStock(
    productId: number,
    colorId?: number | null,
    sizeId?: number | null,
    colorHex?: string | null,
    sizeName?: string | null
  ): Promise<VariantStockInfo> {
    // Antes se leía response.data.data (un nivel de más) y siempre llegaba undefined.
    return http.get<VariantStockInfo>(`${this.baseUrl}/variant-stock/${productId}`, {
      colorId: colorId || undefined,
      sizeId: sizeId || undefined,
      colorHex: colorHex || undefined,
      sizeName: sizeName || undefined,
    });
  }
}

export const templateRecipesService = new TemplateRecipesService();
