# Epic 2 — Recipe Costing Engine: Design

**Date:** 2026-07-04
**Source PRD:** `02-prd-pour-cost-margin-engine.md` (Epic 2 only)
**Builds on:** Epic 1 (`docs/superpowers/specs/2026-07-04-epic1-ingredient-prep-library-design.md`)

## Goal

Recipes built from library ingredients and preps, with live pour cost, cost %
at the current menu price, gross margin (€), and a rounded suggested price for
a target cost % — all German-VAT-honest. Duplicate-as-variation and batch
sheets keep R&D and prep in sync with costing.

## Decisions (interview outcomes)

| Topic | Decision |
|---|---|
| Units | Recipe lines in ml, cl, oz, dash, barspoon, g, piece. **1 oz = 30 ml** (bar convention); dash = 0.8 ml, barspoon = 5 ml. Volume units interconvert; g and piece must match the component's native unit |
| Price rounding | Suggested gross price rounds **up** to the next 0,50 step |
| Target cost % | Global setting (default 20) + optional per-recipe override |
| Garnish / glass / ice | Garnish lines are costed library lines flagged `is_garnish`; glass and ice are no-cost text picklists |
| Dilution | Recipe has a `method` (shaken 25 % / stirred 20 % / built 10 % / thrown 15 %) presetting the batch sheet's editable dilution % |
| Sales VAT | Fixed 19 % on all menu prices (prices entered gross, margins computed net) |

## 1. Database (run `supabase/schema-epic2.sql` in the SQL editor)

**`settings`** — `id uuid pk`, `user_id uuid not null unique default auth.uid()`,
`target_cost_pct numeric not null default 20 check (> 0 and < 100)`,
timestamps. RLS `user_id = auth.uid()`. Row created lazily by the app
(upsert on first save; readers fall back to 20 when absent).

**`recipes`** — `id`, `user_id` (Epic 1 pattern), `name text not null`
(unique per user, `lower(name)` index), `glass text`, `ice text`,
`method text not null default 'shaken' check in ('shaken','stirred','built','thrown')`,
`price_gross numeric check (>= 0)` nullable, `target_cost_pct_override numeric
check (> 0 and < 100)` nullable, `notes text`, timestamps, `updated_at`
trigger, RLS `user_id = auth.uid()`.

**`recipe_lines`** — `id`, `recipe_id` → recipes on delete cascade,
`ingredient_id` → ingredients on delete restrict, `component_prep_id` → preps
on delete restrict, `check (num_nonnulls(ingredient_id, component_prep_id) = 1)`,
`amount numeric not null check (> 0)`,
`unit text not null check in ('ml','cl','oz','dash','barspoon','g','piece')`,
`is_garnish boolean not null default false`. RLS via parent recipe ownership
plus component-ownership checks (Epic 1 `prep_lines` pattern). Index on
`recipe_id`.

Deleting an ingredient/prep used by a recipe line is blocked by
`on delete restrict`; Epic 1's "in use" UI messages extend to recipes.

## 2. Engine modules (pure TS, Vitest-tested)

**`src/lib/units.ts`**
- `VOLUME_FACTORS_ML = { ml: 1, cl: 10, oz: 30, dash: 0.8, barspoon: 5 }`
- `RECIPE_UNITS = ['ml','cl','oz','dash','barspoon','g','piece']`, type `RecipeUnit`
- `convertAmount(amount, from: RecipeUnit, to: Unit): number` — volume→ml/volume
  conversions; `g→g`, `piece→piece` identity; anything else throws
  `UnitError` (typed, i18n-keyed message in the form)
- `toMl(amount, from): number | null` — null for g/piece (used by batch volume)

**`src/lib/recipeCost.ts`**
- `recipeLineCost(line, lib)` = `convertAmount(line.amount, line.unit, componentNativeUnit) × componentUnitCost` (component cost via Epic 1 `ingredientUnitCost` / `prepUnitCost`, so waste, VAT-net and nested preps propagate unchanged)
- `recipePourCost(recipeId, lib)` = Σ line costs, garnish included
- Extends `Library` with `recipes: Recipe[]` and `recipeLines: RecipeLine[]`

**`src/lib/pricing.ts`**
- `SALES_VAT = 0.19`
- `netOfVat(gross)` = `gross / (1 + SALES_VAT)`
- `costPct(pourCost, priceGross)` = `pourCost / netOfVat(priceGross)` (null when price unset/0)
- `grossMarginEur(pourCost, priceGross)` = `netOfVat(priceGross) − pourCost`
- `effectiveTargetPct(recipe, settings)` = `recipe.target_cost_pct_override ?? settings.target_cost_pct ?? 20`
- `suggestedPriceGross(pourCost, targetPct)` = `roundUpTo(0.5, (pourCost / (targetPct/100)) × (1 + SALES_VAT))`

**`src/lib/batch.ts`**
- `DILUTION_PRESETS = { shaken: 25, stirred: 20, built: 10, thrown: 15 }`
- `preDilutionVolumeMl(recipeId, lib)` = Σ `toMl` of volume lines (g/piece lines excluded from volume, included in cost)
- `batchForServes(recipeId, lib, serves, dilutionPct)` → `{ lines: [{name, amount, unit, amountMl|null, cost}], waterMl, totalVolumeMl, totalCost, costPerServe }`
- `batchForVolume(recipeId, lib, targetMl, dilutionPct)` → same shape + `serves` (exact, displayed to 1 decimal); scale factor = `targetMl / (V × (1 + d))`

## 3. Frontend

- **Data:** `useLibrary` gains `recipes`/`recipe_lines` fetches and CRUD
  (`addRecipe`, `updateRecipe`, `deleteRecipe`, `duplicateRecipe`) following
  the prep pattern (update = replace lines). New `useSettings` hook:
  read (fallback 20), `saveTargetCostPct` (upsert).
- **Recipes tab** (third tab): table — name, glass, price (gross),
  pour cost, cost %, margin €, suggested price; "—" where price unset.
  Row click edits. Row actions: **Duplicate** (copies recipe + lines, name +
  " (Variante)"/" (variation)", numbered suffix on collision) and
  **Batch sheet**.
- **Recipe form** (wide slide-over): name, glass picklist (Tumbler, Highball,
  Coupe, Nick & Nora, Weinglas, Flöte, Becher, Sonstiges), ice picklist
  (Würfel, großer Würfel, crushed, ohne), method select, gross price,
  target-% override, notes; line editor = prep form pattern + per-line unit
  select (validated against the component's native unit) + garnish checkbox;
  live panel: pour cost, cost %, margin €, suggested price.
- **Batch sheet dialog:** mode toggle (N serves | target volume), dilution %
  prefilled from method, scaled ingredient table (native unit + ml), dilution
  water line, totals, cost per serve. Print via browser (`print:` styles keep
  the dialog clean on paper).
- **Settings dialog** (header gear): target cost % input, saved to `settings`.
- i18n: all new strings in `de.ts`/`en.ts`; key parity enforced as before.

## 4. Tests (acceptance is explicitly test-driven)

- Units: oz→ml (1 oz = 30 ml), cl/dash/barspoon factors, volume→volume,
  g/piece identity, incompatible pair throws.
- Pricing: net-of-VAT, cost % at price, margin, suggested price rounds UP to
  0,50 (12,17 → 12,50; 12,50 → 12,50), override precedence
  (recipe > settings > 20).
- Recipe cost: a recipe using the two-level Citrus Cordial chain plus a
  wasted ingredient and an oz-measured spirit costs correctly end-to-end
  (hand-computed expected value).
- Batch: serves mode and target-volume mode with dilution; g/piece lines
  scale in cost but not volume.

## 5. Out of scope (Epic 3)

Menus, profitability flags, sorting/analytics, exports (guest/internal),
per-recipe DE/EN description fields.

## Acceptance mapping

- Story 1 (build recipe, live pour cost) → recipes/recipe_lines + form live panel.
- Story 2 (cost %, margin, suggested price, VAT-honest) → `pricing.ts` + live panel + settings.
- Story 3 (duplicate as variation) → Duplicate action.
- Story 4 (batch sheet, scale + dilution) → `batch.ts` + batch dialog.
- Acceptance (unit-tested math incl. conversions, prep-derived costs, waste, two-level chain) → §4 test list.
