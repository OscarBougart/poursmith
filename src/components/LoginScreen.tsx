import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { useT } from '@/i18n';

export interface LoginScreenProps {
  onSignIn: (email: string, password: string) => Promise<string | null>;
}

export default function LoginScreen({ onSignIn }: LoginScreenProps): ReactElement {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setFailed(false);
    const error = await onSignIn(email, password);
    setPending(false);
    if (error !== null) setFailed(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-8 shadow-xl"
        aria-label={t('auth.signIn')}
      >
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-text-primary">
          {t('app.title')}
        </h1>
        {failed && (
          <p role="alert" className="mb-4 rounded-lg bg-margin-bad/10 px-3 py-2 text-sm text-margin-bad">
            {t('auth.error.invalid')}
          </p>
        )}
        <label htmlFor="login-email" className="mb-1 block text-sm text-text-secondary">
          {t('auth.email')}
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-green"
        />
        <label htmlFor="login-password" className="mb-1 block text-sm text-text-secondary">
          {t('auth.password')}
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-green"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green px-4 py-2.5 font-medium text-bg-primary transition hover:bg-green-d1 disabled:opacity-60"
        >
          {pending ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </main>
  );
}
