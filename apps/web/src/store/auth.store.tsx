/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../shared/services/api.client';
export type Session = {
  userId: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  permissions: string[];
  sessionVersion: number;
};
export const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    try {
      setSession(await api<Session>('/auth/me'));
    } catch {
      try {
        await api('/auth/refresh', { method: 'POST' });
        setSession(await api<Session>('/auth/me'));
      } catch {
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, []);
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setSession(null);
  };
  return (
    <AuthContext.Provider value={{ session, loading, reload, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
