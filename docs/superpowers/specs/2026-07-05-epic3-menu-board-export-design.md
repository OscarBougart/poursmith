# Epic 3 — Menu Board & Export: Design

**Date:** 2026-07-05
**Source PRD:** `02-prd-pour-cost-margin-engine.md` (Epic 3 only)
**Builds on:** Epic 1 (ingredient/prep library) and Epic 2 (recipe costing engine).

## Goal

Assemble recipes into named menus with a finance-aware board — per-drink
price, pour cost, cost %, margin, and red/amber/green profitability flags,
plus menu-level analytics. Export two ways: a guest-facing PDF with zero cost
data, and an internal PDF/CSV with full costing that matches the screen
exactly. Guest menu descriptions toggle DE/EN.

## Decisions (interview outcomes)

| Topic | Decision |
|---|---|
| PDF export | Browser print-to-PDF via dedicated styled print views (guest + internal), reusing Epic 2's batch-sheet print-CSS pattern. No new dependencies. CSV is a separate Blob download |
| RAG flags | Relative to target cost %: **green** cost% ≤ target, **amber** ≤ 1.25 × target, **red** > 1.25 × target. Target = recipe override ?? settings ?? 20 |
| Menu structure | Flat ordered list of recipes; manual up/down reordering. No sections |
| Bilingual fields | Add `description_de` + `description_en` to recipes. Guest menu shows the recipe's existing `name` as the title plus the description in the toggled language |
| Menu ↔ recipe data | Live: menus reference recipes and always show current price/cost. No snapshot, no per-menu price override |
| Guest PDF numbers | Hides costing (pour cost, cost %, margin) but **keeps the selling price**. "Zero cost data" per the acceptance criterion |

## 1. Database (`supabase/schema-epic3.sql`, run in the SQL editor)

**`menus`** — `id`, `user_id` (Epic 1 pattern), `name text not null`
(unique per user, `lower(name)` index), timestamps, `updated_at` trigger,
RLS `user_id = auth.uid()`.

**`menu_items`** — `id`, `menu_id uuid not null` → menus on delete cascade,
`recipe_id uuid not null` → recipes **on delete restrict**, `sort_order int
not null default 0`. RLS via parent menu ownership plus recipe-ownership check
(Epic 1/2 line-table pattern). Index on `menu_id`. Unique index on
`(menu_id, recipe_id)` so a recipe can't be added to the same menu twice.

**`recipes` alteration** — `add column description_de text`, `add column
description_en text` (both nullable).

Deleting a recipe used by a menu item is blocked by `on delete restrict`;
Epic 2's "in use" messaging on the recipe form extends to name menus.

## 2. Analytics module (`src/lib/menuAnalytics.ts`, pure TS, Vitest-tested)

Consumes Epic 2 `recipePourCost`, `costPct`, `grossMarginEur`,
`effectiveTargetPct`.

```ts
export type RagFlag = 'green' | 'amber' | 'red' | 'unpriced';
export interface MenuRow {
  recipe: Recipe;
  pourCost: number;
  priceGross: number | null;
  costPct: number | null;   // fraction
  marginEur: number | null;
  flag: RagFlag;
}
export interface MenuAnalytics {
  rows: MenuRow[];               // in menu sort order
  avgCostPct: number | null;    // fraction; excludes unpriced drinks
  marginSpread: { min: number; max: number } | null; // gross margin €, priced drinks
  worstOffenderId: string | null; // priced drink with the highest cost %
}
export function ragFlag(costPct: number | null, targetPct: number): RagFlag;
export function menuAnalytics(menuId: string, lib: Library, settings: Settings): MenuAnalytics;
```

- `ragFlag`: null cost% → `unpriced`; else fraction×100 compared to target
  (`≤ target` green, `≤ 1.25 × target` amber, else red). Boundary inclusive
  on the lower side (exactly target = green; exactly 1.25× = amber).
- Rows follow `menu_items.sort_order`. A menu item whose recipe pour cost
  throws (missing component) is defensively skipped in the analytics only if
  it errors; normal recipes always appear.
- `avgCostPct` = mean of priced drinks' cost% (null if none priced).
- `marginSpread` = min/max gross margin € across priced drinks.
- `worstOffenderId` = priced drink with the max cost% (ties → first in order).

## 3. Frontend

- **Data:** `Library` gains `menus: Menu[]` and `menuItems: MenuItem[]`;
  `useLibrary` fetches both and adds CRUD: `addMenu`, `renameMenu`,
  `deleteMenu`, `addMenuItem(menuId, recipeId)`, `removeMenuItem(id)`,
  `reorderMenuItem(id, direction)` (swaps `sort_order` with the neighbour).
  Recipe CRUD (Epic 2) extends to carry `description_de`/`description_en`;
  `recipeUsedByMenus(id, lib)` feeds the delete guard.
- **Menus tab** (fourth tab): master list of menus (add/rename/delete) →
  selected menu detail.
- **Menu detail:** analytics strip (avg cost %, margin spread, worst-offender
  name); a sortable table — columns drink, price, pour cost, cost %, margin,
  RAG dot — default order = menu order, clickable numeric headers sort
  client-side; per-row remove + up/down; an "add recipe" picker (recipes not
  already on the menu); three export buttons (guest PDF, internal PDF,
  internal CSV) and a DE/EN language selector for the guest export.
- **Recipe form** (Epic 2) gains `description_de` / `description_en` textareas.
- **`GuestMenuView`** — print-only styled page: menu name, and for each drink
  its `name`, the description in the selected language, and selling price
  (recipes without a price show the name/description only). No pour cost,
  cost %, or margin anywhere. Rendered into the print area, printed via
  `window.print()`.
- **`InternalMenuView`** — print-only page: full costing table + analytics.
- **CSV export** (`src/lib/menuCsv.ts`): `menuCsv(analytics, locale)` returns a
  semicolon-delimited string (header + one row per drink: name, price, pour
  cost, cost %, margin, flag) plus a totals/average line; downloaded via Blob
  (same mechanism as the Epic 1 template). Numbers formatted to match the
  on-screen values.
- i18n: all new strings in `de.ts`/`en.ts`; key parity enforced.
- Only one print view mounts at a time (guest **or** internal), so the shared
  `.print-area` CSS prints exactly the intended document.

## 4. Tests (Vitest)

- `ragFlag`: unpriced (null), exactly target → green, just above target →
  amber, exactly 1.25× target → amber, just above 1.25× → red.
- `menuAnalytics`: avg cost % excludes unpriced drinks; margin spread min/max;
  worst-offender = highest cost %; empty menu → nulls.
- `menuCsv`: header + rows; a priced and an unpriced drink; values equal the
  formatted on-screen numbers (guards the "internal export matches screen"
  acceptance).

## 5. Out of scope

Drag-and-drop reordering (up/down buttons instead), menu sections, per-menu
price overrides, menu duplication, print-server/headless PDF.

## Acceptance mapping

- Story 1 (named menu, per-drink table, sorting, RAG flags) → menus/menu_items
  + menu detail table + `ragFlag`.
- Story 2 (avg cost %, margin spread, worst-offender) → `menuAnalytics` + strip.
- Story 3 (guest PDF no numbers, internal PDF/CSV full costing) →
  `GuestMenuView` / `InternalMenuView` / `menuCsv`.
- Story 4 (DE/EN toggle, per-recipe descriptions) → recipe description_de/en +
  guest export language selector.
- Acceptance "guest PDF zero cost data" → `GuestMenuView` renders no
  cost/%/margin. "Internal export matches screen exactly" → `menuCsv` test
  asserts equality with the formatted row values.
