import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
