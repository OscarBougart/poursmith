import type { ReactElement } from 'react';
import { useT } from '@/i18n';

/** Red banner for a server/network error string returned by a mutation. */
export default function ErrorBanner({ message }: { message: string }): ReactElement {
  const t = useT();
  return (
    <p role="alert" className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
      {t('common.error.generic', { message })}
    </p>
  );
}
