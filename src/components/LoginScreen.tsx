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
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl"
        aria-label={t('auth.signIn')}
      >
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-50">
          {t('app.title')}
        </h1>
        {failed && (
          <p role="alert" className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {t('auth.error.invalid')}
          </p>
        )}
        <label htmlFor="login-email" className="mb-1 block text-sm text-zinc-400">
          {t('auth.email')}
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
        />
        <label htmlFor="login-password" className="mb-1 block text-sm text-zinc-400">
          {t('auth.password')}
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </main>
  );
}
