import type { Library, Unit } from '@/data/types';
import { indexLibrary } from '@/lib/libraryIndex';

/**
 * A recipe/prep line points at either an ingredient or a component prep. In the
 * forms that choice is a single <select>, so we tag its value: '' when nothing
 * is chosen, `i:<id>` for an ingredient, `p:<id>` for a prep.
 */
export type ComponentKey = string;

export interface ComponentRef {
  ingredient_id: string | null;
  component_prep_id: string | null;
}

export function encodeComponent(ref: ComponentRef): ComponentKey {
  if (ref.ingredient_id !== null) return `i:${ref.ingredient_id}`;
  if (ref.component_prep_id !== null) return `p:${ref.component_prep_id}`;
  return '';
}

export function decodeComponent(key: ComponentKey): ComponentRef {
  if (key.startsWith('i:')) return { ingredient_id: key.slice(2), component_prep_id: null };
  if (key.startsWith('p:')) return { ingredient_id: null, component_prep_id: key.slice(2) };
  return { ingredient_id: null, component_prep_id: null };
}

export function componentName(key: ComponentKey, lib: Library): string {
  const idx = indexLibrary(lib);
  if (key.startsWith('i:')) return idx.ingredient(key.slice(2))?.name ?? '?';
  if (key.startsWith('p:')) return idx.prep(key.slice(2))?.name ?? '?';
  return '?';
}

/** Native unit of the referenced component: ml/g/piece, or null when unset. */
export function componentNativeUnit(key: ComponentKey, lib: Library): Unit | null {
  const idx = indexLibrary(lib);
  if (key.startsWith('i:')) return idx.ingredient(key.slice(2))?.unit ?? null;
  if (key.startsWith('p:')) return idx.prep(key.slice(2))?.yield_unit ?? null;
  return null;
}

/** Name for a stored line (used by cost/batch views that hold refs, not keys). */
export function lineComponentName(ref: ComponentRef, lib: Library): string {
  return componentName(encodeComponent(ref), lib);
}
