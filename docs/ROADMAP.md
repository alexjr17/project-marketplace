# 🗺️ Roadmap de Desarrollo

## PLAN DE IMPLEMENTACIÓN POR FASES

---

## 📍 FASE 1: MVP - CATÁLOGO + PERSONALIZADOR (Sin Pagos)

**Duración estimada:** 3-4 semanas
**Estado:** 🟡 Pendiente
**Objetivo:** Sitio web funcional con catálogo, personalizador y carrito simulado

### Semana 1: Setup + Estructura Base

#### Día 1-2: Configuración del Proyecto
- [ ] Crear proyecto con Vite + React + TypeScript
- [ ] Configurar Tailwind CSS
- [ ] Configurar ESLint + Prettier
- [ ] Configurar React Router
- [ ] Estructura de carpetas completa
- [ ] Configurar variables de entorno
- [ ] Git: Inicializar repositorio, `.gitignore`

#### Día 3-5: Componentes Base y Layout
- [ ] Componente `Layout` (Header, Footer, Container)
- [ ] Componente `Header` con navegación
- [ ] Componente `Footer` con enlace oculto a admin
- [ ] Componentes compartidos: `Button`, `Input`, `Modal`, `Toast`, `Loading`
- [ ] Sistema de rutas base
- [ ] Configurar Context API (estructura vacía)

### Semana 2: Catálogo de Productos

#### Día 6-7: Modelo de Datos y Tipos
- [ ] Definir tipos TypeScript (`product.ts`, `cart.ts`, `design.ts`)
- [ ] Crear datos iniciales de productos (6-8 productos hardcodeados)
- [ ] Crear configuración de tipos de producto
- [ ] Crear configuración de zonas de estampado
- [ ] Service: `storage.service.ts` (wrapper de localStorage)

#### Día 8-10: Páginas y Componentes de Catálogo
- [ ] Página `HomePage` con Hero Section
- [ ] Componente `HeroSection` con CTA de personalización
- [ ] Componente `FeaturedProducts` (grid de destacados)
- [ ] Página `CatalogPage`
- [ ] Componente `ProductCard`
- [ ] Componente `ProductGrid`
- [ ] Componente `ProductFilters` (tipo, precio)
- [ ] Componente `ProductSort`
- [ ] Context: `ProductsContext` (listar, filtrar, ordenar)

### Semana 3: Personalizador de Productos

#### Día 11-12: Canvas y Renderizado
- [ ] Service: `canvas.service.ts` (lógica de dibujo)
- [ ] Funciones para dibujar Camiseta (frente/espalda)
- [ ] Funciones para dibujar Hoodie (frente/espalda)
- [ ] Funciones para dibujar zonas de estampado
- [ ] Funciones para aplicar diseños en canvas

#### Día 13-15: Componentes del Personalizador
- [ ] Página `CustomizerPage`
- [ ] Componente `ProductCustomizer` (principal)
- [ ] Componente `ProductSelector` (selector de tipo)
- [ ] Componente `ColorPicker` (selector de color)
- [ ] Componente `ViewToggle` (frente/espalda)
- [ ] Componente `ZoneSelector` (lista de zonas)
- [ ] Componente `CanvasEditor` (canvas de preview)
- [ ] Componente `ImageUploader` (subida de archivos)
- [ ] Componente `DesignControls` (sliders de ajuste)
- [ ] Componente `DesignList` (lista de diseños aplicados)
- [ ] Validaciones: tamaño de imagen, formato, etc.

### Semana 4: Carrito + Panel Admin

#### Día 16-18: Sistema de Carrito
- [ ] Context: `CartContext` (agregar, eliminar, actualizar cantidad)
- [ ] Hook: `useCart`
- [ ] Hook: `useLocalStorage`
- [ ] Componente `CartDrawer` (drawer lateral)
- [ ] Componente `CartItem` (producto normal)
- [ ] Componente `CartItemCustomized` (producto personalizado con preview)
- [ ] Componente `CartSummary` (resumen de costos)
- [ ] Componente `CartEmpty` (estado vacío)
- [ ] Página `CartPage` (vista completa del carrito)
- [ ] Icono de carrito en header con badge de cantidad

#### Día 19-21: Panel de Administración
- [ ] Página `AdminPage` con tabs
- [ ] Componente `ProductManager` (CRUD de productos)
- [ ] Componente `ProductForm` (formulario agregar/editar)
- [ ] Componente `ProductTypeManager` (gestión de tipos)
- [ ] Validaciones de formularios
- [ ] Vista de carritos simulados (desde localStorage)
- [ ] Persistencia en localStorage de productos creados

#### Día 22: Testing y Refinamiento
- [ ] Pruebas manuales completas
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Fix de bugs encontrados
- [ ] Optimización de rendimiento (lazy loading, memoización)
- [ ] Documentación de componentes principales

### Entregables Fase 1
- ✅ Sitio web funcional
- ✅ Catálogo navegable
- ✅ Personalizador funcional (camiseta + hoodie)
- ✅ Carrito con localStorage
- ✅ Panel admin básico
- ✅ Código en GitHub
- ✅ README con instrucciones de instalación

---

## 📍 FASE 2: BACKEND + BASE DE DATOS + AUTENTICACIÓN

**Duración estimada:** 2-3 semanas
**Estado:** ⚪ No iniciada
**Objetivo:** Persistencia real de datos, API REST, sistema de usuarios

### Semana 5: Setup Backend + Base de Datos

#### Día 1-2: Configuración Inicial
- [ ] Inicializar proyecto backend (Node.js + Express + TypeScript)
- [ ] Configurar PostgreSQL local/cloud (Supabase o Railway)
- [ ] Configurar Prisma ORM
- [ ] Diseñar esquema de base de datos (prisma.schema)
- [ ] Crear migraciones iniciales
- [ ] Seeders con datos de prueba

#### Día 3-5: Estructura del Backend
- [ ] Estructura de carpetas (routes, controllers, services, middlewares)
- [ ] Configurar variables de entorno
- [ ] Middleware de error handling
- [ ] Middleware de logging (Morgan)
- [ ] Middleware de CORS
- [ ] Middleware de validación (Zod)

### Semana 6: API REST + Autenticación

#### Día 6-8: Endpoints de Productos
- [ ] GET `/api/products` (listar con filtros, paginación)
- [ ] GET `/api/products/:id` (detalle)
- [ ] POST `/api/products` (crear - solo admin)
- [ ] PUT `/api/products/:id` (actualizar - solo admin)
- [ ] DELETE `/api/products/:id` (eliminar - solo admin)
- [ ] GET `/api/product-types` (listar tipos)
- [ ] POST `/api/product-types` (crear tipo - solo admin)

#### Día 9-11: Sistema de Autenticación
- [ ] Modelo de usuarios (Prisma)
- [ ] POST `/api/auth/register` (registro)
- [ ] POST `/api/auth/login` (login)
- [ ] POST `/api/auth/logout` (logout)
- [ ] POST `/api/auth/refresh-token` (renovar token)
- [ ] GET `/api/auth/me` (perfil usuario)
- [ ] Middleware: `authenticate` (verificar JWT)
- [ ] Middleware: `authorize` (verificar roles)
- [ ] Hash de contraseñas (bcrypt)
- [ ] Generación de tokens JWT

### Semana 7: Integración Frontend + Backend

#### Día 12-14: Cliente HTTP en Frontend
- [ ] Service: `api.ts` (cliente Axios/Fetch)
- [ ] Interceptores de request/response
- [ ] Manejo de tokens (localStorage + refresh)
- [ ] Context: `AuthContext` (login, logout, register)
- [ ] Hook: `useAuth`
- [ ] Componentes: `LoginForm`, `RegisterForm`
- [ ] Protección de rutas (admin panel)

#### Día 15-16: Migración de Datos
- [ ] Migrar productos de localStorage → DB
- [ ] Migrar carritos de localStorage → DB (por usuario)
- [ ] Endpoints de carrito: GET, POST, PUT, DELETE
- [ ] Context: `CartContext` actualizado para usar API

#### Día 17-18: Subida de Imágenes
- [ ] Configurar Cloudinary/AWS S3
- [ ] Endpoint: POST `/api/upload` (subir imagen)
- [ ] Actualizar `ImageUploader` para usar API
- [ ] Guardar diseños personalizados en DB

### Entregables Fase 2
- ✅ API REST funcional
- ✅ Base de datos PostgreSQL
- ✅ Sistema de autenticación completo
- ✅ Gestión de roles y permisos
- ✅ Imágenes en cloud storage
- ✅ Frontend integrado con backend
- ✅ Documentación de API (Swagger/Postman)

---

## 📍 FASE 3: PAGOS + ÓRDENES + EMAIL

**Duración estimada:** 2-3 semanas
**Estado:** ⚪ No iniciada
**Objetivo:** Checkout funcional, procesamiento de pagos, gestión de pedidos

### Semana 8: Sistema de Checkout

#### Día 1-2: Modelos de Datos
- [ ] Modelo: `Order` (Prisma)
- [ ] Modelo: `OrderItem` (Prisma)
- [ ] Modelo: `OrderTimeline` (Prisma)
- [ ] Modelo: `Address` (Prisma)
- [ ] Migraciones

#### Día 3-5: Flujo de Checkout (Frontend)
- [ ] Página `CheckoutPage` con steps
- [ ] Componente `ShippingForm` (dirección de envío)
- [ ] Componente `ShippingMethodSelector` (métodos de envío)
- [ ] Componente `PaymentForm` (formulario de pago)
- [ ] Componente `OrderSummary` (resumen final)
- [ ] Componente `OrderConfirmation` (confirmación exitosa)
- [ ] Validaciones de formularios

### Semana 9: Integración de Pagos

#### Día 6-8: Stripe / MercadoPago
- [ ] Crear cuenta en Stripe/MercadoPago
- [ ] Instalar SDK en backend
- [ ] Endpoint: POST `/api/payments/create-intent` (crear intención de pago)
- [ ] Endpoint: POST `/api/payments/confirm` (confirmar pago)
- [ ] Webhook: `/api/webhooks/stripe` (eventos de Stripe)
- [ ] Integrar widget de pago en frontend
- [ ] Manejo de errores de pago

#### Día 9-11: Sistema de Órdenes
- [ ] Endpoint: POST `/api/orders` (crear orden)
- [ ] Endpoint: GET `/api/orders` (listar órdenes usuario/admin)
- [ ] Endpoint: GET `/api/orders/:id` (detalle de orden)
- [ ] Endpoint: PUT `/api/orders/:id/status` (cambiar estado - admin)
- [ ] Cálculo de impuestos
- [ ] Cálculo de envío
- [ ] Generación de número de orden único
- [ ] Limpiar carrito después de orden exitosa

### Semana 10: Emails + Panel de Pedidos

#### Día 12-13: Sistema de Emails
- [ ] Configurar SendGrid/Resend
- [ ] Templates de email (HTML + texto plano)
  - [ ] Confirmación de orden
  - [ ] Cambio de estado
  - [ ] Tracking de envío
- [ ] Service: `email.service.ts`
- [ ] Cola de emails (Bull/BullMQ) - opcional

#### Día 14-16: Panel de Pedidos (Admin)
- [ ] Página `OrdersPage` (admin)
- [ ] Componente `OrdersList` (tabla de pedidos)
- [ ] Componente `OrderDetail` (detalle completo)
- [ ] Filtros: estado, fecha, usuario
- [ ] Cambiar estado de pedido
- [ ] Ver diseños personalizados del pedido
- [ ] Generar archivo de producción (PDF/PNG)

#### Día 17-18: Historial de Pedidos (Usuario)
- [ ] Página `MyOrdersPage` (usuario)
- [ ] Componente `OrderCard` (resumen de orden)
- [ ] Ver tracking de envío
- [ ] Descargar factura (PDF)

### Entregables Fase 3
- ✅ Checkout funcional
- ✅ Integración de pagos (Stripe/MercadoPago)
- ✅ Sistema de órdenes completo
- ✅ Emails transaccionales
- ✅ Panel de gestión de pedidos
- ✅ Historial de pedidos para usuarios
- ✅ Generación de facturas

---

## 📍 FASE 4: APP MÓVIL (React Native)

**Duración estimada:** 1-2 semanas
**Estado:** ⚪ No iniciada
**Objetivo:** App móvil funcional con WebView y funciones nativas

### Semana 11: Setup + WebView Básico

#### Día 1-2: Configuración Inicial
- [ ] Inicializar proyecto con Expo
- [ ] Configurar TypeScript
- [ ] Instalar dependencias:
  - [ ] react-native-webview
  - [ ] expo-image-picker
  - [ ] expo-camera
  - [ ] expo-sharing
  - [ ] expo-media-library
  - [ ] expo-notifications

#### Día 3-5: WebView + Comunicación
- [ ] Componente `WebViewWrapper`
- [ ] Inyección de `window.isNativeApp = true`
- [ ] Sistema de mensajes bidireccional
- [ ] Service: `messaging.service.ts`
- [ ] Detección de conexión (online/offline)
- [ ] Splash screen

### Semana 12: Funciones Nativas

#### Día 6-7: Subida de Imágenes
- [ ] Solicitar permisos de cámara
- [ ] Solicitar permisos de galería
- [ ] Abrir cámara nativa
- [ ] Abrir galería nativa
- [ ] Convertir imagen a base64
- [ ] Enviar imagen a WebView

#### Día 8-9: Compartir y Guardar
- [ ] Compartir diseño en redes sociales
- [ ] Guardar diseño en galería
- [ ] Integración con Share API nativo

#### Día 10-11: Notificaciones Push
- [ ] Configurar Firebase Cloud Messaging
- [ ] Solicitar permisos de notificaciones
- [ ] Recibir notificaciones push
- [ ] Manejar tap en notificación
- [ ] Endpoint backend: POST `/api/notifications/send`

#### Día 12-13: Testing y Publicación
- [ ] Testing en iOS (simulador + dispositivo real)
- [ ] Testing en Android (emulador + dispositivo real)
- [ ] Configurar app.json (nombre, íconos, splash)
- [ ] Build de producción (EAS Build)
- [ ] Publicar en TestFlight (iOS)
- [ ] Publicar en Google Play (Beta)

### Entregables Fase 4
- ✅ App móvil iOS/Android
- ✅ WebView funcional
- ✅ Comunicación Web ↔ Native
- ✅ Subida de imágenes desde móvil
- ✅ Compartir diseños
- ✅ Notificaciones push
- ✅ App publicada en stores (beta)

---

## 📍 FASE 5: EXPANSIÓN DE PRODUCTOS

**Duración estimada:** Variable
**Estado:** ⚪ No iniciada
**Objetivo:** Más productos personalizables y funciones avanzadas

### Nuevos Productos
- [ ] Gorras (con zonas: frente, lateral, trasera)
- [ ] Botellas (con zona: alrededor)
- [ ] Tazas (con zona: alrededor)
- [ ] Almohadas (con zonas: frontal)
- [ ] Stickers (forma libre)

### Editor de Texto
- [ ] Agregar texto personalizado
- [ ] Selector de fuentes (10+ fuentes)
- [ ] Color de texto
- [ ] Efectos: sombra, contorno, gradiente
- [ ] Texto curvo
- [ ] Alineación

### Biblioteca de Diseños
- [ ] Cliparts predefinidos (categorías)
- [ ] Stickers
- [ ] Marcos decorativos
- [ ] Plantillas populares
- [ ] Búsqueda y filtros

### Funciones Avanzadas
- [ ] Vista 3D de productos (Three.js)
- [ ] Rotación 360° del producto
- [ ] Guardar diseños como plantillas
- [ ] Compartir diseños con otros usuarios
- [ ] Sistema de reviews y ratings
- [ ] Cupones y descuentos
- [ ] Programa de referidos

---

## 🔄 CICLO DE DESARROLLO CONTINUO

### Por cada Feature Nueva:
1. **Planificación** (1 día)
   - Definir requerimientos
   - Diseñar UI/UX
   - Estimar tiempo

2. **Desarrollo** (2-5 días)
   - Backend (si aplica)
   - Frontend
   - Integración

3. **Testing** (1 día)
   - Pruebas unitarias
   - Pruebas manuales
   - Fix de bugs

4. **Deployment** (medio día)
   - Deploy a staging
   - Pruebas en staging
   - Deploy a producción

5. **Monitoreo** (continuo)
   - Logs y errores
   - Métricas de uso
   - Feedback de usuarios

---

## 📊 MÉTRICAS DE ÉXITO POR FASE

### Fase 1
- [ ] 100% de productos visibles en catálogo
- [ ] Personalización funcional en 2+ tipos de producto
- [ ] Carrito con persistencia en localStorage
- [ ] Panel admin operativo

### Fase 2
- [ ] API con 95%+ uptime
- [ ] Autenticación sin errores
- [ ] Tiempo de respuesta API < 200ms

### Fase 3
- [ ] Tasa de éxito de pagos > 98%
- [ ] Emails entregados > 99%
- [ ] Órdenes procesadas correctamente

### Fase 4
- [ ] App funcional en iOS y Android
- [ ] Comunicación Web-Native sin fallos
- [ ] Rating en stores > 4.5 estrellas

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

1. ✅ **Documentación completa** (HECHO)
   - [x] Levantamiento de requerimientos
   - [x] Diagrama de base de datos
   - [x] Diagramas de flujo
   - [x] Arquitectura del sistema
   - [x] Roadmap de desarrollo

2. 🟡 **Iniciar Fase 1** (SIGUIENTE)
   - [ ] Crear proyecto con Vite
   - [ ] Configurar Tailwind CSS
   - [ ] Estructura de carpetas
   - [ ] Primeros componentes

---

**Última actualización:** 2025-11-22
**Versión:** 1.0
