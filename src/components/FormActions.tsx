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
        <p role="alert" className="mb-4 rounded-lg bg-amber-950/60 px-3 py-2 text-sm text-amber-300">
          {onDelete.inUseMessage}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {onDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => (onDelete.usedByNames.length > 0 ? setBlockedByUse(true) : setConfirming(true))}
            className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:bg-red-950/50"
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
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-60"
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
