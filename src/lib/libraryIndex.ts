import type {
  Ingredient,
  Library,
  MenuItem,
  Prep,
  PrepLine,
  Recipe,
  RecipeLine,
} from '@/data/types';

/**
 * Id-keyed lookups over a Library. The cost engine and UI resolve components by
 * id constantly; scanning arrays turns rendering a table into quadratic work.
 */
export interface LibraryIndex {
  ingredient: (id: string | null) => Ingredient | undefined;
  prep: (id: string | null) => Prep | undefined;
  recipe: (id: string | null) => Recipe | undefined;
  prepLinesOf: (prepId: string) => PrepLine[];
  recipeLinesOf: (recipeId: string) => RecipeLine[];
  menuItemsOf: (menuId: string) => MenuItem[];
}

// One index per distinct Library object. useLibrary hands out a new object only
// when data changes, so every consumer in a render pass shares the same index.
const cache = new WeakMap<Library, LibraryIndex>();

export function indexLibrary(lib: Library): LibraryIndex {
  const cached = cache.get(lib);
  if (cached) return cached;

  const ingredients = new Map(lib.ingredients.map((i) => [i.id, i]));
  const preps = new Map(lib.preps.map((p) => [p.id, p]));
  const recipes = new Map(lib.recipes.map((r) => [r.id, r]));
  const prepLines = groupBy(lib.prepLines, (l) => l.prep_id);
  const recipeLines = groupBy(lib.recipeLines, (l) => l.recipe_id);
  const menuItems = groupBy(lib.menuItems, (i) => i.menu_id);

  const index: LibraryIndex = {
    ingredient: (id) => (id === null ? undefined : ingredients.get(id)),
    prep: (id) => (id === null ? undefined : preps.get(id)),
    recipe: (id) => (id === null ? undefined : recipes.get(id)),
    prepLinesOf: (id) => prepLines.get(id) ?? [],
    recipeLinesOf: (id) => recipeLines.get(id) ?? [],
    menuItemsOf: (id) => menuItems.get(id) ?? [],
  };
  cache.set(lib, index);
  return index;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const list = map.get(key(item));
    if (list) list.push(item);
    else map.set(key(item), [item]);
  }
  return map;
}
