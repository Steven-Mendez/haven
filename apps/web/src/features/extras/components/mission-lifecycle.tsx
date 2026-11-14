'use client';

import { Flag, Rocket } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { type Language, textsFor } from '@/lib/i18n';
import type { MissionStatus } from '@/server/types';
import { finishMissionAction, startMissionAction } from '../actions';
import { texts } from '../i18n';

/**
 * The one action that moves a mission to its next state: «Start mission» while in preparation (day 1 is today),
 * «Finish mission» while running (asks once, inline: it cannot be undone). A finished mission has none.
 */
export function MissionLifecycle({
  code,
  status,
  lang,
}: {
  code: string;
  status: MissionStatus;
  lang: Language;
}) {
  const t = textsFor(texts, lang);
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const run = (action: (code: string) => Promise<{ failed: boolean }>) =>
    start(async () => {
      const result = await action(code);
      if (result.failed) toast(t.missionActionFailed);
      setConfirming(false);
    });

  if (status === 'planned' || status === 'scheduled') {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button disabled={pending} onClick={() => run(startMissionAction)}>
          <Rocket data-icon="inline-start" />
          {status === 'scheduled' ? t.missionStartToday : t.missionStart}
        </Button>
        <span className="text-tertiary text-xs">{t.missionStartHint}</span>
      </div>
    );
  }
  if (status !== 'active') return null;
  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <Flag data-icon="inline-start" />
        {t.missionFinish}
      </Button>
    );
  }
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-xl border p-3">
      <p className="text-sm leading-6">{t.missionFinishWarn}</p>
      <div className="flex gap-2">
        <Button variant="outline" disabled={pending} onClick={() => run(finishMissionAction)}>
          <Flag data-icon="inline-start" />
          {t.missionFinishConfirm}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}
