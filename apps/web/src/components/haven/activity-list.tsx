import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import type { Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { TimeAgo } from './age-label';
import { EmptyState } from './empty-state';
import { LevelBadge } from './level-badge';
import { ago } from './levels';
import { havenTexts } from './texts';
import type { Now, VisualLevel } from './types';

export type ActivityItem = {
  id: string;
  level: VisualLevel;
  /** «Heart rate» — what happened. */
  title: string;
  /** Explanation from the engine, already translated. */
  detail?: string;
  /** Crew member name. */
  who?: string;
  /** ISO instant it became visible on Earth (`visibleAt`). */
  at: string;
  href?: string;
};

type Props = {
  items: ActivityItem[];
  now: Now;
  lang: Language;
  title?: string;
  /** Empty-state copy. */
  emptyText?: string;
  /** Right-hand slot in the header. */
  actions?: ReactNode;
  className?: string;
};

/** Recent alerts as an activity feed on shadcn `Card` + `Item`, newest first (ref. Better Stack). */
export function ActivityList({ items, now, lang, title, emptyText, actions, className }: Props) {
  const t = havenTexts[lang];
  const sorted = [...items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return (
    <Card className={cn('gap-2', className)}>
      <CardHeader className="border-b">
        <CardTitle className="text-[15px] font-semibold">{title ?? t.activity}</CardTitle>
        {actions ? <CardAction>{actions}</CardAction> : null}
      </CardHeader>
      <CardContent className="px-2">
        {sorted.length ? (
          <ul className="flex flex-col gap-1">
            {sorted.map((item) => (
              <li key={item.id}>
                <Item
                  size="sm"
                  className="min-h-12 items-start"
                  render={item.href ? <Link href={item.href} /> : undefined}
                >
                  <ItemMedia>
                    <LevelBadge level={item.level} lang={lang} size="sm" symbolOnly />
                  </ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="flex-wrap">
                      {item.who ? <span className="font-semibold">{item.who}</span> : null}
                      <span className="font-normal">{item.title}</span>
                    </ItemTitle>
                    {item.detail ? <ItemDescription>{item.detail}</ItemDescription> : null}
                  </ItemContent>
                  <ItemActions className="text-muted-foreground font-mono text-xs">
                    <TimeAgo at={item.at} lang={lang}>
                      {ago(item.at, now)}
                    </TimeAgo>
                  </ItemActions>
                </Item>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={emptyText ?? t.noActivity} className="border-0 py-8" />
        )}
      </CardContent>
    </Card>
  );
}
