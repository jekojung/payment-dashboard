import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, apiError, tokenStore } from '../api/client';

export interface AuthUser {
  id: string;
  employeeCode: string;
  name: string;
  department?: string | null;
  roles: string[];
  permissions: string[];
  isSystemAdmin: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (employeeCode: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
}

const Ctx = createContext<AuthCtx>(null as never);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<AuthUser>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (employeeCode: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { employeeCode, password });
      tokenStore.set(res.data.accessToken);
      setUser(res.data.user);
    } catch (e) {
      throw new Error(apiError(e));
    }
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  const can = (permission: string) =>
    !!user && (user.isSystemAdmin || user.permissions.includes(permission));

  return <Ctx.Provider value={{ user, loading, login, logout, can }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
