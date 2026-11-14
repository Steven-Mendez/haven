#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const noScreen = args.includes('--no-screen');
const [app, folder, id, titleEs, titleEn = titleEs] = args.filter((a) => !a.startsWith('--'));

if (!['mobile', 'web'].includes(app) || !folder || !id || !titleEs) {
  console.error(
    'Usage: pnpm feature <mobile|web> <folder> <ID> "<es title>" "<en title>" [--no-screen]',
  );
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(folder)) {
  console.error('The folder must be kebab-case English: body, indicator, earth-queue…');
  process.exit(1);
}

const target = join(root, 'apps', app, 'src', 'features', folder);
if (existsSync(target)) {
  console.error(`${relative(root, target)} already exists`);
  process.exit(1);
}

function findNote(dir) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const found = findNote(path);
      if (found) return found;
    } else if (entry.name.startsWith(`${id} `) && entry.name.endsWith('.md')) {
      return path;
    }
  }
  return null;
}
const note = findNote(join(root, '..', 'obsidian', '40 Proyecto'));
const header = `// ${id} · ${titleEn}${note ? ` — ${relative(root, note)}` : ''}`;

const i18n = `import { defineTexts } from '@/${app === 'mobile' ? 'shared' : 'lib'}/i18n';

export const texts = defineTexts({
  es: { title: ${JSON.stringify(titleEs)} },
  en: { title: ${JSON.stringify(titleEn)} },
});
`;

const files = {};
if (app === 'mobile') {
  files['index.ts'] = noScreen
    ? `${header}\n// Public API of the feature. No screen: exposes services, hooks or bus listeners.\nexport {};\n`
    : `${header}\n// Public API of the feature: the only thing src/app routes import.\nexport { default } from './screen';\n`;
  if (!noScreen) {
    files['screen.tsx'] = `import { PendingScreen } from '@/shared/components/pending-screen';
import { useTexts } from '@/shared/i18n';
import { texts } from './i18n';

export default function Screen() {
  const t = useTexts(texts);
  return <PendingScreen id="${id}" title={t.title} />;
}
`;
  }
  files['i18n.ts'] = i18n;
} else {
  files['index.ts'] = noScreen
    ? `${header}\nexport {};\n`
    : `${header}\n// Public API of the feature: the only thing src/app routes import.\nexport { View } from './view';\n`;
  if (!noScreen) {
    files['view.tsx'] = `import { PendingScreen } from '@/components/pending-screen';
import { texts } from './i18n';

export function View() {
  return <PendingScreen id="${id}" title={texts.en.title} />;
}
`;
  }
  files['i18n.ts'] = i18n;
}

mkdirSync(target, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(target, name), content);
}

console.log(`✔ ${relative(root, target)}/ (${Object.keys(files).join(', ')})`);
if (!noScreen) {
  console.log(
    app === 'mobile'
      ? `  Route: create apps/mobile/src/app/<route>.tsx with\n    export { default } from '@/features/${folder}';`
      : `  Route: create apps/web/src/app/<route>/page.tsx with\n    import { View } from '@/features/${folder}';\n    export default function Page() { return <View />; }`,
  );
}
