import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Text } from '@/shared/components/ui/text';
import { usePreferences } from '@/shared/data';
import { type Language, useTexts } from '@/shared/i18n';
import { testEarthApi } from '../hooks/missions';
import { texts } from '../i18n';
import { Group, Row } from './rows';

/** Language names are shown in their own language. */
const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

/** Language and Earth API URL (with a connection test that never blocks the app). */
export function SettingsGroup() {
  const t = useTexts(texts);
  const preferences = usePreferences();
  const [url, setUrl] = useState(preferences.apiUrl);
  const [status, setStatus] = useState<string | undefined>();
  const [testing, setTesting] = useState(false);

  useEffect(() => setUrl(preferences.apiUrl), [preferences.apiUrl]);

  async function test() {
    setTesting(true);
    if (url.trim() !== preferences.apiUrl) await preferences.set({ apiUrl: url.trim() });
    const result = await testEarthApi();
    setTesting(false);
    setStatus(result === 'ok' ? t.apiOk : result === 'skipped' ? t.apiSkipped : t.apiFail);
  }

  return (
    <Group title={t.settingsGroup}>
      <Row label={t.language} stacked>
        <Select
          value={LANGUAGES.find((l) => l.value === preferences.language)}
          onValueChange={(option) => {
            if (option) void preferences.set({ language: option.value as Language });
          }}
        >
          <SelectTrigger className="min-h-touch w-full" accessibilityLabel={t.language}>
            <SelectValue placeholder={t.language} className="text-body" />
          </SelectTrigger>
          <SelectContent className="w-72">
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value} label={l.label} className="min-h-touch" />
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row stacked>
        <View className="gap-0.5">
          <Label nativeID="api-url" className="text-body font-medium">
            {t.apiUrl}
          </Label>
          <Text className="text-muted-foreground text-sm">{t.apiUrlHint}</Text>
        </View>
        <Input
          aria-labelledby="api-url"
          value={url}
          onChangeText={(text) => {
            setUrl(text);
            setStatus(undefined);
          }}
          onSubmitEditing={() => {
            void preferences.set({ apiUrl: url.trim() });
            setStatus(t.urlSaved);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className="min-h-touch text-body"
        />
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            className="min-h-touch h-auto flex-1"
            disabled={url.trim() === preferences.apiUrl}
            onPress={() => {
              void preferences.set({ apiUrl: url.trim() });
              setStatus(t.urlSaved);
            }}
          >
            <Text>{t.saveUrl}</Text>
          </Button>
          <Button
            variant="outline"
            className="min-h-touch h-auto flex-1"
            disabled={testing}
            onPress={test}
          >
            <Text>{testing ? t.testing : t.testUrl}</Text>
          </Button>
        </View>
        {status ? (
          <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-sm">
            {status}
          </Text>
        ) : null}
      </Row>
    </Group>
  );
}
