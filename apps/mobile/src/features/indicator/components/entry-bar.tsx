import type { Indicator, Reading } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useDeferredValue, useMemo, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BigButton, format, LevelBadge, useUnitLabel } from '@/shared/components/haven';
import { showToast } from '@/shared/components/toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { config } from '@/shared/config';
import { store, useMission, usePreferences, useReadings } from '@/shared/data';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';
import { formatNumber, formatRange } from '../logic/format';
import {
  dailyActionZone,
  entryIndicators,
  manualReading,
  parseNumber,
  referenceSide,
  validateNumber,
} from '../logic/manual-entry';
import { previewAssessments } from '../logic/preview';
import { indicatorForEnvironment } from '../logic/rule';
import { categoriesOf } from '../logic/series';
import { useCategoryText } from './use-category-text';

const SYMPTOM_INDICATOR = 'symptom';

/**
 * «Register» always visible in the fixed footer (DESIGN_SYSTEM 4.1a): `[ 128 ] mmHg [Save]`.
 * While typing, the badge shows the level the engine would give; saving updates the screen in
 * place (no confirmation screen). Blood pressure: two fields, two readings. Categories: a selector.
 */
export function EntryBar({
  indicator,
  autoFocus,
  secondary,
}: {
  indicator: Indicator;
  autoFocus?: boolean;
  /** A red level: «Open protocol» is the only main action, so «Register» steps back (§8.0.7). */
  secondary?: boolean;
}) {
  // Folded into one 56 pt button (DESIGN_SYSTEM §8.6); «Measure» (`autoFocus`) opens it directly.
  const [open, setOpen] = useState(Boolean(autoFocus));
  const t = useTexts(texts);
  const tr = useTranslate();
  const unitText = useUnitLabel();
  const language = useLanguage();
  const insets = useSafeAreaInsets();
  const categoryOf = useCategoryText();
  const mission = useMission();
  const { crewMember } = usePreferences();
  const allReadings = useReadings();

  const fields = useMemo(
    () =>
      entryIndicators(indicator.id)
        .map((id) => indicatorForEnvironment(config, id, mission.environment))
        .filter((i): i is Indicator => Boolean(i)),
    [indicator.id, mission.environment],
  );
  const isCategory = indicator.kind === 'category';

  const [values, setValues] = useState<Record<string, string>>({});
  const [category, setCategory] = useState<string | undefined>();
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | undefined>();
  // The preview runs the engine: defer it so typing stays instant.
  const typed = useDeferredValue(values);

  // Candidate readings from what is typed (only when every field is a number).
  const candidates = useMemo((): Reading[] | undefined => {
    const takenAt = new Date().toISOString();
    if (isCategory) {
      return category
        ? [manualReading({ id: 'preview', indicator, value: category, crewMember, takenAt })]
        : undefined;
    }
    const parsed = fields.map((f) => parseNumber(typed[f.id] ?? ''));
    if (parsed.some((v) => v === undefined)) return undefined;
    return fields.map((f, i) =>
      manualReading({
        id: `preview-${f.id}`,
        indicator: f,
        value: parsed[i] as number,
        crewMember,
        takenAt,
      }),
    );
  }, [isCategory, category, indicator, fields, typed, crewMember]);

  const preview = useMemo(() => {
    if (!candidates) return [];
    const ids = new Set(candidates.map((c) => c.indicator));
    return previewAssessments({
      config,
      environment: mission.environment,
      readings: allReadings.filter((r) => ids.has(r.indicator)),
      candidates,
      baselines: Object.fromEntries([...ids].map((id) => [id, store.baseline(id)])),
      symptoms: allReadings.filter((r) => r.indicator === SYMPTOM_INDICATOR),
      now: new Date(),
    });
  }, [candidates, allReadings, mission.environment]);

  const dailyZone = dailyActionZone(config, indicator.id);
  const dailyZoneName = tr(config.zones.find((z) => z.id === dailyZone)?.name);

  const save = async () => {
    // Built from what is typed now, not from the deferred preview.
    const takenAt = new Date().toISOString();
    const parsed = fields.map((f) => parseNumber(values[f.id] ?? ''));
    const toSave: Reading[] | undefined = isCategory
      ? category
        ? [manualReading({ id: randomUUID(), indicator, value: category, crewMember, takenAt })]
        : undefined
      : parsed.some((v) => v === undefined)
        ? undefined
        : fields.map((f, i) =>
            manualReading({
              id: randomUUID(),
              indicator: f,
              value: parsed[i] as number,
              crewMember,
              takenAt,
            }),
          );
    if (!toSave) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await store.saveReadings(toSave);
      // Show the updated screen: the keyboard would cover it.
      Keyboard.dismiss();
      setValues({});
      setCategory(undefined);
      setShowErrors(false);
      setOpen(false);
      const note = dailyZone
        ? `${t.saved} · ${format(t.dailyActionDone, { n: dailyZoneName })}`
        : t.saved;
      setSavedNote(note);
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(note);
    } finally {
      setSaving(false);
    }
  };

  const edit = () => {
    if (savedNote) setSavedNote(undefined);
  };

  // Status line: live mark against the reference range, errors, or the saved note.
  const status = (() => {
    if (showErrors && !isCategory) {
      const error = fields.map((f) => validateNumber(values[f.id] ?? '')).find(Boolean);
      if (error) return { text: error === 'empty' ? t.errorEmpty : t.errorNumber, strong: true };
    }
    if (candidates && !isCategory) {
      // Only what falls outside the reference range, short: «Above 139 mmHg».
      const outside = fields.flatMap((f, i) => {
        const side = referenceSide(f, candidates[i]?.value as number);
        if (side === 'inside') return [];
        const bound = side === 'below' ? f.green[0] : f.green[1];
        return [
          format(side === 'below' ? t.outsideBelow : t.outsideAbove, {
            n: `${formatNumber(bound, language)} ${unitText(f.unit)}`,
          }),
        ];
      });
      return outside.length
        ? { text: outside.join(' · '), strong: true }
        : { text: t.insideReference, strong: false };
    }
    if (savedNote) return { text: savedNote, strong: false };
    if (isCategory) return { text: t.pickCategory, strong: false };
    return {
      text: format(t.referenceHint, {
        n: fields.map((f) => `${formatRange(f.green, language)} ${unitText(f.unit)}`).join(' / '),
      }),
      strong: false,
    };
  })();

  // Safe areas: the footer always clears the home indicator (EQUIPOS.md «Safe areas»).
  const footerStyle = { paddingBottom: insets.bottom + 16 };

  if (!open) {
    return (
      <View className="bg-background border-border gap-2 border-t px-4 pt-3" style={footerStyle}>
        {savedNote ? (
          <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-sm">
            {savedNote}
          </Text>
        ) : null}
        <BigButton
          variant={secondary ? 'outline' : 'primary'}
          label={t.registerValue}
          onPress={() => {
            setSavedNote(undefined);
            setOpen(true);
          }}
        />
      </View>
    );
  }

  return (
    <View
      className="bg-background border-border gap-3 border-t px-4 pt-3"
      style={footerStyle}
      accessibilityLabel={t.register}
    >
      <View className="gap-1">
        <View className="min-h-touch flex-row items-center gap-2">
          <Text className="text-foreground text-sm font-semibold">{t.register}</Text>
          {/* Live level the engine will give (§4.1a); one badge per field, in field order. */}
          <View className="flex-1 flex-row flex-wrap gap-2">
            {preview.map((a) => (
              <LevelBadge key={a.indicator} level={a.level} size="md" />
            ))}
          </View>
          <Button
            variant="ghost"
            className="min-h-touch h-auto px-2"
            onPress={() => {
              Keyboard.dismiss();
              setOpen(false);
            }}
          >
            <Text className="text-link text-sm">{t.cancel}</Text>
          </Button>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          className={cn(
            'text-sm',
            status.strong ? 'text-foreground font-semibold' : 'text-muted-foreground',
          )}
        >
          {status.text}
        </Text>
      </View>

      {isCategory ? (
        <View className="flex-row items-stretch gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            value={category}
            onValueChange={(v) => {
              if (v) {
                setCategory(v);
                edit();
              }
            }}
            className="flex-1 gap-2"
          >
            {categoriesOf(indicator).map((c) => (
              <ToggleGroupItem
                key={c}
                value={c}
                accessibilityLabel={categoryOf(indicator, c)}
                className={cn(
                  'min-h-touch-lg h-auto flex-1 rounded-lg border',
                  // `hover:` keeps the selected look under the web pointer.
                  category === c ? 'bg-primary hover:bg-primary border-primary' : 'border-input',
                )}
              >
                <Text
                  className={cn(
                    'text-body font-medium',
                    category === c ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {categoryOf(indicator, c)}
                </Text>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <BigButton
            variant={secondary ? 'outline' : 'primary'}
            label={t.save}
            onPress={save}
            loading={saving}
            disabled={!category}
            fullWidth={false}
          />
        </View>
      ) : (
        <View className="flex-row items-end gap-2">
          {fields.map((f, i) => (
            <View key={f.id} className="flex-1 gap-1">
              {fields.length > 1 ? (
                <Text numberOfLines={1} className="text-muted-foreground text-sm">
                  {tr(f.name)}
                </Text>
              ) : null}
              <View className="flex-row items-center gap-2">
                <Input
                  accessibilityLabel={`${tr(f.name)} (${unitText(f.unit)})`}
                  value={values[f.id] ?? ''}
                  onChangeText={(text) => {
                    setValues((v) => ({ ...v, [f.id]: text }));
                    edit();
                  }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  autoFocus={i === 0}
                  returnKeyType="done"
                  onSubmitEditing={i === fields.length - 1 ? save : undefined}
                  aria-invalid={showErrors && Boolean(validateNumber(values[f.id] ?? ''))}
                  placeholder="—"
                  className="text-subtitle h-14 flex-1 font-semibold tabular-nums"
                />
                <Text className="text-muted-foreground text-sm">{unitText(f.unit)}</Text>
              </View>
            </View>
          ))}
          <BigButton
            variant={secondary ? 'outline' : 'primary'}
            label={t.save}
            onPress={save}
            loading={saving}
            fullWidth={false}
          />
        </View>
      )}
    </View>
  );
}
