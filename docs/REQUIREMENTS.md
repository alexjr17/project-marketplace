# 📋 Levantamiento de Requerimientos - Marketplace de Ropa Personalizada

## 1. INFORMACIÓN DEL PROYECTO

**Nombre del Proyecto:** Tienda de Ropa Personalizada
**Plataformas:** Web (React) + Móvil (React Native con WebView)
**Tipo:** Marketplace modular por fases
**Objetivo:** Sistema de venta de ropa con personalización de diseños

---

## 2. ALCANCE GENERAL DEL PROYECTO (TODAS LAS FASES)

### 2.1 Descripción General
Plataforma e-commerce para venta de ropa personalizada donde los clientes pueden:
- Ver catálogo de productos
- Personalizar prendas con diseños propios
- Agregar al carrito y realizar compras
- Seguimiento de pedidos
- Gestión administrativa completa

### 2.2 Usuarios del Sistema
1. **Cliente/Usuario Final**
   - Navegar catálogo
   - Personalizar productos
   - Realizar compras
   - Ver historial de pedidos

2. **Administrador**
   - Gestionar productos
   - Gestionar pedidos
   - Ver reportes
   - Configurar sistema

3. **Super Admin** (futuro)
   - Gestionar roles y permisos
   - Configuración avanzada

---

## 3. REQUERIMIENTOS POR FASE

---

## 📍 FASE 1: MVP - CATÁLOGO + PERSONALIZADOR (SIN PAGOS)

### 3.1 Objetivo de Fase 1
Sitio web funcional con catálogo de productos, personalizador visual y carrito simulado (sin checkout real).

### 3.2 Requerimientos Funcionales - Fase 1

#### RF-001: Página Principal (Home)
- **Prioridad:** Alta
- **Descripción:** Landing page que muestre hero section con llamado a la acción de personalización
- **Criterios de aceptación:**
  - Hero section con imagen destacada
  - Botón grande "Personaliza tu Prenda" que redirija a /customizer
  - Mensaje informativo sobre personalización
  - Grid de productos destacados/recientes (4-6 productos)
  - Footer con enlace oculto a panel admin

#### RF-002: Catálogo de Productos
- **Prioridad:** Alta
- **Descripción:** Página que muestre todos los productos disponibles
- **Criterios de aceptación:**
  - Grid responsivo de productos (cards)
  - Cada card muestra: imagen, nombre, precio, botón "Ver más", botón "Personalizar"
  - Filtros básicos: tipo de producto, rango de precio
  - Ordenamiento: precio (asc/desc), nombre, más recientes
  - Indicador visual si el producto es personalizable

#### RF-003: Detalle de Producto
- **Prioridad:** Media
- **Descripción:** Vista detallada de un producto individual
- **Criterios de aceptación:**
  - Imágenes del producto (frente/espalda)
  - Información completa: nombre, descripción, precio
  - Selector de color
  - Selector de talla
  - Selector de cantidad
  - Botón "Agregar al Carrito"
  - Botón "Personalizar" (si aplica)

#### RF-004: Personalizador de Productos
- **Prioridad:** Alta
- **Descripción:** Editor visual para personalizar prendas con diseños propios
- **Criterios de aceptación:**
  - Selector de tipo de producto (camiseta, hoodie)
  - Selector de color de prenda (mínimo 6 colores)
  - Toggle entre vista frontal y trasera
  - Definición de zonas de estampado según tipo de producto
  - Carga de imagen desde dispositivo
  - Una imagen por zona (reemplaza si ya existe)
  - Controles de ajuste por diseño:
    - Escala/tamaño
    - Rotación (0-360°)
    - Posición horizontal
    - Posición vertical
  - Preview en tiempo real en canvas
  - Visualización realista de la prenda (con sombras, costuras, detalles)
  - Botón "Agregar al Carrito" (guarda diseño personalizado)
  - Contador de diseños aplicados (frente/espalda)

#### RF-005: Carrito de Compras (Simulado)
- **Prioridad:** Alta
- **Descripción:** Sistema de carrito sin funcionalidad de pago real
- **Criterios de aceptación:**
  - Icono de carrito en header con contador de items
  - Drawer/Modal lateral al hacer clic
  - Lista de productos agregados:
    - Imagen del producto
    - Nombre y precio
    - Color y talla seleccionada
    - Preview del diseño personalizado (si aplica)
    - Cantidad (editable)
    - Subtotal
    - Botón eliminar
  - Cálculo de total general
  - Botón "Ver Carrito Completo" → página dedicada
  - Persistencia en localStorage
  - Mensaje indicando que checkout no está disponible aún

#### RF-006: Panel de Administración
- **Prioridad:** Alta
- **Descripción:** CRUD completo de productos y gestión básica
- **Acceso:** Enlace oculto en footer (sin login en Fase 1)
- **Criterios de aceptación:**
  - **Gestión de Tipos de Producto:**
    - Listar tipos (camiseta, hoodie, etc.)
    - Crear nuevo tipo
    - Editar tipo existente
    - Eliminar tipo
    - Definir zonas de estampado por tipo
  - **Gestión de Productos:**
    - Listar todos los productos (tabla o cards)
    - Crear nuevo producto (formulario completo)
    - Editar producto existente
    - Eliminar producto
    - Campos del producto:
      - Nombre
      - Tipo de producto
      - Descripción
      - Precio
      - Colores disponibles (multi-select)
      - Tallas disponibles (multi-select)
      - Imágenes (frente/espalda) - subida local
      - Es personalizable (checkbox)
      - Stock inicial
      - Categoría
  - **Vista de Carrito Simulado:**
    - Ver items agregados por usuarios (desde localStorage)
    - Eliminar items del carrito
    - Ver resumen de "pedidos pendientes"

### 3.3 Requerimientos No Funcionales - Fase 1

#### RNF-001: Rendimiento
- Tiempo de carga inicial < 3 segundos
- Renderizado del canvas < 100ms por cambio
- Carga de imágenes optimizada (lazy loading)

#### RNF-002: Compatibilidad
- Navegadores: Chrome, Firefox, Safari, Edge (últimas 2 versiones)
- Responsive: Mobile (320px+), Tablet (768px+), Desktop (1024px+)
- Detección de entorno (web vs mobile app)

#### RNF-003: Usabilidad
- Interfaz intuitiva y moderna
- Feedback visual en todas las acciones
- Mensajes de error claros
- Indicadores de carga

#### RNF-004: Almacenamiento (Fase 1)
- Productos: JSON hardcodeado en código
- Carrito: localStorage del navegador
- Diseños personalizados: base64 en localStorage
- Límite de 5MB total en localStorage

---

## 📍 FASE 2: BACKEND + BASE DE DATOS + AUTENTICACIÓN

### 3.4 Requerimientos Funcionales - Fase 2

#### RF-007: Sistema de Autenticación
- Registro de usuarios (email/contraseña)
- Login/Logout
- Recuperación de contraseña
- Roles: Cliente, Admin, Super Admin
- Permisos por rol

#### RF-008: Backend API REST
- Endpoints para productos (CRUD)
- Endpoints para usuarios
- Endpoints para carrito
- Endpoints para diseños personalizados
- Subida de imágenes a servidor/cloud

#### RF-009: Base de Datos
- Persistencia real de productos
- Usuarios y autenticación
- Carritos guardados por usuario
- Diseños personalizados guardados

#### RF-010: Gestión de Usuarios (Admin)
- Listar usuarios registrados
- Ver detalles de usuario
- Cambiar roles/permisos
- Desactivar/activar usuarios

---

## 📍 FASE 3: PAGOS + ÓRDENES + EMAIL

### 3.5 Requerimientos Funcionales - Fase 3

#### RF-011: Checkout y Pagos
- Formulario de datos de envío
- Integración con pasarela de pago (Stripe/MercadoPago)
- Cálculo de envío
- Confirmación de pago
- Generación de orden

#### RF-012: Sistema de Órdenes
- Crear orden al confirmar pago
- Estados de orden: Pendiente, En Producción, Enviado, Entregado, Cancelado
- Historial de órdenes por usuario
- Tracking de pedido

#### RF-013: Notificaciones Email
- Email de confirmación de orden
- Email de cambio de estado
- Email de tracking de envío

#### RF-014: Panel de Pedidos (Admin)
- Listar todas las órdenes
- Filtrar por estado, fecha, usuario
- Cambiar estado de orden
- Ver detalles completos de orden (productos, diseños)
- Generar reporte de ventas

---

## 📍 FASE 4: APP MÓVIL NATIVA

### 3.6 Requerimientos Funcionales - Fase 4

#### RF-015: App React Native
- WebView cargando sitio web principal
- Detección desde web: `window.isNativeApp = true`
- Comunicación bidireccional Web ↔ Native

#### RF-016: Funciones Nativas
- Subir imagen desde galería
- Tomar foto con cámara
- Notificaciones push (estado de pedido)
- Compartir diseño en redes sociales
- Guardar diseño en galería

#### RF-017: Parámetros desde Web
- Web detecta si está en app: habilita funciones nativas
- Web envía mensajes a Native: `window.ReactNativeWebView.postMessage()`
- Native responde a Web con datos/resultados

---

## 📍 FASE 5: EXPANSIÓN DE PRODUCTOS

### 3.7 Requerimientos Funcionales - Fase 5

#### RF-018: Nuevos Productos Personalizables
- Botellas
- Gorras
- Tazas
- Almohadas
- Stickers
- Cada uno con sus propias zonas de estampado

#### RF-019: Editor de Texto
- Agregar texto personalizado a prendas
- Selector de fuentes (mínimo 10)
- Color de texto
- Efectos (sombra, contorno)
- Texto curvo

#### RF-020: Biblioteca de Diseños
- Cliparts predefinidos
- Stickers
- Marcos decorativos
- Plantillas populares

---

## 4. ARQUITECTURA WEB + MOBILE

### 4.1 Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIO FINAL                            │
└─────────────────┬───────────────────────┬───────────────────┘
                  │                       │
         ┌────────▼────────┐     ┌───────▼────────┐
         │  NAVEGADOR WEB  │     │   APP MÓVIL    │
         │   (React Web)   │     │ (React Native) │
         └────────┬────────┘     └───────┬────────┘
                  │                      │
                  │              ┌───────▼────────┐
                  │              │    WebView     │
                  │              │  (carga web)   │
                  │              └───────┬────────┘
                  │                      │
         ┌────────▼──────────────────────▼────────┐
         │         REACT WEB APP                  │
         │  (Fuente de verdad - Todo vive aquí)  │
         │                                        │
         │  Detecta: window.isNativeApp          │
         │  Comunica: postMessage ↔ onMessage    │
         └────────┬───────────────────────────────┘
                  │
         ┌────────▼────────┐
         │  API REST       │  (Fase 2+)
         │  (Node.js)      │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │   BASE DE       │  (Fase 2+)
         │    DATOS        │
         │  (PostgreSQL)   │
         └─────────────────┘
```

### 4.2 Comunicación Web ↔ Mobile

**Desde Web → Native:**
```typescript
// Detectar si está en app
const isNative = window.isNativeApp || false;

// Enviar mensaje a Native
if (window.ReactNativeWebView) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'UPLOAD_IMAGE',
    data: { zone: 'front-center' }
  }));
}
```

**Desde Native → Web:**
```typescript
// En React Native
webViewRef.current.postMessage(JSON.stringify({
  type: 'IMAGE_UPLOADED',
  data: { base64: '...', zone: 'front-center' }
}));

// En Web (escuchar)
window.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'IMAGE_UPLOADED') {
    // Usar imagen en canvas
  }
});
```

---

## 5. STACK TECNOLÓGICO

### Fase 1 (Actual)
- **Frontend Web:** React 18 + TypeScript + Vite
- **Estilos:** Tailwind CSS
- **Routing:** React Router v6
- **Estado Global:** Context API
- **Almacenamiento:** localStorage
- **Canvas:** HTML5 Canvas API
- **Iconos:** lucide-react

### Fase 2
- **Backend:** Node.js + Express + TypeScript
- **Base de Datos:** PostgreSQL + Prisma ORM
- **Autenticación:** JWT + bcrypt
- **Almacenamiento:** Cloudinary (imágenes)
- **Validación:** Zod

### Fase 3
- **Pagos:** Stripe / MercadoPago
- **Email:** Resend / SendGrid
- **PDF:** PDFKit (facturas)

### Fase 4
- **Mobile:** React Native + Expo
- **WebView:** react-native-webview
- **Cámara:** expo-camera
- **Imágenes:** expo-image-picker
- **Notificaciones:** expo-notifications

---

## 6. CONSIDERACIONES TÉCNICAS

### 6.1 Datos de Prueba (Fase 1)
- 6-8 productos iniciales hardcodeados
- Tipos: Camiseta (3), Hoodie (2), Sudadera (1)
- Colores: blanco, negro, gris, azul, rojo, verde
- Tallas: XS, S, M, L, XL, XXL
- Imágenes: Mockups generados por canvas si no se tienen reales

### 6.2 Panel Admin (Fase 1)
- **Acceso:** Enlace oculto en footer `/admin-secret-panel`
- **Sin login:** Acceso directo (temporal)
- **Roles predefinidos:** Hardcodeados en código
  ```typescript
  const ROLES = {
    SUPER_ADMIN: { name: 'Super Admin', permissions: ['*'] },
    ADMIN: { name: 'Admin', permissions: ['products', 'orders'] },
    CLIENT: { name: 'Cliente', permissions: ['view'] }
  }
  ```

### 6.3 Limitaciones Fase 1
- ❌ Sin registro/login de usuarios
- ❌ Sin checkout real
- ❌ Sin integración de pagos
- ❌ Sin envío de emails
- ❌ Sin persistencia en servidor
- ✅ Todo en localStorage (máximo 5MB)
- ✅ Carrito simulado
- ✅ Panel admin básico

---

## 7. MÉTRICAS DE ÉXITO

### Fase 1
- [ ] Usuario puede navegar catálogo completo
- [ ] Usuario puede personalizar mínimo 2 tipos de productos
- [ ] Usuario puede agregar productos al carrito
- [ ] Admin puede crear/editar/eliminar productos
- [ ] Sistema responsive en mobile, tablet, desktop
- [ ] Canvas funciona correctamente en todos los navegadores

### Fase 2
- [ ] Productos persisten en base de datos
- [ ] Sistema de autenticación funcional
- [ ] API REST documentada

### Fase 3
- [ ] Checkout funcional con pago real
- [ ] Órdenes generadas correctamente
- [ ] Emails enviados automáticamente

### Fase 4
- [ ] App móvil funcional en iOS/Android
- [ ] Comunicación Web-Native sin errores
- [ ] Funciones nativas operativas

---

## 8. RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| localStorage limitado (5MB) | Media | Medio | Comprimir imágenes, límite de productos en carrito |
| Canvas no compatible en navegadores viejos | Baja | Bajo | Detección de capacidades, mensaje de actualización |
| Diseños personalizados muy pesados | Alta | Medio | Validar tamaño máximo (2MB), optimizar base64 |
| Incompatibilidad Web ↔ Native | Media | Alto | Testing exhaustivo, fallbacks, documentación clara |

---

## 9. CRONOGRAMA ESTIMADO

**Fase 1:** 3-4 semanas
**Fase 2:** 2-3 semanas
**Fase 3:** 2-3 semanas
**Fase 4:** 1-2 semanas
**Fase 5:** Variable según productos

---

## 10. ENTREGABLES FASE 1

- [ ] Código fuente web (React + TypeScript)
- [ ] Documentación técnica
- [ ] Diagrama de base de datos (diseño completo para futuro)
- [ ] Diagrama de flujo de usuario
- [ ] README con instrucciones de instalación
- [ ] Datos de prueba (productos iniciales)

---

**Última actualización:** 2025-11-22
**Versión:** 1.0
