# 🚀 Guía de Deployment a Vercel

## Prerequisitos

- Cuenta en GitHub (el código ya está en un repositorio)
- Cuenta en Vercel (gratuita, sin necesidad de tarjeta de crédito)

---

## Opción 1: Deploy con Vercel CLI (Recomendado para testing rápido)

### Paso 1: Instalar Vercel CLI

```bash
npm install -g vercel
```

### Paso 2: Login en Vercel

```bash
vercel login
```

### Paso 3: Deploy desde la raíz del proyecto

```bash
vercel
```

Sigue las instrucciones en pantalla:
- Set up and deploy? **Yes**
- Which scope? **Tu cuenta personal**
- Link to existing project? **No**
- Project name? **marketplace-personalizacion** (o el nombre que prefieras)
- In which directory is your code located? **web**

### Paso 4: Deploy a producción

```bash
vercel --prod
```

---

## Opción 2: Deploy desde GitHub (Recomendado para producción)

### Paso 1: Push del código a GitHub

```bash
git push origin main
```

### Paso 2: Crear cuenta en Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Haz clic en "Sign Up"
3. Selecciona "Continue with GitHub"
4. Autoriza Vercel para acceder a tu repositorio

### Paso 3: Importar el proyecto

1. En el dashboard de Vercel, haz clic en "Add New Project"
2. Selecciona el repositorio del marketplace
3. Configura el proyecto:

   **Framework Preset:** Vite

   **Root Directory:** `web`

   **Build Command:** `npm run build`

   **Output Directory:** `dist`

   **Install Command:** `npm install`

4. Haz clic en "Deploy"

### Paso 4: Configurar dominio (Opcional)

Vercel te dará un dominio gratuito tipo: `tu-proyecto.vercel.app`

Puedes agregar un dominio personalizado en:
- Project Settings → Domains

---

## Variables de Entorno en Vercel

Si necesitas agregar variables de entorno:

1. Ve a Project Settings → Environment Variables
2. Agrega las variables necesarias (basadas en `.env.example`)
3. Redeploy el proyecto

---

## Comandos Útiles

```bash
# Deploy preview (testing)
vercel

# Deploy a producción
vercel --prod

# Ver logs en tiempo real
vercel logs

# Ver lista de deployments
vercel ls

# Abrir dashboard del proyecto
vercel
```

---

## Configuración Automática

El proyecto ya incluye:

- ✅ `vercel.json` - Configuración de rutas y build
- ✅ `.vercelignore` - Archivos a ignorar
- ✅ `web/vite.config.ts` - Optimización de build
- ✅ `web/.env.example` - Plantilla de variables

---

## Características del Plan Gratuito de Vercel

- ✅ **Deployments ilimitados**
- ✅ **100 GB de ancho de banda por mes**
- ✅ **HTTPS automático**
- ✅ **CDN global**
- ✅ **Preview deployments** para cada push
- ✅ **Sin límite de tiempo** (no caduca después de 1 mes)
- ✅ **Analytics básicos**

---

## Alternativas Gratuitas

Si prefieres otras plataformas:

### Netlify
```bash
npm install -g netlify-cli
cd web
netlify deploy --prod
```

### Railway
- Conecta tu repositorio de GitHub
- Selecciona "Deploy from GitHub"
- Configura el directorio `web`

### Render
- Similar a Railway
- Auto-deploy desde GitHub

---

## Verificar el Deploy

Después del deploy, visita la URL proporcionada y verifica:

- ✅ Página principal carga correctamente
- ✅ Navegación entre páginas funciona
- ✅ Imágenes y assets cargan
- ✅ Personalizador funciona
- ✅ Carrito persiste en localStorage
- ✅ Responsive design en mobile

---

## Troubleshooting

### Error: "404 Not Found" en rutas

**Solución:** Asegúrate que `vercel.json` tiene las rutas configuradas correctamente.

### Error: "Build failed"

**Solución:**
1. Verifica que el build funciona localmente: `npm run build`
2. Revisa los logs del build en Vercel
3. Asegúrate que todas las dependencias están en `package.json`

### Error: "Cannot find module"

**Solución:**
1. Limpia node_modules: `rm -rf node_modules package-lock.json`
2. Reinstala: `npm install`
3. Intenta build local nuevamente

---

## Próximos Pasos Después del Deploy

1. **Probar en diferentes dispositivos** - Mobile, tablet, desktop
2. **Compartir la URL** con usuarios para feedback
3. **Configurar analytics** (Google Analytics, Vercel Analytics)
4. **Agregar dominio personalizado** (opcional)
5. **Configurar CI/CD** - Deploy automático en cada push a main

---

## Soporte

- **Documentación Vercel:** [vercel.com/docs](https://vercel.com/docs)
- **Community:** [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)

---

**Última actualización:** 2025-11-22
