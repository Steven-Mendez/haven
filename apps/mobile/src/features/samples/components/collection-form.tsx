import type { SampleType } from '@haven/core';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { BigButton } from '@/shared/components/haven';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';

export type CollectionInput = {
  module?: string;
  answers: Record<string, string>;
  comment?: string;
};

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-body-sm font-medium">{label}</Text>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => onChange(v || undefined)}
        accessibilityLabel={label}
        className="flex-row flex-wrap justify-start gap-2"
      >
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <ToggleGroupItem
              key={o.id}
              value={o.id}
              accessibilityLabel={o.label}
              className={cn(
                'min-h-touch h-auto rounded-full border px-4 sm:h-auto',
                selected ? 'bg-brand-subtle border-brand' : 'border-border bg-transparent',
              )}
            >
              <Text className="text-body-sm">{o.label}</Text>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </View>
  );
}

/** What the app asks when a sample is collected: module, questions and an optional note. */
export function CollectionForm({
  sample,
  saving,
  onSave,
  onCancel,
}: {
  sample: SampleType;
  saving: boolean;
  onSave: (input: CollectionInput) => void;
  onCancel: () => void;
}) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const [module, setModule] = useState<string | undefined>(sample.modules?.[0]?.id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Uncontrolled: React never rewrites the note while it is being typed.
  const comment = useRef('');
  return (
    <View className="border-border bg-muted/30 gap-4 rounded-lg border p-3">
      {sample.modules?.length ? (
        <Choice
          label={t.chooseModule}
          options={sample.modules.map((m) => ({ id: m.id, label: translate(m.name) }))}
          value={module}
          onChange={setModule}
        />
      ) : null}
      {sample.questions.map((q) => (
        <Choice
          key={q.id}
          label={translate(q.label)}
          options={q.options.map((o) => ({ id: o.id, label: translate(o.label) }))}
          value={answers[q.id]}
          onChange={(v) =>
            setAnswers((prev) => {
              const next = { ...prev };
              if (v) next[q.id] = v;
              else delete next[q.id];
              return next;
            })
          }
        />
      ))}
      <View className="gap-1.5">
        <Text className="text-body-sm font-medium">{t.comment}</Text>
        <Input
          maxLength={200}
          placeholder={t.commentPlaceholder}
          onChangeText={(v) => {
            comment.current = v;
          }}
        />
      </View>
      <BigButton
        label={t.save}
        loading={saving}
        disabled={Boolean(sample.modules?.length) && !module}
        onPress={() =>
          onSave({
            ...(module ? { module } : {}),
            answers,
            ...(comment.current.trim() ? { comment: comment.current.trim() } : {}),
          })
        }
      />
      <BigButton label={t.cancel} variant="ghost" onPress={onCancel} />
    </View>
  );
}
