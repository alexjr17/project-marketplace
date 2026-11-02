import type { ProductSortOption } from '../../types/product';
import { SelectInput } from '../ui';

interface ProductSortProps {
  value: ProductSortOption;
  onChange: (value: ProductSortOption) => void;
}

export const ProductSort = ({ value, onChange }: ProductSortProps) => {
  const sortOptions: { value: ProductSortOption; label: string }[] = [
    { value: 'newest', label: 'Más recientes' },
    { value: 'price-asc', label: 'Precio: Menor a mayor' },
    { value: 'price-desc', label: 'Precio: Mayor a menor' },
    { value: 'name-asc', label: 'Nombre: A-Z' },
    { value: 'name-desc', label: 'Nombre: Z-A' },
    { value: 'rating', label: 'Mejor valorados' },
    { value: 'popular', label: 'Más populares' },
  ];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="product-sort" className="text-sm text-gray-500 whitespace-nowrap">Ordenar por</label>
      <SelectInput
        id="product-sort"
        value={value}
        onChange={(e) => onChange(e.target.value as ProductSortOption)}
        className="sm:w-56 cursor-pointer"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectInput>
    </div>
  );
};
