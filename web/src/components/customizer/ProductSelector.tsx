import type { ProductType } from '../../types/product';
import { Shirt, Wind } from 'lucide-react';

interface ProductSelectorProps {
  selectedType: ProductType;
  onTypeChange: (type: ProductType) => void;
  availableTypes?: ProductType[];
}

const productIcons: Record<ProductType, any> = {
  // Ropa
  tshirt: Shirt,
  hoodie: Wind,
  sweatshirt: Wind,
  polo: Shirt,
  tanktop: Shirt,
  longsleeve: Shirt,
  // Accesorios
  cap: Shirt,
  totebag: Shirt,
  keychain: Shirt,
  mousepad: Shirt,
  phonecase: Shirt,
  lanyard: Shirt,
  // Drinkware
  mug: Shirt,
  magicmug: Shirt,
  bottle: Shirt,
  tumbler: Shirt,
  // Hogar
  aluminumframe: Shirt,
  coaster: Shirt,
  pillow: Shirt,
  blanket: Shirt,
  clock: Shirt,
  puzzle: Shirt,
  // Oficina
  notebook: Shirt,
  calendar: Shirt,
};

const productLabels: Record<ProductType, string> = {
  // Ropa
  tshirt: 'Camiseta',
  hoodie: 'Buzo con Capucha',
  sweatshirt: 'Suéter/Buzo',
  polo: 'Polo',
  tanktop: 'Camisilla',
  longsleeve: 'Manga Larga',
  // Accesorios
  cap: 'Gorra',
  totebag: 'Bolsa de Tela',
  keychain: 'Llavero',
  mousepad: 'Mouse Pad',
  phonecase: 'Funda Celular',
  lanyard: 'Cordón/Lanyard',
  // Drinkware
  mug: 'Taza Cerámica',
  magicmug: 'Taza Mágica',
  bottle: 'Botella/Termo',
  tumbler: 'Vaso Térmico',
  // Hogar
  aluminumframe: 'Cuadro Aluminio',
  coaster: 'Posa Vasos',
  pillow: 'Cojín',
  blanket: 'Manta/Cobija',
  clock: 'Reloj de Pared',
  puzzle: 'Rompecabezas',
  // Oficina
  notebook: 'Libreta',
  calendar: 'Calendario',
};

export const ProductSelector = ({
  selectedType,
  onTypeChange,
  availableTypes = ['tshirt', 'hoodie'],
}: ProductSelectorProps) => {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-900">Tipo de Producto</label>
      <div className="grid grid-cols-2 gap-3">
        {availableTypes.map((type) => {
          const Icon = productIcons[type];
          return (
            <button
              key={type}
              onClick={() => onTypeChange(type)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                selectedType === type
                  ? 'border-app-600 bg-app-50 text-app-600'
                  : 'border-gray-300 hover:border-gray-400 text-gray-700'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-sm font-semibold">{productLabels[type]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
