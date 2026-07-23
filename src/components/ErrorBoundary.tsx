import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Copy is self-contained (no i18n hook — a class can't use hooks, and the error
// may originate inside the i18n tree). We pick the language from the <html lang>
// the locale provider maintains, falling back to German.
const COPY = {
  de: {
    title: 'Etwas ist schiefgelaufen',
    body: 'Ein unerwarteter Fehler ist aufgetreten. Lade die Seite neu, um fortzufahren.',
    reload: 'Neu laden',
  },
  en: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred. Reload the page to continue.',
    reload: 'Reload',
  },
} as const;

/** Catches render-time errors anywhere below it and shows a recoverable fallback
 *  instead of a white screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error for debugging / future error-reporting integration.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const lang = document.documentElement.lang === 'en' ? 'en' : 'de';
    const copy = COPY[lang];
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold text-text-primary">{copy.title}</h1>
          <p className="mb-6 text-sm text-text-secondary">{copy.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-d1"
          >
            {copy.reload}
          </button>
        </div>
      </main>
    );
  }
}
