const BASE = import.meta.env.VITE_API_URL ?? '/api';

/**
 * Access token só em memória (não em localStorage: mitiga roubo via XSS).
 * A sessão persiste pelo refresh token em cookie httpOnly, renovado automaticamente.
 */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export const session = {
  set: (t: string | null) => { accessToken = t; },
  has: () => !!accessToken,
  onLost: (fn: () => void) => { onSessionLost = fn; },
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public feature?: string) { super(message); }
}

export async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (r) => {
      if (!r.ok) { accessToken = null; return false; }
      accessToken = (await r.json()).accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; retry?: boolean } = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    credentials: 'include',
    headers: {
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && accessToken && opts.retry !== false && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
    onSessionLost?.();
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new ApiError(msg ?? `Erro ${res.status}`, res.status, data?.code, data?.feature);
  }
  return data as T;
}

export const isPlanError = (e: unknown): e is ApiError => e instanceof ApiError && e.code === 'PLAN_REQUIRED';

export interface Topic { id: number; name: string; subjectId: number }
export interface Subject { id: number; name: string; topics: Topic[] }
export interface Alternative { key: string; text: string }
export interface Question {
  id: number; statement: string; alternatives: Alternative[]; topic: Topic;
  institution?: string; year?: number; difficulty: string; correctKey?: string; commentary?: string;
}
export interface User { id: string; name: string; email: string; role: 'student' | 'admin'; university?: string; semester?: number }
