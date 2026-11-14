import type { Step } from '@haven/core';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Volume2,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';
import { BigButton, format, StepTimer, useCountdown } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { type EmergencyTexts, texts } from '../i18n';
import { hasOptions, type StepPhase } from '../logic/protocol';

/** Instructions longer than this read better one size down (CPR, AED steps). */
const LONG_TEXT = 120;

const PHASE_LABEL: Record<StepPhase, keyof EmergencyTexts> = {
  triage: 'phaseTriage',
  cpr: 'phaseCpr',
  aed: 'phaseAed',
  care: 'phaseCare',
};

type Props = {
  step: Step;
  phase: StepPhase;
  index: number;
  /** Label of the main button when it is not "Done" (e.g. the packet step). */
  doneLabel?: string;
  onDone: (option?: number) => void;
  canGoBack: boolean;
  onBack: () => void;
  onAttachPhoto: () => void;
  photoCount: number;
  photoFailed: boolean;
  say: (text: string | undefined, force?: boolean) => void;
  buzz: (kind: 'tap' | 'alert') => void;
  /** Extra block under the instruction (crew alert, symptoms). */
  children?: ReactNode;
};

function SecondaryButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: typeof Camera;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      className="min-h-touch h-auto grow basis-[30%] flex-col gap-1 rounded-lg px-2 py-2 sm:h-auto"
    >
      <Icon as={icon} size={20} strokeWidth={1.75} className="text-muted-foreground" />
      <Text className="text-muted-foreground text-caption text-center">{label}</Text>
    </Button>
  );
}

/**
 * One protocol step per screen (C). Steps with options are one-tap triage (B): a large question
 * and stacked ≥ 96 pt answers. Keyed by visit so the timer restarts on every entry.
 */
export function StepView({
  step,
  phase,
  index,
  doneLabel,
  onDone,
  canGoBack,
  onBack,
  onAttachPhoto,
  photoCount,
  photoFailed,
  say,
  buzz,
  children,
}: Props) {
  const t = useTexts(texts);
  const tr = useTranslate();
  const seconds = step.seconds ?? 0;
  const [running, setRunning] = useState(seconds > 0);
  const timer = useCountdown(seconds, running, () => {
    buzz('alert');
    say(t.timeUp);
  });
  const triage = hasOptions(step);
  const instruction = tr(step.text);
  const audio = tr(step.audio) || instruction;
  const options = step.options ?? [];

  // Read the step aloud on entry (the screen decides whether audio is on).
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per visit (the view is keyed)
  useEffect(() => {
    say(audio);
  }, []);

  // No total: the remaining path depends on the answers, and a changing "of N" misleads (QA).
  // So no segmented bar here: a big step numeral (Mobbin «one numbered step per screen») instead.
  return (
    <View className="gap-6">
      <View
        className="flex-row items-end gap-3"
        accessible
        accessibilityLabel={`${format(t.stepN, { n: index })} · ${t[PHASE_LABEL[phase]]}`}
      >
        <Text className="text-metric-xl font-semibold tabular-nums">{index}</Text>
        <View className="mb-2.5 gap-0.5">
          <Text className="text-tertiary text-micro font-semibold uppercase">{t.stepLabel}</Text>
          <Text className="text-muted-foreground text-body-sm font-medium">
            {t[PHASE_LABEL[phase]]}
          </Text>
        </View>
      </View>

      <Text
        role="heading"
        className={cn(
          instruction.length <= LONG_TEXT ? 'text-title font-bold' : 'text-title-sm font-semibold',
        )}
      >
        {instruction}
      </Text>

      {seconds > 0 ? (
        <View className="items-center gap-3">
          <StepTimer
            total={seconds}
            remaining={timer.remaining}
            size={triage ? 160 : 200}
            paused={!running && !timer.done}
          />
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              className="min-h-touch h-auto gap-2 rounded-full px-5 sm:h-auto"
              onPress={() => setRunning((r) => !r)}
              disabled={timer.done}
            >
              <Icon as={running ? Pause : Play} size={18} className="text-foreground" />
              <Text>{running ? t.pauseTimer : t.resumeTimer}</Text>
            </Button>
            <Button
              variant="outline"
              className="min-h-touch h-auto gap-2 rounded-full px-5 sm:h-auto"
              onPress={() => {
                timer.reset();
                setRunning(true);
              }}
            >
              <Icon as={RotateCcw} size={18} className="text-foreground" />
              <Text>{t.restartTimer}</Text>
            </Button>
          </View>
        </View>
      ) : null}

      {children}

      {triage ? (
        // alias questionnaire: answers as tall rows inside ONE hairline box (glove-sized, 88 pt).
        // The last answer is the safe default «if in doubt»: it carries a white leading bar.
        <View className="gap-3">
          <View className="border-border rounded-lg border">
            {options.map((option, i) => {
              const safe = i === options.length - 1 && options.length > 1;
              return (
                <View key={option.next}>
                  {i > 0 ? <View className="bg-border h-px" /> : null}
                  <Button
                    variant="ghost"
                    accessibilityRole="button"
                    accessibilityLabel={tr(option.text)}
                    onPress={() => {
                      buzz('tap');
                      onDone(i);
                    }}
                    className={cn(
                      'active:bg-active h-auto min-h-[88px] justify-start gap-4 rounded-none px-5 py-0 sm:h-auto',
                      i === 0 && 'rounded-t-lg',
                      i === options.length - 1 && 'rounded-b-lg',
                    )}
                  >
                    {safe ? (
                      <View className="bg-foreground absolute top-4 bottom-4 left-0 w-0.5 rounded-full" />
                    ) : null}
                    <Text className="text-title flex-1 font-semibold">{tr(option.text)}</Text>
                    <Icon
                      as={ChevronRight}
                      size={22}
                      className="text-tertiary group-active:text-tertiary"
                    />
                  </Button>
                </View>
              );
            })}
          </View>
          {options.length > 1 ? (
            <Text className="text-muted-foreground text-caption">
              {format(t.doubtHint, { n: tr(options[options.length - 1].text) })}
            </Text>
          ) : null}
        </View>
      ) : (
        <BigButton
          label={doneLabel ?? t.done}
          size="lg"
          variant="primary"
          onPress={() => {
            buzz('tap');
            onDone();
          }}
        />
      )}

      <View className="border-border flex-row flex-wrap gap-1 border-t pt-3">
        <SecondaryButton icon={Volume2} label={t.repeatAudio} onPress={() => say(audio, true)} />
        <SecondaryButton icon={Camera} label={t.attachPhoto} onPress={onAttachPhoto} />
        <SecondaryButton
          icon={ChevronLeft}
          label={t.previous}
          onPress={onBack}
          disabled={!canGoBack}
        />
      </View>
      {photoCount > 0 ? (
        <Text className="text-muted-foreground text-caption">
          {format(t.photoAdded, { n: photoCount })}
        </Text>
      ) : null}
      {photoFailed ? <Text className="text-level-amber text-caption">{t.photoFailed}</Text> : null}
    </View>
  );
}
