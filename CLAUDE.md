# Vexa Marketplace

Laravel 12 (api/) + React 19 / TypeScript / Tailwind 3 (web/). Se levanta con `docker compose up -d` (front :5173, API :8000, MariaDB :3307).

## Vistas
- El estándar de diseño de este proyecto es **`web/DESIGN_SYSTEM.md`** con el kit `web/src/components/ui`. Reemplaza al estándar Bootstrap/jQuery de la skill `diseno-vistas`, que no aplica a este front.
- Cada app (Tienda, Administración, POS, Social, Fábrica) tiene su color configurable. En las vistas el acento se escribe con las clases `app-*`, nunca con un color fijo.
- La navegación del panel de Administración vive en `web/src/components/admin/adminNav.ts`.
- Referencia viva de los componentes: `/admin-panel/settings/design-system`.

## Backend
- Las capas de la skill `arquitectura-capas` se traducen así en Laravel: Route (con middleware `permission:`) → Controller (valida y responde) → Service en `app/Services` (reglas de negocio y transacciones) → Model Eloquent. Lo nuevo va en su capa aunque el módulo viejo lo tenga todo en el controlador.
- Cambios de base de datos: migraciones de Laravel en `api/database/migrations`.
