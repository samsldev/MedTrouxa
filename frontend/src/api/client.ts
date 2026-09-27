const BASE = import.meta.env.VITE_API_URL ?? '/api';

export const tokenStore = {
  get: () => localStorage.getItem('mt_token'),
  set: (t: string) => localStorage.setItem('mt_token', t),
  clear: () => localStorage.removeItem('mt_token'),
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(BASE + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && token) {
    tokenStore.clear();
    location.href = '/login';
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(msg ?? `Erro ${res.status}`);
  }
  return data as T;
}

export interface Topic { id: number; name: string; subjectId: number }
export interface Subject { id: number; name: string; topics: Topic[] }
export interface Alternative { key: string; text: string }
export interface Question {
  id: number; statement: string; alternatives: Alternative[]; topic: Topic;
  institution?: string; year?: number; difficulty: string; correctKey?: string; commentary?: string;
}
export interface User { id: string; name: string; email: string; role: 'student' | 'admin'; university?: string; semester?: number }
