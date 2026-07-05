import type { ReactElement } from 'react';
import type { Library, Locale, Menu } from '@/data/types';
import { formatEur } from '@/lib/format';

export interface GuestMenuViewProps {
  menu: Menu;
  library: Library;
  language: Locale;
}

/**
 * Print-only guest menu. Shows drink name, description (in the chosen language)
 * and selling price — no pour cost, cost %, or margin anywhere.
 */
export default function GuestMenuView({ menu, library, language }: GuestMenuViewProps): ReactElement {
  const items = library.menuItems
    .filter((i) => i.menu_id === menu.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="print-area hidden print:block">
      <h1 className="mb-8 text-center text-3xl font-semibold">{menu.name}</h1>
      <ul className="mx-auto max-w-xl">
        {items.map((item) => {
          const recipe = library.recipes.find((r) => r.id === item.recipe_id);
          if (!recipe) return null;
          const description = language === 'de' ? recipe.description_de : recipe.description_en;
          return (
            <li key={item.id} className="mb-5 flex items-baseline justify-between gap-4 border-b border-dotted border-gray-300 pb-1">
              <div>
                <p className="text-lg font-medium">{recipe.name}</p>
                {description !== null && description !== '' && (
                  <p className="text-sm text-gray-600">{description}</p>
                )}
              </div>
              {recipe.price_gross !== null && (
                <span className="shrink-0 text-lg">{formatEur(recipe.price_gross, language)}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
