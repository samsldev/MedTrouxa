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
  token: () => accessToken,
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

/** Baixa um arquivo autenticado (o token fica só em memória, então links diretos não funcionariam). */
export async function downloadFile(path: string, fallbackName: string) {
  const go = () => fetch(BASE + path, { credentials: 'include', headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });
  let res = await go();
  if (res.status === 401 && (await refreshSession())) res = await go();
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.message ?? `Erro ${res.status}`, res.status);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CPF (11) ou CNPJ (14) formatado enquanto digita. */
export function formatTaxId(raw: string, type: 'cpf' | 'cnpj') {
  const d = raw.replace(/\D/g, '').slice(0, type === 'cpf' ? 11 : 14);
  return type === 'cpf'
    ? d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
    : d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
