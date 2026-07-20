import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
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
import DemoBanner from '@/components/DemoBanner';
import GuestMenuView from '@/components/GuestMenuView';
import IngredientsTab from '@/components/IngredientsTab';
import InternalMenuView from '@/components/InternalMenuView';
import MenusTab from '@/components/MenusTab';
import PrepsTab from '@/components/PrepsTab';
import RecipeSummary from '@/components/RecipeSummary';
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

  // Roving-tabindex keyboard nav for the tablist (WAI-ARIA tabs pattern).
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const index = tabs.findIndex((x) => x.id === tab);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    const nextTab = tabs[next];
    if (!nextTab) return;
    event.preventDefault();
    setTab(nextTab.id);
    tabRefs.current.get(nextTab.id)?.focus();
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <DemoBanner />
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
        <div role="tablist" aria-label={t('app.title')} className="mx-auto flex max-w-5xl gap-1 px-4">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              ref={(el) => {
                if (el) tabRefs.current.set(id, el);
                else tabRefs.current.delete(id);
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={onTabKeyDown}
              className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === id
                  ? 'border-green text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="mx-auto max-w-5xl px-4 py-6 print:hidden focus:outline-none"
      >
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
          <>
            <RecipeSummary library={library} settings={settings} />
            <RecipesTab
            library={library}
            settings={settings}
            onAdd={addRecipe}
            onUpdate={updateRecipe}
            onDelete={deleteRecipe}
            onDuplicate={duplicateRecipe}
            onOpenBatch={setBatchRecipe}
          />
          </>
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
