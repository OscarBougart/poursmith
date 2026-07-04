# Epic 1 — Ingredient & Prep Library: Design

**Date:** 2026-07-04
**Source PRD:** `02-prd-pour-cost-margin-engine.md` (Epic 1 only)
**Stack:** Vite + React 19 + TypeScript (strict) + Tailwind v4 + Supabase

## Goal

The costing foundation for PourSmith. A bar manager can maintain a library of
purchased ingredients and house preps, with real (waste-adjusted, net-of-VAT)
cost per ml/g/piece derived automatically. Changing one bottle price propagates
through every prep instantly. Library can be bootstrapped from a CSV.

## Decisions (interview outcomes)

| Topic | Decision |
|---|---|
| Auth/tenancy | Single owner via Supabase email/password; all tables carry `user_id`, RLS keyed to `auth.uid()` |
| Waste model | `waste_pct` on purchased ingredients; prep loss expressed via the prep's stated yield |
| Prep nesting | Unlimited depth; cycle detection in UI **and** a DB trigger |
| CSV import | Fixed downloadable template with preview + per-row validation |
| Purchase VAT | Prices entered gross with VAT-rate selector (19% / 7% / 0%); system stores and costs from net |
| Cost engine | Pure client-side TypeScript functions, unit-tested with Vitest; DB stores raw inputs only |
| Seed data | `seed.sql` with ~25 realistic ingredients + 5 preps (incl. a nested prep chain) |
| Language | DE default, EN toggle, persisted in localStorage; all strings via i18n key lookup |

## 1. Database schema (Supabase SQL editor)

Delivered as `supabase/schema.sql` (paste into SQL editor) plus `supabase/seed.sql`.

### Tables

**`ingredients`**
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null default auth.uid()` → `auth.users`
- `name text not null` (unique per user, case-insensitive)
- `category text not null check in ('spirit','liqueur','juice','syrup','produce','other')`
- `pack_size numeric not null check (> 0)` — size of the purchased pack/bottle
- `unit text not null check in ('ml','g','piece')`
- `price_gross numeric not null check (>= 0)` — invoice price incl. VAT
- `vat_rate numeric not null default 0.19 check in (0, 0.07, 0.19)`
- `price_net numeric generated always as (price_gross / (1 + vat_rate)) stored`
- `waste_pct numeric not null default 0 check (>= 0 and < 100)`
- `created_at`, `updated_at` (trigger-maintained)

**`preps`**
- `id`, `user_id` (as above)
- `name text not null` (unique per user, case-insensitive)
- `yield_amount numeric not null check (> 0)`
- `yield_unit text not null check in ('ml','g','piece')`
- `notes text`
- `created_at`, `updated_at`

**`prep_lines`**
- `id uuid pk`
- `prep_id uuid not null` → `preps` on delete cascade
- `ingredient_id uuid null` → `ingredients` on delete restrict
- `component_prep_id uuid null` → `preps` on delete restrict
- `amount numeric not null check (> 0)` — in the component's native unit
- `check (num_nonnulls(ingredient_id, component_prep_id) = 1)`
- `check (component_prep_id is distinct from prep_id)` (no direct self-reference)

### Integrity & security

- RLS enabled on all three tables; policies: `user_id = auth.uid()` for
  select/insert/update/delete (prep_lines checks ownership via parent prep).
- `updated_at` maintained by a shared trigger function.
- Cycle guard: `before insert or update` trigger on `prep_lines` walks
  `component_prep_id` ancestry with a recursive CTE and raises on a cycle.
  The UI performs the same check before submit for a friendly error.
- Deleting an ingredient/prep that is used by a prep line is blocked by
  `on delete restrict`; the UI explains where it is used.

### Seed

`supabase/seed.sql` inserts ~25 ingredients (spirits, liqueurs, juices,
syrups, produce) and 5 preps for the first user in `auth.users`, including a
two-level chain (oleo saccharum → citrus cordial) to prove nesting. Run after
the owner account exists.

## 2. Cost engine (`src/lib/cost.ts`)

Pure functions, no I/O; consumed by the UI and later by Epic 2.

- `ingredientUnitCost(i)` = `price_net / pack_size / (1 − waste_pct/100)` → €/ml, €/g or €/piece.
- `prepUnitCost(prepId, library)` = Σ(line amount × component unit cost) / `yield_amount`, resolved recursively with memoization.
- Cycle detection: `wouldCreateCycle(prepId, componentPrepId, library)` used by forms; the recursive resolver also throws a typed error on cycles rather than looping.
- All money math in plain `number` with rounding only at display time (4-decimal internal precision is sufficient at library scale; formatting via `Intl.NumberFormat('de-DE'/'en-DE', EUR)`).

**Tests (Vitest, new dev dependency):** unit costs incl. waste and VAT-to-net,
single- and two-level prep chains, propagation (changed input price changes
derived prep cost), cycle detection, division-by-zero guards.

## 3. Frontend

### Structure

```
src/
  lib/        supabase.ts (client), cost.ts, csv.ts, validation.ts
  hooks/      useAuth.ts, useLibrary.ts (fetch + mutate ingredients/preps), useLocale.ts
  i18n/       de.ts, en.ts, index.ts (useT hook, key lookup)
  components/ small typed components (tables, forms, dialogs, banners)
  data/       types.ts (DB row types, enums), csvTemplate.ts
  App.tsx     auth gate: LoginScreen ↔ LibraryScreen (no router yet)
```

### Screens & flows

- **Login** — email/password against Supabase; error banner on failure.
- **Library** — header (app name, DE/EN toggle, sign-out) + two tabs:
  - *Ingredients*: search box + category filter; table with name, category,
    pack (size + unit), net price, waste %, derived cost per unit. Row click
    opens edit; "Add ingredient" opens the same slide-over form.
  - *Preps*: table with name, yield, derived cost per unit, component count;
    expandable rows list components with their line costs. Prep form manages
    lines (pick ingredient or prep, amount) with live derived cost and cycle
    prevention (a prep cannot pick itself or any ancestor).
- **Ingredient form** — gross price + VAT-rate selector with the computed net
  shown live; validation inline (required, positive numbers, waste < 100).
- **CSV import** (Ingredients tab) — dialog with: template download
  (`name,category,pack_size,unit,price_gross,vat_rate,waste_pct`, semicolon-
  or comma-delimited, decimal comma accepted), file upload, preview table
  flagging per-row errors (unknown category/unit, bad numbers, duplicate
  names), "import N valid rows" action. CSV covers purchased ingredients
  only; preps are entered in the UI.
- **Propagation** — `useLibrary` holds the full library in memory; all derived
  costs are computed at render time from it, so any price edit re-renders
  every dependent prep cost instantly (the Epic 1 acceptance criterion).

### Cross-cutting

- i18n: every user-facing string through `useT()`; DE default, persisted.
- Errors: Supabase failures → dismissible error banner; destructive actions
  (delete) confirm first and report "in use by …" conflicts meaningfully.
- Styling: Tailwind v4; components small, typed, no `any`.
- Accessibility: labelled inputs, focus-trapped dialogs, keyboard-operable tables.

## 4. Out of scope (Epic 1)

Unit conversion (oz↔ml), recipes/pour cost/pricing/VAT-on-sales (Epic 2),
menus/export (Epic 3), CSV import of preps, multi-user, offline.

## 5. Operator setup (manual steps)

1. Create Supabase project; enable Email provider; create the owner account.
2. Run `supabase/schema.sql`, then `supabase/seed.sql` in the SQL editor.
3. Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Acceptance mapping

- Story 1 (purchased ingredient w/ cost per unit) → ingredients table + form + derived unit cost column.
- Story 2 (house prep, derived, auto-updating) → preps/prep_lines + client-side derivation.
- Story 3 (waste %) → `waste_pct` in schema, form, cost engine, CSV.
- Story 4 (CSV import) → template + preview + validated import.
- Acceptance "price change propagates instantly" → in-memory derivation, covered by a Vitest propagation test and manual check.
- Acceptance "prep can contain a prep" → unlimited nesting + cycle guard; seed contains a two-level chain.
