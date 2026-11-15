'use client';

import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Compass,
  Dumbbell,
  Footprints,
  Languages,
  LogIn,
  Moon,
  Pill,
  PlaneLanding,
  Plus,
  Rocket,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  TestTube,
  Users,
  Waves,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { setLanguage } from '@/components/haven/actions';
import { LevelGlyph } from '@/components/haven/level-glyph';
import { levelLabel } from '@/components/haven/levels';
import { havenTexts } from '@/components/haven/texts';
import { THEME_COOKIE } from '@/components/haven/theme';
import type { VisualLevel } from '@/components/haven/types';
import { START_TOUR_EVENT } from '@/components/product-tour';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { LANGUAGES, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const OPEN_COMMAND_EVENT = 'haven:command-open';

export type CommandCrewMember = { id: string; name: string; level: VisualLevel };

type Props = {
  lang: Language;
  crew: CommandCrewMember[];
};

export function CommandTrigger({
  lang,
  variant = 'button',
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'children' | 'variant'> & {
  lang: Language;
  variant?: 'button' | 'field';
}) {
  const t = havenTexts[lang];
  const open = () => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));
  if (variant === 'field') {
    return (
      <Button
        variant="outline"
        size="sm"
        {...props}
        onClick={open}
        className={cn(
          'text-muted-foreground hover:bg-hover hover:text-foreground border-border flex h-8 w-full justify-start gap-2.5 rounded-lg px-2.5 text-sm font-normal group-data-[collapsible=icon]:hidden',
          className,
        )}
      >
        <Search aria-hidden="true" className="size-3.5" />
        <span className="flex-1 text-left">{t.search}</span>
        <Kbd>⌘K</Kbd>
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        open();
      }}
      aria-label={`${t.commandTitle} (⌘K)`}
      className={cn(
        'text-muted-foreground hover:bg-hover hover:text-foreground border-border hit-area h-7 gap-1.5 rounded-md px-2 text-xs font-normal',
        className,
      )}
    >
      <Search aria-hidden="true" className="size-3.5" />
      <Kbd className="border-0 bg-transparent px-0">⌘K</Kbd>
    </Button>
  );
}

export function CommandMenu({ lang, crew }: Props) {
  const t = havenTexts[lang];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
    };
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  const go = (href: string) => run(() => router.push(href));
  const toggleTheme = () =>
    run(() => {
      const dark = !document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', dark);
      // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie, read by THEME_SCRIPT
      document.cookie = `${THEME_COOKIE}=${dark ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
    });
  const other = LANGUAGES.find((l) => l !== lang) ?? lang;
  const switchLanguage = () =>
    run(() =>
      startTransition(async () => {
        const form = new FormData();
        form.set('lang', other);
        await setLanguage(form);
        router.refresh();
      }),
    );

  const pages = [
    { href: '/', label: t.navCrew, icon: Users },
    { href: '/orion', label: t.navOrion, icon: Sparkles },
    { href: '/rules', label: t.navRules, icon: SlidersHorizontal },
    { href: '/kpi', label: t.navKpi, icon: ChartNoAxesCombined },
    { href: '/eva', label: t.navEva, icon: Footprints },
    { href: '/reentry', label: t.navReentry, icon: PlaneLanding },
    { href: '/medication', label: t.navMedication, icon: Pill },
    { href: '/samples', label: t.navSamples, icon: TestTube },
    { href: '/exercise', label: t.navExercise, icon: Dumbbell },
    { href: '/motion', label: t.navMotion, icon: Waves },
    { href: '/workload', label: t.navWorkload, icon: BriefcaseBusiness },
    { href: '/missions', label: t.navMissions, icon: Rocket },
    { href: '/settings', label: t.navSettings, icon: Settings },
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t.commandTitle}
      description={t.commandDescription}
    >
      <Command loop>
        <CommandInput placeholder={t.commandPlaceholder} />
        <CommandList>
          <CommandEmpty>{t.commandEmpty}</CommandEmpty>
          {crew.length ? (
            <CommandGroup heading={t.commandAstronauts}>
              {crew.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name} ${m.id}`}
                  onSelect={() => go(`/astronaut/${encodeURIComponent(m.id)}`)}
                >
                  <LevelGlyph level={m.level} size={10} />
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="text-tertiary text-xs">{levelLabel(m.level, lang)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          <CommandGroup heading={t.commandPages}>
            {pages.map((p) => (
              <CommandItem key={p.href} value={p.label} onSelect={() => go(p.href)}>
                <p.icon aria-hidden="true" className="text-muted-foreground" />
                <span className="flex-1">{p.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={t.commandActions}>
            <CommandItem value={t.createMission} onSelect={() => go('/missions/new')}>
              <Plus aria-hidden="true" className="text-muted-foreground" />
              <span className="flex-1">{t.createMission}</span>
            </CommandItem>
            <CommandItem value={t.joinMission} onSelect={() => go('/missions#join-code')}>
              <LogIn aria-hidden="true" className="text-muted-foreground" />
              <span className="flex-1">{t.joinMission}</span>
            </CommandItem>
            <CommandItem value={t.commandToggleTheme} onSelect={toggleTheme}>
              <Moon aria-hidden="true" className="text-muted-foreground" />
              <span className="flex-1">{t.commandToggleTheme}</span>
            </CommandItem>
            <CommandItem
              value={t.commandTour}
              onSelect={() => run(() => window.dispatchEvent(new Event(START_TOUR_EVENT)))}
            >
              <Compass aria-hidden="true" className="text-muted-foreground" />
              <span className="flex-1">{t.commandTour}</span>
            </CommandItem>
            <CommandItem value={t.commandLanguage} onSelect={switchLanguage}>
              <Languages aria-hidden="true" className="text-muted-foreground" />
              <span className="flex-1">{t.commandLanguage}</span>
              <CommandShortcut>{other.toUpperCase()}</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="text-tertiary text-2xs flex h-9 items-center gap-4 border-t px-4">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            {t.commandNavigate}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            {t.commandSelect}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>esc</Kbd>
            {t.commandClose}
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
