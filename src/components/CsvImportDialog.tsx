import { useRef, useState } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import type { Library, NewIngredient } from '@/data/types';
import type { CsvParseResult } from '@/lib/csv';
import { ingredientCsvTemplate, parseIngredientCsv } from '@/lib/csv';
import { downloadFile } from '@/lib/download';
import { formatNumber } from '@/lib/format';
import { useLocale, useT } from '@/i18n';
import SlideOver from '@/components/SlideOver';

export interface CsvImportDialogProps {
  library: Library;
  open: boolean;
  onImport: (rows: NewIngredient[]) => Promise<string | null>;
  onClose: () => void;
}

export default function CsvImportDialog({
  library,
  open,
  onImport,
  onClose,
}: CsvImportDialogProps): ReactElement {
  const t = useT();
  const { locale } = useLocale();
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function downloadTemplate(): void {
    downloadFile('poursmith-ingredients.csv', ingredientCsvTemplate());
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setResult(parseIngredientCsv(text, library.ingredients.map((i) => i.name)));
      setServerError(null);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleImport(): Promise<void> {
    if (!result || result.valid.length === 0) return;
    setPending(true);
    const message = await onImport(result.valid);
    setPending(false);
    if (message !== null) {
      setServerError(message);
    } else {
      handleClose();
    }
  }

  function handleClose(): void {
    setResult(null);
    setServerError(null);
    if (fileInput.current) fileInput.current.value = '';
    onClose();
  }

  return (
    <SlideOver title={t('csv.title')} open={open} onClose={handleClose}>
      {serverError !== null && (
        <p role="alert" className="mb-4 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {t('common.error.generic', { message: serverError })}
        </p>
      )}

      <div className="mb-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800"
        >
          {t('csv.downloadTemplate')}
        </button>
        <label
          htmlFor="csv-file"
          className="cursor-pointer rounded-lg border border-dashed border-zinc-600 px-4 py-6 text-center text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          {t('csv.chooseFile')}
          <input
            ref={fileInput}
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFile(e)}
            className="sr-only"
          />
        </label>
      </div>

      {result !== null && (
        <div>
          <p className="mb-2 text-sm text-zinc-300">
            {t('csv.rowsFound', { n: result.totalRows })}
            {result.errors.length > 0 && (
              <span className="ml-2 text-red-400">
                {t('csv.errorsFound', { n: result.errors.length })}
              </span>
            )}
          </p>

          {result.errors.length > 0 && (
            <ul className="mb-4 flex flex-col gap-1 rounded-lg bg-red-950/40 p-3 text-xs text-red-300">
              {result.errors.map((error) => (
                <li key={`${error.row}-${error.field}`}>
                  {t('csv.row', { row: error.row })}: {error.field} — {t(error.key)}
                </li>
              ))}
            </ul>
          )}

          {result.valid.length > 0 && (
            <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">{t('common.name')}</th>
                    <th className="px-3 py-2">{t('ingredient.category')}</th>
                    <th className="px-3 py-2">{t('ingredient.packSize')}</th>
                    <th className="px-3 py-2">{t('ingredient.priceGross')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {result.valid.map((row) => (
                    <tr key={row.name}>
                      <td className="px-3 py-2 text-zinc-200">{row.name}</td>
                      <td className="px-3 py-2 text-zinc-400">{t(`category.${row.category}`)}</td>
                      <td className="px-3 py-2 text-zinc-400">
                        {formatNumber(row.pack_size, locale)} {t(`unit.${row.unit}`)}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {formatNumber(row.price_gross, locale)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            disabled={pending || result.valid.length === 0}
            onClick={() => void handleImport()}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? t('common.saving') : t('csv.importValid', { n: result.valid.length })}
          </button>
        </div>
      )}
    </SlideOver>
  );
}
