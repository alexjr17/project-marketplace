import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { Size, Color, ProductType, Category } from '../types/catalog';

interface CatalogsContextType {
  sizes: Size[];
  colors: Color[];
  productTypes: ProductType[];
  categories: Category[];

  // Sizes
  addSize: (size: Omit<Size, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSize: (id: string, updates: Partial<Omit<Size, 'id' | 'createdAt'>>) => void;
  deleteSize: (id: string) => void;

  // Colors
  addColor: (color: Omit<Color, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateColor: (id: string, updates: Partial<Omit<Color, 'id' | 'createdAt'>>) => void;
  deleteColor: (id: string) => void;

  // Product Types
  addProductType: (type: Omit<ProductType, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProductType: (id: string, updates: Partial<Omit<ProductType, 'id' | 'createdAt'>>) => void;
  deleteProductType: (id: string) => void;

  // Categories
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>) => void;
  deleteCategory: (id: string) => void;
}

const CatalogsContext = createContext<CatalogsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  sizes: 'marketplace_sizes',
  colors: 'marketplace_colors',
  productTypes: 'marketplace_product_types',
  categories: 'marketplace_categories',
};

// Mock initial data
const initialSizes: Size[] = [
  { id: '1', name: 'Extra Small', abbreviation: 'XS', order: 1, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Small', abbreviation: 'S', order: 2, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Medium', abbreviation: 'M', order: 3, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Large', abbreviation: 'L', order: 4, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Extra Large', abbreviation: 'XL', order: 5, active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '6', name: 'Double XL', abbreviation: 'XXL', order: 6, active: true, createdAt: new Date(), updatedAt: new Date() },
];

const initialColors: Color[] = [
  { id: '1', name: 'Blanco', hexCode: '#FFFFFF', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Negro', hexCode: '#000000', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Rojo', hexCode: '#EF4444', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Azul', hexCode: '#3B82F6', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Verde', hexCode: '#10B981', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '6', name: 'Amarillo', hexCode: '#F59E0B', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '7', name: 'Rosa', hexCode: '#EC4899', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '8', name: 'Morado', hexCode: '#8B5CF6', active: true, createdAt: new Date(), updatedAt: new Date() },
];

const initialProductTypes: ProductType[] = [
  { id: '1', name: 'Camiseta', description: 'Camisetas de diferentes estilos', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Sudadera', description: 'Sudaderas con y sin capucha', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Gorra', description: 'Gorras y sombreros personalizables', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Taza', description: 'Tazas cerámicas personalizables', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Bolsa', description: 'Bolsas de tela y totebags', active: true, createdAt: new Date(), updatedAt: new Date() },
];

const initialCategories: Category[] = [
  { id: '1', name: 'Ropa', description: 'Prendas de vestir personalizables', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Accesorios', description: 'Accesorios personalizados', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Hogar', description: 'Artículos para el hogar', active: true, createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Oficina', description: 'Artículos de oficina y papelería', active: true, createdAt: new Date(), updatedAt: new Date() },
];

export const CatalogsProvider = ({ children }: { children: ReactNode }) => {
  // Initialize from localStorage or use defaults
  const [sizes, setSizes] = useState<Size[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.sizes);
    if (stored) {
      try {
        return JSON.parse(stored).map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }));
      } catch (e) {
        console.error('Error loading sizes:', e);
      }
    }
    return initialSizes;
  });

  const [colors, setColors] = useState<Color[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.colors);
    if (stored) {
      try {
        return JSON.parse(stored).map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        }));
      } catch (e) {
        console.error('Error loading colors:', e);
      }
    }
    return initialColors;
  });

  const [productTypes, setProductTypes] = useState<ProductType[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.productTypes);
    if (stored) {
      try {
        return JSON.parse(stored).map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        }));
      } catch (e) {
        console.error('Error loading product types:', e);
      }
    }
    return initialProductTypes;
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.categories);
    if (stored) {
      try {
        return JSON.parse(stored).map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        }));
      } catch (e) {
        console.error('Error loading categories:', e);
      }
    }
    return initialCategories;
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sizes, JSON.stringify(sizes));
  }, [sizes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.colors, JSON.stringify(colors));
  }, [colors]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.productTypes, JSON.stringify(productTypes));
  }, [productTypes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
  }, [categories]);

  // Size methods
  const addSize = (sizeData: Omit<Size, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newSize: Size = {
      ...sizeData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSizes((prev) => [...prev, newSize]);
  };

  const updateSize = (id: string, updates: Partial<Omit<Size, 'id' | 'createdAt'>>) => {
    setSizes((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s
      )
    );
  };

  const deleteSize = (id: string) => {
    setSizes((prev) => prev.filter((s) => s.id !== id));
  };

  // Color methods
  const addColor = (colorData: Omit<Color, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newColor: Color = {
      ...colorData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setColors((prev) => [...prev, newColor]);
  };

  const updateColor = (id: string, updates: Partial<Omit<Color, 'id' | 'createdAt'>>) => {
    setColors((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
      )
    );
  };

  const deleteColor = (id: string) => {
    setColors((prev) => prev.filter((c) => c.id !== id));
  };

  // ProductType methods
  const addProductType = (typeData: Omit<ProductType, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newType: ProductType = {
      ...typeData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setProductTypes((prev) => [...prev, newType]);
  };

  const updateProductType = (id: string, updates: Partial<Omit<ProductType, 'id' | 'createdAt'>>) => {
    setProductTypes((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
      )
    );
  };

  const deleteProductType = (id: string) => {
    setProductTypes((prev) => prev.filter((t) => t.id !== id));
  };

  // Category methods
  const addCategory = (categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCategory: Category = {
      ...categoryData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setCategories((prev) => [...prev, newCategory]);
  };

  const updateCategory = (id: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date() } : c
      )
    );
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <CatalogsContext.Provider
      value={{
        sizes,
        colors,
        productTypes,
        categories,
        addSize,
        updateSize,
        deleteSize,
        addColor,
        updateColor,
        deleteColor,
        addProductType,
        updateProductType,
        deleteProductType,
        addCategory,
        updateCategory,
        deleteCategory,
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
