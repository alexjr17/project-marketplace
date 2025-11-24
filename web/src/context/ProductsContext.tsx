import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import type { Product, ProductSortOption } from '../types/product';
import { mockProducts } from '../data/mockProducts';
import type { FilterValues } from '../components/products/ProductFilters';

interface ProductsContextType {
  products: Product[];
  filteredProducts: Product[];
  filters: FilterValues;
  sortOption: ProductSortOption;
  isLoading: boolean;
  setFilters: (filters: FilterValues) => void;
  setSortOption: (option: ProductSortOption) => void;
  getProductById: (id: string) => Product | undefined;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, updates: Partial<Omit<Product, 'id' | 'createdAt'>>) => void;
  deleteProduct: (id: string) => void;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

const STORAGE_KEY = 'marketplace_products';

export const ProductsProvider = ({ children }: { children: ReactNode }) => {
  // Initialize products from localStorage or use mockProducts
  const [products, setProducts] = useState<Product[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        return parsed.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }));
      } catch (e) {
        console.error('Error loading products from localStorage:', e);
      }
    }
    return mockProducts;
  });
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState<FilterValues>({});
  const [sortOption, setSortOption] = useState<ProductSortOption>('newest');
  const [isLoading, setIsLoading] = useState(true);

  // Save products to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  // Apply filters and sorting
  useEffect(() => {
    setIsLoading(true);

    let result = [...products];

    // Apply filters
    if (filters.category) {
      result = result.filter((p) => p.category === filters.category);
    }

    if (filters.type) {
      result = result.filter((p) => p.type === filters.type);
    }

    if (filters.minPrice !== undefined) {
      result = result.filter((p) => p.basePrice >= filters.minPrice!);
    }

    if (filters.maxPrice !== undefined) {
      result = result.filter((p) => p.basePrice <= filters.maxPrice!);
    }

    if (filters.inStock) {
      result = result.filter((p) => p.stock > 0);
    }

    if (filters.featured) {
      result = result.filter((p) => p.featured);
    }

    // Apply sorting
    switch (sortOption) {
      case 'price-asc':
        result.sort((a, b) => a.basePrice - b.basePrice);
        break;
      case 'price-desc':
        result.sort((a, b) => b.basePrice - a.basePrice);
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'rating':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'popular':
        result.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
        break;
      case 'newest':
        result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }

    setFilteredProducts(result);
    setIsLoading(false);
  }, [products, filters, sortOption]);

  const getProductById = (id: string): Product | undefined => {
    return products.find((p) => p.id === id);
  };

  const addProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProduct: Product = {
      ...productData,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setProducts((prev) => [...prev, newProduct]);
  };

  const updateProduct = (id: string, updates: Partial<Omit<Product, 'id' | 'createdAt'>>) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, ...updates, updatedAt: new Date() }
          : p
      )
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <ProductsContext.Provider
      value={{
        products,
        filteredProducts,
        filters,
        sortOption,
        isLoading,
        setFilters,
        setSortOption,
        getProductById,
        addProduct,
        updateProduct,
        deleteProduct,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
};
