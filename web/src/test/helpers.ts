import { HttpResponse } from 'msw';

/** Sobre estándar de la API Laravel (api/app/Http/Concerns/ApiResponse.php). */
export const ok = <T,>(data?: T, message?: string, extra: Record<string, unknown> = {}, status = 200) =>
  HttpResponse.json(
    { success: true, ...(message !== undefined ? { message } : {}), ...(data !== undefined ? { data } : {}), ...extra },
    { status },
  );

export const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
  HttpResponse.json({ success: false, message, ...extra }, { status });

/** Guarda una sesión como lo hace authService.login. */
export const setSession = (token = 'tok-123', user: Record<string, unknown> = { id: 1, name: 'Ana' }) =>
  localStorage.setItem('marketplace_auth', JSON.stringify({ token, user }));
