import { Suspense } from 'react';
import { kpiTexts } from '@/features/extras/components/kpi/texts';
import { texts as extrasTexts } from '@/features/extras/i18n';
import { getMission } from '@/features/extras/server';
import { getTexts } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { OrionChat } from './components/chat';
import { texts } from './i18n';
import { assistantConfigured } from './server/model';

async function Content() {
  const [{ lang, t }, code] = await Promise.all([getTexts(texts), getMissionCode()]);
  const mission = code ? await getMission(code).catch(() => null) : null;
  return (
    <OrionChat
      lang={lang}
      t={t}
      kpi={kpiTexts(extrasTexts[lang])}
      mission={mission ? { code: mission.code, name: mission.name } : null}
      configured={assistantConfigured()}
    />
  );
}

/** Orion AI: the Ground View's chat, with the console's own tools. */
export function View() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Content />
    </Suspense>
  );
}
