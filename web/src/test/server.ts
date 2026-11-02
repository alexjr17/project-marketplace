import { setupServer } from 'msw/node';

/** URL base de la API en las pruebas (ver `test.env` en vite.config.ts). */
export const API = 'http://api.test/api';
export const API_ORIGIN = 'http://api.test';

/** Servidor MSW compartido. Cada prueba registra sus handlers con `server.use(...)`. */
export const server = setupServer();
