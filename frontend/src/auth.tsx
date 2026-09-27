import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, tokenStore, User } from './api/client';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(data: Record<string, unknown>): Promise<void>;
  logout(): void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<User>('/auth/me').then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const handle = (r: { accessToken: string; user: User }) => { tokenStore.set(r.accessToken); setUser(r.user); };

  return (
    <Ctx.Provider value={{
      user, loading,
      login: async (email, password) => handle(await api('/auth/login', { body: { email, password } })),
      register: async (data) => handle(await api('/auth/register', { body: data })),
      logout: () => { tokenStore.clear(); setUser(null); },
    }}>
      {children}
    </Ctx.Provider>
  );
}
