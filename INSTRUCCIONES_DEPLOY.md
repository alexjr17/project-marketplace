# 🚀 Instrucciones para Desplegar a Vercel

## Estado Actual

✅ **Build exitoso** - El proyecto compila correctamente
✅ **Archivos de configuración creados** - vercel.json y .vercelignore
✅ **Optimización aplicada** - Build optimizado con code splitting

---

## Opción 1: Deploy con Vercel CLI (MÁS RÁPIDO)

### Paso 1: Verificar instalación de Vercel CLI

```bash
vercel --version
```

Si no está instalado:
```bash
npm install -g vercel
```

### Paso 2: Login en Vercel

```bash
vercel login
```

Selecciona tu método preferido:
- GitHub
- GitLab
- Bitbucket
- Email

### Paso 3: Deploy (Preview)

Desde la raíz del proyecto:

```bash
vercel
```

Responde las preguntas:
- **Set up and deploy "~/project-marketplace"?** `Y`
- **Which scope do you want to deploy to?** [Tu cuenta personal]
- **Link to existing project?** `N`
- **What's your project's name?** `marketplace-personalizacion`
- **In which directory is your code located?** `web`

Vercel detectará automáticamente que es un proyecto Vite.

### Paso 4: Deploy a Producción

```bash
vercel --prod
```

¡Listo! Te dará una URL tipo: `https://marketplace-personalizacion.vercel.app`

---

## Opción 2: Deploy desde GitHub (RECOMENDADO)

### Paso 1: Asegúrate que el código esté en GitHub

```bash
git status
git add .
git commit -m "chore: prepare for Vercel deployment"
git push origin main
```

### Paso 2: Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Haz clic en **"Sign Up"** o **"Log In"**
3. Selecciona **"Continue with GitHub"**
4. Autoriza Vercel

### Paso 3: Importar Proyecto

1. En el dashboard, clic en **"Add New..."** → **"Project"**
2. Busca tu repositorio **"project-marketplace"**
3. Clic en **"Import"**

### Paso 4: Configurar Proyecto

Vercel detectará automáticamente la configuración, pero verifica:

```
Framework Preset: Vite
Root Directory: web
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### Paso 5: Deploy

1. Clic en **"Deploy"**
2. Espera 1-2 minutos
3. ¡Listo! Tu sitio estará en vivo

---

## Variables de Entorno (Si las necesitas después)

En el dashboard de Vercel:
1. Ve a **Project Settings** → **Environment Variables**
2. Agrega las variables basadas en `.env.example`
3. Redeploy el proyecto

---

## URLs que Obtendrás

Vercel te dará 2 tipos de URLs:

1. **URL de Producción**: `https://marketplace-personalizacion.vercel.app`
   - Esta es tu URL principal
   - Se actualiza con cada deploy a producción

2. **URL de Preview**: `https://marketplace-personalizacion-[hash].vercel.app`
   - Se genera automáticamente en cada push/PR
   - Útil para testing

---

## Ventajas del Deploy

✅ **HTTPS automático** - Certificado SSL gratis
✅ **CDN Global** - Tu sitio será rápido en todo el mundo
✅ **Deploy automático** - Cada push a main despliega automáticamente
✅ **Preview Deployments** - Cada PR tiene su propia URL de preview
✅ **Rollback fácil** - Puedes volver a versiones anteriores con 1 clic
✅ **Sin costo** - Plan gratuito sin límite de tiempo
✅ **Analytics** - Métricas básicas incluidas

---

## Verificar que Todo Funcione

Después del deploy, prueba:

- [ ] Página principal carga
- [ ] Navegación entre páginas
- [ ] Personalizador funciona
- [ ] Subir imágenes funciona
- [ ] Carrito funciona
- [ ] localStorage persiste
- [ ] Responsive en mobile

---

## Comandos Útiles Vercel CLI

```bash
# Ver logs en tiempo real
vercel logs

# Listar deployments
vercel ls

# Ver dominios
vercel domains ls

# Abrir proyecto en Vercel
vercel

# Deploy preview
vercel

# Deploy producción
vercel --prod

# Remover deployment
vercel remove [deployment-url]
```

---

## Troubleshooting

### "Build Failed"
- Verifica que `npm run build` funcione localmente
- Revisa los logs en Vercel
- Asegúrate que todas las dependencias estén en `package.json`

### "404 on routes"
- Verifica que `vercel.json` esté en la raíz del proyecto
- Asegúrate que las rutas estén configuradas correctamente

### "Cannot find module"
- Limpia y reinstala: `rm -rf node_modules package-lock.json && npm install`
- Intenta build local nuevamente

---

## Próximos Pasos Después del Deploy

1. **Compartir URL** con usuarios para obtener feedback
2. **Agregar dominio personalizado** (opcional)
   - Project Settings → Domains → Add Domain
3. **Configurar Analytics**
   - Project Settings → Analytics → Enable
4. **Configurar GitHub Auto-Deploy**
   - Ya está configurado automáticamente si usaste GitHub

---

## Alternativas si Vercel no Funciona

### Netlify (Muy similar a Vercel)
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=web/dist
```

### Railway (Más complejo pero poderoso)
- Conecta GitHub
- Selecciona repo
- Deploy automático

### GitHub Pages (Solo sitios estáticos)
```bash
npm install -g gh-pages
npm run build
gh-pages -d web/dist
```

---

## Contacto y Soporte

- **Documentación Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)
- **Discord**: [vercel.com/discord](https://vercel.com/discord)

---

**¡Buena suerte con el deploy!** 🚀

---

**Última actualización:** 2025-11-22
