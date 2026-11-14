'use client';

import { Rocket } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Language } from '@/lib/i18n';
import { startMissionAction } from '../actions';
import { texts } from '../i18n';

export function StartMission({
  mission,
  scheduled,
  lang,
}: {
  mission: string;
  scheduled: boolean;
  lang: Language;
}) {
  const t = texts[lang];
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await startMissionAction(mission);
            if (result.failed) toast(t.startFailed);
            else toast.success(t.startDone);
          })
        }
      >
        <Rocket data-icon="inline-start" />
        {scheduled ? t.startNowInstead : t.startMission}
      </Button>
      <span className="text-tertiary text-xs">{t.startHint}</span>
    </div>
  );
}
