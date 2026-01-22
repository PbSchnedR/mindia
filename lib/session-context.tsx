import React, { createContext, useContext, useEffect, useState } from 'react';

import { getSession as loadSession, signOut as signOutFn } from '@/lib/auth';
import { api } from '@/lib/api';
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
        console.log('[SessionProvider] Vérification de la session au démarrage...');
        // Charger la session depuis le storage
        const existing = await loadSession();
        
        if (existing) {
          console.log('[SessionProvider] Session trouvée dans le storage');
          // Vérifier que le token JWT est toujours valide
          const token = await api.auth.getStoredToken();
          
          if (token) {
            console.log('[SessionProvider] Token trouvé, vérification...');
            // Vérifier le token sans afficher d'erreur
            const result = await api.auth.verifyToken(token).catch(() => null);
            
            if (result) {
              // Token valide, garder la session
              console.log('[SessionProvider] Token valide, session restaurée');
              setSession(existing);
            } else {
              // Token invalide/expiré, nettoyer la session
              console.log('[SessionProvider] Token invalide/expiré, nettoyage...');
              await signOutFn();
              setSession(null);
            }
          } else {
            // Pas de token, nettoyer la session
            console.log('[SessionProvider] Pas de token, nettoyage...');
            await signOutFn();
            setSession(null);
          }
        } else {
          console.log('[SessionProvider] Pas de session existante');
        }
      } catch (error) {
        // En cas d'erreur, nettoyer la session
        console.error('[SessionProvider] Erreur lors de la vérification de session:', error);
        await signOutFn();
        setSession(null);
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
