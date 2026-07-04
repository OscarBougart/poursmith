import type { ReactElement } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LocaleProvider, useT } from '@/i18n';
import LibraryScreen from '@/components/LibraryScreen';
import LoginScreen from '@/components/LoginScreen';

function AuthGate(): ReactElement {
  const t = useT();
  const { session, ready, signIn, signOut } = useAuth();

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-500">{t('app.loading')}</p>
      </main>
    );
  }
  return session ? <LibraryScreen onSignOut={signOut} /> : <LoginScreen onSignIn={signIn} />;
}

export default function App(): ReactElement {
  return (
    <LocaleProvider>
      <AuthGate />
    </LocaleProvider>
  );
}
