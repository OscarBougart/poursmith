import { useState } from 'react';
import type { ReactElement } from 'react';
import { useT } from '@/i18n';
import ConfirmDialog from '@/components/ConfirmDialog';

export interface DeleteAction {
  /** Names blocking deletion; non-empty shows the in-use notice instead. */
  usedByNames: string[];
  inUseMessage: string;
  confirmMessage: string;
  run: () => void;
}

export interface FormActionsProps {
  pending: boolean;
  onCancel: () => void;
  /** Omit for create forms with nothing to delete. */
  onDelete?: DeleteAction;
}

/** Shared footer: delete (guarded by usage) on the left, cancel/save on the right. */
export default function FormActions({ pending, onCancel, onDelete }: FormActionsProps): ReactElement {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [blockedByUse, setBlockedByUse] = useState(false);

  return (
    <>
      {blockedByUse && onDelete && (
        <p role="alert" className="mb-4 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          {onDelete.inUseMessage}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {onDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => (onDelete.usedByNames.length > 0 ? setBlockedByUse(true) : setConfirming(true))}
            className="rounded-lg border border-margin-bad/40 px-4 py-2 text-sm text-margin-bad transition hover:bg-margin-bad/10"
          >
            {t('common.delete')}
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary transition hover:bg-bg-elevated"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-green px-4 py-2 text-sm font-medium text-bg-primary transition hover:bg-green-d1 disabled:opacity-60"
          >
            {pending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {confirming && onDelete && (
        <ConfirmDialog
          title={t('common.delete')}
          message={onDelete.confirmMessage}
          confirmLabel={t('common.delete')}
          onConfirm={() => {
            setConfirming(false);
            onDelete.run();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
