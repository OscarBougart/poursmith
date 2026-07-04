# PRD — PourSmith: Pour Cost & Margin Menu Engine

## Overview

**Problem:** Bar owners build menus in design tools (Canva, InDesign) that know nothing about money. Costing lives in spreadsheets that know nothing about the menu. Nobody sees, at a glance, which cocktails make money.

**Product:** A web app where a bar's ingredient library, recipes, and menu live in one place. Every recipe shows live pour cost, margin, and suggested price. The menu view is finance-aware: sort and flag drinks by profitability, then export a clean menu.

**User:** Owner-operators and bar managers of independent cocktail bars. Primary reference user: The Gin Library, Aachen.

**Platform:** Web first (Vite + React + Tailwind, Supabase backend — matches my app-factory stack so a later Expo mobile companion reuses the schema and API). Bilingual DE/EN. Currency: EUR default, configurable.

**Non-goals (v1):** POS integration, inventory depletion tracking, multi-venue, staff accounts/roles.

**Success criteria:** I can cost The Gin Library's full summer menu (incl. batched ingredients and house syrups) in under an hour, and the exported menu is good enough to print.

---

## Epic 1 — Ingredient & Prep Library

The costing foundation. Everything else reads from this.

**Stories:**

1. As a bar manager, I can add a purchased ingredient with bottle/pack size, unit (ml, g, piece), purchase price, and category (spirit, liqueur, juice, syrup, produce, other), so the system knows cost per ml/g/unit.
2. As a bar manager, I can record a *house prep* (syrup, cordial, clarified juice, fat-washed spirit, batch) as a recipe of other ingredients plus a yield, so its cost per ml is derived automatically — and updates when an input price changes.
3. As a bar manager, I can set a waste/loss percentage per ingredient (e.g. citrus yield, clarification loss) so real cost is reflected, not theoretical.
4. As a bar manager, I can import my starting library from a CSV so setup isn't manual data entry hell.

**Acceptance:** Changing the price of one bottle propagates through every prep and recipe that uses it, instantly. A prep can contain another prep (one level minimum, e.g. oleo → cordial).

## Epic 2 — Recipe Costing Engine

**Stories:**

1. As a bar manager, I can build a recipe from library ingredients with quantities, glass, ice type, and garnish, so pour cost is computed live as I type.
2. As a bar manager, I see pour cost, cost percentage at current price, gross margin (€), and a suggested price for a target cost % (configurable, default 20%), including German VAT (19%) handling — prices entered gross, margins shown honestly.
3. As a bar manager, I can duplicate a recipe as a variation (e.g. Saturn → Guava Saturn) so R&D iterations keep separate costings.
4. As a bar manager, I can generate a *batch sheet* from any recipe (scale to N serves or to a target volume, with dilution line) so prep and costing stay in sync.

**Acceptance:** Costing math is unit-tested, including unit conversions (oz↔ml), prep-derived costs, and waste percentages. A recipe using a two-level prep chain costs correctly.

## Epic 3 — Menu Board & Export

**Stories:**

1. As an owner, I can assemble recipes into a named menu (e.g. "Summer 2026") and see a table with price, pour cost, cost %, and margin per drink, with sorting and red/amber/green profitability flags.
2. As an owner, I see menu-level analytics: average cost %, margin spread, and which single drink most drags the average, so I know what to reprice or cut.
3. As an owner, I can export the menu two ways: a guest-facing PDF (clean, styled, no numbers) and an internal PDF/CSV with full costing, so one source of truth feeds both front and back of house.
4. As an owner, I can toggle menu language DE/EN with per-recipe description fields for each.

**Acceptance:** Guest PDF contains zero cost data. Internal export matches the on-screen numbers exactly.

---

## Build order & verification

Epics strictly in order (2 depends on 1, 3 on 2). Seed the database with a realistic demo set: 25 ingredients, 5 house preps, 10 Gin Library cocktails. Definition of done for the release: the success criterion above, plus all acceptance checks green and the costing test suite passing.
