# 🌐 Web - React Application

Aplicación web principal del proyecto Marketplace de Ropa Personalizada.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview
```

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── layout/         # Header, Footer, Layout
│   ├── home/           # Componentes de página principal
│   ├── catalog/        # Componentes de catálogo
│   ├── product/        # Componentes de producto
│   ├── customizer/     # Personalizador (Semana 3)
│   ├── cart/           # Carrito (Semana 4)
│   ├── admin/          # Panel admin (Semana 4)
│   └── shared/         # Button, Input, Modal, Toast, Loading
│
├── pages/              # Páginas principales
│   ├── HomePage.tsx
│   ├── CatalogPage.tsx
│   ├── CustomizerPage.tsx
│   ├── CartPage.tsx
│   ├── AdminPage.tsx
│   └── NotFoundPage.tsx
│
├── context/            # Context API (estado global)
├── hooks/              # Custom hooks
├── services/           # Servicios (API, canvas, storage)
├── utils/              # Utilidades
├── types/              # TypeScript types
├── data/               # Datos iniciales
└── styles/             # Estilos adicionales
```

## 🛠️ Stack Tecnológico

- **React 18** - Framework UI
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router v6** - Routing
- **Tailwind CSS** - Estilos
- **lucide-react** - Iconos
- **Context API** - Estado global

## 📋 Estado Actual

### ✅ Completado (Semana 1)
- [x] Setup del proyecto con Vite
- [x] Configuración de Tailwind CSS
- [x] Configuración de ESLint + Prettier
- [x] React Router configurado
- [x] Estructura de carpetas completa
- [x] Variables de entorno
- [x] Componentes base (Layout, Header, Footer)
- [x] Sistema de rutas
- [x] Componentes compartidos (Button, Input, Modal, Toast, Loading)
- [x] HomePage con diseño completo

### 🟡 En Progreso (Semana 2)
- [ ] Tipos TypeScript
- [ ] Datos iniciales de productos
- [ ] Context de productos
- [ ] Página de catálogo completa

### ⚪ Pendiente
- Semana 3: Personalizador
- Semana 4: Carrito + Admin

## 🌐 Rutas Disponibles

| Ruta | Página | Estado |
|------|--------|--------|
| `/` | HomePage | ✅ Completada |
| `/catalog` | CatalogPage | 🟡 Placeholder |
| `/customize` | CustomizerPage | 🟡 Placeholder |
| `/cart` | CartPage | 🟡 Placeholder |
| `/admin-panel` | AdminPage | 🟡 Placeholder |
| `/*` | NotFoundPage | ✅ Completada |

## 🎨 Componentes Compartidos

### Button
```typescript
<Button variant="primary" size="md" isLoading={false}>
  Click me
</Button>
```

Variants: `primary`, `secondary`, `outline`, `danger`
Sizes: `sm`, `md`, `lg`

### Input
```typescript
<Input
  label="Email"
  type="email"
  error="Email inválido"
  helperText="Ingresa tu email"
/>
```

### Modal
```typescript
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Título del Modal"
  size="md"
>
  Contenido del modal
</Modal>
```

### Toast
```typescript
<Toast
  message="Operación exitosa"
  type="success"
  onClose={() => {}}
/>
```

Types: `success`, `error`, `warning`, `info`

### Loading
```typescript
<Loading size="md" fullScreen={false} text="Cargando..." />
```

## 📦 Scripts Disponibles

```bash
npm run dev          # Servidor de desarrollo (http://localhost:5173)
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint         # Verificar código
```

## 🔧 Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
VITE_API_URL=http://localhost:3000/api
VITE_APP_ENV=development
```

## 📝 Convenciones de Código

- **Componentes**: PascalCase (ej: `HomePage.tsx`)
- **Archivos**: camelCase (ej: `useCart.ts`)
- **CSS**: Tailwind classes (evitar CSS custom)
- **Imports**: Organizados (React → Libs → Components → Utils)

## 🚧 Próximos Pasos

Revisar [docs/ROADMAP.md](../docs/ROADMAP.md) para el plan completo de desarrollo.

---

**Última actualización:** 2025-11-22
**Fase actual:** Semana 1 completada ✅
