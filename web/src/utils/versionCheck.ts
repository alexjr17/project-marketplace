// Detecta cuándo hay una versión nueva desplegada y recarga automáticamente.
// Evita que el navegador (sobre todo en móvil) se quede con un bundle viejo en
// caché. El build actual conoce su __BUILD_ID__ (inyectado por Vite) y lo
// compara contra /build-id.txt del servidor, que siempre refleja la última
// versión.

declare const __BUILD_ID__: string;

const CURRENT_BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '';
const RELOAD_GUARD_KEY = 'app-reloaded-for-build';

let checking = false;

async function checkForUpdate(): Promise<void> {
  if (!CURRENT_BUILD_ID || checking) return;
  checking = true;
  try {
    const res = await fetch(`/build-id.txt?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const remote = (await res.text()).trim();
    if (!remote || remote === CURRENT_BUILD_ID) return;

    // Hay una versión nueva. Recargar una sola vez por versión para evitar
    // bucles si algo quedara desincronizado.
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) === remote) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, remote);
    window.location.reload();
  } catch {
    // Sin red o sin archivo (deploy anterior): no hacer nada.
  } finally {
    checking = false;
  }
}

export function initVersionCheck(): void {
  if (!CURRENT_BUILD_ID) return;
  // Al abrir (tras un pequeño margen) y cada vez que la pestaña vuelve a estar
  // visible/enfocada (típico al volver al POS en el celular).
  setTimeout(checkForUpdate, 3000);
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}
