# Epic 2 — Recipe Costing Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recipes with live pour cost, cost %, gross margin and rounded suggested prices (German-VAT-honest), duplicate-as-variation, and batch sheets with dilution.

**Architecture:** Three new tables (`settings`, `recipes`, `recipe_lines`) follow Epic 1's RLS patterns. All math stays in pure TS modules (`units`, `pricing`, `recipeCost`, `batch`) layered on Epic 1's cost engine, so waste/VAT-net/nested-prep behavior propagates unchanged. UI adds a third tab reusing the slide-over + line-editor patterns.

**Tech Stack:** Existing stack only (Vite 8, React 19, TS strict, Tailwind v4, supabase-js, Vitest). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-04-epic2-recipe-costing-engine-design.md`

## Global Constraints

- Everything from the Epic 1 plan's Global Constraints still applies (strict TS, no enums, `import type`, i18n for every string, decimal comma inputs, commit per task).
- 1 oz = **30 ml**; cl = 10 ml; dash = 0.8 ml; barspoon = 5 ml. Volume units interconvert; `g` and `piece` only match themselves.
- Sales VAT fixed: `SALES_VAT = 0.19`. Purchase-side VAT (Epic 1) is untouched.
- Suggested price rounds **up** to the next 0,50 step (epsilon-guarded so 12,50 stays 12,50).
- Target cost %: `recipe.target_cost_pct_override ?? settings.target_cost_pct ?? 20`.
- Dilution presets (% of pre-dilution volume): shaken 25, stirred 20, built 10, thrown 15.
- `costPct` returns a **fraction** (e.g. 0.22); the UI multiplies by 100 for display.
- Glass/ice picklists are data values (not translated), from `src/data/barLists.ts`.

## File map

```
supabase/schema-epic2.sql                                  Task 1
src/data/types.ts (extend), src/data/barLists.ts           Task 2
src/lib/units.ts (+ test)                                  Task 2
src/lib/pricing.ts (+ test)                                Task 3
src/lib/recipeCost.ts (+ test)                             Task 4
src/lib/batch.ts (+ test)                                  Task 5
src/hooks/useLibrary.ts (extend), src/hooks/useSettings.ts Task 6
src/i18n/de.ts, en.ts (extend)                             Task 7
src/components/{RecipesTab,RecipeForm}.tsx                 Task 8
src/components/BatchSheetDialog.tsx                        Task 9
src/components/SettingsDialog.tsx, LibraryScreen (wire),
  IngredientForm/PrepForm usedByNames prop change          Task 10 (+ final verification)
```

---

### Task 1: Epic 2 schema SQL

**Files:** Create `supabase/schema-epic2.sql`.
**Produces:** tables `settings`, `recipes`, `recipe_lines` matching Task 2 types. Reuses Epic 1's `public.set_updated_at()`.

- [ ] **Step 1: Write the file:**

```sql
-- PourSmith Epic 2 schema. Run once in the Supabase SQL editor (after Epic 1's schema.sql).

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  target_cost_pct numeric not null default 20 check (target_cost_pct > 0 and target_cost_pct < 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
alter table public.settings enable row level security;
create policy "own settings" on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  glass text,
  ice text,
  method text not null default 'shaken' check (method in ('shaken','stirred','built','thrown')),
  price_gross numeric check (price_gross >= 0),
  target_cost_pct_override numeric check (target_cost_pct_override > 0 and target_cost_pct_override < 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index recipes_user_name_key on public.recipes (user_id, lower(name));
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();
alter table public.recipes enable row level security;
create policy "own recipes" on public.recipes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.recipe_lines (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete restrict,
  component_prep_id uuid references public.preps (id) on delete restrict,
  amount numeric not null check (amount > 0),
  unit text not null check (unit in ('ml','cl','oz','dash','barspoon','g','piece')),
  is_garnish boolean not null default false,
  check (num_nonnulls(ingredient_id, component_prep_id) = 1)
);
create index recipe_lines_recipe_id_idx on public.recipe_lines (recipe_id);
alter table public.recipe_lines enable row level security;
create policy "own recipe lines" on public.recipe_lines
  for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid())
    and (ingredient_id is null or exists (
      select 1 from public.ingredients i where i.id = ingredient_id and i.user_id = auth.uid()))
    and (component_prep_id is null or exists (
      select 1 from public.preps p where p.id = component_prep_id and p.user_id = auth.uid()))
  );
```

- [ ] **Step 2:** Sanity-read; no local runner (operator runs it in Task 10's handoff).
- [ ] **Step 3:** Commit `feat: epic 2 schema — settings, recipes, recipe lines`.

### Task 2: Types, bar lists, units module (TDD)

**Files:** Modify `src/data/types.ts`; create `src/data/barLists.ts`, `src/lib/units.ts`, `src/lib/units.test.ts`. Modify `src/lib/cost.test.ts`, `src/hooks/useLibrary.ts`, `src/components/PrepForm.tsx` (Library gained two required fields — fix all constructors).
**Produces:**

```ts
// types.ts additions
export const RECIPE_UNITS = ['ml','cl','oz','dash','barspoon','g','piece'] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];
export const METHODS = ['shaken','stirred','built','thrown'] as const;
export type Method = (typeof METHODS)[number];
export interface NewRecipe { name: string; glass: string | null; ice: string | null; method: Method; price_gross: number | null; target_cost_pct_override: number | null; notes: string | null }
export interface Recipe extends NewRecipe { id: string; created_at: string; updated_at: string }
export interface NewRecipeLine { ingredient_id: string | null; component_prep_id: string | null; amount: number; unit: RecipeUnit; is_garnish: boolean }
export interface RecipeLine extends NewRecipeLine { id: string; recipe_id: string }
export interface Settings { target_cost_pct: number }
// Library gains (required): recipes: Recipe[]; recipeLines: RecipeLine[];
// barLists.ts
export const GLASSES = ['Tumbler','Highball','Coupe','Nick & Nora','Weinglas','Flöte','Becher','Sonstiges'] as const;
export const ICE_TYPES = ['Würfel','Großer Würfel','Crushed','Ohne'] as const;
// units.ts
export const VOLUME_FACTORS_ML = { ml: 1, cl: 10, oz: 30, dash: 0.8, barspoon: 5 } as const;
export type VolumeUnit = keyof typeof VOLUME_FACTORS_ML;
export class UnitError extends Error { readonly from: RecipeUnit; readonly to: Unit }
export function isVolumeUnit(unit: string): unit is VolumeUnit;
export function toMl(amount: number, from: RecipeUnit): number | null;      // null for g/piece
export function convertAmount(amount: number, from: RecipeUnit, to: Unit): number; // throws UnitError on g/piece mismatch
```

- [ ] **Step 1: Failing tests** (`units.test.ts`): 1 oz→30 ml; 2 cl→20 ml; 3 dash→2.4 ml (closeTo); 1 barspoon→5 ml; ml→ml identity; `convertAmount(2,'oz','ml')`→60; `convertAmount(50,'g','g')`→50; `convertAmount(1,'piece','piece')`→1; `convertAmount(1,'oz','g')` throws UnitError; `convertAmount(1,'g','ml')` throws; `toMl(1,'oz')`→30; `toMl(5,'g')`→null.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement types + barLists + units; update `EMPTY_LIBRARY` in `useLibrary.ts` (add `recipes: [], recipeLines: []` — fetches come in Task 6), the `Library` literals in `cost.test.ts` (add a `lib(over)` builder defaulting the new arrays to `[]`), and PrepForm's hypothetical library (spread `...library` then override preps/prepLines). **Step 4:** `npx vitest run` + `tsc -b` green.
- [ ] **Step 5:** Commit `feat: recipe units with bar-oz conversion and extended library types`.

### Task 3: Pricing module (TDD)

**Files:** Create `src/lib/pricing.ts`, `src/lib/pricing.test.ts`.
**Produces:**

```ts
export const SALES_VAT = 0.19;
export function netOfVat(gross: number): number;                                 // gross / 1.19
export function costPct(pourCost: number, priceGross: number | null): number | null;   // fraction; null when price null/0
export function grossMarginEur(pourCost: number, priceGross: number | null): number | null;
export function effectiveTargetPct(override: number | null, settings: Settings | null): number; // override ?? settings ?? 20
export function roundUpTo(step: number, value: number): number;                  // Math.ceil((value - 1e-9) / step) * step
export function suggestedPriceGross(pourCost: number, targetPct: number): number; // roundUpTo(0.5, pourCost/(targetPct/100)*(1+SALES_VAT))
```

- [ ] **Step 1: Failing tests:** `netOfVat(11.9)`→10 (closeTo); `costPct(2, 11.9)`→0.2; `costPct(2, null)`/`costPct(2, 0)`→null; `grossMarginEur(2, 11.9)`→8; `effectiveTargetPct(25, {target_cost_pct: 18})`→25; `(null, {18})`→18; `(null, null)`→20; `roundUpTo(0.5, 12.17)`→12.5; `roundUpTo(0.5, 12.5)`→12.5; `roundUpTo(0.5, 12.51)`→13; `suggestedPriceGross(2.05, 20)`→12.5 (2.05/0.2×1.19 = 12.1975 → 12.5).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** green.
- [ ] **Step 5:** Commit `feat: pricing math — VAT-net margins and rounded suggested prices`.

### Task 4: Recipe cost module (TDD)

**Files:** Create `src/lib/recipeCost.ts`, `src/lib/recipeCost.test.ts`.
**Consumes:** `ingredientUnitCost`, `prepUnitCost`, `CostError` (Epic 1 cost.ts); `convertAmount` (Task 2).
**Produces:**

```ts
export function recipeLineCost(line: NewRecipeLine, lib: Library): number; // throws CostError('missing') / UnitError
export function recipePourCost(recipeId: string, lib: Library): number;   // Σ lines incl. garnish; CostError('missing') for unknown recipe
```

- [ ] **Step 1: Failing tests.** Reuse Epic 1 builder style (ing/prep/line builders + new recipe/recipeLine builders). Cases: gin 700 ml pack net 14 → 0.02 €/ml, line 2 oz → 60 ml → 1.20 €; g line against g ingredient; piece garnish line costed and included; unit mismatch throws UnitError; unknown component throws CostError; end-to-end acceptance: recipe = 2 oz gin (0.02 €/ml → 1.20) + 20 ml Citrus Cordial from the Epic 1 two-level chain (unit cost 5.5/480 → 0.2292) + 1 piece lime with 20 % waste (net 0.40/piece → 0.50) → pour cost closeTo(1.20 + 0.2292 + 0.50, 4 dp).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (component native unit = ingredient.unit or prep.yield_unit; look up, convert, multiply by Epic 1 unit cost). **Step 4:** green.
- [ ] **Step 5:** Commit `feat: recipe pour cost over converted units and nested preps`.

### Task 5: Batch module (TDD)

**Files:** Create `src/lib/batch.ts`, `src/lib/batch.test.ts`.
**Produces:**

```ts
export const DILUTION_PRESETS: Record<Method, number> = { shaken: 25, stirred: 20, built: 10, thrown: 15 };
export interface BatchLine { name: string; amount: number; unit: RecipeUnit; amountMl: number | null; cost: number }
export interface BatchSheet { lines: BatchLine[]; waterMl: number; totalVolumeMl: number; totalCost: number; costPerServe: number; serves: number }
export function preDilutionVolumeMl(recipeId: string, lib: Library): number;  // Σ toMl of volume lines; g/piece excluded
export function batchForServes(recipeId: string, lib: Library, serves: number, dilutionPct: number): BatchSheet;
export function batchForVolume(recipeId: string, lib: Library, targetMl: number, dilutionPct: number): BatchSheet;
```

Math: scale s (= serves, or `targetMl / (V × (1 + d/100))`); each line amount × s (cost × s too); `waterMl = V × s × d/100`; `totalVolumeMl = V × s × (1 + d/100)`; `costPerServe = totalCost / serves`.

- [ ] **Step 1: Failing tests.** Recipe: 60 ml gin (0.02 €/ml) + 1 oz cordial + 1 piece lime. V = 60 + 30 = 90 ml (piece excluded). `batchForServes(…, 10, 25)`: gin line amount 600 ml, lime 10 piece with `amountMl: null`, waterMl 225, totalVolumeMl 1125, serves 10, costPerServe = per-serve pour cost. `batchForVolume(…, 1125, 25)` returns serves closeTo 10. Presets object spot-check (shaken 25, built 10).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** green.
- [ ] **Step 5:** Commit `feat: batch sheets — scaling, dilution and cost per serve`.

### Task 6: Data hooks — recipes CRUD, duplicate, settings

**Files:** Modify `src/hooks/useLibrary.ts`; create `src/hooks/useSettings.ts`.
**Produces:**

```ts
// useLibrary additions
export interface RecipeInput extends NewRecipe { lines: NewRecipeLine[] }
addRecipe(v: RecipeInput): Promise<string | null>;
updateRecipe(id: string, v: RecipeInput): Promise<string | null>;   // update row → delete lines → insert lines
deleteRecipe(id: string): Promise<string | null>;                   // delete lines → delete recipe
duplicateRecipe(id: string, newName: string): Promise<string | null>; // copy recipe row (with newName) + its lines
export function ingredientUsedByRecipes(id: string, lib: Library): Recipe[];
export function prepUsedByRecipes(id: string, lib: Library): Recipe[];
// fetch: add recipes (order name) + recipe_lines selects to the existing Promise.all
// useSettings.ts
export function useSettings(enabled: boolean): { targetCostPct: number; save: (pct: number) => Promise<string | null> };
// read single row, fallback 20; save: update by id if row exists, else insert { target_cost_pct: pct }
```

- [ ] **Step 1:** Implement both (patterns identical to Epic 1 prep CRUD / run() wrapper). **Step 2:** `tsc -b` + lint + `npm test` green. **Step 3:** Commit `feat: recipe CRUD, duplication and settings hooks`.

### Task 7: i18n additions

**Files:** Modify `src/i18n/de.ts`, `src/i18n/en.ts`.
**Produces keys** (DE and EN; type parity enforces completeness): `nav.recipes`, `recipe.add`, `recipe.edit`, `recipe.glass`, `recipe.ice`, `recipe.method`, `method.shaken`, `method.stirred`, `method.built`, `method.thrown`, `recipe.priceGross`, `recipe.targetOverride`, `recipe.pourCost`, `recipe.costPct`, `recipe.margin`, `recipe.suggestedPrice`, `recipe.duplicate`, `recipe.variantSuffix` (DE "Variante", EN "variation"), `recipe.deleteConfirm` `{name}`, `recipe.empty`, `recipe.garnish`, `recipe.batchSheet`, `recipe.unitMismatch` `{name}`, `unit.cl`, `unit.oz`, `unit.dash`, `unit.barspoon`, `batch.title` `{name}`, `batch.mode.serves`, `batch.mode.volume`, `batch.dilution`, `batch.water`, `batch.totalVolume`, `batch.totalCost`, `batch.costPerServe`, `batch.serves`, `batch.print`, `settings.title`, `settings.targetCostPct`.

- [ ] **Step 1:** Add keys to both catalogs. **Step 2:** `npm test` (parity test) green. **Step 3:** Commit `feat: epic 2 i18n strings`.

### Task 8: Recipes tab + recipe form

**Files:** Create `src/components/RecipesTab.tsx`, `src/components/RecipeForm.tsx`.
**Interfaces:**

```ts
export interface RecipesTabProps {
  library: Library; settings: Settings;
  onAdd(v: RecipeInput): Promise<string | null>;
  onUpdate(id: string, v: RecipeInput): Promise<string | null>;
  onDelete(id: string): Promise<string | null>;
  onDuplicate(id: string, newName: string): Promise<string | null>;
  onOpenBatch(recipe: Recipe): void;
}
export interface RecipeFormProps {
  initial: Recipe | null; library: Library; settings: Settings;
  onSubmit(v: RecipeInput): Promise<string | null>; onDelete: (() => Promise<string | null>) | null; onClose(): void;
}
```

Behavior: table columns name, glass, price, pour cost, cost % (fraction × 100, 1 decimal), margin €, suggested price; "—" for null price / cost errors (try/catch). Row actions: duplicate (name = `${name} (${t('recipe.variantSuffix')})`, then ` 2`, ` 3`… until unique), batch sheet, row click edit. Form: PrepForm's line-editor pattern + per-line unit `<select>` (RECIPE_UNITS, labels via `unit.*`) + garnish checkbox; line unit validated compatible with the component's native unit (volume↔ml ok; g↔g; piece↔piece) — incompatible shows `recipe.unitMismatch`; glass/ice selects from `GLASSES`/`ICE_TYPES` (empty option allowed); method select; price/override decimal inputs (optional, validated ≥0 / 0<x<100); live panel computes pour cost, cost %, margin, suggested price on each render from a hypothetical library (Task 10 in Epic 1 pattern: substitute draft recipe + lines under id `'__draft__'`).

- [ ] **Step 1:** Implement both. **Step 2:** `tsc -b` + lint green. **Step 3:** Commit `feat: recipes tab with live costing panel and duplicate action`.

### Task 9: Batch sheet dialog

**Files:** Create `src/components/BatchSheetDialog.tsx`.
**Interface:** `export interface BatchSheetDialogProps { recipe: Recipe | null; library: Library; onClose(): void }` (renders nothing when recipe null).

Behavior: SlideOver titled `batch.title {name}`; mode toggle (serves | target volume) with one decimal input each; dilution % input prefilled `DILUTION_PRESETS[recipe.method]`; recompute `batchForServes`/`batchForVolume` on every change (try/catch → "—"); table of scaled lines (amount + unit, ml column when `amountMl !== null`, cost), water row, totals row, cost per serve; print button calls `window.print()` with `print:` Tailwind classes hiding everything but the sheet.

- [ ] **Step 1:** Implement. **Step 2:** `tsc -b` + lint green. **Step 3:** Commit `feat: batch sheet dialog with dilution and print view`.

### Task 10: Settings dialog, wiring, verification

**Files:** Create `src/components/SettingsDialog.tsx`; modify `src/components/LibraryScreen.tsx` (third tab, gear button, batch state, settings state), `src/components/IngredientForm.tsx` + `src/components/PrepForm.tsx` (prop `usedBy: Prep[]` → `usedByNames: string[]`), `src/components/IngredientsTab.tsx` + `src/components/PrepsTab.tsx` (pass `[...preps, ...recipes].map(x => x.name)` from the usage lookups so recipes also block deletion).

- [ ] **Step 1:** Implement: `SettingsDialog { open, targetCostPct, onSave, onClose }` — one decimal input, validates 0<x<100, saves via `useSettings.save`. LibraryScreen: tabs array gains `recipes`; gear button in header opens settings; `<RecipesTab>` + `<BatchSheetDialog>` wired; `useSettings(true)`.
- [ ] **Step 2:** Full verification: `npm test`, `npx tsc -b`, `npm run lint`, `npm run build` all green.
- [ ] **Step 3: Operator handoff:** run `supabase/schema-epic2.sql` in the SQL editor.
- [ ] **Step 4: Manual acceptance (with user):** build a Gin Sour-style recipe (2 oz gin, 20 ml Citrus Cordial, lime garnish) — pour cost live while typing; set price 12 € → cost % and margin update; clear price → "—"; suggested price ends on ,00/,50; duplicate → "(Variante)" copy; batch sheet for 10 serves shows scaled lines + dilution water; change Zucker price → recipe cost moves (two-level chain propagation).
- [ ] **Step 5:** Commit `feat: settings dialog and recipe tab wiring`.

---

## Self-review notes

- Spec coverage: §1 schema → Task 1; §2 engine (units/recipeCost/pricing/batch) → Tasks 2–5; §3 frontend (hooks, tab, form, batch, settings, in-use extension) → Tasks 6–10; §4 tests → Tasks 2–5 test lists; duplicate story → Task 6 hook + Task 8 action.
- Type consistency: `RecipeInput` defined Task 6, consumed Task 8; `Settings` from Task 2 consumed by pricing (Task 3) and UI (Tasks 8/10); `UnitError` from Task 2 caught in Task 8's form; fraction-vs-percent convention pinned in Global Constraints.
- UI Tasks 8–10 specify exact props/behavior over full JSX (same executed-inline convention as the Epic 1 plan; all logic-bearing code is complete in Tasks 1–5).
