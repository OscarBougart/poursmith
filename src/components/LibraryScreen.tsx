import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Locale, Recipe } from '@/data/types';
import { useLibrary } from '@/hooks/useLibrary';
import { useSettings } from '@/hooks/useSettings';
import { useLocale, useT } from '@/i18n';
import Banner from '@/components/Banner';
import BatchSheetDialog from '@/components/BatchSheetDialog';
import CsvImportDialog from '@/components/CsvImportDialog';
import IngredientsTab from '@/components/IngredientsTab';
import PrepsTab from '@/components/PrepsTab';
import RecipesTab from '@/components/RecipesTab';
import SettingsDialog from '@/components/SettingsDialog';

export interface LibraryScreenProps {
  onSignOut: () => Promise<void>;
}

type Tab = 'ingredients' | 'preps' | 'recipes';
const LOCALES: Locale[] = ['de', 'en'];

export default function LibraryScreen({ onSignOut }: LibraryScreenProps): ReactElement {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const {
    library,
    loading,
    error,
    refresh,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addPrep,
    updatePrep,
    deletePrep,
    importIngredients,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    duplicateRecipe,
  } = useLibrary(true);
  const { targetCostPct, save: saveSettings } = useSettings(true);
  const [tab, setTab] = useState<Tab>('ingredients');
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [batchRecipe, setBatchRecipe] = useState<Recipe | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ingredients', label: t('nav.ingredients') },
    { id: 'preps', label: t('nav.preps') },
    { id: 'recipes', label: t('nav.recipes') },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-xl font-semibold tracking-tight">{t('app.title')}</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('settings.title')}
              className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              ⚙
            </button>
            <div role="group" aria-label="Sprache / Language" className="flex rounded-lg border border-zinc-700 p-0.5">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  aria-pressed={locale === l}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium uppercase transition ${
                    locale === l ? 'bg-zinc-700 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              {t('auth.signOut')}
            </button>
          </div>
        </div>
        <nav aria-label={t('app.title')} className="mx-auto flex max-w-5xl gap-1 px-4">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-selected={tab === id}
              role="tab"
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === id
                  ? 'border-emerald-500 text-zinc-50'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {error !== null && !errorDismissed && (
          <Banner
            kind="error"
            message={t('common.error.generic', { message: error })}
            onDismiss={() => {
              setErrorDismissed(true);
              void refresh();
            }}
          />
        )}
        {loading ? (
          <p className="p-10 text-center text-sm text-zinc-500">{t('app.loading')}</p>
        ) : tab === 'ingredients' ? (
          <IngredientsTab
            library={library}
            onAdd={addIngredient}
            onUpdate={updateIngredient}
            onDelete={deleteIngredient}
            onOpenImport={() => setImportOpen(true)}
          />
        ) : tab === 'preps' ? (
          <PrepsTab
            library={library}
            onAdd={addPrep}
            onUpdate={updatePrep}
            onDelete={deletePrep}
          />
        ) : (
          <RecipesTab
            library={library}
            settings={{ target_cost_pct: targetCostPct }}
            onAdd={addRecipe}
            onUpdate={updateRecipe}
            onDelete={deleteRecipe}
            onDuplicate={duplicateRecipe}
            onOpenBatch={setBatchRecipe}
          />
        )}
      </main>

      <CsvImportDialog
        library={library}
        open={importOpen}
        onImport={importIngredients}
        onClose={() => setImportOpen(false)}
      />
      <BatchSheetDialog
        recipe={batchRecipe}
        library={library}
        onClose={() => setBatchRecipe(null)}
      />
      {settingsOpen && (
        <SettingsDialog
          key={targetCostPct}
          open
          targetCostPct={targetCostPct}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
