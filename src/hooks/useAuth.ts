import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface UseAuthResult {
  session: Session | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        if (data.session) {
          setSession(data.session);
          return;
        }
        // No session: sign the visitor in anonymously so the demo "just works"
        // without a login screen. onAuthStateChange delivers the new session.
        await supabase.auth.signInAnonymously();
      })
      .catch(() => {
        // treat a failed session lookup as signed-out rather than hanging
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, ready, signIn, signOut };
}
