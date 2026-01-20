import React, { createContext, useContext, useEffect, useState } from 'react';

import { getSession as loadSession, signOut as signOutFn } from '@/lib/auth';
import type { Session } from '@/lib/types';

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
  setSession: (s: Session | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const existing = await loadSession();
        setSession(existing);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const existing = await loadSession();
      setSession(existing);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await signOutFn();
    setSession(null);
  };

  return (
    <SessionContext.Provider value={{ session, loading, setSession, refresh, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}


export function useSessionContext() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be used inside SessionProvider');
  return ctx;
}
