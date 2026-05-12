'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AuthUser } from '@/types';

type Http = {
  get:  <T>(path: string) => Promise<T>;
  post: <T>(path: string, body: unknown) => Promise<T>;
};

export interface RoleAuthCtx {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

interface RoleAuthConfig {
  http: Http;
  acceptRole: (role: string) => boolean;
  hookName: string;
  deniedMessage: string;
}

export function createRoleAuth(config: RoleAuthConfig) {
  const { http, acceptRole, hookName, deniedMessage } = config;
  const Context = createContext<RoleAuthCtx | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const [user, setUser]       = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const hydrate = useCallback(async () => {
      try {
        const me = await http.get<AuthUser>('/auth/me');
        setUser(acceptRole(me.role) ? me : null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { void hydrate(); }, [hydrate]);

    const login = async (email: string, password: string) => {
      const res = await http.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
      if (!acceptRole(res.user.role)) {
        await http.post('/auth/logout', {}).catch(() => {});
        throw new Error(deniedMessage);
      }
      setUser(res.user);
    };

    const logout = async () => {
      await http.post('/auth/logout', {}).catch(() => {});
      setUser(null);
    };

    return <Context.Provider value={{ user, login, logout, loading }}>{children}</Context.Provider>;
  }

  function useHook() {
    const ctx = useContext(Context);
    if (!ctx) throw new Error(`${hookName} must be used inside its provider`);
    return ctx;
  }

  return { Provider, useHook };
}
