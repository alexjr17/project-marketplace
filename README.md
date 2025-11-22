# 🛍️ Marketplace de Ropa Personalizada

## Tienda E-commerce con Personalización de Diseños

Plataforma web y móvil para venta de ropa personalizada donde los clientes pueden diseñar sus propias prendas con diseños únicos.

---

## 📋 Descripción del Proyecto

Sistema modular de e-commerce desarrollado por fases, que permite:

- **Ver catálogo de productos** (camisetas, hoodies, sudaderas, y más en el futuro)
- **Personalizar prendas** con diseños propios utilizando un editor visual
- **Procesar compras** con integración de pagos (Fase 3+)
- **Gestionar pedidos** con tracking completo
- **App móvil** con funciones nativas (cámara, galería, notificaciones)

---

## 🎯 Estado Actual: Fase 1 - MVP

### ✅ Planificación Completa
- Levantamiento de requerimientos
- Diagrama de base de datos
- Diagramas de flujo de usuario
- Arquitectura del sistema
- Roadmap de desarrollo

### 🟡 En Desarrollo
- Setup del proyecto web (React + TypeScript)
- Componentes base
- Personalizador visual

---

## 🏗️ Arquitectura

### Frontend
- **Web:** React 18 + TypeScript + Vite
- **Móvil:** React Native + Expo (Fase 4)
- **Estilos:** Tailwind CSS
- **Estado:** Context API
- **Routing:** React Router v6

### Backend (Fase 2+)
- **API:** Node.js + Express + TypeScript
- **Base de Datos:** PostgreSQL + Prisma ORM
- **Autenticación:** JWT + bcrypt
- **Storage:** Cloudinary (imágenes)

### Pagos (Fase 3+)
- **Pasarela:** Stripe / MercadoPago
- **Emails:** SendGrid / Resend

---

## 📂 Estructura del Proyecto

```
project-marketplace/
├── docs/                        # 📚 Documentación completa
│   ├── REQUIREMENTS.md          # Levantamiento de requerimientos
│   ├── DATABASE_SCHEMA.md       # Diagrama de base de datos
│   ├── USER_FLOWS.md            # Diagramas de flujo de usuario
│   ├── ARCHITECTURE.md          # Arquitectura del sistema
│   └── ROADMAP.md               # Roadmap de desarrollo
│
├── web/                         # 🌐 Aplicación React Web (Fase 1)
│   └── (pendiente)
│
├── mobile/                      # 📱 App React Native (Fase 4)
│   └── (pendiente)
│
├── backend/                     # 🔧 API Node.js (Fase 2)
│   └── (pendiente)
│
└── README.md                    # Este archivo
```

---

## 📖 Documentación

### [📋 REQUIREMENTS.md](docs/REQUIREMENTS.md)
Levantamiento completo de requerimientos funcionales y no funcionales de todas las fases.

**Contenido:**
- Alcance del proyecto
- Requerimientos por fase
- Stack tecnológico
- Métricas de éxito
- Gestión de riesgos

### [🗄️ DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
Diagrama completo del modelo entidad-relación (ERD) de la base de datos.

**Contenido:**
- Diagrama visual completo
- Descripción de todas las tablas
- Relaciones entre entidades
- Índices recomendados
- Datos iniciales (seeds)

### [🔄 USER_FLOWS.md](docs/USER_FLOWS.md)
Diagramas de flujo detallados de todos los procesos del usuario.

**Contenido:**
- Flujo de navegación general
- Flujo de compra simple
- Flujo de personalización
- Flujo de carrito
- Flujo de administración
- Flujo de checkout
- Flujo de autenticación
- Flujo de app móvil

### [🏗️ ARCHITECTURE.md](docs/ARCHITECTURE.md)
Arquitectura completa del sistema web + mobile.

**Contenido:**
- Visión general de la arquitectura
- Estructura de carpetas (frontend/backend/mobile)
- Comunicación Web ↔ Mobile (WebView)
- Protocolo de mensajes
- Implementaciones de código
- Seguridad

### [🗺️ ROADMAP.md](docs/ROADMAP.md)
Plan de desarrollo completo por fases con tareas detalladas.

**Contenido:**
- Fase 1: MVP (3-4 semanas)
- Fase 2: Backend + DB (2-3 semanas)
- Fase 3: Pagos + Órdenes (2-3 semanas)
- Fase 4: App Móvil (1-2 semanas)
- Fase 5: Expansión
- Checklist por semana/día

---

## 🚀 Fases del Proyecto

### ✅ FASE 0: Planificación (COMPLETADA)
- [x] Levantamiento de requerimientos
- [x] Diseño de base de datos
- [x] Diagramas de flujo
- [x] Definición de arquitectura
- [x] Roadmap detallado

### 🟡 FASE 1: MVP - Catálogo + Personalizador (EN CURSO)
**Duración:** 3-4 semanas

**Objetivos:**
- [x] Planificación completa
- [x] Setup del proyecto (Semana 1 completada)
- [ ] Catálogo de productos
- [ ] Personalizador visual
- [ ] Carrito con localStorage
- [ ] Panel de administración básico

**Sin implementar aún:**
- ❌ Backend real
- ❌ Base de datos
- ❌ Autenticación
- ❌ Pagos

### ⚪ FASE 2: Backend + Base de Datos
**Duración:** 2-3 semanas

**Objetivos:**
- [ ] API REST con Node.js + Express
- [ ] Base de datos PostgreSQL
- [ ] Sistema de autenticación (JWT)
- [ ] Roles y permisos
- [ ] Subida de imágenes a cloud

### ⚪ FASE 3: Pagos + Órdenes
**Duración:** 2-3 semanas

**Objetivos:**
- [ ] Checkout funcional
- [ ] Integración con Stripe/MercadoPago
- [ ] Sistema de órdenes
- [ ] Tracking de pedidos
- [ ] Emails transaccionales

### ⚪ FASE 4: App Móvil
**Duración:** 1-2 semanas

**Objetivos:**
- [ ] App React Native
- [ ] WebView integrado
- [ ] Funciones nativas (cámara, galería)
- [ ] Notificaciones push
- [ ] Publicación en stores

### ⚪ FASE 5: Expansión
**Duración:** Variable

**Objetivos:**
- [ ] Más productos (gorras, botellas, tazas)
- [ ] Editor de texto
- [ ] Biblioteca de diseños
- [ ] Vista 3D
- [ ] Sistema de reviews
- [ ] Cupones y descuentos

---

## 🎨 Características Principales

### Fase 1 (MVP)
✅ **Catálogo de Productos**
- Grid responsivo de productos
- Filtros por tipo y precio
- Ordenamiento
- Vista detallada de producto

✅ **Personalizador Visual**
- Selector de tipo de producto (Camiseta, Hoodie)
- Selector de color (6 colores)
- Vista frontal y trasera
- Zonas de estampado predefinidas
- Subida de imágenes
- Controles de ajuste (tamaño, rotación, posición)
- Preview en tiempo real en canvas

✅ **Carrito de Compras**
- Agregar/eliminar productos
- Ver productos personalizados con preview
- Cálculo de total
- Persistencia en localStorage

✅ **Panel de Administración**
- CRUD de productos
- Gestión de tipos de producto
- Vista de carritos simulados
- Acceso por enlace oculto (sin login en Fase 1)

### Fase 2+
🔜 Autenticación de usuarios
🔜 API REST completa
🔜 Base de datos PostgreSQL
🔜 Checkout y pagos
🔜 Gestión de pedidos
🔜 App móvil nativa
🔜 Notificaciones push

---

## 💻 Tecnologías

### Frontend Web
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router v6
- Context API
- HTML5 Canvas API
- lucide-react (iconos)

### Frontend Mobile (Fase 4)
- React Native
- Expo
- react-native-webview
- expo-camera
- expo-image-picker
- expo-notifications

### Backend (Fase 2+)
- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT
- bcrypt
- Zod (validación)

### Servicios Externos (Fase 3+)
- Stripe / MercadoPago (pagos)
- Cloudinary / AWS S3 (imágenes)
- SendGrid / Resend (emails)
- Firebase Cloud Messaging (push)

---

## 🎯 Objetivos del Proyecto

### Corto Plazo (Fase 1)
- ✅ Documentación completa y profesional
- 🟡 Sitio web funcional con catálogo
- 🟡 Personalizador de productos operativo
- 🟡 Carrito de compras simulado

### Mediano Plazo (Fases 2-3)
- ⚪ Backend robusto y escalable
- ⚪ Sistema de usuarios y autenticación
- ⚪ Procesamiento de pagos real
- ⚪ Gestión completa de pedidos

### Largo Plazo (Fases 4-5)
- ⚪ App móvil en iOS y Android
- ⚪ Expansión de catálogo de productos
- ⚪ Funciones avanzadas (vista 3D, editor de texto)
- ⚪ Sistema de reviews y valoraciones

---

## 📦 Instalación (Fase 1)

### Prerrequisitos
- Node.js 18+
- npm o yarn
- Git

### Pasos

```bash
# Clonar el repositorio
git clone <url-repositorio>
cd project-marketplace

# Instalar dependencias del proyecto web
cd web
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El sitio estará disponible en `http://localhost:5173`

---

## 🤝 Contribución

Este es un proyecto en desarrollo activo. Las contribuciones serán bienvenidas una vez completada la Fase 1.

---

## 📝 Licencia

Por definir

---

## 👤 Autor

**Kondory**

---

## 📞 Contacto

Por definir

---

## 🗓️ Cronograma

| Fase | Duración | Estado | Inicio | Fin Estimado |
|------|----------|--------|--------|--------------|
| 0. Planificación | 1 día | ✅ Completada | 2025-11-22 | 2025-11-22 |
| 1. MVP | 3-4 semanas | 🟡 En curso | 2025-11-23 | 2025-12-20 |
| 2. Backend + DB | 2-3 semanas | ⚪ Pendiente | - | - |
| 3. Pagos + Órdenes | 2-3 semanas | ⚪ Pendiente | - | - |
| 4. App Móvil | 1-2 semanas | ⚪ Pendiente | - | - |
| 5. Expansión | Variable | ⚪ Pendiente | - | - |

---

## 📊 Progreso del Proyecto

### Fase 1: MVP
```
[████████░░░░░░░░░░░░] 40% completado

✅ Planificación y documentación (100%)
🟡 Setup del proyecto (0%)
⚪ Componentes base (0%)
⚪ Catálogo de productos (0%)
⚪ Personalizador (0%)
⚪ Carrito (0%)
⚪ Panel admin (0%)
```

---

**Última actualización:** 2025-11-22
**Versión:** 1.0
