import type { Action } from '../contracts';

/** Actions the engine adds by itself (closing rule, pending, cognitive battery). */
export const ACTION_REPEAT = 'repeat-measurement';
export const ACTION_RECORD = 'record-reading';
export const ACTION_NOTIFY_EARTH = 'notify-earth';
export const ACTION_REPEAT_BATTERY = 'repeat-battery-2h';

/** Fallback copy when the Content catalog (`config/actions.json`) lacks the action. */
const FALLBACK: Record<string, Action> = {
  [ACTION_REPEAT]: {
    id: ACTION_REPEAT,
    text: { es: 'Repite la medición', en: 'Repeat the measurement' },
    priority: 50,
  },
  [ACTION_RECORD]: {
    id: ACTION_RECORD,
    text: { es: 'Toma una lectura', en: 'Take a reading' },
    priority: 60,
  },
  [ACTION_NOTIFY_EARTH]: {
    id: ACTION_NOTIFY_EARTH,
    text: { es: 'Avisa a Tierra', en: 'Notify Earth' },
    priority: 20,
  },
  [ACTION_REPEAT_BATTERY]: {
    id: ACTION_REPEAT_BATTERY,
    text: { es: 'Descansa y repite en 2 h', en: 'Rest and repeat in 2 h' },
    priority: 30,
  },
};

let registered: Action[] = [];

/**
 * Registers the default action catalog. `src/index.ts` calls it with the `actions` exported by
 * `src/config` (Content) when present, so engine modules never import config themselves.
 */
export function registerActionCatalog(catalog: unknown): void {
  registered = Array.isArray(catalog) ? (catalog as Action[]) : [];
}

/** The registered catalog (empty if Content has not published `actions`). */
export function defaultActionCatalog(): Action[] {
  return registered;
}

/**
 * Turns action ids into `Action[]` (at most `max`, by ascending priority: 1 = most urgent).
 * An id missing from the catalog is kept, with the id as its text, so it is never lost.
 */
export function resolveActions(ids: string[], catalog?: Action[], max = 3): Action[] {
  const cat = catalog ?? defaultActionCatalog();
  const seen = new Set<string>();
  const result: { action: Action; order: number }[] = [];
  ids.forEach((id, order) => {
    if (seen.has(id)) return;
    seen.add(id);
    const action = cat.find((a) => a.id === id) ??
      FALLBACK[id] ?? { id, text: { es: id, en: id }, priority: 100 + order };
    result.push({ action, order });
  });
  return result
    .sort((a, b) => a.action.priority - b.action.priority || a.order - b.order)
    .slice(0, max)
    .map((r) => r.action);
}
