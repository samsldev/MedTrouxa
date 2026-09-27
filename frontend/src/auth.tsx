import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, refreshSession, session, User } from './api/client';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(data: Record<string, unknown>): Promise<void>;
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

  const handle = (r: { accessToken: string; user: User }) => { session.set(r.accessToken); setUser(r.user); };

  return (
    <Ctx.Provider value={{
      user, loading, setUser,
      login: async (email, password) => handle(await api('/auth/login', { body: { email, password } })),
      register: async (data) => handle(await api('/auth/register', { body: data })),
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
