import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { canvasService } from '../services/canvas.service';
import { getProductById } from '../data/mockProducts';
import { getPrintZones } from '../data/productTypeConfigs';
import { getSizeChart, getAvailableSizes } from '../data/sizeCharts';
import { useCart } from '../context/CartContext';
import { ProductSelector } from '../components/customizer/ProductSelector';
import { ColorPicker } from '../components/customizer/ColorPicker';
import { ViewToggle } from '../components/customizer/ViewToggle';
import { ImageUploader } from '../components/customizer/ImageUploader';
import { DesignControls } from '../components/customizer/DesignControls';
import { ZoneSelector } from '../components/customizer/ZoneSelector';
import { SizeSelector } from '../components/customizer/SizeSelector';
import { SizeGuideModal } from '../components/customizer/SizeGuideModal';
import type { ProductType, PrintZone } from '../types/product';
import type { Design, CustomizedProduct } from '../types/design';

export const CustomizerPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addCustomizedProduct } = useCart();

  // State
  const [productType, setProductType] = useState<ProductType>('tshirt');
  const [selectedColor, setSelectedColor] = useState<string>('#FFFFFF');
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [selectedZone, setSelectedZone] = useState<PrintZone>('front-regular');
  const [designs, setDesigns] = useState<Map<PrintZone, Design>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  // Obtener zonas de impresión disponibles para el producto actual
  const allZones = getPrintZones(productType);

  // Filtrar zonas según la vista actual (front/back)
  const availableZones = allZones.filter(zone => {
    if (currentView === 'front') {
      return zone.id.includes('front') || zone.id.includes('sleeve') || zone.id.includes('chest');
    } else {
      return zone.id.includes('back');
    }
  });

  // Obtener tallas disponibles y guía de tallas
  const availableSizes = getAvailableSizes(productType);
  const sizeChart = getSizeChart(productType);

  // Obtener factor de escala de la talla seleccionada
  const currentSizeMeasurements = sizeChart?.sizes.find(s => s.size === selectedSize);
  const sizeScale = currentSizeMeasurements?.scale || 1.0;

  // Obtener producto inicial si viene en la URL
  useEffect(() => {
    const productId = searchParams.get('product');
    if (productId) {
      const product = getProductById(productId);
      if (product) {
        setProductType(product.type);
        if (product.colors.length > 0) {
          setSelectedColor(product.colors[0].hex);
        }
      }
    }
  }, [searchParams]);

  // Inicializar canvas
  useEffect(() => {
    if (canvasRef.current) {
      canvasService.init(canvasRef.current);
      canvasService.resize(600, 600);
      renderCanvas();
    }
  }, []);

  // Cambiar zona seleccionada cuando cambie la vista
  useEffect(() => {
    if (currentView === 'front' && !selectedZone.includes('front') && !selectedZone.includes('sleeve')) {
      setSelectedZone('front-regular');
    } else if (currentView === 'back' && !selectedZone.includes('back')) {
      setSelectedZone('back-large');
    }
  }, [currentView]);

  // Re-renderizar cuando cambien las propiedades
  useEffect(() => {
    renderCanvas();
  }, [productType, selectedColor, currentView, designs, selectedZone, sizeScale]);

  const renderCanvas = () => {
    if (!canvasRef.current) return;

    // Obtener configuración de la zona seleccionada
    const zoneConfig = availableZones.find(z => z.id === selectedZone);

    // Dibujar producto base con la zona seleccionada y el tamaño
    canvasService.drawProductBase(productType, selectedColor, currentView, zoneConfig, sizeScale);

    // Dibujar SOLO el diseño de la zona actualmente seleccionada
    const currentDesign = designs.get(selectedZone);
    if (currentDesign) {
      canvasService.drawDesign(currentDesign);
    }
  };

  const handleImageUpload = (imageData: string) => {
    setIsUploading(true);

    // Obtener configuración de la zona seleccionada
    const zoneConfig = availableZones.find(z => z.id === selectedZone);
    const defaultWidth = zoneConfig?.maxWidth || 200;
    const defaultHeight = zoneConfig?.maxHeight || 200;
    const posX = zoneConfig?.position.x || 200;
    const posY = zoneConfig?.position.y || 200;

    // Crear diseño para la zona actual
    const newDesign: Design = {
      id: `design-${selectedZone}-${Date.now()}`,
      zoneId: selectedZone,
      imageUrl: '',
      imageData: imageData,
      position: { x: posX, y: posY },
      size: { width: Math.min(defaultWidth, 200), height: Math.min(defaultHeight, 200) },
      rotation: 0,
      opacity: 1,
    };

    // Actualizar el Map con el diseño de esta zona
    setDesigns(prev => new Map(prev).set(selectedZone, newDesign));
    setIsUploading(false);
  };

  const handleDesignUpdate = (updates: Partial<Design>) => {
    const currentDesign = designs.get(selectedZone);
    if (!currentDesign) return;

    const updatedDesign = { ...currentDesign, ...updates };
    setDesigns(prev => new Map(prev).set(selectedZone, updatedDesign));
  };

  const handleDesignDelete = () => {
    setDesigns(prev => {
      const newMap = new Map(prev);
      newMap.delete(selectedZone);
      return newMap;
    });
  };

  const handleProductTypeChange = (type: ProductType) => {
    setProductType(type);
    // Limpiar todos los diseños al cambiar de producto
    setDesigns(new Map());

    // Actualizar la talla a la primera disponible del nuevo producto
    const newSizes = getAvailableSizes(type);
    if (newSizes.length > 0) {
      setSelectedSize(newSizes[0]);
    }
  };

  const handleAddToCart = (quantity: number = 1) => {
    // Obtener producto base
    const product = getProductById(`${productType}-001`) || {
      id: `${productType}-001`,
      name: `${productType} Personalizado`,
      type: productType,
      basePrice: 29.99,
    };

    // Verificar que hay al menos un diseño
    if (designs.size === 0) {
      alert('Por favor sube al menos una imagen en alguna zona');
      return;
    }

    // Exportar canvas como imagen
    const previewImage = canvasService.exportAsImage('png', 0.95);
    if (!previewImage) {
      alert('Error al generar vista previa');
      return;
    }

    // Convertir Map a Array de diseños
    const allDesigns = Array.from(designs.values());

    // Calcular precio de personalización (por ejemplo, $2 por cada zona con diseño)
    const customizationPrice = designs.size * 2.00;
    const totalPrice = product.basePrice + customizationPrice;

    // Crear objeto CustomizedProduct
    const customizedProduct: CustomizedProduct = {
      id: `custom-${Date.now()}`,
      productId: product.id,
      productType: productType,
      productName: product.name || `${productType} Personalizado`,
      basePrice: product.basePrice,
      selectedColor: selectedColor,
      selectedSize: selectedSize,
      designs: allDesigns,
      previewImages: {
        front: previewImage,
      },
      customizationPrice: customizationPrice,
      totalPrice: totalPrice,
      createdAt: new Date(),
    };

    // Agregar al carrito como UNA prenda con la cantidad especificada
    addCustomizedProduct(customizedProduct, quantity);

    alert(`¡${quantity} producto(s) personalizado(s) agregado(s) al carrito!`);
    navigate('/cart');
  };

  // Colores disponibles
  const availableColors = [
    '#FFFFFF', // Blanco
    '#000000', // Negro
    '#EF4444', // Rojo
    '#3B82F6', // Azul
    '#10B981', // Verde
    '#F59E0B', // Amarillo
    '#8B5CF6', // Morado
    '#EC4899', // Rosa
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white py-6 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/catalog')}
                className="hover:bg-white/10 p-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Personalizador</h1>
                <p className="text-sm text-white/90">Crea tu diseño único</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Product Config */}
          <aside className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <ProductSelector
                selectedType={productType}
                onTypeChange={handleProductTypeChange}
              />
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <ColorPicker
                colors={availableColors}
                selectedColor={selectedColor}
                onColorChange={setSelectedColor}
              />
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <SizeSelector
                sizes={availableSizes}
                selectedSize={selectedSize}
                onSizeChange={setSelectedSize}
                onShowSizeGuide={() => setShowSizeGuide(true)}
              />
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <ViewToggle currentView={currentView} onViewChange={setCurrentView} />
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <ZoneSelector
                zones={availableZones}
                selectedZone={selectedZone}
                onZoneChange={setSelectedZone}
              />
            </div>
          </aside>

          {/* Center - Canvas */}
          <main className="lg:col-span-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={600}
                  className="border border-gray-200 rounded-lg max-w-full h-auto"
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-600">
                    {designs.size > 0 && `${designs.size} zona${designs.size > 1 ? 's' : ''} con diseño`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Selector de Cantidad */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Cantidad:</label>
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                        className="w-14 text-center py-2 border-x border-gray-300 focus:outline-none"
                      />
                      <button
                        onClick={() => setQuantity(Math.min(99, quantity + 1))}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Botón Agregar al Carrito */}
                  <button
                    onClick={() => handleAddToCart(quantity)}
                    disabled={designs.size === 0}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Agregar al Carrito
                  </button>
                </div>
              </div>
            </div>
          </main>

          {/* Right Sidebar - Design Controls */}
          <aside className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Subir Imagen</h3>
              <ImageUploader onImageUpload={handleImageUpload} isUploading={isUploading} />
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Controles de Diseño</h3>
              <DesignControls
                design={designs.get(selectedZone) || null}
                onUpdate={handleDesignUpdate}
                onDelete={handleDesignDelete}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Modal de guía de tallas */}
      {sizeChart && (
        <SizeGuideModal
          isOpen={showSizeGuide}
          onClose={() => setShowSizeGuide(false)}
          sizeChart={sizeChart}
        />
      )}
    </div>
  );
};
