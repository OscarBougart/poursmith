# Epic 3 — Menu Board & Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble recipes into named menus with a finance-aware board (price, pour cost, cost %, margin, RAG flags), menu-level analytics, a guest PDF with zero cost data, and internal PDF/CSV exports that match the screen.

**Architecture:** Two new tables (`menus`, `menu_items`) plus two nullable description columns on `recipes`, all following the Epic 1/2 RLS patterns. Analytics and CSV stay in pure TS modules layered on Epic 2's pricing/cost engine. UI adds a fourth tab with a master/detail menu board and two print-only views reusing Epic 2's `.print-area` CSS.

**Tech Stack:** Existing stack only (Vite 8, React 19, TS strict, Tailwind v4, supabase-js, Vitest). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-05-epic3-menu-board-export-design.md`

## Global Constraints

- Everything from the Epic 1 & 2 Global Constraints still applies (strict TS, no TS enums, `import type`, i18n for every user-facing string, decimal-comma inputs, commit per task).
- RAG flags relative to target cost %: **green** cost% ≤ target, **amber** ≤ 1.25 × target, **red** > 1.25 × target. `unpriced` when no price. Target = `effectiveTargetPct(recipe.target_cost_pct_override, settings)`.
- `costPct` is a **fraction** (Epic 2); compare `costPct × 100` against the target percentage. Averages exclude unpriced drinks.
- Menus reference recipes **live** — no snapshot, no per-menu price override.
- Guest PDF shows drink name, description (toggled language), and selling price only — **no** pour cost, cost %, or margin.
- CSV export is semicolon-delimited (matching Epic 1 import), numbers formatted to match the on-screen values.
- Only one print view (guest **or** internal) is mounted at a time so the shared `.print-area` CSS prints the intended document.

## File map

```
supabase/schema-epic3.sql                                   Task 1
src/data/types.ts (extend Library, add Menu/MenuItem,
  recipe description fields)                                Task 2
src/lib/menuAnalytics.ts (+ test)                           Task 3
src/lib/menuCsv.ts (+ test)                                 Task 4
src/hooks/useLibrary.ts (menus fetch + CRUD, recipe
  descriptions, recipeUsedByMenus)                          Task 5
src/i18n/de.ts, en.ts (extend)                              Task 6
src/components/RecipeForm.tsx (description_de/en fields)    Task 6
src/components/MenusTab.tsx, MenuDetail.tsx                 Task 7
src/components/GuestMenuView.tsx, InternalMenuView.tsx      Task 8
src/components/LibraryScreen.tsx (fourth tab wiring)        Task 9 (+ final verification)
```

---

### Task 1: Epic 3 schema SQL

**Files:** Create `supabase/schema-epic3.sql`.
**Produces:** tables `menus`, `menu_items`; `recipes.description_de`, `recipes.description_en`. Reuses Epic 1's `public.set_updated_at()`.

- [ ] **Step 1: Write the file:**

```sql
-- PourSmith Epic 3 schema. Run once in the Supabase SQL editor (after Epic 1 & 2).

alter table public.recipes add column description_de text;
alter table public.recipes add column description_en text;

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index menus_user_name_key on public.menus (user_id, lower(name));
create trigger menus_updated_at before update on public.menus
  for each row execute function public.set_updated_at();
alter table public.menus enable row level security;
create policy "own menus" on public.menus
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  sort_order integer not null default 0
);
create index menu_items_menu_id_idx on public.menu_items (menu_id);
create unique index menu_items_menu_recipe_key on public.menu_items (menu_id, recipe_id);
alter table public.menu_items enable row level security;
create policy "own menu items" on public.menu_items
  for all
  using (exists (select 1 from public.menus m where m.id = menu_id and m.user_id = auth.uid()))
  with check (
    exists (select 1 from public.menus m where m.id = menu_id and m.user_id = auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
  );
```

- [ ] **Step 2:** Sanity-read; no local runner (operator runs it in Task 9's handoff).
- [ ] **Step 3:** Commit `feat: epic 3 schema — menus, menu items, recipe descriptions`.

### Task 2: Types

**Files:** Modify `src/data/types.ts`. Then fix every `Library` literal for the two new required arrays: `src/hooks/useLibrary.ts` (EMPTY_LIBRARY + fetch mapping — full CRUD comes in Task 5), and the `makeLib` builders in `src/lib/cost.test.ts`, `src/lib/recipeCost.test.ts`, and the inline `lib` in `src/lib/batch.test.ts`.
**Produces:**

```ts
// added to NewRecipe (so Recipe inherits them): description_de: string | null; description_en: string | null;
export interface Menu { id: string; name: string; created_at: string; updated_at: string }
export interface MenuItem { id: string; menu_id: string; recipe_id: string; sort_order: number }
// Library gains (required): menus: Menu[]; menuItems: MenuItem[];
```

- [ ] **Step 1:** In `types.ts`, add `description_de: string | null;` and `description_en: string | null;` to `NewRecipe`; add `Menu` and `MenuItem` interfaces; add `menus: Menu[];` and `menuItems: MenuItem[];` to `Library`.
- [ ] **Step 2:** Update `EMPTY_LIBRARY` and the fetch `setLibrary({...})` in `useLibrary.ts` to include `menus: []` and `menuItems: []` (real fetch in Task 5). Update the three test `makeLib`/`lib` constructors to default `menus: [], menuItems: []`.
- [ ] **Step 3:** `RecipeForm` (Epic 2) and `RecipeInput` currently build `NewRecipe` without the new fields — TS will flag it. In `RecipeForm.tsx` add the two fields to the submitted object as `null` for now (real inputs in Task 6) so the type checks; `useLibrary` `addRecipe`/`updateRecipe`/`duplicateRecipe` pass them through generically (they spread `...recipe`), no change needed.
- [ ] **Step 4:** `npx tsc -b` clean, `npm test` (existing 71) green.
- [ ] **Step 5:** Commit `feat: menu types and recipe description fields`.

### Task 3: Menu analytics module (TDD)

**Files:** Create `src/lib/menuAnalytics.ts`, `src/lib/menuAnalytics.test.ts`.
**Consumes:** `recipePourCost` (recipeCost.ts); `costPct`, `grossMarginEur`, `effectiveTargetPct` (pricing.ts).
**Produces:**

```ts
export type RagFlag = 'green' | 'amber' | 'red' | 'unpriced';
export interface MenuRow {
  recipe: Recipe; pourCost: number; priceGross: number | null;
  costPct: number | null; marginEur: number | null; flag: RagFlag;
}
export interface MenuAnalytics {
  rows: MenuRow[];
  avgCostPct: number | null;
  marginSpread: { min: number; max: number } | null;
  worstOffenderId: string | null;
}
export function ragFlag(costPctFraction: number | null, targetPct: number): RagFlag;
export function menuAnalytics(menuId: string, lib: Library, settings: Settings): MenuAnalytics;
```

- [ ] **Step 1: Write failing tests.** Builders for recipe/menu/menuItem (default `description_de/en: null`). Cases:
  - `ragFlag(null, 20)` → 'unpriced'; `ragFlag(0.20, 20)` → 'green' (exactly target); `ragFlag(0.201, 20)` → 'amber'; `ragFlag(0.25, 20)` → 'amber' (exactly 1.25×); `ragFlag(0.2501, 20)` → 'red'.
  - `menuAnalytics` on a 3-drink menu (target 20): drink A price 10 gross pour 1.0 (net 8.4034 → cost% 0.119 → green), drink B price 12 pour 3.0 (net 10.084 → 0.2975 → red), drink C no price (unpriced). Assert rows length 3 in sort order; `avgCostPct` = mean of A,B only; `marginSpread` = {min: B margin, max: A margin}; `worstOffenderId` = B.
  - Empty menu → rows `[]`, `avgCostPct` null, `marginSpread` null, `worstOffenderId` null.
- [ ] **Step 2:** Run `npx vitest run src/lib/menuAnalytics.test.ts` → FAIL. **Step 3:** Implement. **Step 4:** green + `tsc -b`.
- [ ] **Step 5:** Commit `feat: menu analytics with RAG flags and worst-offender`.

### Task 4: Menu CSV module (TDD)

**Files:** Create `src/lib/menuCsv.ts`, `src/lib/menuCsv.test.ts`.
**Consumes:** `MenuAnalytics` (Task 3); `formatEur`, `formatNumber` (format.ts).
**Produces:**

```ts
export function menuCsv(analytics: MenuAnalytics, locale: Locale): string; // semicolon-delimited
```

Header: `name;price;pour_cost;cost_pct;margin;flag`. One row per `MenuRow`
using the same formatting the UI shows (price/pour cost/margin via
`formatEur`, cost % as `formatNumber(costPct*100) + ' %'`, flag as the raw
RagFlag word); unpriced cells emit an empty string. Trailing summary line
`average;;;<avgCostPct%>;;` (empty when null).

- [ ] **Step 1: Failing tests:** one priced + one unpriced row → assert exact header line, the priced row's cells equal `formatEur`/`formatNumber` outputs for the given locale, the unpriced row has empty price/cost/margin cells and a `unpriced` flag, and the average line reflects the single priced drink. Use `locale: 'de'`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** green.
- [ ] **Step 5:** Commit `feat: internal menu CSV export matching on-screen values`.

### Task 5: Data hooks — menus CRUD, reorder, recipe descriptions, delete guard

**Files:** Modify `src/hooks/useLibrary.ts`.
**Produces:**

```ts
// fetch: add menus (order name) + menu_items selects to the Promise.all; map into library
addMenu(name: string): Promise<string | null>;
renameMenu(id: string, name: string): Promise<string | null>;
deleteMenu(id: string): Promise<string | null>;               // delete items → delete menu
addMenuItem(menuId: string, recipeId: string): Promise<string | null>; // sort_order = max+1 within menu
removeMenuItem(id: string): Promise<string | null>;
reorderMenuItem(id: string, direction: 'up' | 'down'): Promise<string | null>; // swap sort_order with neighbour in same menu
export function recipeUsedByMenus(id: string, lib: Library): Menu[];
```

- [ ] **Step 1:** Add `menus`/`menu_items` to the fetch `Promise.all` and `setLibrary`. Implement the six mutations via the existing `run()` wrapper: `addMenuItem` computes `Math.max(...existing sort_order, -1) + 1`; `reorderMenuItem` finds the menu's items sorted, locates the neighbour in `direction`, and issues two `update` calls swapping `sort_order` (no-op if at an edge). Add `recipeUsedByMenus`.
- [ ] **Step 2:** `tsc -b` + lint + `npm test` green.
- [ ] **Step 3:** Commit `feat: menu CRUD, item reordering and recipe-in-menu guard`.

### Task 6: i18n + recipe description fields

**Files:** Modify `src/i18n/de.ts`, `src/i18n/en.ts`, `src/components/RecipeForm.tsx`, `src/components/RecipesTab.tsx` (extend the recipe delete guard's `usedByNames` with `recipeUsedByMenus`).
**Produces keys** (DE + EN, parity enforced): `nav.menus`, `menu.add`, `menu.rename`, `menu.delete`, `menu.deleteConfirm` `{name}`, `menu.empty`, `menu.name`, `menu.addRecipe`, `menu.removeRecipe`, `menu.moveUp`, `menu.moveDown`, `menu.pick` (placeholder for the add-recipe select), `menu.drink`, `menu.exportGuest`, `menu.exportInternalPdf`, `menu.exportCsv`, `menu.language`, `menu.avgCostPct`, `menu.marginSpread`, `menu.worstOffender`, `menu.none`, `menu.unpriced`, `menu.inUse` `{names}`, `recipe.descriptionDe`, `recipe.descriptionEn`, `flag.green`, `flag.amber`, `flag.red`.

- [ ] **Step 1:** Add all keys to both catalogs. **Step 2:** In `RecipeForm.tsx` add two textareas (`description_de`, `description_en`) wired to state seeded from `initial`, and submit their trimmed-or-null values (replacing the `null` placeholders from Task 2). In `RecipesTab.tsx`, extend the delete guard so a recipe used by a menu is blocked (append `recipeUsedByMenus(...).map(m => m.name)` to the form's `usedByNames`). **Step 3:** `npm test` (parity) + `tsc -b` green.
- [ ] **Step 4:** Commit `feat: recipe description fields and epic 3 i18n`.

### Task 7: Menus tab + menu detail board

**Files:** Create `src/components/MenusTab.tsx`, `src/components/MenuDetail.tsx`.
**Interfaces:**

```ts
export interface MenusTabProps {
  library: Library; settings: Settings;
  onAddMenu(name: string): Promise<string | null>;
  onRenameMenu(id: string, name: string): Promise<string | null>;
  onDeleteMenu(id: string): Promise<string | null>;
  onAddItem(menuId: string, recipeId: string): Promise<string | null>;
  onRemoveItem(id: string): Promise<string | null>;
  onReorder(id: string, direction: 'up' | 'down'): Promise<string | null>;
  onExportGuest(menu: Menu, language: Locale): void;
  onExportInternal(menu: Menu): void;
}
export interface MenuDetailProps {
  menu: Menu; library: Library; settings: Settings;
  onAddItem(recipeId: string): Promise<string | null>;
  onRemoveItem(id: string): Promise<string | null>;
  onReorder(id: string, direction: 'up' | 'down'): Promise<string | null>;
  onExportGuest(language: Locale): void;
  onExportInternal(): void;
}
```

Behaviour: `MenusTab` = left list of menus (add via inline input, rename,
delete-with-confirm) + selected `MenuDetail`. `MenuDetail` runs
`menuAnalytics(menu.id, library, settings)`; renders an analytics strip
(avg cost %, margin spread as `formatEur`..`formatEur`, worst-offender recipe
name or `menu.none`); a table (drink, price, pour cost, cost %, margin, a RAG
dot coloured by `flag`) whose numeric column headers toggle client-side sort
(default = menu order); each row has up/down (disabled at edges) and remove;
an "add recipe" `<select>` listing recipes not already on the menu; export
buttons (guest PDF with a DE/EN `<select>`, internal PDF, internal CSV — CSV
triggers a Blob download built from `menuCsv`). Empty menu → `menu.empty`.

- [ ] **Step 1:** Implement both. **Step 2:** `tsc -b` + lint green. **Step 3:** Commit `feat: menus tab with analytics board, sorting and reordering`.

### Task 8: Guest & internal print views

**Files:** Create `src/components/GuestMenuView.tsx`, `src/components/InternalMenuView.tsx`.
**Interfaces:**

```ts
export interface GuestMenuViewProps { menu: Menu; library: Library; language: Locale }
export interface InternalMenuViewProps { menu: Menu; library: Library; settings: Settings }
```

`GuestMenuView` renders into a `.print-area` container: menu name as a
heading, then each drink (menu order) — name, the description for `language`
(`description_de`/`description_en`, omitted if null), and selling price via
`formatEur` (omitted if null). **No** pour cost / cost % / margin anywhere.
`InternalMenuView` renders a `.print-area` with the full costing table
(same columns as the board) + analytics summary. Both are print-only
(`className="print-area"`, screen-hidden via existing `@media print` CSS plus
a wrapping `hidden print:block`); the parent mounts exactly one and calls
`window.print()`.

- [ ] **Step 1:** Implement both. **Step 2:** `tsc -b` + lint green. **Step 3:** Commit `feat: guest and internal menu print views`.

### Task 9: Wiring + verification

**Files:** Modify `src/components/LibraryScreen.tsx`.

- [ ] **Step 1:** Add `menus` to the `Tab` union and tabs array (`nav.menus`); pull the new `useLibrary` menu mutations; render `<MenusTab>` when active. Hold export state `{ kind: 'guest'|'internal', menu: Menu, language: Locale } | null`; `onExportGuest`/`onExportInternal` set it, then a `useEffect` on that state calls `window.print()` after paint and clears it on `afterprint`. Mount `<GuestMenuView>` or `<InternalMenuView>` (exactly one) while export state is set. Wire CSV download inside `MenuDetail` (no LibraryScreen state needed).
- [ ] **Step 2:** Full verification: `npm test`, `npx tsc -b`, `npm run lint`, `npm run build` all green.
- [ ] **Step 3: Operator handoff:** run `supabase/schema-epic3.sql` in the SQL editor.
- [ ] **Step 4: Manual acceptance (with user):** create a menu "Summer 2026"; add 3 recipes (one unpriced); confirm RAG dots, avg cost %, margin spread and worst-offender; sort by cost %; reorder a drink; add DE/EN descriptions to a recipe; export guest PDF (DE then EN — descriptions switch, **no** cost numbers, prices shown) and internal PDF/CSV (numbers match the board); try to delete a recipe that's on the menu → blocked.
- [ ] **Step 5:** Commit `feat: menu board wiring and print/export triggers`.

---

## Self-review notes

- Spec coverage: §1 schema → Task 1; types → Task 2; §2 analytics → Task 3; CSV (§3) → Task 4; data hooks (§3) → Task 5; i18n + description fields (§3, story 4) → Task 6; menus tab/detail board with sorting + RAG (story 1, 2) → Task 7; guest/internal print views (story 3) → Task 8; wiring + verification → Task 9.
- Placeholder scan: none — every code step shows concrete SQL/signatures; UI Tasks 7–9 specify exact props/behaviour (same executed-inline convention as Epics 1–2; all logic-bearing code — analytics, CSV — is fully specified in Tasks 3–4).
- Type consistency: `Menu`/`MenuItem` defined Task 2, consumed 3/5/7/8; `MenuAnalytics`/`RagFlag` defined Task 3, consumed 4/7/8; `recipeUsedByMenus` defined Task 5, consumed Task 6; `Locale` (Epic 1) reused for the guest language selector; RAG boundary convention (green ≤ target, amber ≤ 1.25×) pinned in Global Constraints and tested in Task 3.
- Guarded acceptance: guest-PDF "zero cost data" enforced structurally in Task 8 (`GuestMenuView` renders no cost fields); "internal export matches screen" guarded by the Task 4 CSV equality test against the formatters the board uses.
