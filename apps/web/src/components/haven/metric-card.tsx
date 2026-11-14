import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { LevelBadge } from './level-badge';
import { LEVELS } from './levels';
import { havenTexts } from './texts';
import type { VisualLevel } from './types';

export type Trend = {
  direction: 'up' | 'down' | 'flat';
  text?: string;
};

type Props = {
  label: string;
  value: string | number;
  lang: Language;
  unit?: string;
  detail?: ReactNode;
  trend?: Trend;
  level?: VisualLevel;
  icon?: ReactNode;
  className?: string;
};

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight };

export function MetricCard({
  label,
  value,
  lang,
  unit,
  detail,
  trend,
  level,
  icon,
  className,
}: Props) {
  const t = havenTexts[lang];
  const meta = level ? LEVELS[level] : null;
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  const trendText =
    trend?.text ??
    (trend ? { up: t.trendUp, down: t.trendDown, flat: t.trendFlat }[trend.direction] : undefined);

  return (
    <Card className={cn('min-h-28 justify-between gap-3 [--card-spacing:--spacing(5)]', className)}>
      <CardHeader>
        <CardDescription className="text-muted-foreground text-[13px]">{label}</CardDescription>
        {meta && level ? (
          <CardAction>
            <LevelBadge level={level} lang={lang} size="sm" symbolOnly />
          </CardAction>
        ) : icon ? (
          <CardAction aria-hidden="true" className="text-muted-foreground [&>svg]:size-4">
            {icon}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline gap-1">
          <span className="numeric text-[28px] leading-8 font-medium tracking-[-0.8px]">
            {value}
          </span>
          {unit ? <span className="text-muted-foreground text-[13px]">{unit}</span> : null}
        </div>
        {detail || trend ? (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            {TrendIcon ? (
              <span className="inline-flex items-center gap-1">
                <TrendIcon aria-hidden="true" className="size-3.5" />
                {trendText}
              </span>
            ) : null}
            {detail ? <span>{detail}</span> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
