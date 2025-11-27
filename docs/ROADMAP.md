# 🗺️ Roadmap de Desarrollo

## PLAN DE IMPLEMENTACIÓN POR FASES

---

## 📍 FASE 1: MVP - CATÁLOGO + PERSONALIZADOR + ADMIN BÁSICO

**Estado:** 🟢 95% Completado
**Deploy:** ✅ https://project-marketplace.vercel.app

### ✅ Completado

#### Semana 1-2: Setup + Catálogo
- [x] Proyecto Vite + React + TypeScript + Tailwind
- [x] Estructura de carpetas y rutas
- [x] Componentes base (Layout, Header, Footer, Button, Input, Modal, Toast)
- [x] Catálogo de productos con filtros y ordenamiento
- [x] ProductCard, ProductGrid, ProductFilters

#### Semana 3: Personalizador
- [x] Canvas 2D con renderizado realista (sombras, costuras, texturas)
- [x] 6 tipos de productos (camiseta, hoodie, gorra, botella, taza, almohada)
- [x] 14 zonas de impresión diferentes
- [x] Sistema de tallas con escalado visual
- [x] Guía de tallas interactiva
- [x] 8 colores base
- [x] Subida de imágenes (2MB máx, PNG/JPG)
- [x] Controles de diseño (posición en cm, tamaño, rotación, bloqueo de proporción)
- [x] Export de preview como PNG

#### Semana 4: Carrito + Panel Admin
- [x] Sistema de carrito completo con persistencia localStorage
- [x] Cálculo de impuestos (16%) y envío (gratis >$50)
- [x] Panel Admin con Dashboard y estadísticas
- [x] CRUD de Productos (tabla con búsqueda, paginación, ordenamiento)
- [x] ProductForm completo (nombre, descripción, tipo, categoría, precio, stock, imágenes, colores, tallas)
- [x] Gestión de Catálogos:
  - [x] Tipos de producto
  - [x] Categorías
  - [x] Colores
  - [x] Tallas

### ⚪ Pendiente Fase 1
- [ ] Testing y refinamiento final
- [ ] Optimización de rendimiento

---

## 📍 FASE 2: USUARIOS + AUTENTICACIÓN + ROLES

**Estado:** 🟢 90% Completado
**Objetivo:** Sistema de usuarios con roles diferenciados (Cliente, Admin, SuperAdmin)

### Módulo de Autenticación
- [x] Página de Login
- [x] Página de Registro
- [ ] Recuperación de contraseña
- [ ] Verificación de email (opcional)
- [x] Context: `AuthContext` (login, logout, register)
- [x] Hook: `useAuth`
- [x] Protección de rutas por rol

### Módulo de Usuarios (Clientes)
- [x] Página `UsersPage` en Admin (lista de clientes con tabla)
- [x] Ver perfil de usuario (`UserDetailPage`)
- [x] Historial de pedidos del usuario
- [x] Direcciones guardadas del usuario
- [x] Activar/Desactivar usuario
- [x] Filtros: estado, fecha registro, rol

### Módulo de Administradores
- [x] Página `AdminUsersPage` en Admin (lista de administradores)
- [x] Crear nuevo administrador
- [x] Asignar rol (Admin, SuperAdmin)
- [x] Permisos por módulo (estructura definida)
- [ ] Log de actividad del administrador
- [x] Solo SuperAdmin puede crear/editar otros admins

### Perfil de Usuario (Frontend público)
- [x] Página `ProfilePage`
- [x] Editar datos personales
- [x] Cambiar contraseña
- [x] Mis direcciones (CRUD)
- [ ] Mis pedidos (historial)

### Entregables Fase 2
- [x] Sistema de autenticación completo
- [x] Gestión de usuarios clientes
- [x] Gestión de administradores con roles
- [x] Perfiles de usuario en frontend

---

## 📍 FASE 3: PEDIDOS + HISTORIAL DE ESTADOS

**Estado:** 🟢 98% Completado
**Objetivo:** Sistema simple de pedidos con registro de cambio de estados (sin pagos reales)

### Flujo del Pedido (Estados)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  PENDIENTE  │───►│ CONFIRMADO  │───►│ EN PROCESO  │───►│  COMPLETADO │
│   (Nuevo)   │    │   (Pago OK) │    │ (Producción)│    │  (Listo)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │
       ▼
┌─────────────┐
│  CANCELADO  │
└─────────────┘
```

### Estados del Pedido
| Estado | Descripción | Acción Admin |
|--------|-------------|--------------|
| `pending` | Pedido creado, esperando confirmación | Confirmar / Cancelar |
| `confirmed` | Pago verificado manualmente | Pasar a producción |
| `processing` | En producción (estampado) | Marcar completado |
| `completed` | Pedido listo/entregado | - |
| `cancelled` | Cancelado | - |

### Modelo de Datos

**Pedido (Order)**
```
- id
- orderNumber (ej: ORD-001)
- customerName
- customerEmail
- customerPhone
- items[] (productos del carrito)
- subtotal
- total
- status (pending, confirmed, processing, completed, cancelled)
- notes (notas del admin)
- createdAt
- updatedAt
```

**Timeline del Pedido (OrderTimeline)**
```
- id
- orderId
- status (estado al que cambió)
- changedBy (quién hizo el cambio)
- notes (comentario opcional)
- createdAt
```

### Checkout (Frontend - Simple)
- [x] Página `CheckoutPage` básica:
  - [x] Resumen del carrito
  - [x] Formulario de datos del cliente (nombre, email, teléfono)
  - [x] Dirección de entrega (texto libre)
  - [x] Selección de método de pago
  - [x] Botón "Confirmar Pedido"
- [x] Página `OrderConfirmationPage` (número de pedido generado)

### Módulo de Pedidos (Admin)
- [x] Página `OrdersPage` - Lista de pedidos con tabla
- [x] Tabla: #Orden, Cliente, Fecha, Total, Estado, Acciones
- [x] Filtros por estado
- [x] Búsqueda por número de orden o cliente
- [x] Página `OrderDetailPage`:
  - [x] Datos del cliente
  - [x] Productos del pedido (con preview)
  - [x] Timeline del pedido (historial de cambios de estado)
  - [x] Totales
- [x] Botones de cambio de estado con flujo completo
- [x] Campo de notas al cambiar estado
- [x] Subir evidencias de pago
- [ ] Descargar diseños para producción (PNG)

### Mis Pedidos (Cliente - Opcional)
- [ ] Página `MyOrdersPage` - Ver mis pedidos por email
- [ ] Ver estado actual y timeline

### Entregables Fase 3
- [x] Checkout simple (sin pasarela de pago)
- [x] Sistema de pedidos con cambio de estados
- [x] Timeline/historial de cada pedido
- [x] Panel de gestión de pedidos para admin

---

## 📍 FASE 4: PAGOS + FACTURACIÓN + DESPACHOS

**Estado:** 🔮 Futuro (No prioritario)
**Objetivo:** Integración de pasarela de pagos, facturación y sistema de despachos

> ⚠️ **Nota:** Esta fase se implementará cuando el negocio lo requiera.
> Por ahora el sistema funciona con confirmación manual de pagos.

### Integración de Pagos (Futuro)
- [ ] Pasarela de pagos (Stripe / MercadoPago / PayU)
- [ ] Pago con tarjeta en checkout
- [ ] Webhooks de confirmación automática
- [ ] Pago por transferencia con comprobante

### Facturación (Futuro)
- [ ] Generación de facturas PDF
- [ ] Datos fiscales configurables
- [ ] Envío de factura por email

### Sistema de Despachos (Futuro)
- [ ] Métodos de envío configurables
- [ ] Cálculo de costos de envío
- [ ] Integración con couriers
- [ ] Tracking de envíos

---

## 📍 FASE 5: NOTIFICACIONES + EMAILS

**Estado:** ⚪ No iniciada
**Objetivo:** Sistema de notificaciones y emails transaccionales

### Emails Transaccionales
- [ ] Configurar servicio de email (SendGrid / Resend / AWS SES)
- [ ] Templates de email:
  - [ ] Bienvenida (registro)
  - [ ] Confirmación de pedido
  - [ ] Pago recibido
  - [ ] Pedido en producción
  - [ ] Pedido enviado (con tracking)
  - [ ] Pedido entregado
  - [ ] Pedido cancelado
  - [ ] Recuperación de contraseña
- [ ] Diseño responsive de emails
- [ ] Variables dinámicas (nombre, #orden, productos, etc.)

### Notificaciones en App
- [ ] Sistema de notificaciones internas
- [ ] Icono de campana en header con badge
- [ ] Lista de notificaciones
- [ ] Marcar como leída
- [ ] Tipos de notificación:
  - [ ] Nuevo pedido (admin)
  - [ ] Cambio de estado de pedido (cliente)
  - [ ] Stock bajo (admin)

### Configuración de Notificaciones (Admin)
- [ ] Página `NotificationConfigPage`
- [ ] Activar/desactivar emails por tipo
- [ ] Personalizar textos de email
- [ ] Email de prueba

### Entregables Fase 5
- Emails transaccionales automáticos
- Sistema de notificaciones in-app
- Configuración de notificaciones

---

## 📍 FASE 6: CONFIGURACIÓN GENERAL

**Estado:** 🟢 85% Completado
**Objetivo:** Configuración centralizada del sistema

### Configuración del Negocio
- [x] Página `SettingsPage` en Admin (con tabs)
- [x] Datos del negocio:
  - [x] Nombre de la tienda
  - [ ] Logo
  - [x] Dirección
  - [x] Teléfono
  - [x] Email de contacto
  - [x] Redes sociales (Facebook, Instagram, WhatsApp)
- [ ] Datos fiscales (para facturas)
- [ ] Horario de atención

### Configuración de Envíos
- [x] Origen de envío (dirección de salida de paquetes)
- [x] Zonas geográficas
- [x] Transportadoras con tarifas por zona
- [x] Factor volumétrico por transportadora
- [x] Tiempo de preparación
- [x] Configuración de paquetes por defecto

### Configuración de Pagos
- [x] Métodos de pago (Transferencia, PSE, Efectivo, Tarjeta)
- [x] Información bancaria para transferencias
- [x] Impuestos (IVA %)
- [x] Moneda configurable

### Términos y Políticas
- [ ] Página de Términos y Condiciones
- [ ] Página de Política de Privacidad
- [ ] Página de Política de Devoluciones
- [ ] Editor de contenido para cada página

### Entregables Fase 6
- [x] Configuración centralizada del negocio
- [x] Configuración de envíos y transportadoras
- [x] Configuración de métodos de pago
- [ ] Páginas legales editables

---

## 📍 FASE 7: BACKEND + BASE DE DATOS (Cuando sea necesario)

**Estado:** ⚪ No iniciada
**Objetivo:** Migrar de localStorage a persistencia real

### Setup Backend
- [ ] Proyecto Node.js + Express + TypeScript
- [ ] PostgreSQL (Supabase / Railway / PlanetScale)
- [ ] Prisma ORM
- [ ] Esquema de base de datos
- [ ] Seeders con datos iniciales

### API REST
- [ ] Endpoints de productos
- [ ] Endpoints de usuarios
- [ ] Endpoints de pedidos
- [ ] Endpoints de autenticación
- [ ] Documentación Swagger

### Migración
- [ ] Migrar productos de localStorage → DB
- [ ] Migrar usuarios de localStorage → DB
- [ ] Migrar pedidos de localStorage → DB
- [ ] Actualizar servicios del frontend

### Storage de Imágenes
- [ ] Cloudinary / AWS S3
- [ ] Subida de imágenes de productos
- [ ] Subida de diseños personalizados
- [ ] Optimización de imágenes

---

## 📍 FASE 8: APP MÓVIL (Opcional)

**Estado:** ⚪ No iniciada
**Objetivo:** App móvil con React Native + WebView

### Contenido
- [ ] Expo + React Native
- [ ] WebView del sitio web
- [ ] Subida de imágenes desde cámara/galería
- [ ] Notificaciones push
- [ ] Publicación en stores

---

## 📊 RESUMEN DE ESTADO

| Fase | Nombre | Estado | Progreso |
|------|--------|--------|----------|
| 1 | MVP: Catálogo + Personalizador + Admin | 🟢 | 95% |
| 2 | Usuarios + Autenticación + Roles | 🟢 | 90% |
| 3 | Pedidos + Historial de Estados | 🟢 | 98% |
| 4 | Pagos + Facturación + Despachos | 🔮 | Futuro |
| 5 | Notificaciones + Emails | ⚪ | 0% |
| 6 | Configuración General | 🟢 | 85% |
| 7 | Backend + Base de Datos | ⚪ | 0% |
| 8 | App Móvil | 🔮 | Futuro |

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

### Pendientes prioritarios:
1. **Mis Pedidos** - Vista de pedidos para clientes
2. **Notificaciones** - Emails transaccionales básicos
3. **Descargar diseños** - Descargar diseños para producción (PNG)

### Nota sobre localStorage vs Backend:
Por ahora todo funciona con localStorage. Cuando el volumen de datos lo requiera, se implementará la Fase 7 (Backend + Base de datos).

---

**Última actualización:** 2025-11-26
**Versión:** 3.0
