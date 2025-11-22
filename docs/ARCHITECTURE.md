# 🏗️ Arquitectura del Sistema

## ARQUITECTURA HÍBRIDA WEB + MOBILE

---

## 1. VISIÓN GENERAL

```
┌────────────────────────────────────────────────────────────────────┐
│                         USUARIOS FINALES                           │
└────────────────────────────────────────────────────────────────────┘
              │                                    │
              │                                    │
     ┌────────▼─────────┐                 ┌────────▼──────────┐
     │  NAVEGADOR WEB   │                 │   APP MÓVIL       │
     │                  │                 │  (iOS/Android)    │
     │  - Chrome        │                 │                   │
     │  - Firefox       │                 │  React Native     │
     │  - Safari        │                 │  + Expo           │
     │  - Edge          │                 │                   │
     └────────┬─────────┘                 └────────┬──────────┘
              │                                    │
              │                                    │
              │                           ┌────────▼──────────┐
              │                           │   WebView         │
              │                           │   react-native-   │
              │                           │   webview         │
              │                           │                   │
              │                           │   Carga: https:// │
              │                           │   tudominio.com   │
              │                           └────────┬──────────┘
              │                                    │
              │                                    │
     ┌────────▼────────────────────────────────────▼──────────┐
     │             REACT WEB APPLICATION                      │
     │         (Fuente de verdad - Single Source)             │
     │                                                         │
     │  ┌──────────────────────────────────────────────────┐  │
     │  │  Detección de Plataforma                        │  │
     │  │  - window.isNativeApp (inyectado por Native)    │  │
     │  │  - window.ReactNativeWebView (comunicación)     │  │
     │  └──────────────────────────────────────────────────┘  │
     │                                                         │
     │  ┌──────────────────────────────────────────────────┐  │
     │  │  Frontend (React + TypeScript)                   │  │
     │  │  - Components                                    │  │
     │  │  - Pages                                         │  │
     │  │  - Context API                                   │  │
     │  │  - React Router                                  │  │
     │  └──────────────────────────────────────────────────┘  │
     │                                                         │
     └────────┬────────────────────────────────────────────────┘
              │
              │ HTTP/HTTPS
              │ REST API
              │
     ┌────────▼─────────┐
     │                  │
     │   BACKEND API    │  (FASE 2+)
     │                  │
     │  Node.js         │
     │  + Express       │
     │  + TypeScript    │
     │                  │
     └────────┬─────────┘
              │
              │
     ┌────────▼─────────┐
     │                  │
     │  BASE DE DATOS   │  (FASE 2+)
     │                  │
     │  PostgreSQL      │
     │  + Prisma ORM    │
     │                  │
     └──────────────────┘


     ┌──────────────────────────────────────────────────────┐
     │         SERVICIOS EXTERNOS (FASE 3+)                 │
     ├──────────────────────────────────────────────────────┤
     │  - Stripe / MercadoPago (Pagos)                      │
     │  - Cloudinary / AWS S3 (Imágenes)                    │
     │  - SendGrid / Resend (Emails)                        │
     │  - Firebase Cloud Messaging (Push Notifications)     │
     └──────────────────────────────────────────────────────┘
```

---

## 2. ARQUITECTURA FRONTEND (React Web)

### 2.1 Estructura de Carpetas

```
web/
├── public/
│   ├── products/              # Imágenes de productos (Fase 1)
│   ├── mockups/               # Mockups de productos
│   └── favicon.ico
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── Sidebar.tsx
│   │   │
│   │   ├── home/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── Features.tsx
│   │   │   └── FeaturedProducts.tsx
│   │   │
│   │   ├── catalog/
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── ProductFilters.tsx
│   │   │   └── ProductSort.tsx
│   │   │
│   │   ├── product/
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── ProductGallery.tsx
│   │   │   ├── ProductInfo.tsx
│   │   │   ├── ColorSelector.tsx
│   │   │   ├── SizeSelector.tsx
│   │   │   └── QuantitySelector.tsx
│   │   │
│   │   ├── customizer/
│   │   │   ├── ProductCustomizer.tsx    # Componente principal
│   │   │   ├── ProductSelector.tsx       # Selector de tipo de producto
│   │   │   ├── ColorPicker.tsx           # Selector de color
│   │   │   ├── ViewToggle.tsx            # Front/Back toggle
│   │   │   ├── ZoneSelector.tsx          # Selector de zonas
│   │   │   ├── CanvasEditor.tsx          # Canvas de renderizado
│   │   │   ├── ImageUploader.tsx         # Subida de imágenes
│   │   │   ├── DesignControls.tsx        # Controles de ajuste
│   │   │   └── DesignList.tsx            # Lista de diseños aplicados
│   │   │
│   │   ├── cart/
│   │   │   ├── CartDrawer.tsx            # Drawer lateral
│   │   │   ├── CartItem.tsx              # Item individual
│   │   │   ├── CartItemCustomized.tsx    # Item personalizado
│   │   │   ├── CartSummary.tsx           # Resumen de costos
│   │   │   └── CartEmpty.tsx             # Estado vacío
│   │   │
│   │   ├── admin/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ProductManager.tsx
│   │   │   ├── ProductForm.tsx
│   │   │   ├── ProductTypeManager.tsx
│   │   │   ├── OrdersList.tsx
│   │   │   └── Settings.tsx
│   │   │
│   │   ├── auth/                         # Fase 2+
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ForgotPassword.tsx
│   │   │
│   │   ├── checkout/                     # Fase 3+
│   │   │   ├── CheckoutSteps.tsx
│   │   │   ├── ShippingForm.tsx
│   │   │   ├── PaymentForm.tsx
│   │   │   └── OrderConfirmation.tsx
│   │   │
│   │   └── shared/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx
│   │       ├── Loading.tsx
│   │       └── ErrorBoundary.tsx
│   │
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── CatalogPage.tsx
│   │   ├── ProductDetailPage.tsx
│   │   ├── CustomizerPage.tsx
│   │   ├── CartPage.tsx
│   │   ├── AdminPage.tsx
│   │   ├── CheckoutPage.tsx              # Fase 3+
│   │   ├── OrdersPage.tsx                # Fase 3+
│   │   └── NotFoundPage.tsx
│   │
│   ├── context/
│   │   ├── CartContext.tsx               # Estado del carrito
│   │   ├── ProductsContext.tsx           # Estado de productos
│   │   ├── AuthContext.tsx               # Autenticación (Fase 2+)
│   │   └── PlatformContext.tsx           # Detección Web/Mobile
│   │
│   ├── hooks/
│   │   ├── useCart.ts
│   │   ├── useProducts.ts
│   │   ├── useLocalStorage.ts
│   │   ├── usePlatform.ts                # Hook de detección de plataforma
│   │   ├── useNativeMessage.ts           # Comunicación con Native
│   │   └── useAuth.ts                    # Fase 2+
│   │
│   ├── services/
│   │   ├── api.ts                        # Cliente HTTP (Fase 2+)
│   │   ├── canvas.service.ts             # Lógica de canvas
│   │   ├── storage.service.ts            # LocalStorage wrapper
│   │   ├── native.service.ts             # Comunicación con React Native
│   │   └── payment.service.ts            # Fase 3+
│   │
│   ├── utils/
│   │   ├── productConfig.ts              # Configuración de productos/zonas
│   │   ├── constants.ts                  # Constantes globales
│   │   ├── validators.ts                 # Validaciones
│   │   ├── formatters.ts                 # Formateadores (precio, fecha)
│   │   └── helpers.ts                    # Utilidades generales
│   │
│   ├── types/
│   │   ├── product.ts
│   │   ├── cart.ts
│   │   ├── design.ts
│   │   ├── user.ts                       # Fase 2+
│   │   ├── order.ts                      # Fase 3+
│   │   └── native.ts                     # Tipos de mensajes Native
│   │
│   ├── data/
│   │   ├── initialProducts.ts            # Productos seed (Fase 1)
│   │   ├── productTypes.ts               # Tipos de producto
│   │   └── printZones.ts                 # Configuración de zonas
│   │
│   ├── styles/
│   │   ├── globals.css
│   │   └── tailwind.css
│   │
│   ├── App.tsx                           # Componente raíz
│   ├── main.tsx                          # Entry point
│   └── vite-env.d.ts
│
├── .env                                  # Variables de entorno
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

### 2.2 Arquitectura de Componentes

```
┌─────────────────────────────────────────────────────┐
│                    App.tsx                          │
│                                                     │
│  - Router Principal                                 │
│  - Providers (Context)                              │
│  - ErrorBoundary                                    │
│  - Platform Detection                               │
└──────────────┬──────────────────────────────────────┘
               │
     ┌─────────┴──────────┐
     │                    │
     ▼                    ▼
┌─────────────┐    ┌──────────────┐
│   Layout    │    │  Routes      │
│             │    │              │
│  - Header   │    │  /           │ → HomePage
│  - Footer   │    │  /catalog    │ → CatalogPage
│  - Sidebar  │    │  /product/:id│ → ProductDetailPage
│  - Toast    │    │  /customize  │ → CustomizerPage
└─────────────┘    │  /cart       │ → CartPage
                   │  /admin      │ → AdminPage (Fase 1)
                   │  /checkout   │ → CheckoutPage (Fase 3+)
                   │  /orders     │ → OrdersPage (Fase 3+)
                   └──────────────┘
```

### 2.3 Flujo de Estado (Context API)

```
┌─────────────────────────────────────────────────────┐
│             Context Providers Tree                  │
└─────────────────────────────────────────────────────┘

<App>
  <PlatformProvider>              # Detección Web/Mobile
    <AuthProvider>                # Autenticación (Fase 2+)
      <ProductsProvider>          # Productos del catálogo
        <CartProvider>            # Estado del carrito
          <Router>
            <Layout>
              {children}
            </Layout>
          </Router>
        </CartProvider>
      </ProductsProvider>
    </AuthProvider>
  </PlatformProvider>
</App>
```

---

## 3. ARQUITECTURA MOBILE (React Native)

### 3.1 Estructura de Carpetas

```
mobile/
├── src/
│   ├── components/
│   │   ├── WebViewWrapper.tsx      # WebView principal
│   │   ├── NativeImagePicker.tsx   # Selector de imagen nativo
│   │   ├── NativeCamera.tsx        # Cámara nativa
│   │   └── SplashScreen.tsx        # Pantalla de carga
│   │
│   ├── services/
│   │   ├── messaging.service.ts    # Comunicación con WebView
│   │   ├── permissions.service.ts  # Gestión de permisos
│   │   ├── notifications.service.ts # Push notifications
│   │   └── storage.service.ts      # AsyncStorage
│   │
│   ├── utils/
│   │   ├── imageProcessor.ts       # Procesar imágenes (base64)
│   │   └── constants.ts
│   │
│   ├── types/
│   │   └── messages.ts             # Tipos de mensajes
│   │
│   └── App.tsx                     # Entry point
│
├── app.json
├── package.json
├── tsconfig.json
└── README.md
```

### 3.2 Componente Principal (App.tsx)

```typescript
import React, { useRef, useState } from 'react';
import { SafeAreaView } from 'react-native';
import WebView from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import * as Camera from 'expo-camera';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inyectar código en la web para identificarse como app
  const injectedJavaScript = `
    window.isNativeApp = true;
    window.platform = 'mobile';
    true; // Required for iOS
  `;

  // Recibir mensajes desde la Web
  const handleMessage = async (event: any) => {
    const message = JSON.parse(event.nativeEvent.data);

    switch (message.type) {
      case 'REQUEST_IMAGE':
        await handleImageRequest(message.data);
        break;
      case 'SHARE_DESIGN':
        await handleShareDesign(message.data);
        break;
      case 'SAVE_TO_GALLERY':
        await handleSaveToGallery(message.data);
        break;
    }
  };

  // Enviar mensaje a la Web
  const sendToWeb = (type: string, data: any) => {
    webViewRef.current?.postMessage(JSON.stringify({ type, data }));
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://tudominio.com' }} // Producción
        // source={{ uri: 'http://192.168.1.5:5173' }} // Desarrollo local
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onLoadEnd={() => setIsLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
      />
    </SafeAreaView>
  );
}
```

---

## 4. COMUNICACIÓN WEB ↔ MOBILE

### 4.1 Protocolo de Mensajes

#### **Estructura de Mensaje**

```typescript
interface NativeMessage {
  type: string;           // Tipo de acción
  data: any;              // Payload del mensaje
  timestamp?: number;     // Timestamp opcional
  requestId?: string;     // ID para respuestas
}
```

#### **Tipos de Mensajes Web → Native**

```typescript
// 1. Solicitar subir imagen
{
  type: 'REQUEST_IMAGE',
  data: {
    zone: string,              // 'front-center', 'back-large', etc.
    source: 'gallery' | 'camera'
  }
}

// 2. Compartir diseño
{
  type: 'SHARE_DESIGN',
  data: {
    imageUrl: string,          // URL de la imagen a compartir
    text: string,              // Texto del mensaje
    productName: string
  }
}

// 3. Guardar en galería
{
  type: 'SAVE_TO_GALLERY',
  data: {
    imageUrl: string,
    filename: string
  }
}

// 4. Solicitar permisos
{
  type: 'REQUEST_PERMISSIONS',
  data: {
    permission: 'camera' | 'photos' | 'notifications'
  }
}

// 5. Registrar para notificaciones push
{
  type: 'REGISTER_PUSH',
  data: {
    userId: string
  }
}
```

#### **Tipos de Mensajes Native → Web**

```typescript
// 1. Imagen subida exitosamente
{
  type: 'IMAGE_UPLOADED',
  data: {
    base64: string,            // Imagen en base64
    zone: string,              // Zona solicitada
    width: number,
    height: number,
    mimeType: string           // 'image/jpeg', 'image/png'
  }
}

// 2. Error al subir imagen
{
  type: 'IMAGE_UPLOAD_ERROR',
  data: {
    error: string,             // Mensaje de error
    code: 'PERMISSION_DENIED' | 'CANCELLED' | 'UNKNOWN'
  }
}

// 3. Permisos otorgados/denegados
{
  type: 'PERMISSIONS_RESULT',
  data: {
    permission: string,
    granted: boolean
  }
}

// 4. Diseño compartido
{
  type: 'DESIGN_SHARED',
  data: {
    platform: 'whatsapp' | 'facebook' | 'instagram' | 'other',
    success: boolean
  }
}

// 5. Notificación push tocada
{
  type: 'NOTIFICATION_TAPPED',
  data: {
    orderId: string,
    type: 'order_update' | 'promotion' | 'system',
    payload: any
  }
}

// 6. App pasó a background/foreground
{
  type: 'APP_STATE_CHANGED',
  data: {
    state: 'active' | 'background' | 'inactive'
  }
}
```

### 4.2 Implementación en Web (React)

#### **Hook: useNativeMessage**

```typescript
// hooks/useNativeMessage.ts
import { useEffect, useCallback } from 'react';

export const useNativeMessage = (onMessage: (message: any) => void) => {
  useEffect(() => {
    const handleNativeMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        onMessage(message);
      } catch (error) {
        console.error('Error parsing native message:', error);
      }
    };

    window.addEventListener('message', handleNativeMessage);

    return () => {
      window.removeEventListener('message', handleNativeMessage);
    };
  }, [onMessage]);

  const sendToNative = useCallback((type: string, data: any) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type, data })
      );
    }
  }, []);

  return { sendToNative };
};
```

#### **Service: native.service.ts**

```typescript
// services/native.service.ts
export class NativeService {
  static isNativeApp(): boolean {
    return !!(window as any).isNativeApp;
  }

  static sendMessage(type: string, data: any): void {
    if (this.isNativeApp() && (window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type, data, timestamp: Date.now() })
      );
    } else {
      console.warn('Not running in native app');
    }
  }

  static requestImage(zone: string, source: 'gallery' | 'camera'): void {
    this.sendMessage('REQUEST_IMAGE', { zone, source });
  }

  static shareDesign(imageUrl: string, text: string, productName: string): void {
    this.sendMessage('SHARE_DESIGN', { imageUrl, text, productName });
  }

  static saveToGallery(imageUrl: string, filename: string): void {
    this.sendMessage('SAVE_TO_GALLERY', { imageUrl, filename });
  }

  static requestPermission(permission: 'camera' | 'photos' | 'notifications'): void {
    this.sendMessage('REQUEST_PERMISSIONS', { permission });
  }
}
```

#### **Uso en Componente**

```typescript
// components/customizer/ImageUploader.tsx
import { useNativeMessage } from '@/hooks/useNativeMessage';
import { NativeService } from '@/services/native.service';

export const ImageUploader = ({ zone }: { zone: string }) => {
  const handleNativeMessage = (message: any) => {
    if (message.type === 'IMAGE_UPLOADED') {
      // Cargar imagen en canvas
      loadImageToCanvas(message.data.base64, message.data.zone);
    }
  };

  const { sendToNative } = useNativeMessage(handleNativeMessage);

  const handleUpload = () => {
    if (NativeService.isNativeApp()) {
      // Usar funciones nativas
      NativeService.requestImage(zone, 'gallery');
    } else {
      // Usar input file tradicional
      fileInputRef.current?.click();
    }
  };

  return (
    <button onClick={handleUpload}>
      {NativeService.isNativeApp() ? 'Subir desde Galería' : 'Subir Imagen'}
    </button>
  );
};
```

### 4.3 Implementación en Native (React Native)

#### **Service: messaging.service.ts**

```typescript
// services/messaging.service.ts
import * as ImagePicker from 'expo-image-picker';
import * as Camera from 'expo-camera';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

export class MessagingService {
  private webViewRef: any;

  constructor(webViewRef: any) {
    this.webViewRef = webViewRef;
  }

  sendToWeb(type: string, data: any) {
    this.webViewRef.current?.postMessage(
      JSON.stringify({ type, data, timestamp: Date.now() })
    );
  }

  async handleMessage(message: any) {
    switch (message.type) {
      case 'REQUEST_IMAGE':
        await this.handleImageRequest(message.data);
        break;
      case 'SHARE_DESIGN':
        await this.handleShareDesign(message.data);
        break;
      case 'SAVE_TO_GALLERY':
        await this.handleSaveToGallery(message.data);
        break;
      case 'REQUEST_PERMISSIONS':
        await this.handlePermissionsRequest(message.data);
        break;
    }
  }

  private async handleImageRequest(data: { zone: string, source: string }) {
    try {
      let result;

      if (data.source === 'camera') {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          this.sendToWeb('IMAGE_UPLOAD_ERROR', {
            error: 'Camera permission denied',
            code: 'PERMISSION_DENIED'
          });
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          this.sendToWeb('IMAGE_UPLOAD_ERROR', {
            error: 'Gallery permission denied',
            code: 'PERMISSION_DENIED'
          });
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
          base64: true
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        this.sendToWeb('IMAGE_UPLOADED', {
          base64: `data:image/jpeg;base64,${asset.base64}`,
          zone: data.zone,
          width: asset.width,
          height: asset.height,
          mimeType: 'image/jpeg'
        });
      } else {
        this.sendToWeb('IMAGE_UPLOAD_ERROR', {
          error: 'Image selection cancelled',
          code: 'CANCELLED'
        });
      }
    } catch (error) {
      this.sendToWeb('IMAGE_UPLOAD_ERROR', {
        error: error.message,
        code: 'UNKNOWN'
      });
    }
  }

  private async handleShareDesign(data: { imageUrl: string, text: string }) {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(data.imageUrl, {
          dialogTitle: data.text
        });
        this.sendToWeb('DESIGN_SHARED', {
          platform: 'other',
          success: true
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }

  private async handleSaveToGallery(data: { imageUrl: string, filename: string }) {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(data.imageUrl);
        this.sendToWeb('SAVED_TO_GALLERY', { success: true });
      }
    } catch (error) {
      console.error('Error saving to gallery:', error);
    }
  }

  private async handlePermissionsRequest(data: { permission: string }) {
    let granted = false;

    switch (data.permission) {
      case 'camera':
        const cameraResult = await Camera.requestCameraPermissionsAsync();
        granted = cameraResult.status === 'granted';
        break;
      case 'photos':
        const photosResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        granted = photosResult.status === 'granted';
        break;
    }

    this.sendToWeb('PERMISSIONS_RESULT', {
      permission: data.permission,
      granted
    });
  }
}
```

---

## 5. ALMACENAMIENTO DE DATOS

### 5.1 Fase 1 (localStorage)

```typescript
// Estructura de localStorage
{
  "products": [...],                    // Productos del catálogo
  "cart": {
    "items": [...],                     // Items en el carrito
    "total": 0
  },
  "customDesigns": {
    "design-uuid-1": {...},            // Diseños guardados
    "design-uuid-2": {...}
  },
  "admin": {
    "productTypes": [...],             // Tipos de producto
    "printZones": {...}                // Configuración de zonas
  }
}
```

### 5.2 Fase 2+ (Base de Datos)

Ver [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)

---

## 6. SEGURIDAD

### 6.1 Comunicación Web ↔ Native

- ✅ Validar origen de mensajes
- ✅ Sanitizar datos recibidos
- ✅ No enviar datos sensibles por postMessage
- ✅ Timeout para respuestas

### 6.2 API (Fase 2+)

- ✅ Autenticación JWT
- ✅ HTTPS obligatorio
- ✅ Rate limiting
- ✅ Validación de entrada (Zod)
- ✅ CORS configurado correctamente

---

**Última actualización:** 2025-11-22
**Versión:** 1.0
