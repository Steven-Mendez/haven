// Regenerates .expo/types/router.d.ts (Expo Router typed routes) without starting Metro,
// so `pnpm typecheck` works in CI and in the pre-push hook.
const path = require('node:path');

const root = path.join(__dirname, '..');
process.env.EXPO_ROUTER_APP_ROOT = path.join(root, 'src', 'app');

const typedRoutes = require(
  require.resolve('@expo/router-server/build/typed-routes', { paths: [root] }),
);
typedRoutes.regenerateDeclarations(path.join(root, '.expo', 'types'), {});
