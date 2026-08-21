import { isAuthUser, type AuthUser } from '../server/types';

export type { AuthUser };

let redirectingToLogin = false;

export function clearSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function redirectToLogin(): void {
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  clearSession();
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 || res.status === 403) {
    redirectToLogin();
  }
  return res;
}

export async function readApiError(res: Response, fallback = 'Ошибка запроса'): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error: unknown }).error;
      if (typeof message === 'string' && message.trim()) return message;
    }
  } catch {
    // тело ответа не JSON
  }
  return fallback;
}
