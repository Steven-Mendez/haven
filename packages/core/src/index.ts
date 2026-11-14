import * as configModule from './config';
import { registerActionCatalog } from './engine';

// Product entry: contracts, versioned config and the rules engine. Test data generators live in
// `@haven/core/testdata` (seeds, tests and dev tools only) and are never part of this entry.
export * from './config';
export * from './contracts';
export * from './engine';

// Default action catalog for evaluate(): Content's `actions` if src/config exports it.
registerActionCatalog((configModule as Record<string, unknown>).actions);
