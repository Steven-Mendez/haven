import { loadConfig } from '@haven/core';
import { type ReactNode, Suspense } from 'react';
import { setLanguage } from '@/components/haven/actions';
import { PageContainer } from '@/components/haven/page-container';
import { Portrait } from '@/components/haven/portrait';
import { type HavenTexts, havenTexts } from '@/components/haven/texts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { format, LANGUAGES, type Language, translate } from '@/lib/i18n';
import { getLanguage } from '@/lib/language';
import { getMissionCode } from '@/lib/mission';
import { cn } from '@/lib/utils';
import { SettingsNav } from './components/settings-nav';
import { ThemeChoice } from './components/theme-choice';
import { type SettingsTexts, texts } from './i18n';
import { readMissions } from './server';

const LANGUAGE_NAMES: Record<Language, string> = { es: 'Español', en: 'English' };

/** Section heading + description above a bordered group of rows (Linear settings). */
function Group({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-16 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-title`} className="text-[15px] leading-[22px] font-semibold">
          {title}
        </h2>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
      <div className="bg-card divide-border-subtle divide-y rounded-lg border">{children}</div>
    </section>
  );
}

/** 52 px settings row: label (and grey hint) on the left, value or control on the right. */
function Row({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-13 items-center justify-between gap-4 px-4 py-2.5', className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm">{label}</span>
        {hint ? <span className="text-tertiary text-xs">{hint}</span> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Real shortcuts only (same list as the `?` dialog in components/keyboard-shortcuts.tsx). */
function shortcutRows(h: HavenTexts): { keys: string[][]; label: string }[] {
  return [
    { keys: [['⌘', 'K']], label: h.shortcutOpenMenu },
    { keys: [['j'], ['k']], label: h.shortcutMove },
    { keys: [['↵']], label: h.shortcutOpen },
    { keys: [['g', 'c']], label: h.shortcutGoCrew },
    { keys: [['g', 'r']], label: h.shortcutGoRules },
    { keys: [['g', 't']], label: h.shortcutGoTrends },
    { keys: [['g', 'e']], label: h.shortcutGoEva },
    { keys: [['g', 'm']], label: h.shortcutGoMissions },
    { keys: [['⌘', 'B']], label: h.shortcutSidebar },
    { keys: [['?']], label: h.shortcutHelp },
    { keys: [['esc']], label: h.shortcutClose },
  ];
}

async function MissionRows({ lang, t }: { lang: Language; t: SettingsTexts }) {
  const [missions, active] = await Promise.all([readMissions(), getMissionCode()]);
  if (missions === null) return <Row label={t.missionsError} />;
  if (missions.length === 0) return <Row label={t.missionsEmpty} />;
  const environments = loadConfig().environments;
  // Active first, then newest.
  const sorted = [...missions].sort(
    (a, b) => Number(b.code === active) - Number(a.code === active),
  );
  return sorted.map((m) => {
    const env = environments.find((e) => e.id === m.environment);
    return (
      <Row
        key={m.code}
        label={
          <span className="flex items-center gap-2">
            <span className="text-tertiary font-mono text-xs">{m.code}</span>
            <span className="truncate font-medium">{m.name}</span>
            {m.code === active ? (
              <Badge variant="secondary" className="text-foreground h-5 text-[11px]">
                {t.active}
              </Badge>
            ) : null}
          </span>
        }
        hint={[
          env ? translate(env.name, lang) : m.environment,
          format(t.dayOf, { day: m.day, total: m.durationDays }),
          format(t.crewCount, { n: m.crew.length }),
        ].join(' · ')}
      />
    );
  });
}

function MissionRowsSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <Skeleton className="h-3 w-56" />
      <Skeleton className="h-2.5 w-40" />
    </div>
  );
}

async function SettingsContent() {
  const [lang, code] = await Promise.all([getLanguage(), getMissionCode()]);
  const t = texts[lang];
  const h = havenTexts[lang];
  const sections = [
    { id: 'profile', label: t.profile },
    { id: 'missions', label: t.missions },
    { id: 'preferences', label: t.preferences },
    { id: 'shortcuts', label: t.shortcuts },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[176px_minmax(0,640px)] md:gap-12">
      <SettingsNav label={t.navLabel} sections={sections} />
      <div className="flex min-w-0 flex-col gap-10">
        <Group id="profile" title={t.profile} description={t.profileDescription}>
          <div className="flex items-center gap-3 px-4 py-4">
            <Portrait id="lucia-control" name={h.operatorName} size={48} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] leading-[22px] font-semibold">
                {h.operatorName}
              </span>
              <span className="text-muted-foreground text-xs">{h.operatorRole}</span>
            </div>
          </div>
          <Row label={t.activeMission}>
            <span className="text-muted-foreground font-mono text-xs">{code}</span>
          </Row>
        </Group>

        <Group id="missions" title={t.missions} description={t.missionsDescription}>
          <Suspense fallback={<MissionRowsSkeleton />}>
            <MissionRows lang={lang} t={t} />
          </Suspense>
        </Group>

        <Group id="preferences" title={t.preferences} description={t.preferencesDescription}>
          <Row label={t.language} hint={t.languageHint}>
            <form action={setLanguage} aria-label={t.language} className="flex">
              <div className="flex gap-0.5 rounded-md border p-0.5">
                {LANGUAGES.map((l) => (
                  <Button
                    key={l}
                    type="submit"
                    name="lang"
                    value={l}
                    lang={l}
                    size="xs"
                    variant="ghost"
                    aria-pressed={l === lang}
                    className="aria-pressed:bg-active aria-pressed:text-foreground text-muted-foreground h-6 rounded-sm px-2.5 text-xs"
                  >
                    {LANGUAGE_NAMES[l]}
                  </Button>
                ))}
              </div>
            </form>
          </Row>
          <Row label={t.theme} hint={t.themeHint}>
            <ThemeChoice labels={{ label: t.theme, dark: t.dark, light: t.light }} />
          </Row>
        </Group>

        <Group id="shortcuts" title={t.shortcuts} description={t.shortcutsDescription}>
          {shortcutRows(h).map((r) => (
            <Row key={r.label} label={r.label} className="min-h-10 py-1.5">
              {r.keys.map((combo) => (
                <KbdGroup key={combo.join('+')}>
                  {combo.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </KbdGroup>
              ))}
            </Row>
          ))}
        </Group>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[176px_minmax(0,640px)] md:gap-12">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
      <div className="flex flex-col gap-10">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    </div>
  );
}

/** Settings (`/settings`, opened from the operator row in the sidebar footer and from ⌘K). */
export function View() {
  return (
    <PageContainer className="max-w-[960px] gap-8">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </PageContainer>
  );
}
