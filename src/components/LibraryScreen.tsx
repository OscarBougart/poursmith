import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Locale, Menu, Recipe, Settings } from '@/data/types';
import { useLibrary } from '@/hooks/useLibrary';
import { usePersistentState } from '@/hooks/usePersistentState';
import { usePrintJob } from '@/hooks/usePrintJob';
import { useSettings } from '@/hooks/useSettings';
import { downloadFile } from '@/lib/download';
import { menuAnalytics } from '@/lib/menuAnalytics';
import { menuCsv } from '@/lib/menuCsv';
import { useLocale, useT } from '@/i18n';
import Banner from '@/components/Banner';
import BatchSheetDialog from '@/components/BatchSheetDialog';
import CsvImportDialog from '@/components/CsvImportDialog';
import GuestMenuView from '@/components/GuestMenuView';
import IngredientsTab from '@/components/IngredientsTab';
import InternalMenuView from '@/components/InternalMenuView';
import MenusTab from '@/components/MenusTab';
import PrepsTab from '@/components/PrepsTab';
import RecipesTab from '@/components/RecipesTab';
import SettingsDialog from '@/components/SettingsDialog';
import { useToast } from '@/components/Toast';

export interface LibraryScreenProps {
  onSignOut: () => Promise<void>;
}

type Tab = 'ingredients' | 'preps' | 'recipes' | 'menus';
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
    addMenu,
    renameMenu,
    deleteMenu,
    addMenuItem,
    removeMenuItem,
    reorderMenuItem,
  } = useLibrary(true);
  const { targetCostPct, save: saveSettings } = useSettings(true);
  const settings: Settings = { target_cost_pct: targetCostPct };
  const { push } = useToast();
  const [tab, setTab] = usePersistentState<Tab>(
    'poursmith.tab',
    'ingredients',
    (v): v is Tab => v === 'ingredients' || v === 'preps' || v === 'recipes' || v === 'menus',
  );
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [batchRecipe, setBatchRecipe] = useState<Recipe | null>(null);
  const [printJob, setPrintJob] = usePrintJob();
  const [errorDismissed, setErrorDismissed] = useState(false);

  function exportCsv(menu: Menu): void {
    downloadFile(`${menu.name}.csv`, menuCsv(menuAnalytics(menu.id, library, settings), locale));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ingredients', label: t('nav.ingredients') },
    { id: 'preps', label: t('nav.preps') },
    { id: 'recipes', label: t('nav.recipes') },
    { id: 'menus', label: t('nav.menus') },
  ];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-xl font-semibold tracking-tight">{t('app.title')}</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('settings.title')}
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-text-secondary transition hover:bg-bg-elevated"
            >
              ⚙
            </button>
            <div role="group" aria-label="Sprache / Language" className="flex rounded-lg border border-border p-0.5">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  aria-pressed={locale === l}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium uppercase transition ${
                    locale === l ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary transition hover:bg-bg-elevated"
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
                  ? 'border-green text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 print:hidden">
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
          <p className="p-10 text-center text-sm text-text-secondary">{t('app.loading')}</p>
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
        ) : tab === 'recipes' ? (
          <RecipesTab
            library={library}
            settings={settings}
            onAdd={addRecipe}
            onUpdate={updateRecipe}
            onDelete={deleteRecipe}
            onDuplicate={duplicateRecipe}
            onOpenBatch={setBatchRecipe}
          />
        ) : (
          <MenusTab
            library={library}
            settings={settings}
            onAddMenu={addMenu}
            onRenameMenu={renameMenu}
            onDeleteMenu={deleteMenu}
            onAddItem={addMenuItem}
            onRemoveItem={removeMenuItem}
            onReorder={reorderMenuItem}
            onExportGuest={(menu, language) => setPrintJob({ kind: 'guest', menu, language })}
            onExportInternal={(menu) => setPrintJob({ kind: 'internal', menu })}
            onExportCsv={exportCsv}
          />
        )}
      </main>

      <CsvImportDialog
        library={library}
        open={importOpen}
        onImport={async (rows) => {
          const message = await importIngredients(rows);
          if (message === null) push(t('toast.imported', { n: rows.length }));
          return message;
        }}
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
      {printJob?.kind === 'guest' && (
        <GuestMenuView menu={printJob.menu} library={library} language={printJob.language} />
      )}
      {printJob?.kind === 'internal' && (
        <InternalMenuView menu={printJob.menu} library={library} settings={settings} />
      )}
    </div>
  );
}
