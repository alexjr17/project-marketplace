import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initVersionCheck } from './utils/versionCheck'

// Auto-actualización: recarga si hay una versión nueva desplegada (evita
// bundles viejos en caché, sobre todo en móvil).
initVersionCheck()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
