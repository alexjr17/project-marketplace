# 📚 Índice de Documentación

## Guía Completa del Proyecto - Marketplace de Ropa Personalizada

---

## 🚀 Por Dónde Empezar

### Si eres nuevo en el proyecto:
1. Lee primero el [**Resumen Ejecutivo**](EXECUTIVE_SUMMARY.md) (10 min)
2. Revisa el [**README principal**](../README.md) (5 min)
3. Explora el [**Roadmap**](ROADMAP.md) para ver el plan completo (15 min)

### Si eres desarrollador:
1. Revisa la [**Arquitectura**](ARCHITECTURE.md) (20 min)
2. Estudia los [**Requerimientos**](REQUIREMENTS.md) (30 min)
3. Consulta el [**Diagrama de Base de Datos**](DATABASE_SCHEMA.md) (15 min)

### Si eres diseñador/UX:
1. Revisa los [**Flujos de Usuario**](USER_FLOWS.md) (20 min)
2. Lee los [**Requerimientos Funcionales**](REQUIREMENTS.md#3-requerimientos-por-fase) (15 min)

---

## 📄 Documentos Disponibles

### 1. [README.md](../README.md)
**Documento principal del proyecto**

**Contenido:**
- Descripción general del proyecto
- Estado actual y progreso
- Estructura de carpetas
- Guía rápida de instalación
- Tecnologías utilizadas
- Cronograma de fases
- Enlaces a documentación detallada

**Cuándo leer:** Siempre primero, para tener contexto general

---

### 2. [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)
**Resumen ejecutivo completo**

**Contenido:**
- Visión general y propuesta de valor
- Alcance del proyecto por fases
- Características principales
- Stack tecnológico
- Arquitectura simplificada
- Plan de desarrollo
- Métricas de éxito
- Riesgos y mitigaciones
- Próximos pasos

**Cuándo leer:** Para presentaciones, onboarding de nuevos miembros, o revisión rápida del proyecto completo

**Tiempo de lectura:** 15-20 minutos

---

### 3. [REQUIREMENTS.md](REQUIREMENTS.md)
**Levantamiento completo de requerimientos**

**Contenido:**
- Información del proyecto
- Alcance general de todas las fases
- Requerimientos funcionales por fase (RF-001 a RF-020)
- Requerimientos no funcionales (RNF-001 a RNF-004)
- Arquitectura Web + Mobile
- Stack tecnológico detallado
- Consideraciones técnicas
- Métricas de éxito
- Riesgos y mitigación
- Cronograma estimado
- Entregables por fase

**Cuándo leer:**
- Antes de implementar cualquier feature
- Para validar scope de cada fase
- Para entender limitaciones de Fase 1

**Tiempo de lectura:** 30-40 minutos

**Secciones clave:**
- [Requerimientos Fase 1](REQUIREMENTS.md#-fase-1-mvp---catálogo--personalizador-sin-pagos)
- [Arquitectura Web + Mobile](REQUIREMENTS.md#4-arquitectura-web--mobile)
- [Stack Tecnológico](REQUIREMENTS.md#5-stack-tecnológico)

---

### 4. [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
**Diagrama completo de base de datos (ERD)**

**Contenido:**
- Modelo entidad-relación visual
- Descripción detallada de todas las tablas (16 tablas)
- Relaciones entre entidades
- Índices recomendados
- Datos iniciales (seeds)
- Consultas SQL de ejemplo

**Cuándo leer:**
- Antes de implementar Fase 2 (Backend)
- Para entender modelo de datos completo
- Al crear migraciones de Prisma

**Tiempo de lectura:** 20-25 minutos

**Secciones clave:**
- [Diagrama visual completo](DATABASE_SCHEMA.md#modelo-entidad-relación-erd)
- [Módulo de Usuarios](DATABASE_SCHEMA.md#-módulo-de-usuarios-y-autenticación)
- [Módulo de Productos](DATABASE_SCHEMA.md#-módulo-de-productos)
- [Módulo de Personalización](DATABASE_SCHEMA.md#-módulo-de-personalización)
- [Módulo de Órdenes](DATABASE_SCHEMA.md#-módulo-de-órdenes-y-pagos)

---

### 5. [USER_FLOWS.md](USER_FLOWS.md)
**Diagramas de flujo de todos los procesos del usuario**

**Contenido:**
- Flujo de navegación general
- Flujo de compra simple (sin personalización)
- Flujo de personalización de producto (detallado)
- Flujo de gestión del carrito
- Flujo de administración (Fase 1)
- Flujo de checkout (Fase 3)
- Flujo de autenticación (Fase 2)
- Flujo de app móvil - funciones nativas (Fase 4)
- Mensajes de comunicación Web ↔ Native

**Cuándo leer:**
- Al implementar una nueva página/feature
- Para entender la experiencia del usuario
- Al diseñar UI/UX

**Tiempo de lectura:** 25-30 minutos

**Secciones clave:**
- [Flujo de Personalización](USER_FLOWS.md#3-flujo-de-personalización-de-producto)
- [Flujo de Carrito](USER_FLOWS.md#4-flujo-de-gestión-del-carrito)
- [Mensajes Web ↔ Mobile](USER_FLOWS.md#mensajes-de-comunicación-web--native)

---

### 6. [ARCHITECTURE.md](ARCHITECTURE.md)
**Arquitectura completa del sistema (Web + Mobile)**

**Contenido:**
- Visión general de la arquitectura
- Estructura de carpetas del frontend (detallada)
- Estructura de carpetas del mobile
- Arquitectura de componentes React
- Flujo de estado (Context API)
- Comunicación Web ↔ Mobile (protocolo completo)
- Implementaciones de código (hooks, services)
- Almacenamiento de datos (localStorage → DB)
- Seguridad

**Cuándo leer:**
- Antes de empezar a codear
- Para entender organización del código
- Al implementar comunicación con mobile

**Tiempo de lectura:** 30-35 minutos

**Secciones clave:**
- [Estructura de carpetas Frontend](ARCHITECTURE.md#21-estructura-de-carpetas)
- [Comunicación Web ↔ Mobile](ARCHITECTURE.md#4-comunicación-web--mobile)
- [Implementación en Web](ARCHITECTURE.md#42-implementación-en-web-react)
- [Implementación en Native](ARCHITECTURE.md#43-implementación-en-native-react-native)

---

### 7. [ROADMAP.md](ROADMAP.md)
**Plan de desarrollo completo por fases**

**Contenido:**
- Fase 1: Semana por semana, día por día (checklist detallado)
- Fase 2: Tareas de backend y API
- Fase 3: Tareas de checkout y pagos
- Fase 4: Tareas de app móvil
- Fase 5: Expansión de productos
- Ciclo de desarrollo continuo
- Métricas de éxito por fase
- Próximos pasos inmediatos

**Cuándo leer:**
- Diariamente durante desarrollo
- Para planear sprints
- Para tracking de progreso

**Tiempo de lectura:** 20-25 minutos

**Secciones clave:**
- [Fase 1 - Semana 1](ROADMAP.md#semana-1-setup--estructura-base)
- [Fase 1 - Semana 3 (Personalizador)](ROADMAP.md#semana-3-personalizador-de-productos)
- [Próximos pasos](ROADMAP.md#-próximos-pasos-inmediatos)

---

### 8. [PRODUCT_SYSTEM.md](PRODUCT_SYSTEM.md)
**Sistema completo de productos y personalización**

**Contenido:**
- Tipos de productos implementados (6 tipos)
- Sistema de zonas de impresión (14 zonas diferentes)
- Configuración detallada por producto
- Sistema de tallas con escalado visual
- Tablas de medidas completas
- Sistema de colores
- Flujo de personalización paso a paso
- Modelo de datos (Design, CustomizedProduct)
- Integración con carrito
- Componentes del sistema
- Referencias técnicas y APIs

**Cuándo leer:**
- Al trabajar con el personalizador
- Para entender zonas de impresión
- Al agregar nuevos productos
- Para consultar tablas de tallas
- Al modificar el sistema de canvas

**Tiempo de lectura:** 25-30 minutos

**Secciones clave:**
- [Tipos de Productos](PRODUCT_SYSTEM.md#2-tipos-de-productos)
- [Sistema de Zonas](PRODUCT_SYSTEM.md#3-sistema-de-zonas-de-impresión)
- [Sistema de Tallas](PRODUCT_SYSTEM.md#4-sistema-de-tallas)
- [Modelo de Datos](PRODUCT_SYSTEM.md#8-modelo-de-datos)
- [APIs Principales](PRODUCT_SYSTEM.md#132-apis-principales)

---

## 🔍 Guías de Búsqueda Rápida

### "¿Cómo implemento...?"

| Pregunta | Documento | Sección |
|----------|-----------|---------|
| ¿Cómo estructuro las carpetas del proyecto? | [ARCHITECTURE.md](ARCHITECTURE.md) | 2.1 Estructura de Carpetas |
| ¿Cómo funciona la comunicación Web-Mobile? | [ARCHITECTURE.md](ARCHITECTURE.md) | 4. Comunicación Web ↔ Mobile |
| ¿Qué tablas necesito en la base de datos? | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Modelo Entidad-Relación |
| ¿Cuál es el flujo de personalización? | [USER_FLOWS.md](USER_FLOWS.md) | 3. Flujo de Personalización |
| ¿Qué features van en Fase 1? | [REQUIREMENTS.md](REQUIREMENTS.md) | Fase 1: MVP |
| ¿Cuánto tiempo toma cada fase? | [ROADMAP.md](ROADMAP.md) | Todas las fases |
| ¿Cómo funcionan las zonas de impresión? | [PRODUCT_SYSTEM.md](PRODUCT_SYSTEM.md) | 3. Sistema de Zonas |
| ¿Qué tallas tiene cada producto? | [PRODUCT_SYSTEM.md](PRODUCT_SYSTEM.md) | 4. Sistema de Tallas |
| ¿Cómo agregar un nuevo producto? | [PRODUCT_SYSTEM.md](PRODUCT_SYSTEM.md) | 11. Mejores Prácticas |

### "¿Qué hace...?"

| Pregunta | Documento | Sección |
|----------|-----------|---------|
| ¿Qué es PlatformContext? | [ARCHITECTURE.md](ARCHITECTURE.md) | 2.3 Flujo de Estado |
| ¿Qué hace la tabla custom_designs? | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | custom_designs |
| ¿Qué es window.isNativeApp? | [ARCHITECTURE.md](ARCHITECTURE.md) | 4.1 Protocolo de Mensajes |
| ¿Qué pasa cuando el usuario sube una imagen? | [USER_FLOWS.md](USER_FLOWS.md) | Flujo de Personalización |
| ¿Qué son las PrintZones? | [PRODUCT_SYSTEM.md](PRODUCT_SYSTEM.md) | 3.1 Tipos de Zonas |
| ¿Qué es el factor de escala (scale)? | [PRODUCT_SYSTEM.md](PRODUCT_SYSTEM.md) | 4.2 Sistema de Escalado |

### "¿Cuándo...?"

| Pregunta | Documento | Sección |
|----------|-----------|---------|
| ¿Cuándo implemento autenticación? | [ROADMAP.md](ROADMAP.md) | Fase 2 |
| ¿Cuándo integro pagos? | [ROADMAP.md](ROADMAP.md) | Fase 3 |
| ¿Cuándo creo la app móvil? | [ROADMAP.md](ROADMAP.md) | Fase 4 |
| ¿Cuándo migro de localStorage a DB? | [ROADMAP.md](ROADMAP.md) | Fase 2 - Semana 7 |

---

## 📊 Matriz de Documentos por Rol

### 👨‍💻 Desarrollador Frontend

**Lectura esencial:**
1. [ARCHITECTURE.md](ARCHITECTURE.md) - Estructura de carpetas y componentes
2. [REQUIREMENTS.md](REQUIREMENTS.md) - Requerimientos funcionales Fase 1
3. [PRODUCT_SYSTEM.md](PRODUCT_SYSTEM.md) - Sistema de productos y zonas
4. [USER_FLOWS.md](USER_FLOWS.md) - Flujos de usuario
5. [ROADMAP.md](ROADMAP.md) - Tareas semana a semana

**Lectura recomendada:**
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Para entender modelo de datos

### 👨‍💻 Desarrollador Backend (Fase 2+)

**Lectura esencial:**
1. [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Esquema completo de DB
2. [REQUIREMENTS.md](REQUIREMENTS.md) - Requerimientos Fase 2-3
3. [ARCHITECTURE.md](ARCHITECTURE.md) - Arquitectura de API

**Lectura recomendada:**
- [USER_FLOWS.md](USER_FLOWS.md) - Para entender flujos de negocio
- [ROADMAP.md](ROADMAP.md) - Plan de Fase 2-3

### 📱 Desarrollador Mobile (Fase 4)

**Lectura esencial:**
1. [ARCHITECTURE.md](ARCHITECTURE.md) - Sección 3 y 4 (Mobile + Comunicación)
2. [USER_FLOWS.md](USER_FLOWS.md) - Flujo de app móvil
3. [REQUIREMENTS.md](REQUIREMENTS.md) - Requerimientos Fase 4

**Lectura recomendada:**
- [ROADMAP.md](ROADMAP.md) - Plan de Fase 4

### 🎨 Diseñador UI/UX

**Lectura esencial:**
1. [USER_FLOWS.md](USER_FLOWS.md) - Todos los flujos
2. [REQUIREMENTS.md](REQUIREMENTS.md) - Características del sistema
3. [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) - Visión general

**Lectura recomendada:**
- [ROADMAP.md](ROADMAP.md) - Para entender qué se implementa cuándo

### 👔 Product Manager / Stakeholder

**Lectura esencial:**
1. [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) - Resumen completo
2. [ROADMAP.md](ROADMAP.md) - Plan y cronograma
3. [README.md](../README.md) - Estado actual

**Lectura opcional:**
- [REQUIREMENTS.md](REQUIREMENTS.md) - Detalles técnicos

---

## 🗂️ Organización de la Documentación

```
docs/
├── INDEX.md                  # 📚 Este archivo (índice general)
├── EXECUTIVE_SUMMARY.md      # 📊 Resumen ejecutivo
├── REQUIREMENTS.md           # 📋 Requerimientos completos
├── DATABASE_SCHEMA.md        # 🗄️ Diagrama de base de datos
├── USER_FLOWS.md             # 🔄 Diagramas de flujo
├── ARCHITECTURE.md           # 🏗️ Arquitectura del sistema
├── ROADMAP.md                # 🗺️ Plan de desarrollo
└── PRODUCT_SYSTEM.md         # 📦 Sistema de productos y personalización

../README.md                  # 🏠 README principal del proyecto
```

---

## 📝 Convenciones de la Documentación

### Iconos utilizados
- ✅ Completado
- 🟡 En progreso
- ⚪ Pendiente
- ❌ No aplica / Deshabilitado
- 🔜 Próximamente
- 📍 Fase actual
- 🚀 Feature destacada
- ⚠️ Advertencia
- 💡 Tip / Recomendación

### Estados de Fase
- **✅ Completada**: Toda la fase está terminada
- **🟡 En curso**: Fase activa actualmente
- **⚪ Pendiente**: Fase no iniciada

### Formato de Requerimientos
- **RF-XXX**: Requerimiento Funcional
- **RNF-XXX**: Requerimiento No Funcional

---

## 🔄 Mantenimiento de la Documentación

### Responsabilidad
Mantener la documentación actualizada es responsabilidad de todo el equipo.

### Cuándo actualizar

| Evento | Documentos a actualizar |
|--------|------------------------|
| Nueva feature completada | ROADMAP.md (marcar checklist), README.md (progreso) |
| Cambio en arquitectura | ARCHITECTURE.md |
| Nuevo requerimiento | REQUIREMENTS.md |
| Cambio en flujo de usuario | USER_FLOWS.md |
| Cambio en base de datos | DATABASE_SCHEMA.md |
| Nueva fase iniciada | Todos los documentos (actualizar estado) |

### Versionado
Todos los documentos incluyen al final:
```
Última actualización: YYYY-MM-DD
Versión: X.Y
```

**Incrementar versión:**
- **X (major)**: Cambios significativos en el proyecto
- **Y (minor)**: Actualizaciones menores, correcciones

---

## 📞 Ayuda

Si no encuentras lo que buscas:
1. Usa la búsqueda de tu editor (Ctrl+F / Cmd+F)
2. Revisa este índice nuevamente
3. Lee el [Resumen Ejecutivo](EXECUTIVE_SUMMARY.md) para contexto
4. Consulta con el equipo

---

**Última actualización:** 2025-11-22
**Versión:** 1.0
