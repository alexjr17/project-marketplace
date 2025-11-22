# 🚀 Guía de Inicio Rápido

## Empezar a Desarrollar el Proyecto

Esta guía te llevará desde cero hasta tener el proyecto corriendo localmente en **menos de 30 minutos**.

---

## ✅ Prerrequisitos

Antes de empezar, asegúrate de tener instalado:

- ✅ **Node.js** 18 o superior → [Descargar](https://nodejs.org/)
- ✅ **npm** o **yarn** (viene con Node.js)
- ✅ **Git** → [Descargar](https://git-scm.com/)
- ✅ **Editor de código** (VS Code recomendado) → [Descargar](https://code.visualstudio.com/)

### Verificar instalación

```bash
node --version   # Debe mostrar v18.x.x o superior
npm --version    # Debe mostrar 9.x.x o superior
git --version    # Debe mostrar 2.x.x o superior
```

---

## 📚 Paso 1: Leer Documentación Esencial (15 min)

Antes de codear, lee estos documentos en orden:

1. **[README.md](README.md)** (5 min)
   - Visión general del proyecto
   - Estado actual

2. **[docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md)** (10 min)
   - Resumen ejecutivo completo
   - Características de Fase 1

**Opcional (si tienes tiempo):**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Estructura del código
- [docs/ROADMAP.md](docs/ROADMAP.md) - Plan de desarrollo

---

## 🏗️ Paso 2: Setup del Proyecto (10 min)

### 2.1 Clonar repositorio (si existe)

```bash
git clone <url-del-repositorio>
cd project-marketplace
```

**O crear desde cero (si no existe repo):**

```bash
# Ya estás en la carpeta project-marketplace
# Solo necesitas crear el proyecto web
```

### 2.2 Crear proyecto Web con Vite

```bash
# Crear proyecto React + TypeScript
npm create vite@latest web -- --template react-ts

# Entrar a la carpeta
cd web

# Instalar dependencias
npm install
```

### 2.3 Instalar Tailwind CSS

```bash
# Instalar Tailwind y sus dependencias
npm install -D tailwindcss postcss autoprefixer

# Inicializar configuración
npx tailwindcss init -p
```

### 2.4 Configurar Tailwind

Edita `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Reemplaza el contenido de `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 2.5 Instalar dependencias adicionales

```bash
# React Router
npm install react-router-dom

# Iconos
npm install lucide-react

# TypeScript types
npm install -D @types/node
```

### 2.6 Configurar ESLint + Prettier (opcional pero recomendado)

```bash
npm install -D prettier eslint-config-prettier eslint-plugin-prettier

# Crear .prettierrc
echo '{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}' > .prettierrc
```

---

## 📁 Paso 3: Crear Estructura de Carpetas (5 min)

Dentro de `web/src/`, crea esta estructura:

```bash
# Desde web/src/
mkdir -p components/{layout,home,catalog,product,customizer,cart,admin,shared}
mkdir -p pages
mkdir -p context
mkdir -p hooks
mkdir -p services
mkdir -p utils
mkdir -p types
mkdir -p data
mkdir -p styles
```

**Estructura completa:**

```
web/src/
├── components/
│   ├── layout/
│   ├── home/
│   ├── catalog/
│   ├── product/
│   ├── customizer/
│   ├── cart/
│   ├── admin/
│   └── shared/
├── pages/
├── context/
├── hooks/
├── services/
├── utils/
├── types/
├── data/
└── styles/
```

---

## 🎯 Paso 4: Primer Componente - Layout (5 min)

### 4.1 Crear `src/components/layout/Header.tsx`

```typescript
export const Header = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">
            🛍️ Mi Tienda Personalizada
          </h1>
          <nav className="flex gap-6">
            <a href="/" className="text-gray-600 hover:text-gray-900">
              Inicio
            </a>
            <a href="/catalog" className="text-gray-600 hover:text-gray-900">
              Catálogo
            </a>
            <a href="/customize" className="text-gray-600 hover:text-gray-900">
              Personalizar
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
};
```

### 4.2 Crear `src/components/layout/Footer.tsx`

```typescript
export const Footer = () => {
  return (
    <footer className="bg-gray-800 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-sm text-gray-400">
            © 2025 Mi Tienda Personalizada. Todos los derechos reservados.
          </p>
          {/* Enlace oculto para admin */}
          <a
            href="/admin"
            className="text-xs text-gray-600 hover:text-gray-400 mt-2 inline-block"
          >
            Admin
          </a>
        </div>
      </div>
    </footer>
  );
};
```

### 4.3 Crear `src/components/layout/Layout.tsx`

```typescript
import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};
```

---

## 📄 Paso 5: Primera Página - Home (5 min)

### 5.1 Crear `src/pages/HomePage.tsx`

```typescript
export const HomePage = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Personaliza tu Ropa
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Crea diseños únicos en camisetas y hoodies
        </p>
        <a
          href="/customize"
          className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 inline-block"
        >
          🎨 Empezar a Personalizar
        </a>
      </div>

      {/* Placeholder para productos destacados */}
      <div className="mt-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">
          Productos Destacados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
            >
              <div className="bg-gray-200 h-48 rounded-md mb-4" />
              <h3 className="text-xl font-semibold mb-2">Producto {i}</h3>
              <p className="text-gray-600 mb-4">Descripción del producto</p>
              <p className="text-2xl font-bold text-blue-600">$29.99</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

---

## 🔧 Paso 6: Configurar Router (5 min)

### 6.1 Actualizar `src/App.tsx`

```typescript
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* Más rutas se agregarán después */}
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
```

---

## ▶️ Paso 7: Ejecutar el Proyecto

```bash
# Desde web/
npm run dev
```

Abre tu navegador en: **http://localhost:5173**

Deberías ver:
- ✅ Header con navegación
- ✅ Hero section con botón "Empezar a Personalizar"
- ✅ 3 cards de productos placeholder
- ✅ Footer con enlace a admin

---

## 🎉 ¡Listo!

Ya tienes la base del proyecto corriendo. Ahora puedes empezar a desarrollar siguiendo el [Roadmap](docs/ROADMAP.md).

---

## 📋 Próximos Pasos

Sigue el [Roadmap - Fase 1](docs/ROADMAP.md#-fase-1-mvp---catálogo--personalizador-sin-pagos) en este orden:

### Semana 1 (días que quedan)
- [ ] Crear más componentes base (Button, Input, Modal, Toast)
- [ ] Crear páginas placeholder (CatalogPage, CustomizerPage, CartPage)
- [ ] Configurar Context API (estructura vacía)

### Semana 2
- [ ] Definir tipos TypeScript
- [ ] Crear datos iniciales de productos
- [ ] Implementar CatalogPage completo
- [ ] Implementar ProductCard

### Semana 3
- [ ] **Migrar tu prototipo del personalizador**
- [ ] Separar en componentes modulares
- [ ] Implementar lógica de canvas

### Semana 4
- [ ] Implementar carrito
- [ ] Implementar panel admin
- [ ] Testing y refinamiento

---

## 🛠️ Comandos Útiles

```bash
# Desarrollo
npm run dev          # Iniciar servidor de desarrollo

# Build
npm run build        # Crear build de producción
npm run preview      # Preview del build

# Linting (si configuraste ESLint)
npm run lint         # Verificar código
npm run lint:fix     # Corregir automáticamente
```

---

## 📁 Estructura Actual del Proyecto

```
project-marketplace/
├── docs/                    # 📚 Documentación completa
│   ├── INDEX.md
│   ├── EXECUTIVE_SUMMARY.md
│   ├── REQUIREMENTS.md
│   ├── DATABASE_SCHEMA.md
│   ├── USER_FLOWS.md
│   ├── ARCHITECTURE.md
│   └── ROADMAP.md
│
├── web/                     # 🌐 Aplicación React (en desarrollo)
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/
│   │   │       ├── Header.tsx
│   │   │       ├── Footer.tsx
│   │   │       └── Layout.tsx
│   │   ├── pages/
│   │   │   └── HomePage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── README.md
└── GETTING_STARTED.md       # Este archivo
```

---

## 💡 Tips para Desarrollar

### 1. Sigue el Roadmap
No te adelantes a features de otras fases. Completa Fase 1 primero.

### 2. Commits Frecuentes
```bash
git add .
git commit -m "feat: add Header and Footer components"
git push
```

### 3. Convención de Commits
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Cambios en documentación
- `style:` Cambios de formato
- `refactor:` Refactorización de código
- `test:` Agregar tests

### 4. Testea Constantemente
- Prueba en Chrome, Firefox, Safari
- Prueba en mobile (responsive)
- Usa DevTools de React

### 5. Consulta la Documentación
Si tienes dudas, revisa:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Estructura del código
- [docs/USER_FLOWS.md](docs/USER_FLOWS.md) - Flujos de usuario
- [docs/INDEX.md](docs/INDEX.md) - Índice de toda la documentación

---

## 🆘 Solución de Problemas

### Error: "Cannot find module"
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

### Error: Tailwind no funciona
```bash
# Verificar que tailwind.config.js tenga el content correcto
# Verificar que index.css tenga las directivas @tailwind
```

### Servidor no inicia
```bash
# Verificar que el puerto 5173 no esté en uso
# Cambiar puerto en vite.config.ts si es necesario
```

---

## 📞 Ayuda

Si te atascas:
1. Lee la documentación en [docs/](docs/)
2. Revisa el [Roadmap](docs/ROADMAP.md) para ver qué sigue
3. Consulta [docs/INDEX.md](docs/INDEX.md) para encontrar info específica

---

## ✅ Checklist de Setup Completo

- [ ] Node.js 18+ instalado
- [ ] Proyecto Vite creado
- [ ] Tailwind CSS configurado
- [ ] React Router instalado
- [ ] Estructura de carpetas creada
- [ ] Layout components creados (Header, Footer, Layout)
- [ ] HomePage creada
- [ ] App.tsx con Router configurado
- [ ] Servidor de desarrollo corriendo
- [ ] Página visible en http://localhost:5173

**Si marcaste todos, ¡estás listo para desarrollar! 🚀**

---

**Última actualización:** 2025-11-22
**Versión:** 1.0
