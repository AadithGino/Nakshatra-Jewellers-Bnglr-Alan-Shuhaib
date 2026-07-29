/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, refreshSession } from '../shared/services/api.client';
import { AuthBoot } from '../shared/components/AuthBoot';

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

/** Keep access cookie alive while the app is open (well under access TTL). */
const PROACTIVE_REFRESH_MS = 10 * 60 * 1000;

async function resolveSession(): Promise<Session | null> {
  // api() already refreshes on 401 — do not call /auth/refresh again here
  // (that used to rotate/invalidate sessions and force a logout).
  try {
    return await api<Session>('/auth/me');
  } catch {
    return null;
  }
}

/** Share one in-flight resolve so Strict Mode double-mount cannot race. */
let sharedResolve: Promise<Session | null> | null = null;

function resolveSessionShared(): Promise<Session | null> {
  if (!sharedResolve) {
    sharedResolve = resolveSession().finally(() => {
      sharedResolve = null;
    });
  }
  return sharedResolve;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const bootId = useRef(0);

  const reload = async () => {
    const id = ++bootId.current;
    setLoading(true);
    try {
      const next = await resolveSession();
      if (id !== bootId.current) return;
      setSession(next);
    } finally {
      if (id === bootId.current) setLoading(false);
    }
  };

  useEffect(() => {
    const id = ++bootId.current;
    let cancelled = false;

    void (async () => {
      const next = await resolveSessionShared();
      if (cancelled || id !== bootId.current) return;
      setSession(next);
      setLoading(false);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Proactively renew access token so users are not kicked after expiry.
  useEffect(() => {
    if (!session) return;

    const tick = () => {
      void refreshSession();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };

    tick();
    const timer = window.setInterval(tick, PROACTIVE_REFRESH_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session]);

  const logout = async () => {
    bootId.current += 1;
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setSession(null);
      setLoading(false);
      setReady(true);
    }
  };

  // Do not mount routes (including /login) until the first session check finishes.
  if (!ready) {
    return (
      <AuthContext.Provider value={{ session: null, loading: true, reload, logout }}>
        <AuthBoot />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ session, loading, reload, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
