import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useT } from '@/i18n';
import { PRIMARY_BUTTON } from '@/components/buttonStyles';

type Mode = 'save' | 'signin';

export interface AccountDialogProps {
  initialMode: Mode;
  /** Upgrade the anonymous session to email + password, keeping current data. */
  onLink: (email: string, password: string) => Promise<string | null>;
  /** Sign into an account saved earlier (replaces the current session). */
  onSignIn: (email: string, password: string) => Promise<string | null>;
  /** Fires with the email after a successful save, for a toast. */
  onSaved: (email: string) => void;
  onClose: () => void;
}

const FIELD =
  'mb-4 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent';

/**
 * Lets a demo visitor keep their bar: either attach an email + password to the
 * current anonymous session (save), or sign into a bar saved earlier (signin).
 */
export default function AccountDialog({
  initialMode,
  onLink,
  onSignIn,
  onSaved,
  onClose,
}: AccountDialogProps): ReactElement {
  const t = useT();
  const panelRef = useFocusTrap<HTMLElement>(true);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    if (mode === 'save') {
      const message = await onLink(email, password);
      setPending(false);
      if (message !== null) {
        setError(message);
        return;
      }
      onSaved(email);
      onClose();
    } else {
      const message = await onSignIn(email, password);
      if (message !== null) {
        setPending(false);
        setError(message);
        return;
      }
      // Reload so the whole app re-initialises with the signed-in account's data.
      window.location.reload();
    }
  }

  const saving = mode === 'save';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('common.close')}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60"
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={saving ? t('account.saveTitle') : t('account.signInTitle')}
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 shadow-2xl outline-none"
      >
        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          {saving ? t('account.saveTitle') : t('account.signInTitle')}
        </h2>
        <p className="mb-5 text-sm text-text-secondary">
          {saving ? t('account.saveBody') : t('account.signInBody')}
        </p>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {error !== null && (
            <p role="alert" className="mb-4 rounded-lg bg-margin-bad/10 px-3 py-2 text-sm text-margin-bad">
              {error}
            </p>
          )}
          <label htmlFor="account-email" className="mb-1 block text-sm text-text-secondary">
            {t('auth.email')}
          </label>
          <input
            id="account-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
          <label htmlFor="account-password" className="mb-1 block text-sm text-text-secondary">
            {t('auth.password')}
          </label>
          <input
            id="account-password"
            type="password"
            required
            minLength={6}
            autoComplete={saving ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
          <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON} w-full`}>
            {pending
              ? t('auth.signingIn')
              : saving
                ? t('account.create')
                : t('auth.signIn')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(saving ? 'signin' : 'save');
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-accent transition hover:text-accent-d1"
        >
          {saving ? t('account.toSignIn') : t('account.toSave')}
        </button>
      </section>
    </div>
  );
}
