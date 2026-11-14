import type { EnvironmentId } from '@haven/core';
import { demoHistory } from '@haven/core/testdata';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { format } from '@/shared/components/haven/i18n';
import { useUnitLabel } from '@/shared/components/haven/unit-label';
import { ReadingSource } from '@/shared/components/reading-source';
import { Screen } from '@/shared/components/screen';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { store, useMission, usePreferences, useReadings } from '@/shared/data';
import { db } from '@/shared/db';
import { previewMilestone } from '@/shared/gamification';
import { type Language, setLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { useWatch } from '@/shared/watch';
import { Code, Group, Picker, Row } from './components/rows';
import { texts } from './i18n';

const FALLBACK_ENVIRONMENTS: EnvironmentId[] = ['transit', 'station', 'moon', 'mars', 'rover'];
const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

function pretty(value: unknown) {
  return value ? JSON.stringify(value, null, 1) : '';
}

export default function DevPanelScreen() {
  const t = useTexts(texts);
  const translate = useTranslate();
  const unitLabel = useUnitLabel();
  const mission = useMission();
  const preferences = usePreferences();
  const readings = useReadings();
  const watchState = useWatch();
  const [apiUrl, setApiUrl] = useState(preferences.apiUrl);
  const [apiSaved, setApiSaved] = useState(false);
  const [loadResult, setLoadResult] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const environments = config.environments.length
    ? config.environments.map((e) => ({ value: e.id, label: translate(e.name) || e.id }))
    : FALLBACK_ENVIRONMENTS.map((id) => ({ value: id as string, label: id }));
  const crew = mission.crew.map((c) => ({ value: c.id, label: c.name }));
  const latest = readings[readings.length - 1];
  const latestIndicator = latest && config.indicators.find((i) => i.id === latest.indicator);

  function changeEnvironment(id: string) {
    const environment = config.environments.find((e) => e.id === id);
    const delay = environment
      ? Math.round((environment.delayMin + environment.delayMax) / 2)
      : mission.currentDelayMin;
    void store.setMission({ environment: id, currentDelayMin: delay });
  }

  async function loadTestData() {
    setLoading(true);
    try {
      const records = demoHistory(preferences.crewMember, new Date(), { config });
      const added = await store.loadTestData(records);
      setLoadResult(added > 0 ? format(t.loaded, { n: added }) : t.nothingNew);
      setDeleted(false);
    } finally {
      setLoading(false);
    }
  }

  async function deleteData() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    await store.reset();
    setLoadResult(undefined);
    setDeleted(true);
  }

  return (
    <Screen>
      <Text className="text-muted-foreground text-body-sm">{t.intro}</Text>

      <Group title={t.testData}>
        <Row label={t.loadTestData} hint={loadResult ?? t.testDataHint} stacked>
          <Button
            size="lg"
            className="min-h-touch rounded-full"
            disabled={loading}
            onPress={loadTestData}
          >
            <Text className="font-semibold">{t.loadTestData}</Text>
          </Button>
        </Row>
      </Group>

      <Group title={t.mission}>
        <Row label={t.environment} hint={t.environmentHint} stacked>
          <Picker
            label={t.environment}
            options={environments}
            value={mission.environment}
            onChange={changeEnvironment}
          />
        </Row>
        {crew.length > 0 ? (
          <Row label={t.crewMember} stacked>
            <Picker
              label={t.crewMember}
              options={crew}
              value={preferences.crewMember}
              onChange={(crewMember) => void preferences.set({ crewMember })}
            />
          </Row>
        ) : null}
        <Row label={t.apiUrl} hint={apiSaved ? t.saved : undefined} stacked>
          <View className="flex-row gap-2">
            <Input
              className="h-12 flex-1"
              value={apiUrl}
              onChangeText={(value) => {
                setApiUrl(value);
                setApiSaved(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel={t.apiUrl}
            />
            <Button
              variant="outline"
              className="h-12"
              disabled={apiUrl.trim() === preferences.apiUrl}
              onPress={() => {
                void preferences.set({ apiUrl: apiUrl.trim() });
                setApiSaved(true);
              }}
            >
              <Text>{t.save}</Text>
            </Button>
          </View>
        </Row>
      </Group>

      <Group title={t.data}>
        <Row label={t.sources} hint={t.sourcesHint} stacked>
          <Button
            variant="outline"
            size="lg"
            className="min-h-12"
            onPress={() => router.push('/sources')}
          >
            <Text>{t.openSources}</Text>
          </Button>
        </Row>
        <Row label={t.latestReading} stacked>
          {latest ? (
            <View className="gap-1">
              <Text className="text-heading font-medium tabular-nums">
                {latestIndicator ? translate(latestIndicator.name) : latest.indicator}:{' '}
                {String(latest.value)} {unitLabel(latest.unit)}
              </Text>
              <ReadingSource reading={latest} />
            </View>
          ) : (
            <Text className="text-muted-foreground">{t.none}</Text>
          )}
        </Row>
        <Row label={t.readingsCount}>
          <Badge variant="secondary">
            <Text>{readings.length}</Text>
          </Badge>
        </Row>
        <Row label={t.storage}>
          <Badge variant="outline">
            <Text>{db.driver === 'sqlite' ? 'SQLite' : 'localStorage'}</Text>
          </Badge>
        </Row>
      </Group>

      <Group title={t.watch}>
        <Row label={t.watchState}>
          <Badge variant={watchState.source === 'native' ? 'default' : 'outline'}>
            <Text>{watchState.source === 'native' ? t.watchConnected : t.watchNotConnected}</Text>
          </Badge>
        </Row>
        <Row label={t.lastStatus} stacked>
          <Code>{pretty(watchState.lastStatus?.payload) || t.none}</Code>
        </Row>
        <Row label={t.lastReceived} stacked>
          <Code>
            {watchState.lastReceived
              ? `${watchState.lastReceived.type} ${pretty(watchState.lastReceived.payload)}`
              : t.none}
          </Code>
        </Row>
      </Group>

      <Group title={t.language}>
        <Row label={t.language} stacked>
          <Picker
            label={t.language}
            options={LANGUAGES}
            value={preferences.language}
            onChange={(language) => setLanguage(language as Language)}
          />
        </Row>
      </Group>

      <Group title={t.gamification}>
        <Row label={t.previewMilestone} hint={t.previewMilestoneHint} stacked>
          <Button
            variant="outline"
            size="lg"
            className="min-h-touch rounded-full"
            onPress={() => {
              router.navigate('/routine');
              setTimeout(() => previewMilestone(7), 400);
            }}
          >
            <Text className="font-semibold">{t.previewMilestone}</Text>
          </Button>
        </Row>
      </Group>

      <Group title={t.dangerZone}>
        <Row label={t.deleteData} hint={deleted ? t.deleted : t.deleteHint} stacked>
          <Button
            variant={confirmDelete ? 'destructive' : 'outline'}
            size="lg"
            className="min-h-touch rounded-full"
            onPress={deleteData}
          >
            <Text
              className={
                confirmDelete
                  ? 'text-destructive-foreground font-semibold'
                  : 'text-level-red font-semibold'
              }
            >
              {confirmDelete ? t.deleteConfirm : t.deleteData}
            </Text>
          </Button>
        </Row>
      </Group>
    </Screen>
  );
}
