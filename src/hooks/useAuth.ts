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

    (async () => {
      try {
        let next = (await supabase.auth.getSession()).data.session;
        if (!next) {
          // No session: sign the visitor in anonymously so the demo "just works"
          // without a login screen.
          const { data, error } = await supabase.auth.signInAnonymously();
          if (!error) {
            // Seed this visitor's personal demo library, then adopt the session.
            // Both must finish BEFORE we mark ready, or the library screen mounts
            // and fetches before the seed rows exist and shows empty.
            await supabase.rpc('seed_demo_data');
            next = data.session;
          }
        }
        if (!cancelled) setSession(next);
      } catch {
        // treat a failed bootstrap as signed-out rather than hanging
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    // Keep the session fresh on later auth changes (sign out, token refresh).
    // Does not touch `ready` — the bootstrap above owns first paint.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, current) => {
      if (!cancelled) setSession(current);
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
