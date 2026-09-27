import Constants from 'expo-constants';
import { API_URL } from './config';
import { secure } from './secure';

const RT_KEY = 'mt.refresh';
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** Access token (15 min) só em memória; o refresh token (rotativo) fica no Keychain/Keystore. */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

/** Recurso fora do plano: no app a mensagem é neutra (sem oferta de compra, conforme as regras das lojas). */
export const PLAN_LOCKED_MESSAGE = 'Este recurso não está incluído no seu plano atual.';
export const isPlanError = (e: unknown): e is ApiError => e instanceof ApiError && e.code === 'PLAN_REQUIRED';

const baseHeaders = () => ({ 'x-client': 'mobile', 'x-app-version': APP_VERSION, accept: 'application/json' });

export const session = {
  onLost(fn: () => void) { onSessionLost = fn; },
  hasAccess: () => !!accessToken,
  /** Guarda a sessão emitida pelo login/2FA/refresh. */
  async save(r: { accessToken: string; refreshToken?: string }) {
    accessToken = r.accessToken;
    if (r.refreshToken) await secure.set(RT_KEY, r.refreshToken);
  },
  async clear() {
    accessToken = null;
    await secure.del(RT_KEY).catch(() => undefined);
  },
  refreshToken: () => secure.get(RT_KEY),
};

async function parse(res: Response) {
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const raw = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    const code: string | undefined = data?.code;
    throw new ApiError(code === 'PLAN_REQUIRED' ? PLAN_LOCKED_MESSAGE : raw ?? `Erro ${res.status}`, res.status, code);
  }
  return data;
}

/** Troca o refresh token por uma nova sessão (rotação: o antigo deixa de valer). Uma chamada por vez. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const rt = await secure.get(RT_KEY);
    if (!rt) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST', headers: { ...baseHeaders(), 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }),
      });
      if (res.status === 401 || res.status === 403) { await session.clear(); return false; }
      const data = await parse(res);
      await session.save(data);
      return true;
    } catch {
      return false; // sem rede: mantém o refresh token para tentar de novo
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; retry?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...baseHeaders(),
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Sem conexão com a internet. Tente de novo.', 0, 'NETWORK');
  }
  if (res.status === 401 && opts.retry !== false && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
    if (!(await session.refreshToken())) onSessionLost?.();
  }
  return parse(res) as Promise<T>;
}

// ---------------- tipos compartilhados com o web ----------------
export interface Topic { id: number; name: string; subjectId: number }
export interface Subject { id: number; name: string; topics: Topic[] }
export interface Alternative { key: string; text: string }
export interface Question {
  id: number; statement: string; alternatives: Alternative[]; difficulty: 'easy' | 'medium' | 'hard';
  institution?: string; year?: number; topic?: { name: string }; correctKey?: string; commentary?: string;
}
export interface User { id: string; name: string; email: string; role: 'student' | 'admin'; university?: string | null; semester?: number | null; xp?: number }
