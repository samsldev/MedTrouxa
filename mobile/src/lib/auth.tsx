import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, session, User } from './api';

/** Resultado de cada etapa de autenticação: sessão pronta, confirmação de e-mail ou segundo fator. */
export type AuthStep =
  | { status: 'ok' }
  | { status: 'verify_email'; challenge: string; email: string }
  | { status: 'mfa'; challenge: string; method: 'totp' | 'email'; email: string };
type Issued = AuthStep & { accessToken?: string; refreshToken?: string; user?: User };

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<AuthStep>;
  register(data: Record<string, unknown>): Promise<AuthStep>;
  verifyEmail(challenge: string, code: string): Promise<AuthStep>;
  mfa(challenge: string, method: 'totp' | 'email' | 'recovery', code: string): Promise<AuthStep>;
  logout(opts?: { everywhere?: boolean }): Promise<void>;
  /** Encerra só localmente (senha trocada, conta excluída). */
  forget(): Promise<void>;
  setUser(u: User | null): void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const forget = useCallback(async () => {
    await session.clear();
    setUser(null);
    const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('exam:'))).catch(() => undefined);
  }, []);

  useEffect(() => {
    session.onLost(() => { void forget(); });
    // Restaura a sessão do Keychain/Keystore ao abrir o app
    refreshSession()
      .then((ok) => (ok ? api<User>('/auth/me').then(setUser) : undefined))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [forget]);

  const handle = useCallback(async (r: Issued): Promise<AuthStep> => {
    if (r.status === 'ok' && r.accessToken && r.user) {
      await session.save({ accessToken: r.accessToken, refreshToken: r.refreshToken });
      setUser(r.user);
    }
    return r;
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user, loading, setUser, forget,
    login: async (email, password) => handle(await api('/auth/login', { body: { email, password } })),
    register: async (data) => handle(await api('/auth/register', { body: data })),
    verifyEmail: async (challenge, code) => handle(await api('/auth/verify-email', { body: { challenge, code } })),
    mfa: async (challenge, method, code) => handle(await api('/auth/mfa', { body: { challenge, method, code } })),
    logout: async ({ everywhere } = {}) => {
      const refreshToken = await session.refreshToken();
      if (everywhere) await api('/auth/logout-all', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
      else await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
      await forget();
    },
  }), [user, loading, handle, forget]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
