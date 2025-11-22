# 📦 Sistema de Productos y Personalización

## 1. VISIÓN GENERAL

Este documento detalla el sistema completo de productos, zonas de impresión, tallas y personalización implementado en el marketplace.

---

## 2. TIPOS DE PRODUCTOS

### 2.1 Productos Implementados

El sistema soporta los siguientes tipos de productos:

| Tipo | Nombre | Categoría | Personalizable | Zonas de Impresión |
|------|--------|-----------|----------------|-------------------|
| `tshirt` | Camiseta | Ropa | ✅ Sí | 8 zonas |
| `hoodie` | Sudadera con capucha | Ropa | ✅ Sí | 5 zonas |
| `cap` | Gorra | Accesorios | ✅ Sí | 1 zona |
| `bottle` | Botella | Hogar | ✅ Sí | 1 zona |
| `mug` | Taza | Hogar | ✅ Sí | 1 zona |
| `pillow` | Almohada | Hogar | ✅ Sí | 1 zona |

### 2.2 Categorías de Productos

```typescript
export type ProductCategory = 'clothing' | 'accessories' | 'home';
```

**Clasificación:**
- **clothing** (Ropa): Camisetas, sudaderas, hoodies
- **accessories** (Accesorios): Gorras, bolsos, etc.
- **home** (Hogar): Botellas, tazas, almohadas

---

## 3. SISTEMA DE ZONAS DE IMPRESIÓN

### 3.1 Tipos de Zonas Disponibles

```typescript
export type PrintZone =
  | 'front'          // Frente genérico
  | 'back'           // Espalda genérico
  | 'front-regular'  // Frente regular 18x25cm
  | 'front-large'    // Frente grande 20x30cm
  | 'back-large'     // Espalda grande
  | 'back-neck'      // Cuello (espalda)
  | 'back-center'    // Centro mediano (espalda)
  | 'sleeve-small'   // Manga pequeña 6x7cm
  | 'sleeve-large'   // Manga grande 7x30cm
  | 'left-sleeve'    // Manga izquierda
  | 'right-sleeve'   // Manga derecha
  | 'chest'          // Pecho (pequeño)
  | 'around'         // Alrededor (botellas, tazas)
  | 'top';           // Superior (gorras)
```

### 3.2 Configuración de Zonas por Producto

#### 3.2.1 Camiseta (T-Shirt)

**Zonas disponibles: 8**

| Zona | ID | Dimensiones | Posición | Descripción |
|------|----|-----------|---------|----|
| Frente Regular | `front-regular` | 180x250 px | Centro frontal | Zona principal frontal |
| Frente Grande | `front-large` | 200x300 px | Centro frontal ampliado | Diseños grandes frontales |
| Espalda Grande | `back-large` | 200x350 px | Centro trasero | Zona principal trasera |
| Cuello Trasero | `back-neck` | 120x80 px | Cuello trasero | Zona pequeña en cuello |
| Centro Trasero | `back-center` | 150x150 px | Centro medio trasero | Zona mediana trasera |
| Pecho | `chest` | 80x80 px | Pecho izquierdo | Logo pequeño tipo polo |
| Manga Izquierda | `left-sleeve` | 70x70 px | Manga izquierda | Logo/diseño en manga |
| Manga Derecha | `right-sleeve` | 70x70 px | Manga derecha | Logo/diseño en manga |

**Vistas disponibles:**
- **front**: Muestra zonas front-*, chest, left-sleeve, right-sleeve
- **back**: Muestra zonas back-*
- **side** (automático): Se activa al seleccionar zonas de manga

#### 3.2.2 Hoodie (Sudadera)

**Zonas disponibles: 5**

| Zona | ID | Dimensiones | Posición | Descripción |
|------|----|-----------|---------|----|
| Frente Grande | `front-large` | 200x300 px | Centro frontal | Diseño principal frontal |
| Espalda Grande | `back-large` | 220x350 px | Centro trasero | Diseño principal trasero |
| Pecho | `chest` | 100x100 px | Pecho izquierdo | Logo pequeño |
| Manga Izquierda | `left-sleeve` | 80x80 px | Manga izquierda | Logo en manga |
| Manga Derecha | `right-sleeve` | 80x80 px | Manga derecha | Logo en manga |

#### 3.2.3 Gorra (Cap)

**Zonas disponibles: 1**

| Zona | ID | Dimensiones | Posición | Descripción |
|------|----|-----------|---------|----|
| Frontal | `front` | 150x100 px | Centro frontal | Zona única frontal |

#### 3.2.4 Botella (Bottle)

**Zonas disponibles: 1**

| Zona | ID | Dimensiones | Posición | Descripción |
|------|----|-----------|---------|----|
| Alrededor | `around` | 200x150 px | Centro del cilindro | Diseño envolvente |

#### 3.2.5 Taza (Mug)

**Zonas disponibles: 1**

| Zona | ID | Dimensiones | Posición | Descripción |
|------|----|-----------|---------|----|
| Alrededor | `around` | 250x150 px | Centro del cilindro | Diseño envolvente |

#### 3.2.6 Almohada (Pillow)

**Zonas disponibles: 1**

| Zona | ID | Dimensiones | Posición | Descripción |
|------|----|-----------|---------|----|
| Frente | `front` | 300x300 px | Centro frontal | Zona única cuadrada |

### 3.3 Estructura de Configuración

```typescript
export interface PrintZoneConfig {
  id: PrintZone;
  name: string;
  description: string;
  maxWidth: number;    // Ancho máximo en px
  maxHeight: number;   // Alto máximo en px
  position: {
    x: number;         // Posición X en canvas
    y: number;         // Posición Y en canvas
  };
  isActive: boolean;   // Si está disponible actualmente
}
```

**Ejemplo de implementación:**

```typescript
{
  id: 'front-regular',
  name: 'Frente Regular',
  description: 'Zona frontal estándar (18x25cm)',
  maxWidth: 180,
  maxHeight: 250,
  position: { x: 210, y: 200 },
  isActive: true
}
```

---

## 4. SISTEMA DE TALLAS

### 4.1 Tallas Disponibles por Producto

| Producto | Tallas | Factor de Escala | Notas |
|----------|--------|------------------|-------|
| Camiseta | XS, S, M, L, XL, XXL | 0.85 - 1.22 | Tallas completas |
| Hoodie | S, M, L, XL, XXL | 0.92 - 1.22 | Sin XS |
| Gorra | Única | N/A | Ajustable |
| Botella | 500ml | N/A | Talla única |
| Taza | 350ml | N/A | Talla única |
| Almohada | 45x45cm | N/A | Talla única |

### 4.2 Sistema de Escalado Visual

El sistema implementa escalado visual del producto en el canvas según la talla seleccionada:

```typescript
export interface SizeMeasurements {
  size: string;
  chest?: number;      // Contorno de pecho (cm)
  length?: number;     // Largo total (cm)
  shoulders?: number;  // Ancho de hombros (cm)
  sleeves?: number;    // Largo de manga (cm)
  diameter?: number;   // Diámetro (gorras, botellas)
  height?: number;     // Altura (botellas, tazas)
  width?: number;      // Ancho (almohadas)
  scale?: number;      // Factor de escala visual (0.8 - 1.2)
}
```

**Factores de escala:**
- **XS**: 0.85 (15% más pequeño que M)
- **S**: 0.92 (8% más pequeño que M)
- **M**: 1.0 (talla base de referencia)
- **L**: 1.08 (8% más grande que M)
- **XL**: 1.15 (15% más grande que M)
- **XXL**: 1.22 (22% más grande que M)

### 4.3 Tablas de Medidas

#### 4.3.1 Camiseta (T-Shirt)

| Talla | Pecho | Largo | Hombros | Manga | Escala Visual |
|-------|-------|-------|---------|-------|---------------|
| XS | 86 cm | 68 cm | 41 cm | 19 cm | 0.85 |
| S | 91 cm | 70 cm | 44 cm | 20 cm | 0.92 |
| M | 97 cm | 72 cm | 47 cm | 21 cm | 1.0 |
| L | 104 cm | 74 cm | 50 cm | 22 cm | 1.08 |
| XL | 112 cm | 76 cm | 53 cm | 23 cm | 1.15 |
| XXL | 120 cm | 78 cm | 56 cm | 24 cm | 1.22 |

**Guía de medición:**
> Mide el contorno del pecho en la parte más ancha y el largo desde el hombro hasta el final de la prenda.

#### 4.3.2 Sudadera (Hoodie)

| Talla | Pecho | Largo | Hombros | Manga | Escala Visual |
|-------|-------|-------|---------|-------|---------------|
| S | 102 cm | 68 cm | 50 cm | 60 cm | 0.92 |
| M | 108 cm | 70 cm | 52 cm | 62 cm | 1.0 |
| L | 114 cm | 72 cm | 54 cm | 64 cm | 1.08 |
| XL | 120 cm | 74 cm | 56 cm | 66 cm | 1.15 |
| XXL | 126 cm | 76 cm | 58 cm | 68 cm | 1.22 |

**Guía de medición:**
> Mide el contorno del pecho en la parte más ancha, el largo desde el cuello hasta el final y el ancho de hombros.

#### 4.3.3 Otros Productos

| Producto | Talla | Especificaciones |
|----------|-------|------------------|
| Gorra | Única | Circunferencia: 58 cm (ajustable) |
| Botella | 500ml | Diámetro: 7 cm, Altura: 20 cm |
| Taza | 350ml | Diámetro: 8 cm, Altura: 10 cm |
| Almohada | 45x45cm | Ancho: 45 cm, Alto: 45 cm |

### 4.4 Modal de Guía de Tallas

El sistema incluye un modal interactivo que muestra:

- ✅ Tabla completa de medidas por talla
- ✅ Guía de cómo medir correctamente
- ✅ Comparación visual entre tallas
- ✅ Notas sobre tolerancia (±2cm)
- ✅ Diseño responsivo y accesible

**Acceso:** Botón "Guía de tallas" en el selector de tallas del personalizador.

---

## 5. SISTEMA DE COLORES

### 5.1 Paleta de Colores Disponible

```typescript
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
```

### 5.2 Renderizado de Colores

El sistema aplica el color seleccionado directamente al canvas:
- **Producto base**: Color aplicado con gradientes y sombras
- **Costuras**: Calculadas dinámicamente según el color base
- **Detalles**: Ajustados para contraste y realismo

---

## 6. FLUJO DE PERSONALIZACIÓN

### 6.1 Proceso Paso a Paso

```
1. Seleccionar tipo de producto (camiseta, hoodie, etc.)
   ↓
2. Seleccionar color de la prenda
   ↓
3. Seleccionar talla (actualiza escala visual)
   ↓
4. Elegir vista (frontal/trasera)
   ↓
5. Seleccionar zona de impresión
   ↓
6. Subir imagen para esa zona
   ↓
7. Ajustar diseño (posición, tamaño, rotación)
   ↓
8. Repetir pasos 4-7 para otras zonas (opcional)
   ↓
9. Agregar al carrito con cantidad deseada
```

### 6.2 Estados del Personalizador

```typescript
interface CustomizerState {
  productType: ProductType;        // Tipo de producto actual
  selectedColor: string;           // Color hex seleccionado
  selectedSize: string;            // Talla seleccionada
  currentView: 'front' | 'back';   // Vista actual
  selectedZone: PrintZone;         // Zona activa
  designs: Map<PrintZone, Design>; // Diseños por zona
  quantity: number;                // Cantidad a agregar
}
```

### 6.3 Restricciones por Zona

- ✅ **Una imagen por zona**: Al subir nueva imagen, reemplaza la anterior
- ✅ **Zonas independientes**: Cada zona mantiene su propio diseño
- ✅ **Límite de tamaño**: Máximo 2MB por imagen
- ✅ **Formatos permitidos**: PNG, JPG, JPEG
- ✅ **Resolución recomendada**: 300 DPI

---

## 7. RENDERIZADO EN CANVAS

### 7.1 Sistema de Vistas

El canvas cambia automáticamente según la zona seleccionada:

| Zona Seleccionada | Vista Renderizada |
|-------------------|-------------------|
| front-*, chest | Vista frontal |
| back-* | Vista trasera |
| *-sleeve | Vista lateral (automático) |

### 7.2 Transformaciones de Canvas

```typescript
// Aplicar escala por talla
ctx.translate(width / 2, height / 2);
ctx.scale(sizeScale, sizeScale);
ctx.translate(-width / 2, -height / 2);
```

### 7.3 Capas de Renderizado

1. **Fondo**: Gradiente gris claro
2. **Producto base**: Silueta con color seleccionado
3. **Costuras**: Detalles realistas
4. **Zona seleccionada**: Rectángulo semi-transparente con esquinas
5. **Diseño**: Imagen del usuario en la zona activa
6. **Etiquetas**: Texto de vista y nombre de zona

---

## 8. MODELO DE DATOS

### 8.1 Estructura de Diseño

```typescript
interface Design {
  id: string;                    // ID único
  zoneId: PrintZone;             // Zona donde se aplica
  imageUrl: string;              // URL de imagen (vacío si local)
  imageData?: string;            // Base64 si es imagen local
  position: {
    x: number;                   // Posición X en canvas
    y: number;                   // Posición Y en canvas
  };
  size: {
    width: number;               // Ancho del diseño
    height: number;              // Alto del diseño
  };
  rotation: number;              // Rotación en grados
  opacity: number;               // Opacidad (0-1)
  filters?: {
    brightness?: number;         // Brillo
    contrast?: number;           // Contraste
    grayscale?: boolean;         // Escala de grises
  };
}
```

### 8.2 Producto Personalizado

```typescript
interface CustomizedProduct {
  id: string;                    // ID único del producto personalizado
  productId: string;             // ID del producto base
  productType: ProductType;      // Tipo de producto
  productName: string;           // Nombre del producto
  basePrice: number;             // Precio base
  selectedColor: string;         // Color seleccionado
  selectedSize: string;          // Talla seleccionada
  designs: Design[];             // Array de todos los diseños
  previewImages: {
    front: string;               // Preview frontal (base64)
    back?: string;               // Preview trasero (opcional)
  };
  customizationPrice: number;    // Costo de personalización
  totalPrice: number;            // Precio total
  createdAt: Date;               // Fecha de creación
}
```

### 8.3 Cálculo de Precios

```typescript
// Precio de personalización: $2 por cada zona con diseño
const customizationPrice = designs.size * 2.00;
const totalPrice = basePrice + customizationPrice;
```

**Ejemplo:**
- Camiseta base: $29.99
- 3 zonas personalizadas: $6.00
- **Total: $35.99**

---

## 9. INTEGRACIÓN CON CARRITO

### 9.1 Agregar Producto Personalizado

```typescript
// En CustomizerPage
const handleAddToCart = (quantity: number = 1) => {
  // Validar que hay diseños
  if (designs.size === 0) {
    alert('Por favor sube al menos una imagen en alguna zona');
    return;
  }

  // Exportar preview del canvas
  const previewImage = canvasService.exportAsImage('png', 0.95);

  // Convertir Map de diseños a Array
  const allDesigns = Array.from(designs.values());

  // Crear objeto CustomizedProduct
  const customizedProduct: CustomizedProduct = {
    id: `custom-${Date.now()}`,
    productId: product.id,
    productType: productType,
    productName: product.name,
    basePrice: product.basePrice,
    selectedColor: selectedColor,
    selectedSize: selectedSize,
    designs: allDesigns,
    previewImages: { front: previewImage },
    customizationPrice: designs.size * 2.00,
    totalPrice: product.basePrice + (designs.size * 2.00),
    createdAt: new Date(),
  };

  // Agregar al carrito
  addCustomizedProduct(customizedProduct, quantity);

  // Redirigir a carrito
  navigate('/cart');
};
```

### 9.2 Almacenamiento

**Fase 1 (Actual):**
- `localStorage`: Productos personalizados completos (con base64)
- Límite: ~5MB total

**Fase 2+ (Futuro):**
- Base de datos: Metadata del producto
- Cloud storage (Cloudinary): Imágenes de diseños
- S3: Previews renderizados

---

## 10. COMPONENTES DEL SISTEMA

### 10.1 Componentes de Personalización

| Componente | Ubicación | Responsabilidad |
|------------|-----------|----------------|
| `CustomizerPage` | `/pages/CustomizerPage.tsx` | Página principal del personalizador |
| `ProductSelector` | `/components/customizer/ProductSelector.tsx` | Selector de tipo de producto |
| `ColorPicker` | `/components/customizer/ColorPicker.tsx` | Selector de color |
| `SizeSelector` | `/components/customizer/SizeSelector.tsx` | Selector de talla |
| `SizeGuideModal` | `/components/customizer/SizeGuideModal.tsx` | Modal de guía de tallas |
| `ViewToggle` | `/components/customizer/ViewToggle.tsx` | Toggle frontal/trasero |
| `ZoneSelector` | `/components/customizer/ZoneSelector.tsx` | Selector de zona de impresión |
| `ImageUploader` | `/components/customizer/ImageUploader.tsx` | Subida de imágenes |
| `DesignControls` | `/components/customizer/DesignControls.tsx` | Controles de ajuste |

### 10.2 Servicios y Datos

| Archivo | Ubicación | Responsabilidad |
|---------|-----------|----------------|
| `canvas.service.ts` | `/services/canvas.service.ts` | Renderizado en canvas |
| `productTypeConfigs.ts` | `/data/productTypeConfigs.ts` | Configuración de zonas |
| `sizeCharts.ts` | `/data/sizeCharts.ts` | Tablas de tallas |
| `mockProducts.ts` | `/data/mockProducts.ts` | Productos de prueba |

---

## 11. MEJORES PRÁCTICAS

### 11.1 Al Agregar Nuevos Productos

1. ✅ Definir tipo en `ProductType`
2. ✅ Agregar categoría correspondiente
3. ✅ Crear configuración de zonas en `productTypeConfigs.ts`
4. ✅ Agregar tabla de tallas en `sizeCharts.ts`
5. ✅ Implementar renderizado en `canvas.service.ts`
6. ✅ Crear productos de prueba en `mockProducts.ts`

### 11.2 Al Agregar Nuevas Zonas

1. ✅ Agregar ID a tipo `PrintZone`
2. ✅ Crear configuración `PrintZoneConfig`
3. ✅ Asignar a productos correspondientes
4. ✅ Implementar detección en `getPerspectiveView()`
5. ✅ Probar en todas las vistas

### 11.3 Optimización de Imágenes

- ✅ Comprimir antes de subir
- ✅ Validar tamaño máximo (2MB)
- ✅ Convertir a formato óptimo
- ✅ Generar thumbnails para carrito

---

## 12. PRÓXIMAS MEJORAS

### 12.1 Corto Plazo

- [ ] Editor de texto (agregar texto personalizado)
- [ ] Biblioteca de cliparts predefinidos
- [ ] Templates populares
- [ ] Vista 3D del producto

### 12.2 Mediano Plazo

- [ ] IA para remover fondos automáticamente
- [ ] Sugerencias de posicionamiento
- [ ] Combinaciones de colores recomendadas
- [ ] Zoom y pan en canvas

### 12.3 Largo Plazo

- [ ] Realidad aumentada (probar prenda virtualmente)
- [ ] Compartir diseños en comunidad
- [ ] Marketplace de diseños
- [ ] Generador de mockups automático

---

## 13. REFERENCIAS TÉCNICAS

### 13.1 Archivos Clave

```
web/src/
├── pages/
│   └── CustomizerPage.tsx          # Página principal
├── components/customizer/
│   ├── ProductSelector.tsx          # Tipo de producto
│   ├── ColorPicker.tsx              # Color
│   ├── SizeSelector.tsx             # Talla
│   ├── SizeGuideModal.tsx           # Guía de tallas
│   ├── ViewToggle.tsx               # Vista
│   ├── ZoneSelector.tsx             # Zona
│   ├── ImageUploader.tsx            # Subir imagen
│   ├── DesignControls.tsx           # Controles
│   └── index.ts                     # Exports
├── services/
│   └── canvas.service.ts            # Renderizado canvas
├── data/
│   ├── productTypeConfigs.ts        # Configuración zonas
│   ├── sizeCharts.ts                # Tablas de tallas
│   └── mockProducts.ts              # Productos prueba
└── types/
    ├── product.ts                   # Tipos de producto
    ├── design.ts                    # Tipos de diseño
    └── cart.ts                      # Tipos de carrito
```

### 13.2 APIs Principales

```typescript
// Obtener zonas de un producto
getPrintZones(productType: ProductType): PrintZoneConfig[]

// Obtener tabla de tallas
getSizeChart(productType: ProductType): SizeChart | undefined

// Obtener tallas disponibles
getAvailableSizes(productType: ProductType): string[]

// Renderizar producto en canvas
canvasService.drawProductBase(
  productType: ProductType,
  color: string,
  view: 'front' | 'back',
  selectedZone?: PrintZoneConfig,
  sizeScale?: number
): void

// Agregar producto personalizado al carrito
addCustomizedProduct(
  customizedProduct: CustomizedProduct,
  quantity?: number
): void
```

---

**Última actualización:** 2025-11-22
**Versión:** 1.0
**Autor:** Sistema de Documentación Automática
