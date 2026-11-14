'use client';

import { Rocket } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { format, type Language } from '@/lib/i18n';
import { startMissionAction } from '../actions';
import { texts } from '../i18n';

export function StartMission({
  mission,
  scheduled,
  ready,
  total,
  lang,
}: {
  mission: string;
  scheduled: boolean;
  ready: number;
  total: number;
  lang: Language;
}) {
  const t = texts[lang];
  const [pending, start] = useTransition();
  const allReady = total > 0 && ready === total;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending || !allReady}
        onClick={() =>
          start(async () => {
            const result = await startMissionAction(mission);
            if (result.failed) toast(result.notReady ? t.startNotReady : t.startFailed);
            else toast.success(t.startDone);
          })
        }
      >
        <Rocket data-icon="inline-start" />
        {scheduled ? t.startNowInstead : t.startMission}
      </Button>
      <span className="text-tertiary text-xs" role="status">
        {allReady
          ? `${format(t.startAllReady, { n: total })} ${t.startHint}`
          : total === 0
            ? t.startNoCrew
            : format(t.startWaiting, { ready, total })}
      </span>
    </div>
  );
}
