import type { Level } from '@haven/core';
import { Plus } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { type KeyboardTypeOptions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';

import { BigButton } from './big-button';
import { havenTexts } from './i18n';
import { LevelBadge } from './level-badge';
import { useUnitLabel } from './unit-label';

type Props = {
  /** Text field value (controlled). */
  value: string;
  onChangeText: (text: string) => void;
  /** Save the reading. The screen updates in place (no confirmation screen). */
  onSave: () => void;
  /** `Indicator.unit` id (or an already translated label): shown via `useUnitLabel`. */
  unit?: string;
  /** Level the typed value would get (live, like Fitbit). Omit while the field is empty. */
  previewLevel?: Level;
  /** Collapsed button label. Default «Log a value». */
  label?: string;
  /** Grey line under the field (reference range, last value…). */
  hint?: string;
  placeholder?: string;
  /** Disable «Save» (invalid or empty value). */
  canSave?: boolean;
  saving?: boolean;
  /** Controlled open state. The «Measure» shortcut opens it with the field focused. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  keyboardType?: KeyboardTypeOptions;
  /** Extra controls between the field and the hint (category picker, symptom chips…). */
  extra?: ReactNode;
  /**
   * pinned (default): sticky footer of the screen — elevated surface, top border and
   * `insets.bottom + 16` bottom padding. Render it OUTSIDE the ScrollView. false: inline block.
   */
  pinned?: boolean;
  className?: string;
};

/**
 * Collapsible register (DESIGN_SYSTEM.md §8.6.7): a 56 pt «Log a value» button that turns into
 * field + unit + «Save» in the same place (no sheet, no pop-up), with the live level badge.
 * Collapsed it costs one button instead of a 150 pt form.
 */
export function RegisterEntry({
  value,
  onChangeText,
  onSave,
  unit: unitId,
  previewLevel,
  label,
  hint,
  placeholder,
  canSave = true,
  saving = false,
  open,
  defaultOpen = false,
  onOpenChange,
  keyboardType = 'decimal-pad',
  extra,
  pinned = true,
  className,
}: Props) {
  const t = useTexts(havenTexts);
  const insets = useSafeAreaInsets();
  const unitOf = useUnitLabel();
  const unit = unitId ? unitOf(unitId) : unitId;
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;
  const setOpen = (v: boolean) => {
    setInner(v);
    onOpenChange?.(v);
  };

  return (
    <View
      className={cn(
        pinned ? 'bg-elevated border-border px-gutter border-t pt-3' : 'gap-0',
        className,
      )}
      style={pinned ? { paddingBottom: insets.bottom + 16 } : undefined}
    >
      {!isOpen ? (
        <BigButton
          label={label ?? t.registerValue}
          icon={Plus}
          variant="secondary"
          onPress={() => setOpen(true)}
        />
      ) : (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center">
              <Input
                value={value}
                onChangeText={onChangeText}
                autoFocus
                keyboardType={keyboardType}
                placeholder={placeholder}
                accessibilityLabel={`${label ?? t.registerValue}${unit ? ` (${unit})` : ''}`}
                returnKeyType="done"
                onSubmitEditing={canSave && !saving ? onSave : undefined}
                className="h-row text-metric-sm rounded-lg pr-16 font-medium tabular-nums"
              />
              {unit ? (
                <Text
                  pointerEvents="none"
                  className="text-muted-foreground text-footnote absolute right-4"
                >
                  {unit}
                </Text>
              ) : null}
            </View>
            <BigButton
              label={t.save}
              onPress={onSave}
              disabled={!canSave}
              loading={saving}
              fullWidth={false}
            />
          </View>
          {extra}
          <View className="min-h-touch flex-row items-center gap-2">
            {previewLevel ? (
              <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
                <Text className="text-muted-foreground text-footnote">{t.willBe}</Text>
                <LevelBadge level={previewLevel} size="sm" />
              </View>
            ) : hint ? (
              <Text className="text-muted-foreground text-footnote flex-1">{hint}</Text>
            ) : (
              <View className="flex-1" />
            )}
            <Button
              variant="link"
              onPress={() => setOpen(false)}
              className="min-h-touch ml-auto h-auto px-0"
            >
              <Text className="text-link text-footnote font-medium">{t.cancel}</Text>
            </Button>
          </View>
          {previewLevel && hint ? (
            <Text className="text-muted-foreground text-caption -mt-2">{hint}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
