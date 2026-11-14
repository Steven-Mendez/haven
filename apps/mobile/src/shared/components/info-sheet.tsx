import { explainTerm, type Level } from '@haven/core';
import * as Haptics from 'expo-haptics';
import { Info } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { BottomSheet } from '@/shared/components/bottom-sheet';
import { havenTexts } from '@/shared/components/haven/i18n';
import { LEVEL_TEXT_CLASS, levelLabel, levelPhrase } from '@/shared/components/haven/level';
import { LevelSymbol } from '@/shared/components/haven/level-symbol';
import { Button } from '@/shared/components/ui/button';
import { DialogClose } from '@/shared/components/ui/dialog';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useMission } from '@/shared/data';
import { currentLanguage, defineTexts, useLanguage, useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

// One reusable «explain in place» layer (user request: not everyone is a doctor). Plain-language
// texts come from the core glossary (`explainTerm`, packages/core/config/glossary.json); this file
// only holds UI copy. A tap opens a bottom sheet; nothing is added permanently to the screen.

const texts = defineTexts({
  es: {
    close: 'Cerrar',
    unit: 'Unidad',
    explain: 'Explicar',
    explainHint: 'Abre una explicación sencilla',
    crewTime: 'Hora a bordo',
    earthTime: 'Hora en Tierra (UTC)',
    lightDelay: 'Retardo de la señal',
    lightDelayValue: '{n} min en cada sentido',
    measured: 'Medido',
    ageTitle: 'Antigüedad del dato',
    actions: 'Acciones',
  },
  en: {
    close: 'Close',
    unit: 'Unit',
    explain: 'Explain',
    explainHint: 'Opens a plain-language explanation',
    crewTime: 'Crew time',
    earthTime: 'Earth time (UTC)',
    lightDelay: 'Signal delay',
    lightDelayValue: '{n} min each way',
    measured: 'Measured',
    ageTitle: 'Age of the reading',
    actions: 'Actions',
  },
});

export type InfoAction = { label: string; onPress: () => void };

export type InfoContent = {
  title: string;
  body?: string;
  /** Unit explanation («mmHg: millimetres of mercury»). */
  unitHint?: string;
  /** Level line (shape + coloured label + what it means). */
  level?: Level;
  /** Key / value rows (tabular), e.g. crew time · Earth time · delay. */
  rows?: { label: string; value: string }[];
  /** Up to three actions (context menu on long press). */
  actions?: InfoAction[];
  /** Extra content under the text. */
  children?: ReactNode;
};

let open: ((content: InfoContent) => void) | null = null;

/** Opens the info sheet with any content. */
export function showInfo(content: InfoContent) {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
  open?.(content);
}

/** Opens the glossary entry `id` (indicator id, zone id or term id). Returns false when missing. */
export function explain(id: string, extra: Partial<InfoContent> = {}): boolean {
  const entry = explainTerm(id, currentLanguage());
  if (!entry && !extra.title) return false;
  showInfo({
    title: entry?.term ?? extra.title ?? id,
    body: entry?.short,
    unitHint: entry?.unitHint,
    ...extra,
  });
  return true;
}

/** Popover for a level shape or meter: «Check · outside your personal range». */
export function explainLevel(level: Level) {
  const lang = currentLanguage();
  const t = havenTexts[lang];
  const entry = explainTerm(`level-${level}`, lang);
  showInfo({
    title: levelLabel(t, level),
    level,
    body: entry?.short ?? levelPhrase(t, level),
  });
}

/** Popover for a data-age label: crew time, Earth time and the one-way light-time delay. */
export function explainAge(takenAt: string | undefined, delayMin: number) {
  const lang = currentLanguage();
  const t = texts[lang];
  const at = takenAt ? new Date(takenAt) : undefined;
  const fmt = (d: Date, utc = false) =>
    d.toLocaleString(lang, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      ...(utc ? { timeZone: 'UTC' } : {}),
    });
  const delay = explainTerm('communication-delay', lang);
  showInfo({
    title: t.ageTitle,
    body: delay?.short,
    rows: [
      ...(at
        ? [
            { label: `${t.measured} · ${t.crewTime}`, value: fmt(at) },
            { label: t.earthTime, value: fmt(at, true) },
          ]
        : []),
      {
        label: t.lightDelay,
        value: t.lightDelayValue.replace('{n}', String(Math.round(delayMin * 10) / 10)),
      },
    ],
  });
}

/**
 * The sheet itself (mount once, in the tabs layout): `elevated` bottom sheet, hairline top,
 * radius 16, 17/600 title, 15 pt plain explanation, unit hint, level line, rows and actions.
 */
export function InfoSheetHost() {
  const t = useTexts(texts);
  const h = useTexts(havenTexts);
  const [content, setContent] = useState<InfoContent | null>(null);
  useEffect(() => {
    open = setContent;
    return () => {
      open = null;
    };
  }, []);
  const close = () => setContent(null);

  return (
    <BottomSheet open={content !== null} onClose={close}>
      {content ? (
        <>
          <View className="gap-2">
            <Text role="heading" className="text-title-sm font-semibold">
              {content.title}
            </Text>
            {content.level ? (
              <View className="flex-row items-center gap-2">
                <LevelSymbol level={content.level} size={10} />
                <Text
                  className={cn(
                    'text-body-sm font-semibold',
                    content.level === 'pending'
                      ? 'text-muted-foreground'
                      : LEVEL_TEXT_CLASS[content.level],
                  )}
                >
                  {levelLabel(h, content.level)}
                </Text>
              </View>
            ) : null}
            {content.body ? (
              <Text className="text-muted-foreground text-body-sm">{content.body}</Text>
            ) : null}
            {content.unitHint ? (
              <Text className="text-tertiary text-caption">{`${t.unit} · ${content.unitHint}`}</Text>
            ) : null}
          </View>
          {content.rows?.length ? (
            <View className="border-border rounded-lg border">
              {content.rows.map((r, i) => (
                <View
                  key={r.label}
                  className={cn(
                    'min-h-row-settings flex-row items-center justify-between gap-3 px-4 py-2',
                    i > 0 && 'border-border border-t',
                  )}
                >
                  <Text className="text-muted-foreground text-body-sm">{r.label}</Text>
                  <Text className="text-body-sm font-medium tabular-nums">{r.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {content.children}
          {content.actions?.length ? (
            <View className="border-border rounded-lg border" accessibilityLabel={t.actions}>
              {content.actions.map((a, i) => (
                <Button
                  key={a.label}
                  variant="ghost"
                  onPress={() => {
                    close();
                    a.onPress();
                  }}
                  className={cn(
                    'min-h-row active:bg-active h-auto justify-start rounded-none px-4 py-0 sm:h-auto',
                    i > 0 && 'border-border border-t',
                  )}
                >
                  <Text className="text-foreground text-body-sm font-medium">{a.label}</Text>
                </Button>
              ))}
            </View>
          ) : null}
          <DialogClose asChild>
            <Button className="min-h-button h-auto rounded-full py-0 active:opacity-85 sm:h-auto">
              <Text className="text-primary-foreground text-body font-semibold">{t.close}</Text>
            </Button>
          </DialogClose>
        </>
      ) : null}
    </BottomSheet>
  );
}

/**
 * A term that explains itself: the label with a dotted underline; a tap opens the glossary entry.
 * `id` = indicator id, zone id or glossary term id. Without a glossary entry it renders plain text.
 */
export function Term({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const language = useLanguage();
  const t = useTexts(texts);
  const entry = explainTerm(id, language);
  if (!entry) return <Text className={className}>{children}</Text>;
  return (
    <Text
      accessibilityRole="button"
      accessibilityHint={t.explainHint}
      onPress={() => explain(id)}
      suppressHighlighting={false}
      className={cn('underline decoration-dotted', className)}
      style={{ textDecorationStyle: 'dotted', textDecorationColor: '#80808a' }}
    >
      {children}
    </Text>
  );
}

/** Small ⓘ (14 pt, tertiary, 44 pt hit area) that opens the glossary entry `id`. */
export function InfoTip({
  id,
  label,
  className,
}: {
  id: string;
  label?: string;
  className?: string;
}) {
  const language = useLanguage();
  const t = useTexts(texts);
  const entry = explainTerm(id, language);
  if (!entry) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      accessibilityLabel={`${t.explain}: ${label ?? entry.term}`}
      hitSlop={15}
      onPress={() => explain(id)}
      className={cn(
        'size-auto rounded-none p-0 active:bg-transparent active:opacity-60 sm:size-auto',
        className,
      )}
    >
      <Icon as={Info} size={14} strokeWidth={2} className="text-tertiary" />
    </Button>
  );
}

/** Mission delay for age popovers, from the shared store. */
export function useMissionDelay(): number {
  return useMission().currentDelayMin;
}

/**
 * Long-press context sheet for an indicator row: plain explanation from the glossary plus the
 * actions that exist (see details · log a value).
 */
export function indicatorContext(id: string, level: Level | undefined, actions: InfoAction[]) {
  explain(id, { level, actions });
}
