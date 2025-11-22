# 🎨 Sistema de Diseño - Tienda Personalizada

## Concepto y Personalidad

**Identidad:** Creativo, Juvenil, Moderno, Divertido, Accesible
**Valores:** Expresión Personal, Creatividad, Calidad, Innovación
**Tono:** Cercano, Inspirador, Energético

---

## 🌈 Paleta de Colores

### Colores Principales

```css
/* Violeta Creativo - Color Principal */
--primary: #8B5CF6       /* violet-500 */
--primary-dark: #7C3AED  /* violet-600 */
--primary-light: #A78BFA /* violet-400 */

/* Rosa Vibrante - Color Secundario */
--secondary: #EC4899     /* pink-500 */
--secondary-dark: #DB2777 /* pink-600 */
--secondary-light: #F472B6 /* pink-400 */

/* Naranja Energético - Acento */
--accent: #F59E0B        /* amber-500 */
--accent-dark: #D97706   /* amber-600 */
--accent-light: #FBBF24  /* amber-400 */
```

### Colores de Estado

```css
/* Éxito */
--success: #10B981       /* emerald-500 */

/* Error */
--error: #EF4444         /* red-500 */

/* Advertencia */
--warning: #F59E0B       /* amber-500 */

/* Info */
--info: #3B82F6          /* blue-500 */
```

### Colores Neutrales

```css
/* Grises */
--gray-50: #F9FAFB
--gray-100: #F3F4F6
--gray-200: #E5E7EB
--gray-300: #D1D5DB
--gray-400: #9CA3AF
--gray-500: #6B7280
--gray-600: #4B5563
--gray-700: #374151
--gray-800: #1F2937
--gray-900: #111827

/* Blanco y Negro */
--white: #FFFFFF
--black: #000000
```

### Fondos

```css
--bg-primary: #FFFFFF
--bg-secondary: #F9FAFB    /* gray-50 */
--bg-tertiary: #F3F4F6     /* gray-100 */
--bg-dark: #1F2937         /* gray-800 */
```

---

## 🎭 Gradientes Característicos

### Gradiente Principal (Violeta → Rosa)
```css
background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
```
**Uso:** CTAs principales, headers importantes, elementos destacados

### Gradiente Energético (Rosa → Naranja)
```css
background: linear-gradient(135deg, #EC4899 0%, #F59E0B 100%);
```
**Uso:** Promociones, ofertas especiales, elementos de atención

### Gradiente Suave (Violeta claro → Rosa claro)
```css
background: linear-gradient(135deg, #A78BFA 0%, #F472B6 100%);
```
**Uso:** Fondos de secciones, cards destacadas

### Gradiente Creativo (Multi-color)
```css
background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F59E0B 100%);
```
**Uso:** Elementos premium, banners especiales

---

## ✍️ Tipografía

### Fuentes

```css
/* Primaria - Sans Serif moderna */
font-family: 'Inter', system-ui, -apple-system, sans-serif;

/* Secundaria - Para títulos */
font-family: 'Poppins', 'Inter', sans-serif;

/* Monospace - Para código/precios */
font-family: 'JetBrains Mono', 'Courier New', monospace;
```

### Escala Tipográfica

```css
/* Display (Títulos muy grandes) */
--text-display: 4rem / 64px      /* text-6xl */
--text-display-sm: 3.75rem / 60px /* text-5xl */

/* Títulos */
--text-h1: 3rem / 48px           /* text-5xl */
--text-h2: 2.25rem / 36px        /* text-4xl */
--text-h3: 1.875rem / 30px       /* text-3xl */
--text-h4: 1.5rem / 24px         /* text-2xl */
--text-h5: 1.25rem / 20px        /* text-xl */

/* Cuerpo */
--text-lg: 1.125rem / 18px       /* text-lg */
--text-base: 1rem / 16px         /* text-base */
--text-sm: 0.875rem / 14px       /* text-sm */
--text-xs: 0.75rem / 12px        /* text-xs */
```

### Pesos

```css
--font-light: 300
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
--font-extrabold: 800
```

---

## 📏 Espaciado

### Sistema de Espaciado (basado en 4px)

```css
--space-1: 0.25rem / 4px
--space-2: 0.5rem / 8px
--space-3: 0.75rem / 12px
--space-4: 1rem / 16px
--space-5: 1.25rem / 20px
--space-6: 1.5rem / 24px
--space-8: 2rem / 32px
--space-10: 2.5rem / 40px
--space-12: 3rem / 48px
--space-16: 4rem / 64px
--space-20: 5rem / 80px
--space-24: 6rem / 96px
```

### Layout

```css
/* Contenedores */
--container-sm: 640px
--container-md: 768px
--container-lg: 1024px
--container-xl: 1280px
--container-2xl: 1536px

/* Padding de secciones */
--section-padding-sm: 2rem / 32px
--section-padding-md: 4rem / 64px
--section-padding-lg: 6rem / 96px
```

---

## 🎪 Bordes y Sombras

### Radios de Borde

```css
--radius-sm: 0.375rem / 6px      /* rounded-md */
--radius-md: 0.5rem / 8px        /* rounded-lg */
--radius-lg: 0.75rem / 12px      /* rounded-xl */
--radius-xl: 1rem / 16px         /* rounded-2xl */
--radius-full: 9999px            /* rounded-full */
```

### Sombras

```css
/* Sombra Suave */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)

/* Sombra Normal */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
             0 2px 4px -1px rgba(0, 0, 0, 0.06)

/* Sombra Grande */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
             0 4px 6px -2px rgba(0, 0, 0, 0.05)

/* Sombra Extra Grande */
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
             0 10px 10px -5px rgba(0, 0, 0, 0.04)

/* Sombra Colorida (para elementos creativos) */
--shadow-violet: 0 10px 25px -5px rgba(139, 92, 246, 0.3)
--shadow-pink: 0 10px 25px -5px rgba(236, 72, 153, 0.3)
--shadow-gradient: 0 10px 25px -5px rgba(139, 92, 246, 0.2),
                   0 10px 25px -5px rgba(236, 72, 153, 0.2)
```

---

## 🎨 Componentes Base

### Botones

#### Variantes

**Primary (Violeta con gradiente)**
```css
bg-gradient-to-r from-violet-500 to-pink-500
text-white font-semibold
rounded-lg px-6 py-3
hover:from-violet-600 hover:to-pink-600
shadow-lg shadow-violet-500/50
```

**Secondary (Rosa)**
```css
bg-pink-500 text-white font-semibold
rounded-lg px-6 py-3
hover:bg-pink-600
shadow-md
```

**Outline (Borde violeta)**
```css
border-2 border-violet-500 text-violet-700
bg-white font-semibold
rounded-lg px-6 py-3
hover:bg-violet-50
```

**Ghost (Transparente)**
```css
text-violet-700 font-semibold
rounded-lg px-6 py-3
hover:bg-violet-50
```

#### Tamaños

```css
sm: px-4 py-2 text-sm
md: px-6 py-3 text-base
lg: px-8 py-4 text-lg
xl: px-10 py-5 text-xl
```

### Cards

**Card Estándar**
```css
bg-white rounded-xl shadow-md
border border-gray-100
p-6
hover:shadow-lg transition-shadow
```

**Card Destacada (con gradiente sutil)**
```css
bg-gradient-to-br from-violet-50 to-pink-50
rounded-xl shadow-md
border border-violet-100
p-6
hover:shadow-xl hover:shadow-violet-500/20
```

**Card Producto**
```css
bg-white rounded-2xl shadow-md
overflow-hidden
transition-all duration-300
hover:shadow-xl hover:scale-105
```

### Inputs

```css
border-2 border-gray-300
rounded-lg px-4 py-2
focus:border-violet-500 focus:ring-2 focus:ring-violet-200
transition-all
```

### Badges

```css
/* Badge Violeta */
bg-violet-100 text-violet-700
px-3 py-1 rounded-full text-sm font-medium

/* Badge Rosa */
bg-pink-100 text-pink-700
px-3 py-1 rounded-full text-sm font-medium

/* Badge Gradiente */
bg-gradient-to-r from-violet-500 to-pink-500
text-white px-3 py-1 rounded-full text-sm font-semibold
```

---

## 🎭 Efectos y Animaciones

### Transiciones

```css
/* Rápida */
transition-all duration-150 ease-in-out

/* Normal */
transition-all duration-300 ease-in-out

/* Lenta */
transition-all duration-500 ease-in-out
```

### Hover Effects

```css
/* Elevación */
hover:scale-105 transition-transform

/* Brillo */
hover:brightness-110 transition-all

/* Sombra */
hover:shadow-xl hover:shadow-violet-500/30

/* Gradiente animado */
bg-gradient-to-r from-violet-500 to-pink-500
hover:from-violet-600 hover:to-pink-600
transition-all duration-300
```

### Animaciones Personalizadas

```css
/* Pulse suave */
@keyframes pulse-soft {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Slide from right */
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Fade in up */
@keyframes fade-in-up {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

---

## 📐 Iconos

### Estilo

```css
/* Tamaños */
icon-sm: w-4 h-4 (16px)
icon-md: w-5 h-5 (20px)
icon-lg: w-6 h-6 (24px)
icon-xl: w-8 h-8 (32px)

/* Color */
text-violet-600 (principal)
text-pink-600 (secundario)
text-gray-600 (neutro)
```

---

## 🎪 Patrones Visuales

### Fondos Decorativos

**Patrón de Puntos**
```css
background-image: radial-gradient(circle, #8B5CF6 1px, transparent 1px);
background-size: 20px 20px;
opacity: 0.1;
```

**Gradiente Mesh (fondo moderno)**
```css
background:
  radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.1) 0, transparent 50%),
  radial-gradient(at 100% 100%, rgba(236, 72, 153, 0.1) 0, transparent 50%);
```

---

## 🎨 Uso por Secciones

### Header/Navbar
- Fondo: blanco con sombra suave
- Bordes: sin borde o borde inferior gris muy claro
- Texto: gris oscuro
- Links hover: violeta

### Hero Section
- Fondo: gradiente suave violeta-rosa o blanco
- Títulos: muy grandes, bold, gradiente en texto
- CTAs: botón primario con gradiente

### Catálogo/Grid
- Fondo: gris muy claro (gray-50)
- Cards: blancas con sombra
- Hover: elevación y sombra colorida

### Footer
- Fondo: gris oscuro (gray-800)
- Texto: gris claro
- Links: violeta claro

---

**Última actualización:** 2025-11-22
**Versión:** 1.0
