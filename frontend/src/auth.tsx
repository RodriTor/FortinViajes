import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): void;
}
const AuthContext = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<{ user: User }>("GET", "/auth/me")
      .then((r) => setUser(r.user))
      .catch((e) => { if (e.status === 401) tokenStore.clear(); })
      .finally(() => setLoading(false));
  }, []);

  const accept = (r: { user: User; token: string }) => { tokenStore.set((r as any).token); setUser(r.user); };
  const login = useCallback(async (email: string, password: string) => accept(await api("POST", "/auth/login", { email, password })), []);
  const register = useCallback(async (name: string, email: string, password: string) => accept(await api("POST", "/auth/register", { name, email, password })), []);
  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
