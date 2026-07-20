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
          if (!error) next = data.session;
        }
        // Ensure any anonymous visitor has a demo library — not just first-time
        // sign-ins. seed_demo_data is idempotent (it early-returns when the user
        // already has data), so this also self-heals sessions left empty by an
        // earlier failed seed. Must finish BEFORE ready, or the library screen
        // mounts and fetches before the rows exist and shows empty.
        if (next?.user.is_anonymous) await supabase.rpc('seed_demo_data');
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
