import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// Identificador único de cada build. Se inyecta en el código (__BUILD_ID__) y
// se escribe en /build-id.txt; el cliente compara ambos para detectar cuando
// hay una versión nueva desplegada y recargar automáticamente (evita que el
// móvil quede con un bundle viejo en caché).
const buildId = Date.now().toString()

function buildIdPlugin(): Plugin {
  return {
    name: 'build-id',
    writeBundle(options) {
      const dir = options.dir || 'dist'
      writeFileSync(resolve(dir, 'build-id.txt'), buildId)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react(), buildIdPlugin()],
  server: {
    host: true, // Permite acceso desde la red local
    port: 5174,
    allowedHosts: true, // Permite acceso desde cualquier host (incluyendo IP local)
    // Las imágenes subidas (/uploads) se sirven desde la API. El proxy las
    // hace aparecer en el mismo origen que el frontend, para que el
    // personalizador pueda procesarlas en <canvas> sin problemas de CORS.
    proxy: {
      '/uploads': {
        target: 'http://api:8000',
        changeOrigin: true,
      },
    },
    watch: {
      // Usar polling para Docker en Windows (detecta cambios de archivos)
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      // Hot Module Replacement
      overlay: true,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'icons': ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  base: '/',
})
