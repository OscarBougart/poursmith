export type Locale = 'de' | 'en';

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

export const RECIPE_UNITS = ['ml', 'cl', 'oz', 'dash', 'barspoon', 'g', 'piece'] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

export const METHODS = ['shaken', 'stirred', 'built', 'thrown'] as const;
export type Method = (typeof METHODS)[number];

export interface NewRecipe {
  name: string;
  glass: string | null;
  ice: string | null;
  method: Method;
  price_gross: number | null;
  target_cost_pct_override: number | null;
  notes: string | null;
}

export interface Recipe extends NewRecipe {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface NewRecipeLine {
  ingredient_id: string | null;
  component_prep_id: string | null;
  amount: number;
  unit: RecipeUnit;
  is_garnish: boolean;
}

export interface RecipeLine extends NewRecipeLine {
  id: string;
  recipe_id: string;
}

export interface Settings {
  target_cost_pct: number;
}

export interface Library {
  ingredients: Ingredient[];
  preps: Prep[];
  prepLines: PrepLine[];
  recipes: Recipe[];
  recipeLines: RecipeLine[];
}
