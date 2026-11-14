import { CheckCircle2, Clock } from 'lucide-react';
import { defineTexts, format, formatDelay, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { MetricCard } from './metric-card';
import type { MissionTotals } from './types';

const texts = defineTexts({
  es: {
    actionsDone: 'Acciones del día',
    actionsOf: 'de {total} resueltas',
    amberZones: 'Zonas por revisar',
    redZones: 'Zonas en emergencia',
    commDelay: 'Retardo de comunicación',
    onlyReceived: 'solo lo recibido',
  },
  en: {
    actionsDone: 'Daily actions',
    actionsOf: 'of {total} done',
    amberZones: 'Zones to check',
    redZones: 'Zones in emergency',
    commDelay: 'Communication delay',
    onlyReceived: 'received data only',
  },
});

type Props = {
  summary: MissionTotals;
  lang: Language;
  className?: string;
};

export function MissionStats({ summary, lang, className }: Props) {
  const t = texts[lang];
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      <MetricCard
        label={t.actionsDone}
        value={summary.actionsDone}
        lang={lang}
        detail={format(t.actionsOf, { total: summary.actionsTotal })}
        icon={<CheckCircle2 />}
      />
      <MetricCard
        label={t.amberZones}
        value={summary.amberZones}
        lang={lang}
        level={summary.amberZones > 0 ? 'amber' : undefined}
        detail={t.onlyReceived}
      />
      <MetricCard
        label={t.redZones}
        value={summary.redZones}
        lang={lang}
        level={summary.redZones > 0 ? 'red' : undefined}
        detail={t.onlyReceived}
      />
      <MetricCard
        label={t.commDelay}
        value={formatDelay(summary.delayMin)}
        lang={lang}
        icon={<Clock />}
      />
    </div>
  );
}
