import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Library, Locale, Menu, Settings } from '@/data/types';
import { useT } from '@/i18n';
import { ICON_BUTTON, ICON_BUTTON_DANGER } from '@/components/buttonStyles';
import ConfirmDialog from '@/components/ConfirmDialog';
import MenuDetail from '@/components/MenuDetail';

export interface MenusTabProps {
  library: Library;
  settings: Settings;
  onAddMenu: (name: string) => Promise<string | null>;
  onRenameMenu: (id: string, name: string) => Promise<string | null>;
  onDeleteMenu: (id: string) => Promise<string | null>;
  onAddItem: (menuId: string, recipeId: string) => Promise<string | null>;
  onRemoveItem: (id: string) => Promise<string | null>;
  onReorder: (id: string, direction: 'up' | 'down') => Promise<string | null>;
  onExportGuest: (menu: Menu, language: Locale) => void;
  onExportInternal: (menu: Menu) => void;
  onExportCsv: (menu: Menu) => void;
}

export default function MenusTab({
  library,
  settings,
  onAddMenu,
  onRenameMenu,
  onDeleteMenu,
  onAddItem,
  onRemoveItem,
  onReorder,
  onExportGuest,
  onExportInternal,
  onExportCsv,
}: MenusTabProps): ReactElement {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(library.menus[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // keep a valid selection as menus change
  useEffect(() => {
    if (library.menus.length === 0) {
      setSelectedId(null);
    } else if (!library.menus.some((m) => m.id === selectedId)) {
      setSelectedId(library.menus[0]?.id ?? null);
    }
  }, [library.menus, selectedId]);

  const selected = library.menus.find((m) => m.id === selectedId) ?? null;
  const deletingMenu = library.menus.find((m) => m.id === deletingId) ?? null;

  async function handleAdd(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const name = newName.trim();
    if (name === '') return;
    const message = await onAddMenu(name);
    if (message === null) setNewName('');
  }

  async function handleRename(id: string): Promise<void> {
    const name = renameValue.trim();
    if (name !== '') await onRenameMenu(id, name);
    setRenamingId(null);
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
      <aside>
        <form onSubmit={(e) => void handleAdd(e)} className="mb-3 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('menu.name')}
            aria-label={t('menu.name')}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
          />
          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover">
            +
          </button>
        </form>

        {library.menus.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-400">
            {t('menu.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {library.menus.map((menu) => (
              <li key={menu.id}>
                {renamingId === menu.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void handleRename(menu.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename(menu.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    aria-label={t('menu.rename')}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
                  />
                ) : (
                  <div
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                      selectedId === menu.id
                        ? 'border-accent bg-accent/10 text-zinc-50'
                        : 'border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <button type="button" onClick={() => setSelectedId(menu.id)} className="flex-1 text-left">
                      {menu.name}
                    </button>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(menu.id);
                          setRenameValue(menu.name);
                        }}
                        aria-label={t('menu.rename')}
                        className={ICON_BUTTON}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(menu.id)}
                        aria-label={t('menu.delete')}
                        className={ICON_BUTTON_DANGER}
                      >
                        ×
                      </button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section>
        {selected ? (
          <MenuDetail
            key={selected.id}
            menu={selected}
            library={library}
            settings={settings}
            onAddItem={(recipeId) => onAddItem(selected.id, recipeId)}
            onRemoveItem={onRemoveItem}
            onReorder={onReorder}
            onExportGuest={(language) => onExportGuest(selected, language)}
            onExportInternal={() => onExportInternal(selected)}
            onExportCsv={() => onExportCsv(selected)}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-400">
            {t('menu.empty')}
          </p>
        )}
      </section>

      {deletingMenu && (
        <ConfirmDialog
          title={t('menu.delete')}
          message={t('menu.deleteConfirm', { name: deletingMenu.name })}
          confirmLabel={t('menu.delete')}
          onConfirm={() => {
            void onDeleteMenu(deletingMenu.id);
            setDeletingId(null);
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
