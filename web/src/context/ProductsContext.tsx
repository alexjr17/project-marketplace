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
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export const ProductsProvider = ({ children }: { children: ReactNode }) => {
  const [products] = useState<Product[]>(mockProducts);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(mockProducts);
  const [filters, setFilters] = useState<FilterValues>({});
  const [sortOption, setSortOption] = useState<ProductSortOption>('newest');
  const [isLoading, setIsLoading] = useState(false);

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
