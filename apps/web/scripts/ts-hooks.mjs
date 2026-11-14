// Lets Node 24 (native type stripping, no extra packages) run the TypeScript of scripts/ and @haven/core:
//  · resolves extensionless relative imports (`./model` → `./model.ts` or `./model/index.ts`)
//  · loads JSON imported without `with { type: 'json' }` as a default export.
// Usage: node --import ./scripts/ts-hooks.mjs scripts/seed.ts
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL) {
        for (const suffix of ['.ts', '.tsx', '/index.ts']) {
          const url = new URL(specifier + suffix, context.parentURL);
          if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
        }
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    // Only workspace JSON (e.g. packages/core/config); dependencies keep Node's own loading (require).
    if (
      url.endsWith('.json') &&
      !url.includes('/node_modules/') &&
      !context.importAttributes?.type
    ) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      return { format: 'module', source: `export default ${source};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
