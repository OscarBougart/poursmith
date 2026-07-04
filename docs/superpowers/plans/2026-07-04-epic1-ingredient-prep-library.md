# Epic 1 — Ingredient & Prep Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Epic 1 of PourSmith: Supabase schema + seed for ingredients/preps, a unit-tested client-side cost engine, and a bilingual React library UI with CSV import.

**Architecture:** DB stores raw inputs only (three tables, RLS, cycle-guard trigger). All derived costs are computed by pure TypeScript functions from an in-memory `Library` snapshot, so price edits propagate instantly. UI is a single auth-gated screen with Ingredients/Preps tabs; no router.

**Tech Stack:** Vite 8, React 19, TypeScript strict, Tailwind v4 (`@tailwindcss/vite`), supabase-js v2, Vitest (new dev dep). No other new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-04-epic1-ingredient-prep-library-design.md`

## Global Constraints

- TypeScript strict; no `any` anywhere. `tsconfig.app.json` currently lacks `strict: true` — Task 2 adds it.
- `erasableSyntaxOnly` is on: no TS enums; use `as const` arrays. `verbatimModuleSyntax` is on: use `import type` for types.
- Every user-facing string goes through `useT()` (i18n key lookup). DE is default locale, persisted under localStorage key `poursmith.locale`.
- Currency EUR; purchase prices entered gross with VAT rate ∈ {0.19, 0.07, 0}; costing uses net. Decimal comma accepted in all numeric inputs and CSV.
- Categories: `spirit, liqueur, juice, syrup, produce, other`. Units: `ml, g, piece`. Waste: `0 ≤ waste_pct < 100`.
- Components small and typed; props interfaces exported; default exports; accessibility labels on inputs/buttons; Tailwind classes for styling.
- Commit after every task (small, conventional messages).

## File map

```
supabase/schema.sql, supabase/seed.sql          Task 1
tsconfig.app.json, vite.config.ts, package.json Task 2 (strict, @ alias, vitest)
src/data/types.ts                               Task 2
src/lib/parse.ts (+ test)                       Task 3
src/lib/cost.ts (+ test), src/lib/format.ts     Task 3
src/lib/csv.ts (+ test), src/data/csvTemplate…  Task 4 (template string lives in csv.ts)
src/i18n/de.ts, en.ts, index.tsx (+ test)       Task 5
src/lib/supabase.ts, src/hooks/useAuth.ts,
  src/components/LoginScreen.tsx                Task 6
src/hooks/useLibrary.ts                         Task 7
src/components/{Banner,SlideOver,ConfirmDialog,Field}.tsx  Task 8
src/lib/validation.ts (+ test)                  Task 8
src/components/{IngredientsTab,IngredientForm}.tsx         Task 9
src/components/{PrepsTab,PrepForm}.tsx                     Task 10
src/components/CsvImportDialog.tsx                         Task 11
src/App.tsx, src/components/LibraryScreen.tsx,
  src/index.css, index.html, deletions          Task 12 (+ final verification)
```

---

### Task 1: Supabase schema + seed SQL

**Files:** Create `supabase/schema.sql`, `supabase/seed.sql`.
**Interfaces produced:** tables `ingredients`, `preps`, `prep_lines` exactly as typed in `src/data/types.ts` (Task 2).

- [ ] **Step 1: Write `supabase/schema.sql`:**

```sql
-- PourSmith Epic 1 schema. Run once in the Supabase SQL editor.

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in ('spirit','liqueur','juice','syrup','produce','other')),
  pack_size numeric not null check (pack_size > 0),
  unit text not null check (unit in ('ml','g','piece')),
  price_gross numeric not null check (price_gross >= 0),
  vat_rate numeric not null default 0.19 check (vat_rate in (0, 0.07, 0.19)),
  price_net numeric generated always as (round(price_gross / (1 + vat_rate), 4)) stored,
  waste_pct numeric not null default 0 check (waste_pct >= 0 and waste_pct < 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ingredients_user_name_key on public.ingredients (user_id, lower(name));

create table public.preps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  yield_amount numeric not null check (yield_amount > 0),
  yield_unit text not null check (yield_unit in ('ml','g','piece')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index preps_user_name_key on public.preps (user_id, lower(name));

create table public.prep_lines (
  id uuid primary key default gen_random_uuid(),
  prep_id uuid not null references public.preps (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete restrict,
  component_prep_id uuid references public.preps (id) on delete restrict,
  amount numeric not null check (amount > 0),
  check (num_nonnulls(ingredient_id, component_prep_id) = 1),
  check (component_prep_id is null or component_prep_id <> prep_id)
);
create index prep_lines_prep_id_idx on public.prep_lines (prep_id);

-- keep updated_at honest
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger ingredients_updated_at before update on public.ingredients
  for each row execute function public.set_updated_at();
create trigger preps_updated_at before update on public.preps
  for each row execute function public.set_updated_at();

-- reject circular prep references (defense in depth; UI checks first)
create or replace function public.check_prep_cycle()
returns trigger language plpgsql as $$
begin
  if new.component_prep_id is null then
    return new;
  end if;
  if exists (
    with recursive deps as (
      select new.component_prep_id as pid
      union
      select pl.component_prep_id
      from public.prep_lines pl
      join deps d on pl.prep_id = d.pid
      where pl.component_prep_id is not null
    )
    select 1 from deps where pid = new.prep_id
  ) then
    raise exception 'circular prep reference';
  end if;
  return new;
end $$;

create trigger prep_lines_cycle_check before insert or update on public.prep_lines
  for each row execute function public.check_prep_cycle();

-- RLS: single owner, everything keyed to auth.uid()
alter table public.ingredients enable row level security;
alter table public.preps enable row level security;
alter table public.prep_lines enable row level security;

create policy "own ingredients" on public.ingredients
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own preps" on public.preps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own prep lines" on public.prep_lines
  for all
  using (exists (select 1 from public.preps p where p.id = prep_id and p.user_id = auth.uid()))
  with check (
    exists (select 1 from public.preps p where p.id = prep_id and p.user_id = auth.uid())
    and (ingredient_id is null or exists (
      select 1 from public.ingredients i where i.id = ingredient_id and i.user_id = auth.uid()))
    and (component_prep_id is null or exists (
      select 1 from public.preps cp where cp.id = component_prep_id and cp.user_id = auth.uid()))
  );
```

- [ ] **Step 2: Write `supabase/seed.sql`** — 25 ingredients, 5 preps incl. two-level chain (oleo saccharum → citrus cordial). Runs for the first (only) user; errors if no account exists yet:

```sql
-- PourSmith Epic 1 seed. Run AFTER schema.sql and after creating the owner account.
do $$
declare
  owner uuid;
  p_simple uuid; p_lime uuid; p_lemon uuid; p_oleo uuid; p_cordial uuid;
begin
  select id into owner from auth.users order by created_at limit 1;
  if owner is null then
    raise exception 'No user found — create the owner account first.';
  end if;

  insert into public.ingredients
    (user_id, name, category, pack_size, unit, price_gross, vat_rate, waste_pct)
  values
    (owner, 'Tanqueray London Dry Gin', 'spirit', 700, 'ml', 18.99, 0.19, 0),
    (owner, 'Monkey 47 Dry Gin',        'spirit', 500, 'ml', 36.90, 0.19, 0),
    (owner, 'Hendrick''s Gin',          'spirit', 700, 'ml', 29.99, 0.19, 0),
    (owner, 'Absolut Vodka',            'spirit', 700, 'ml', 13.99, 0.19, 0),
    (owner, 'Havana Club 3 Años',       'spirit', 700, 'ml', 14.99, 0.19, 0),
    (owner, 'Olmeca Blanco Tequila',    'spirit', 700, 'ml', 17.99, 0.19, 0),
    (owner, 'Bulleit Bourbon',          'spirit', 700, 'ml', 22.99, 0.19, 0),
    (owner, 'Campari',                  'liqueur', 700, 'ml', 14.99, 0.19, 0),
    (owner, 'Aperol',                   'liqueur', 700, 'ml', 12.99, 0.19, 0),
    (owner, 'Cointreau',                'liqueur', 700, 'ml', 19.99, 0.19, 0),
    (owner, 'Luxardo Maraschino',       'liqueur', 500, 'ml', 26.99, 0.19, 0),
    (owner, 'St-Germain',               'liqueur', 700, 'ml', 27.99, 0.19, 0),
    (owner, 'Noilly Prat Dry',          'other',  750, 'ml',  9.99, 0.19, 0),
    (owner, 'Fever-Tree Indian Tonic',  'other',  200, 'ml',  1.19, 0.19, 0),
    (owner, 'Sodawasser',               'other', 1000, 'ml',  0.79, 0.19, 0),
    (owner, 'Orangensaft (100%)',       'juice', 1000, 'ml',  2.49, 0.07, 0),
    (owner, 'Cranberrynektar',          'juice', 1000, 'ml',  2.29, 0.07, 0),
    (owner, 'Ananassaft',               'juice', 1000, 'ml',  2.19, 0.07, 0),
    (owner, 'Monin Vanille Sirup',      'syrup',  700, 'ml',  8.49, 0.19, 0),
    (owner, 'Zucker (weiß)',            'produce', 1000, 'g', 1.09, 0.07, 0),
    (owner, 'Limetten',                 'produce', 1, 'piece', 0.49, 0.07, 0),
    (owner, 'Zitronen',                 'produce', 1, 'piece', 0.59, 0.07, 0),
    (owner, 'Ingwer',                   'produce', 1000, 'g', 4.99, 0.07, 15),
    (owner, 'Minze (Bund)',             'produce', 1, 'piece', 1.29, 0.07, 10),
    (owner, 'Eier (10er)',              'produce', 10, 'piece', 3.49, 0.07, 0);

  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Simple Syrup 1:1', 1300, 'ml', 'Zucker + Wasser 1:1')
    returning id into p_simple;
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Fresh Lime Juice', 340, 'ml', null)
    returning id into p_lime;
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Fresh Lemon Juice', 400, 'ml', null)
    returning id into p_lemon;
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Oleo Saccharum', 450, 'ml', 'Zitronenschalen + Zucker, 24h')
    returning id into p_oleo;
  insert into public.preps (user_id, name, yield_amount, yield_unit, notes)
    values (owner, 'Citrus Cordial', 480, 'ml', 'Oleo + frischer Zitronensaft')
    returning id into p_cordial;

  insert into public.prep_lines (prep_id, ingredient_id, component_prep_id, amount) values
    (p_simple, (select id from public.ingredients where user_id = owner and name = 'Zucker (weiß)'), null, 800),
    (p_lime,   (select id from public.ingredients where user_id = owner and name = 'Limetten'), null, 12),
    (p_lemon,  (select id from public.ingredients where user_id = owner and name = 'Zitronen'), null, 10),
    (p_oleo,   (select id from public.ingredients where user_id = owner and name = 'Zitronen'), null, 8),
    (p_oleo,   (select id from public.ingredients where user_id = owner and name = 'Zucker (weiß)'), null, 500),
    (p_cordial, null, p_oleo, 300),
    (p_cordial, null, p_lemon, 200);
end $$;
```

- [ ] **Step 3: Verify** — no local runner for SQL; correctness is checked when run in the SQL editor (operator step, Task 12). Sanity-read for typos.
- [ ] **Step 4: Commit** — `git add supabase && git commit -m "feat: supabase schema and seed for ingredient & prep library"`

### Task 2: Tooling — strict TS, `@` alias, Vitest, domain types

**Files:** Modify `tsconfig.app.json`, `vite.config.ts`, `package.json`. Create `src/data/types.ts`.
**Produces:** `@/…` imports; `npx vitest run` works; types `Unit`, `Category`, `Ingredient`, `NewIngredient`, `Prep`, `NewPrep`, `PrepLine`, `NewPrepLine`, `Library`; consts `UNITS`, `CATEGORIES`, `VAT_RATES`.

- [ ] **Step 1:** `npm install -D vitest`
- [ ] **Step 2:** In `tsconfig.app.json` compilerOptions add:

```json
"strict": true,
"baseUrl": ".",
"paths": { "@/*": ["src/*"] },
"types": ["vite/client", "vitest/globals"]
```

(replacing the existing `"types"` line; also add `"noUncheckedIndexedAccess": true`).

- [ ] **Step 3:** In `vite.config.ts` add alias + vitest config (use `defineConfig` from `vitest/config`):

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 4:** Add script `"test": "vitest run"` to `package.json`.
- [ ] **Step 5:** Create `src/data/types.ts`:

```ts
export const UNITS = ['ml', 'g', 'piece'] as const;
export type Unit = (typeof UNITS)[number];

export const CATEGORIES = ['spirit', 'liqueur', 'juice', 'syrup', 'produce', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const VAT_RATES = [0.19, 0.07, 0] as const;

export interface NewIngredient {
  name: string;
  category: Category;
  pack_size: number;
  unit: Unit;
  price_gross: number;
  vat_rate: number;
  waste_pct: number;
}

export interface Ingredient extends NewIngredient {
  id: string;
  price_net: number;
  created_at: string;
  updated_at: string;
}

export interface NewPrepLine {
  ingredient_id: string | null;
  component_prep_id: string | null;
  amount: number;
}

export interface PrepLine extends NewPrepLine {
  id: string;
  prep_id: string;
}

export interface NewPrep {
  name: string;
  yield_amount: number;
  yield_unit: Unit;
  notes: string | null;
}

export interface Prep extends NewPrep {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Library {
  ingredients: Ingredient[];
  preps: Prep[];
  prepLines: PrepLine[];
}
```

- [ ] **Step 6:** Verify: `npx tsc -b` clean (fix any strictness fallout in scaffold `App.tsx` minimally), `npm test` reports "no test files" without crashing.
- [ ] **Step 7:** Commit `chore: strict TS, @ alias, vitest, domain types`.

### Task 3: Cost engine (TDD)

**Files:** Create `src/lib/parse.ts`, `src/lib/cost.ts`, `src/lib/format.ts`, tests `src/lib/parse.test.ts`, `src/lib/cost.test.ts`.
**Produces (exact signatures):**

```ts
// parse.ts
export function parseDecimal(input: string): number | null;      // '18,99' → 18.99; '' / junk → null
export function parseVatRate(input: string): number | null;      // '19','19%','0.19','0,19' → 0.19; only {0,0.07,0.19}
// cost.ts
export class CostError extends Error { readonly code: 'cycle' | 'missing'; }
export function ingredientUnitCost(i: Ingredient): number;       // price_net / pack_size / (1 - waste_pct/100)
export function prepUnitCost(prepId: string, lib: Library): number;   // €/yield-unit, recursive, memoized, throws CostError
export function prepTotalCost(prepId: string, lib: Library): number;  // unit cost × yield_amount
export function wouldCreateCycle(prepId: string, componentPrepId: string, lib: Library): boolean;
// format.ts
export function formatEur(value: number, locale: Locale): string;                    // de → 'de-DE', en → 'en-DE'
export function formatPerUnit(value: number, unitLabel: string, locale: Locale): string; // '0,0271 €/ml' (2–4 decimals)
export function formatNumber(value: number, locale: Locale): string;
```

- [ ] **Step 1: Write failing tests.** Test data: builder helpers `ing(partial)` / `prep(partial)` / `line(partial)` with sensible defaults. Cases:
  - `parseDecimal`: '18,99'→18.99, '18.99'→18.99, ' 7 '→7, ''→null, 'abc'→null, '1.234,56'→null is NOT required (reject thousands separators: any input with both '.' and ','→null).
  - `parseVatRate`: '19'→0.19, '7'→0.07, '0'→0, '0,19'→0.19, '19%'→0.19, '5'→null.
  - `ingredientUnitCost`: net 10, pack 500, waste 0 → 0.02; waste 20 → 0.025.
  - `prepUnitCost` single level: 800 g sugar @0.001 €/g into yield 1300 ml → 0.8/1300.
  - Two-level chain: cordial(oleo 300 + lemon-juice-prep 200, yield 480) computes from leaf ingredient prices (write expected value out by hand).
  - Propagation: recompute after doubling a leaf `price_net` → derived cost doubles.
  - Cycle: A contains B, B contains A → `prepUnitCost` throws `CostError` code 'cycle'; `wouldCreateCycle('A','B')` true beforehand; unrelated prep false; self-reference true.
  - Missing component → CostError 'missing'.
- [ ] **Step 2:** `npx vitest run` → FAIL (modules don't exist).
- [ ] **Step 3: Implement.** `prepUnitCost` = recursive resolver with `memo: Map<string, number>` and `visiting: Set<string>`; `wouldCreateCycle` = iterative DFS from `componentPrepId` through `prep_lines` looking for `prepId`.
- [ ] **Step 4:** `npx vitest run` → PASS. `npx tsc -b` clean.
- [ ] **Step 5:** Commit `feat: cost engine with waste, VAT-net and nested prep resolution`.

### Task 4: CSV import module (TDD)

**Files:** Create `src/lib/csv.ts`, `src/lib/csv.test.ts`.
**Produces:**

```ts
export const CSV_COLUMNS = ['name','category','pack_size','unit','price_gross','vat_rate','waste_pct'] as const;
export interface CsvRowError { row: number; field: string; key: MessageKey }  // key = i18n key
export interface CsvParseResult { valid: NewIngredient[]; errors: CsvRowError[]; totalRows: number }
export function ingredientCsvTemplate(): string;  // header + 2 example rows, semicolon-delimited
export function parseIngredientCsv(text: string, existingNames: string[]): CsvParseResult;
```

Rules: strip BOM; split on `\r\n|\n`; delimiter = `;` if the header line contains one, else `,`; header must match `CSV_COLUMNS` exactly (else single error `{row:1, field:'header', key:'csv.error.header'}`); skip blank lines; `waste_pct` empty → 0; `vat_rate` via `parseVatRate`; numbers via `parseDecimal`; name required and unique case-insensitively against `existingNames` AND earlier rows in the file; category/unit must be members of `CATEGORIES`/`UNITS`. Error keys: `csv.error.name.required`, `csv.error.name.duplicate`, `csv.error.category`, `csv.error.unit`, `csv.error.number`, `csv.error.vat`, `csv.error.waste`.

- [ ] **Step 1:** Failing tests: happy path (2 valid rows, comma + decimal-comma variant with `;`), bad header, duplicate name in file, duplicate against existing, bad category, bad number, vat '19' accepted, waste 150 rejected, blank lines skipped, BOM stripped.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: CSV template and validated ingredient import parser`.

### Task 5: i18n

**Files:** Create `src/i18n/de.ts`, `src/i18n/en.ts`, `src/i18n/index.tsx`, `src/i18n/i18n.test.ts`.
**Produces:**

```ts
export type Locale = 'de' | 'en';
export type MessageKey = keyof typeof de;
export function LocaleProvider({ children }: { children: ReactNode }): ReactElement;
export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void };
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string;
```

`de.ts` exports `const de = { … } as const` — the full key set (auth.*, nav.*, common.*, ingredient.*, prep.*, csv.*, category.*, unit.*, validation.*). `en.ts` exports `const en: Record<MessageKey, string>` so TS enforces parity. Interpolation: `{name}`-style placeholders replaced from `vars`. Locale persisted to `localStorage['poursmith.locale']`, default `'de'`. Key list is finalized while building the UI tasks — every string used by Tasks 6–12 must exist in both files; type-checking enforces it.

- [ ] **Step 1:** Failing test: `Object.keys(de).sort()` deep-equals `Object.keys(en).sort()`; interpolation replaces `{n}`; unknown var left literal.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with an initial ~70-key set covering all Task 6–12 strings. **Step 4:** Run → PASS + `tsc -b`.
- [ ] **Step 5:** Commit `feat: DE/EN i18n with typed keys and persisted locale`.

### Task 6: Supabase client, auth, login screen

**Files:** Create `src/lib/supabase.ts`, `src/hooks/useAuth.ts`, `src/components/LoginScreen.tsx`.
**Produces:**

```ts
// supabase.ts — throws a descriptive Error at import time if env vars missing
export const supabase: SupabaseClient;
// useAuth.ts
export function useAuth(): { session: Session | null; ready: boolean; signIn(email: string, password: string): Promise<string | null>; signOut(): Promise<void> };
// LoginScreen.tsx
export interface LoginScreenProps { onSignIn: (email: string, password: string) => Promise<string | null> }
```

`useAuth`: `getSession()` on mount + `onAuthStateChange` subscription (cleanup on unmount); `signIn` returns error message or null. `LoginScreen`: centered card, email + password inputs (labelled), submit button with pending state, error banner text `auth.error.invalid` on failure. All strings via `useT()`.

- [ ] **Step 1:** Implement all three files. **Step 2:** `npx tsc -b` + `npm run lint` clean. **Step 3:** Commit `feat: supabase client, auth hook and login screen`.

### Task 7: Library data hook

**Files:** Create `src/hooks/useLibrary.ts`.
**Produces:**

```ts
export interface PrepInput extends NewPrep { lines: NewPrepLine[] }
export function useLibrary(enabled: boolean): {
  library: Library; loading: boolean; error: string | null;
  refresh(): Promise<void>;
  addIngredient(v: NewIngredient): Promise<string | null>;
  updateIngredient(id: string, v: NewIngredient): Promise<string | null>;
  deleteIngredient(id: string): Promise<string | null>;
  addPrep(v: PrepInput): Promise<string | null>;
  updatePrep(id: string, v: PrepInput): Promise<string | null>;
  deletePrep(id: string): Promise<string | null>;
  importIngredients(rows: NewIngredient[]): Promise<string | null>;
}
export function ingredientUsedBy(id: string, lib: Library): Prep[];
export function prepUsedBy(id: string, lib: Library): Prep[];
```

Fetch: three parallel selects ordered by name; mutations return supabase error message or null and `refresh()` on success. `updatePrep`: update row → delete its lines → insert new lines (sequential; surface first error). `importIngredients`: single bulk insert. Empty library constant while `enabled === false`.

- [ ] **Step 1:** Implement. **Step 2:** `tsc -b` + lint. **Step 3:** Commit `feat: library data hook with CRUD and usage lookups`.

### Task 8: UI primitives + form validation

**Files:** Create `src/components/Banner.tsx`, `SlideOver.tsx`, `ConfirmDialog.tsx`, `Field.tsx`; `src/lib/validation.ts` + `src/lib/validation.test.ts`.
**Produces:**

```ts
export interface BannerProps { kind: 'error' | 'success'; message: string; onDismiss: () => void }
export interface SlideOverProps { title: string; open: boolean; onClose: () => void; children: ReactNode }  // right-side panel, Esc + backdrop close, role="dialog", aria-modal
export interface ConfirmDialogProps { title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }
export interface FieldProps { label: string; htmlFor: string; error?: string; children: ReactNode }
// validation.ts
export interface IngredientFormValues { name: string; category: Category; pack_size: string; unit: Unit; price_gross: string; vat_rate: string; waste_pct: string }
export type IngredientFormErrors = Partial<Record<keyof IngredientFormValues, MessageKey>>;
export function validateIngredient(v: IngredientFormValues, takenNames: string[]): { errors: IngredientFormErrors; value: NewIngredient | null };
```

Validation keys: `validation.required`, `validation.positive`, `validation.nonNegative`, `validation.wasteRange`, `validation.nameTaken`, `validation.vat`.

- [ ] **Step 1:** Failing tests for `validateIngredient` (valid → value non-null; each rule produces its key; decimal comma accepted).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement validation + the four components. **Step 4:** Tests PASS, `tsc -b`, lint.
- [ ] **Step 5:** Commit `feat: UI primitives and ingredient form validation`.

### Task 9: Ingredients tab

**Files:** Create `src/components/IngredientsTab.tsx`, `src/components/IngredientForm.tsx`.
**Interfaces:**

```ts
export interface IngredientsTabProps {
  library: Library;
  onAdd(v: NewIngredient): Promise<string | null>;
  onUpdate(id: string, v: NewIngredient): Promise<string | null>;
  onDelete(id: string): Promise<string | null>;
  onOpenImport(): void;
}
export interface IngredientFormProps { initial: Ingredient | null; takenNames: string[]; onSubmit(v: NewIngredient): Promise<string | null>; onClose(): void }
```

Behavior: search input (name substring, case-insensitive) + category `<select>` (all/each category via `category.*` keys); table columns name, category, pack (`formatNumber` + unit label), net price (`formatEur`), waste %, unit cost (`formatPerUnit(ingredientUnitCost(i), unitLabel, locale)`); row click edits, header button adds (SlideOver + IngredientForm), CSV import button calls `onOpenImport`. Delete inside the form footer: if `ingredientUsedBy(...)` non-empty show `ingredient.inUse` message with prep names instead of ConfirmDialog. IngredientForm: controlled string state, live net price preview (`parseDecimal(price_gross)` + vat → `formatEur`), errors under fields via `Field`. Empty state `ingredient.empty`.

- [ ] **Step 1:** Implement both components. **Step 2:** `tsc -b` + lint. **Step 3:** Commit `feat: ingredients tab with table, filters and form`.

### Task 10: Preps tab

**Files:** Create `src/components/PrepsTab.tsx`, `src/components/PrepForm.tsx`.
**Interfaces:**

```ts
export interface PrepsTabProps {
  library: Library;
  onAdd(v: PrepInput): Promise<string | null>;
  onUpdate(id: string, v: PrepInput): Promise<string | null>;
  onDelete(id: string): Promise<string | null>;
}
export interface PrepFormProps { initial: Prep | null; library: Library; onSubmit(v: PrepInput): Promise<string | null>; onClose(): void }
```

PrepsTab: table with name, yield (`formatNumber` + unit), unit cost (`prepUnitCost` in try/catch → '—' on CostError), total batch cost, component count; chevron toggles an expanded row listing each line (component name, amount+unit, line cost). Delete guarded by `prepUsedBy` (message `prep.inUse`). PrepForm line editor: rows of [component `<select>`, amount input, remove button] + "add line"; component options = all ingredients (group label `nav.ingredients`) + preps (group `nav.preps`) excluding self and any prep `p` where `wouldCreateCycle(editingId, p.id, library)`; option values encoded `i:<id>` / `p:<id>`. Live derived cost preview computed against a hypothetical library where the edited prep + lines are substituted (new prep gets temp id `'__draft__'`). Validation: name required/unique, yield positive, ≥1 line, every line has component + positive amount.

- [ ] **Step 1:** Implement. **Step 2:** `tsc -b` + lint. **Step 3:** Commit `feat: preps tab with nested components and live derived costs`.

### Task 11: CSV import dialog

**Files:** Create `src/components/CsvImportDialog.tsx`.
**Interface:** `export interface CsvImportDialogProps { library: Library; onImport(rows: NewIngredient[]): Promise<string | null>; onClose(): void }`

Behavior: "download template" button (Blob + temp `<a download="poursmith-ingredients.csv">`); file input reads via `File.text()`; runs `parseIngredientCsv(text, existingNames)`; preview table of parsed rows; errors listed as `csv.row {row}: {field} — t(key)`; import button labelled `csv.importValid {n}` disabled when 0 valid; success closes dialog. Re-selecting a file re-parses.

- [ ] **Step 1:** Implement. **Step 2:** `tsc -b` + lint. **Step 3:** Commit `feat: CSV import dialog with preview and per-row errors`.

### Task 12: App shell, wiring, cleanup, final verification

**Files:** Create `src/components/LibraryScreen.tsx`; rewrite `src/App.tsx`, `src/index.css`; modify `index.html`; delete `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`.

- `LibraryScreen` (props `{ onSignOut(): Promise<void> }`): calls `useLibrary(true)`; header with `app.title`, locale toggle (DE/EN buttons via `useLocale`), sign-out; tab bar (`nav.ingredients` / `nav.preps`, `aria-selected`); loading state `common.loading`; error → Banner; renders active tab + CsvImportDialog when open.
- `App.tsx`: `LocaleProvider` → `useAuth()`; `!ready` → loading splash; no session → `LoginScreen`; else `LibraryScreen`.
- `index.css`: replace scaffold demo CSS entirely with `@import 'tailwindcss';` + minimal base (`body { margin: 0 }`, font stack, dark neutral background per Tailwind classes used in components).
- `index.html`: `lang="de"`, `<title>PourSmith</title>`.

- [ ] **Step 1:** Implement + delete scaffold files. **Step 2:** `npx tsc -b`, `npm run lint`, `npm test`, `npm run build` — all clean/green.
- [ ] **Step 3: Operator handoff checklist** (print for the user): create Supabase project → enable Email provider + create owner account → run `schema.sql` then `seed.sql` → `.env`/`.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → `npm run dev`.
- [ ] **Step 4: Manual acceptance pass** (with user's project): login; both tabs render seed data; edit Zucker price → Simple Syrup, Oleo and Citrus Cordial costs change on screen instantly; try to make Oleo contain Citrus Cordial → blocked; CSV template download + re-import of an edited file.
- [ ] **Step 5:** Commit `feat: app shell, auth gate and library screen wiring`.

---

## Self-review notes

- Spec coverage: Story 1 → Tasks 1/2/9; Story 2 → Tasks 1/3/10; Story 3 → schema `waste_pct` + Task 3 math + Task 9 form + Task 4 CSV column; Story 4 → Tasks 4/11. Acceptance propagation → Task 3 test + Task 12 manual pass; nesting + cycle guard → Task 1 trigger + Task 3 `wouldCreateCycle` + Task 10 option filtering.
- UI tasks (6, 9–12) intentionally specify exact props/behavior rather than full JSX; they are markup around the fully-specified lib layer, executed inline in this session. All logic-bearing code (SQL, cost, CSV, validation) is complete above.
- Type consistency: `PrepInput` defined once in Task 7 and consumed by Task 10; `MessageKey` from Task 5 consumed by Tasks 4/8; `Locale` from Task 5 consumed by Task 3's `format.ts` (format.ts imports the type only — no runtime dep on React context).
