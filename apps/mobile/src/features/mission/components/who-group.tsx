import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { BigButton } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Text } from '@/shared/components/ui/text';
import { useTexts, useTranslate } from '@/shared/i18n';
import { texts } from '../i18n';
import { CREW_NAME_MAX, type CrewOption, isValidCrewName } from '../logic/crew';
import { Group, Row } from './rows';

/**
 * «Who are you?» step after joining: the roster mission control created on Earth, one large row per
 * person. Without a roster (none yet, or offline) it explains why and lets the person type a name.
 */
export function WhoGroup({
  crew,
  offline,
  onChoose,
  onTyped,
}: {
  crew: CrewOption[];
  offline: boolean;
  onChoose: (member: CrewOption) => void;
  onTyped: (name: string) => Promise<void>;
}) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const [typing, setTyping] = useState(crew.length === 0);
  const [name, setName] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function continueTyped() {
    if (!isValidCrewName(name)) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      await onTyped(name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-8">
      <Group title={t.whoTitle} hint={crew.length > 0 ? t.whoHint : undefined}>
        {crew.map((member) => (
          <Button
            key={member.id}
            variant="ghost"
            onPress={() => onChoose(member)}
            accessibilityRole="button"
            accessibilityLabel={[member.name, translate(member.role)].filter(Boolean).join('. ')}
            className="active:bg-active h-auto min-h-16 justify-start gap-3 rounded-none px-4 py-3 sm:h-auto"
          >
            <View className="flex-1 gap-0.5">
              <Text className="text-body text-foreground font-semibold">{member.name}</Text>
              {member.role ? (
                <Text className="text-muted-foreground group-active:text-muted-foreground text-sm font-normal">
                  {translate(member.role)}
                </Text>
              ) : null}
            </View>
            <Icon
              as={ChevronRight}
              size={16}
              className="text-tertiary group-active:text-tertiary"
            />
          </Button>
        ))}
        {crew.length === 0 ? (
          <Row key="empty">
            <Text accessibilityLiveRegion="polite" className="text-body flex-1">
              {offline ? t.whoOffline : t.whoEmpty}
            </Text>
          </Row>
        ) : null}
        {crew.length > 0 && !typing ? (
          <Button
            key="not-listed"
            variant="ghost"
            onPress={() => setTyping(true)}
            className="active:bg-active min-h-touch h-auto justify-start rounded-none px-4 py-3 sm:h-auto"
          >
            <Text className="text-link text-body-sm font-medium">{t.whoNotListed}</Text>
          </Button>
        ) : null}
      </Group>
      {typing ? (
        <Group title={t.whoNotListed} hint={t.whoNameNote}>
          <Row stacked>
            <Label nativeID="who-name">{t.whoName}</Label>
            <Input
              aria-labelledby="who-name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                setError(false);
              }}
              placeholder={t.whoNamePlaceholder}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={CREW_NAME_MAX}
              className="min-h-touch text-body"
            />
            {error ? <Text className="text-level-amber text-sm">{t.whoNameError}</Text> : null}
            <BigButton
              label={t.whoNameAction}
              onPress={continueTyped}
              disabled={busy || name.trim().length === 0}
              loading={busy}
            />
          </Row>
        </Group>
      ) : null}
    </View>
  );
}
