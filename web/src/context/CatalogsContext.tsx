import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Size, Color, ProductType, Category, CatalogInput } from '../types/catalog';
import { catalogsService } from '../services';

interface CatalogsContextType {
  sizes: Size[];
  colors: Color[];
  productTypes: ProductType[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;

  // Sizes
  addSize: (size: CatalogInput<Size>) => Promise<void>;
  updateSize: (id: number, updates: Partial<Omit<Size, 'id' | 'createdAt'>>) => Promise<void>;
  deleteSize: (id: number) => Promise<void>;

  // Colors
  addColor: (color: CatalogInput<Color>) => Promise<void>;
  updateColor: (id: number, updates: Partial<Omit<Color, 'id' | 'createdAt'>>) => Promise<void>;
  deleteColor: (id: number) => Promise<void>;

  // Product Types
  addProductType: (type: CatalogInput<ProductType>) => Promise<void>;
  updateProductType: (id: number, updates: Partial<Omit<ProductType, 'id' | 'createdAt'>>) => Promise<void>;
  deleteProductType: (id: number) => Promise<void>;
  createProductType: (typeData: CatalogInput<ProductType>, sizeIds: number[]) => Promise<void>;
  updateProductTypeWithSizes: (id: number, typeData: CatalogInput<ProductType>, sizeIds: number[]) => Promise<void>;

  // Categories
  addCategory: (category: CatalogInput<Category>) => Promise<void>;
  updateCategory: (id: number, updates: Partial<Omit<Category, 'id' | 'createdAt'>>) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;

  // Refresh
  refreshCatalogs: () => Promise<void>;
}

const CatalogsContext = createContext<CatalogsContextType | undefined>(undefined);

// Mapear datos de API a tipos locales
const mapApiSize = (s: any): Size => ({
  id: s.id,
  name: s.name,
  abbreviation: s.abbreviation,
  sortOrder: s.sortOrder || 0,
  isActive: s.isActive,
  createdAt: new Date(s.createdAt || Date.now()),
  updatedAt: new Date(s.updatedAt || Date.now()),
});

const mapApiColor = (c: any): Color => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  hexCode: c.hexCode,
  isActive: c.isActive,
  createdAt: new Date(c.createdAt || Date.now()),
  updatedAt: new Date(c.updatedAt || Date.now()),
});

const mapApiProductType = (t: any): ProductType => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  description: t.description,
  categoryId: t.categoryId || null,
  categorySlug: t.categorySlug || null,
  isActive: t.isActive,
  createdAt: new Date(t.createdAt || Date.now()),
  updatedAt: new Date(t.updatedAt || Date.now()),
});

const mapApiCategory = (c: any): Category => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: c.description,
  isActive: c.isActive,
  createdAt: new Date(c.createdAt || Date.now()),
  updatedAt: new Date(c.updatedAt || Date.now()),
});

export const CatalogsProvider = ({ children }: { children: ReactNode }) => {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar todos los catálogos
  const loadCatalogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [sizesData, colorsData, typesData, categoriesData] = await Promise.all([
        catalogsService.getSizes(),
        catalogsService.getColors(),
        catalogsService.getProductTypes(),
        catalogsService.getCategories(),
      ]);

      setSizes(sizesData.map(mapApiSize));
      setColors(colorsData.map(mapApiColor));
      setProductTypes(typesData.map(mapApiProductType));
      setCategories(categoriesData.map(mapApiCategory));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando catálogos';
      setError(message);
      console.error('Error loading catalogs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar al montar
  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  // Size methods
  const addSize = async (sizeData: CatalogInput<Size>) => {
    const newSize = await catalogsService.createSize({
      name: sizeData.name,
      abbreviation: sizeData.abbreviation,
      sortOrder: sizeData.sortOrder,
      isActive: sizeData.isActive,
    });
    setSizes((prev) => [...prev, mapApiSize(newSize)]);
  };

  const updateSize = async (id: number, updates: Partial<Omit<Size, 'id' | 'createdAt'>>) => {
    const apiUpdates: any = {};
    if (updates.name !== undefined) apiUpdates.name = updates.name;
    if (updates.abbreviation !== undefined) apiUpdates.abbreviation = updates.abbreviation;
    if (updates.sortOrder !== undefined) apiUpdates.sortOrder = updates.sortOrder;
    if (updates.isActive !== undefined) apiUpdates.isActive = updates.isActive;

    const updated = await catalogsService.updateSize(id, apiUpdates);
    setSizes((prev) => prev.map((s) => (s.id === id ? mapApiSize(updated) : s)));
  };

  const deleteSize = async (id: number) => {
    await catalogsService.deleteSize(id);
    setSizes((prev) => prev.filter((s) => s.id !== id));
  };

  // Color methods
  const addColor = async (colorData: CatalogInput<Color>) => {
    const newColor = await catalogsService.createColor({
      name: colorData.name,
      hexCode: colorData.hexCode,
      isActive: colorData.isActive,
    });
    setColors((prev) => [...prev, mapApiColor(newColor)]);
  };

  const updateColor = async (id: number, updates: Partial<Omit<Color, 'id' | 'createdAt'>>) => {
    const apiUpdates: any = {};
    if (updates.name !== undefined) apiUpdates.name = updates.name;
    if (updates.hexCode !== undefined) apiUpdates.hexCode = updates.hexCode;
    if (updates.isActive !== undefined) apiUpdates.isActive = updates.isActive;

    const updated = await catalogsService.updateColor(id, apiUpdates);
    setColors((prev) => prev.map((c) => (c.id === id ? mapApiColor(updated) : c)));
  };

  const deleteColor = async (id: number) => {
    await catalogsService.deleteColor(id);
    setColors((prev) => prev.filter((c) => c.id !== id));
  };

  // ProductType methods
  const addProductType = async (typeData: CatalogInput<ProductType>) => {
    const newType = await catalogsService.createProductType({
      name: typeData.name,
      description: typeData.description,
      isActive: typeData.isActive,
    });
    setProductTypes((prev) => [...prev, mapApiProductType(newType)]);
  };

  const updateProductType = async (
    id: number,
    updates: Partial<Omit<ProductType, 'id' | 'createdAt'>>
  ) => {
    const apiUpdates: any = {};
    if (updates.name !== undefined) apiUpdates.name = updates.name;
    if (updates.description !== undefined) apiUpdates.description = updates.description;
    if (updates.isActive !== undefined) apiUpdates.isActive = updates.isActive;

    const updated = await catalogsService.updateProductType(id, apiUpdates);
    setProductTypes((prev) => prev.map((t) => (t.id === id ? mapApiProductType(updated) : t)));
  };

  const deleteProductType = async (id: number) => {
    await catalogsService.deleteProductType(id);
    setProductTypes((prev) => prev.filter((t) => t.id !== id));
  };

  // Crear tipo de producto con tallas asignadas
  const createProductType = async (
    typeData: CatalogInput<ProductType>,
    sizeIds: number[]
  ) => {
    const newType = await catalogsService.createProductType(typeData);
    await catalogsService.assignSizesToProductType(newType.id, sizeIds);
    await loadCatalogs(); // Recargar para obtener datos actualizados
  };

  // Actualizar tipo de producto con tallas asignadas
  const updateProductTypeWithSizes = async (
    id: number,
    typeData: CatalogInput<ProductType>,
    sizeIds: number[]
  ) => {
    await catalogsService.updateProductType(id, typeData);
    await catalogsService.assignSizesToProductType(id, sizeIds);
    await loadCatalogs(); // Recargar para obtener datos actualizados
  };

  // Category methods
  const addCategory = async (categoryData: CatalogInput<Category>) => {
    const newCategory = await catalogsService.createCategory({
      name: categoryData.name,
      description: categoryData.description,
      isActive: categoryData.isActive,
    });
    setCategories((prev) => [...prev, mapApiCategory(newCategory)]);
  };

  const updateCategory = async (
    id: number,
    updates: Partial<Omit<Category, 'id' | 'createdAt'>>
  ) => {
    const apiUpdates: any = {};
    if (updates.name !== undefined) apiUpdates.name = updates.name;
    if (updates.description !== undefined) apiUpdates.description = updates.description;
    if (updates.isActive !== undefined) apiUpdates.isActive = updates.isActive;

    const updated = await catalogsService.updateCategory(id, apiUpdates);
    setCategories((prev) => prev.map((c) => (c.id === id ? mapApiCategory(updated) : c)));
  };

  const deleteCategory = async (id: number) => {
    await catalogsService.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const refreshCatalogs = async () => {
    await loadCatalogs();
  };

  return (
    <CatalogsContext.Provider
      value={{
        sizes,
        colors,
        productTypes,
        categories,
        isLoading,
        error,
        addSize,
        updateSize,
        deleteSize,
        addColor,
        updateColor,
        deleteColor,
        addProductType,
        updateProductType,
        deleteProductType,
        createProductType,
        updateProductTypeWithSizes,
        addCategory,
        updateCategory,
        deleteCategory,
        refreshCatalogs,
      }}
    >
      {children}
    </CatalogsContext.Provider>
  );
};

export const useCatalogs = () => {
  const context = useContext(CatalogsContext);
  if (context === undefined) {
    throw new Error('useCatalogs must be used within a CatalogsProvider');
  }
  return context;
};
