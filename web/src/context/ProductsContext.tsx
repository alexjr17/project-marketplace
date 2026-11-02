import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Product, ProductSortOption } from '../types/product';
import { productsService } from '../services';
import type { FilterValues } from '../components/products/ProductFilters';

interface ProductsContextType {
  products: Product[];
  filteredProducts: Product[];
  filters: FilterValues;
  sortOption: ProductSortOption;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  setFilters: (filters: FilterValues) => void;
  setSortOption: (option: ProductSortOption) => void;
  setPage: (page: number) => void;
  getProductById: (id: number) => Promise<Product | null>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>;
  updateProduct: (id: number, updates: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: number) => Promise<void>;
  refreshProducts: () => Promise<void>;
  /** Lo llama useProducts(): el listado solo se pide cuando una pantalla lo usa. */
  activate: () => void;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export const ProductsProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filters, setFiltersState] = useState<FilterValues>({});
  const [sortOption, setSortOptionState] = useState<ProductSortOption>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // El proveedor envuelve toda la app, pero el listado solo hace falta en el catálogo y en
  // el panel: antes se pedía en cada página (también en la portada) sin que nadie lo usara.
  const [active, setActive] = useState(false);
  const activate = useCallback(() => setActive(true), []);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Mapear sortOption a parámetros de API
  const getSortParams = (option: ProductSortOption) => {
    switch (option) {
      case 'price-asc':
        return { sortBy: 'basePrice', sortOrder: 'asc' as const };
      case 'price-desc':
        return { sortBy: 'basePrice', sortOrder: 'desc' as const };
      case 'name-asc':
        return { sortBy: 'name', sortOrder: 'asc' as const };
      case 'name-desc':
        return { sortBy: 'name', sortOrder: 'desc' as const };
      case 'rating':
        return { sortBy: 'rating', sortOrder: 'desc' as const };
      case 'popular':
        return { sortBy: 'reviewsCount', sortOrder: 'desc' as const };
      case 'newest':
      default:
        return { sortBy: 'createdAt', sortOrder: 'desc' as const };
    }
  };

  // Cargar productos desde la API
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sortParams = getSortParams(sortOption);

      const response = await productsService.getAll({
        page: pagination.page,
        limit: pagination.limit,
        category: filters.category,
        type: filters.type,
        featured: filters.featured,
        inStock: filters.inStock,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        search: filters.search?.trim() || undefined,
        onSale: filters.onSale || undefined,
        ...sortParams,
      });

      // Convertir fechas de string a Date
      const productsWithDates = response.data.map((p) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }));

      setProducts(productsWithDates);
      setFilteredProducts(productsWithDates);
      setPagination(response.pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error cargando productos';
      setError(message);
      console.error('Error loading products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, sortOption, pagination.page, pagination.limit]);

  // Cargar productos cuando cambian filtros, orden o página
  useEffect(() => {
    if (active) loadProducts();
  }, [active, loadProducts]);

  const setFilters = (newFilters: FilterValues) => {
    setFiltersState(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  const setSortOption = (option: ProductSortOption) => {
    setSortOptionState(option);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  };

  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const getProductById = async (id: number): Promise<Product | null> => {
    // Primero buscar en cache local
    const cached = products.find((p) => p.id === id);
    if (cached) return cached;

    // Si no está en cache, buscar en API
    try {
      const product = await productsService.getById(id);
      if (product) {
        return {
          ...product,
          createdAt: new Date(product.createdAt),
          updatedAt: new Date(product.updatedAt),
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const addProduct = async (
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Product> => {
    const newProduct = await productsService.create(productData);
    await loadProducts(); // Recargar lista
    return {
      ...newProduct,
      createdAt: new Date(newProduct.createdAt),
      updatedAt: new Date(newProduct.updatedAt),
    };
  };

  const updateProduct = async (id: number, updates: Partial<Product>): Promise<Product> => {
    const updated = await productsService.update(id, updates);
    await loadProducts(); // Recargar lista
    return {
      ...updated,
      createdAt: new Date(updated.createdAt),
      updatedAt: new Date(updated.updatedAt),
    };
  };

  const deleteProduct = async (id: number): Promise<void> => {
    await productsService.delete(id);
    await loadProducts(); // Recargar lista
  };

  const refreshProducts = async () => {
    await loadProducts();
  };

  return (
    <ProductsContext.Provider
      value={{
        products,
        filteredProducts,
        filters,
        sortOption,
        isLoading,
        error,
        pagination,
        setFilters,
        setSortOption,
        setPage,
        getProductById,
        addProduct,
        updateProduct,
        deleteProduct,
        refreshProducts,
        activate,
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
  const { activate } = context;
  useEffect(() => { activate(); }, [activate]);
  return context;
};
