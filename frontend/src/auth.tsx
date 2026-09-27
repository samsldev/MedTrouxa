import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, refreshSession, session, User } from './api/client';

/** Resposta das etapas de autenticação: sessão pronta, confirmação de e-mail ou segundo fator. */
export type AuthStep =
  | { status: 'ok' }
  | { status: 'verify_email'; challenge: string; email: string }
  | { status: 'mfa'; challenge: string; method: 'totp' | 'email'; email: string };

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<AuthStep>;
  register(data: Record<string, unknown>): Promise<AuthStep>;
  verifyEmail(challenge: string, code: string): Promise<AuthStep>;
  mfa(challenge: string, method: 'totp' | 'email' | 'recovery', code: string): Promise<AuthStep>;
  logout(): Promise<void>;
  setUser(u: User | null): void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    session.onLost(() => { session.set(null); setUser(null); });
    // Restaura a sessão a partir do cookie httpOnly (se houver)
    refreshSession()
      .then((ok) => (ok ? api<User>('/auth/me').then(setUser) : undefined))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handle = (r: AuthStep & { accessToken?: string; user?: User }): AuthStep => {
    if (r.status === 'ok' && r.accessToken && r.user) { session.set(r.accessToken); setUser(r.user); }
    return r;
  };

  return (
    <Ctx.Provider value={{
      user, loading, setUser,
      login: async (email, password) => handle(await api('/auth/login', { body: { email, password } })),
      register: async (data) => handle(await api('/auth/register', { body: data })),
      verifyEmail: async (challenge, code) => handle(await api('/auth/verify-email', { body: { challenge, code } })),
      mfa: async (challenge, method, code) => handle(await api('/auth/mfa', { body: { challenge, method, code } })),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        session.set(null); setUser(null);
        Object.keys(localStorage).filter((k) => k.startsWith('exam:')).forEach((k) => localStorage.removeItem(k));
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}
