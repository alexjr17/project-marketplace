import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Grid3X3 } from 'lucide-react';
import { useCatalogs } from '../../context/CatalogsContext';

export const CategoriesMenu = () => {
  const { categories, productTypes, isLoading } = useCatalogs();
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);


  // Filtrar solo categorías y tipos activos
  const activeCategories = categories.filter(c => c.isActive);
  const activeProductTypes = productTypes.filter(t => t.isActive);

  // Obtener subcategorías (product types) de una categoría
  const getSubcategories = (categoryId: number | string) => {
    const catId = typeof categoryId === 'string' ? parseInt(categoryId) : categoryId;
    return activeProductTypes.filter(t => t.categoryId === catId);
  };

  // Manejar hover con delay
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setActiveCategory(null);
    }, 150);
  };

  // Click fuera para cerrar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveCategory(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (isLoading || activeCategories.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button
        className={`flex items-center gap-1.5 h-8 px-3 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
          isOpen
            ? 'bg-app-50 text-app-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Grid3X3 className="w-4 h-4" strokeWidth={isOpen ? 2.5 : 2} />
        Categorías
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Mega Menu Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 animate-fade-in-up min-w-[280px]">
          <div className="flex">
            {/* Categorías principales */}
            <div className="w-56 border-r border-gray-100 py-2 bg-gray-50">
              <div className="px-4 py-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Categorías
                </span>
              </div>
              {activeCategories.map((category) => {
                const subcats = getSubcategories(category.id);
                const hasSubcategories = subcats.length > 0;
                const isActive = activeCategory === (typeof category.id === 'string' ? parseInt(category.id) : category.id);

                return (
                  <div
                    key={category.id}
                    className="relative"
                    onMouseEnter={() => setActiveCategory(typeof category.id === 'string' ? parseInt(category.id) : category.id)}
                  >
                    {hasSubcategories ? (
                      <div
                        className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-white text-gray-900'
                            : 'text-gray-700 hover:bg-white hover:text-gray-900'
                        }`}
                      >
                        <span className="font-medium text-sm">{category.name}</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    ) : (
                      <Link
                        to={`/catalog?category=${category.slug}`}
                        className="flex items-center justify-between px-4 py-2.5 text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        <span className="font-medium text-sm">{category.name}</span>
                      </Link>
                    )}
                  </div>
                );
              })}

              {/* Ver todo el catálogo */}
              <div className="border-t border-gray-200 mt-2 pt-2 px-4">
                <Link
                  to="/catalog"
                  className="flex items-center gap-2 py-2 text-sm font-semibold text-app-700 hover:text-app-800 transition-colors"

                  onClick={() => setIsOpen(false)}
                >
                  Ver todo el catálogo
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Subcategorías (Product Types) */}
            {activeCategory && (
              <div className="w-64 py-2 bg-white animate-fade-in">
                <div className="px-4 py-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Tipos de producto
                  </span>
                </div>
                {getSubcategories(activeCategory).map((type) => (
                  <Link
                    key={type.id}
                    to={`/catalog?type=${type.slug}`}
                    className="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="font-medium text-sm">{type.name}</span>
                    {type.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{type.description}</p>
                    )}
                  </Link>
                ))}

                {/* Ver todos de esta categoría */}
                <div className="border-t border-gray-100 mt-2 pt-2 px-4">
                  {(() => {
                    const category = activeCategories.find(
                      c => (typeof c.id === 'string' ? parseInt(c.id) : c.id) === activeCategory
                    );
                    return category ? (
                      <Link
                        to={`/catalog?category=${category.slug}`}
                        className="flex items-center gap-1 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        Ver todo en {category.name}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
