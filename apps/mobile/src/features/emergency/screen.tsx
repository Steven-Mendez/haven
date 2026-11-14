import type { Packet, Protocol, Reading } from '@haven/core';
import { randomUUID } from 'expo-crypto';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Volume2, VolumeX, X } from 'lucide-react-native';
import { type ComponentRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, View } from 'react-native';
import { BigButton, format, InlineConfirm } from '@/shared/components/haven';
import { useScreenInsets } from '@/shared/components/screen';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { config } from '@/shared/config';
import { store, useMission, usePreferences } from '@/shared/data';
import { takeArmedEmergency } from '@/shared/emergency-arm';
import { bus, useEvent } from '@/shared/events';
import { useLanguage, useTexts } from '@/shared/i18n';
import { watch } from '@/shared/watch';
import { ArmView } from './components/arm-view';
import { MonitorStrip } from './components/monitor-strip';
import { PacketView } from './components/packet-view';
import { StepView } from './components/step-view';
import { SymptomChecklist } from './components/symptom-checklist';
import { VitalsEntry } from './components/vitals-entry';
import { usePhotos } from './hooks/use-photos';
import { useVoice } from './hooks/use-voice';
import { type EmergencyTexts, texts } from './i18n';
import { type Episode, firstEpisode, markPacketSent, onEmergencyOpen } from './logic/episode';
import {
  buildEmergencyPacket,
  type EmergencyOrigin,
  normalizeOrigin,
  type Symptom,
  symptomReading,
} from './logic/packet';
import {
  AUTO_STEP_IDS,
  advance,
  canGoBack,
  currentStep,
  decisionLog,
  goBack,
  PACKET_STEP_ID,
  type ProtocolRun,
  progress,
  SYMPTOM_STEP_IDS,
  startRun,
  stepPhase,
  VITALS_STEP_IDS,
} from './logic/protocol';
import { manualVitalReadings, type VitalId } from './logic/vitals';
import { takeOrigin } from './origin';

const DEFAULT_PROTOCOL = 'chest-pain';

const ORIGIN_TEXT: Record<EmergencyOrigin, keyof EmergencyTexts> = {
  button: 'originButton',
  fall: 'originFall',
  heartRate: 'originHeartRate',
  rhythm: 'originRhythm',
  spo2: 'originSpo2',
  notification: 'originNotification',
  assessment: 'originAssessment',
};

function KeepAwake() {
  useKeepAwake('haven-emergency');
  return null;
}

export default function Screen() {
  const t = useTexts(texts);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  const params = useLocalSearchParams<{ protocol?: string; origin?: string }>();
  const protocol = useMemo<Protocol | undefined>(
    () =>
      config.protocols.find((p) => p.id === (params.protocol ?? DEFAULT_PROTOCOL)) ??
      config.protocols.find((p) => p.id === DEFAULT_PROTOCOL),
    [params.protocol],
  );
  if (!protocol) {
    return (
      <View className="bg-background flex-1 p-4">
        <Text className="text-body">{t.protocolMissing}</Text>
      </View>
    );
  }
  return <Episodes protocol={protocol} originParam={params.origin} />;
}

function Episodes({ protocol, originParam }: { protocol: Protocol; originParam?: string }) {
  const [episode, setEpisode] = useState<Episode>(() => firstEpisode(takeOrigin(originParam)));
  const [armed, setArmed] = useState<number | null>(() => (takeArmedEmergency() ? 1 : null));
  const [armedPending, setArmedPending] = useState(false);
  useEvent('emergency:open', ({ origin }) => {
    if (takeArmedEmergency()) setArmedPending(true);
    setEpisode((current) => onEmergencyOpen(current, normalizeOrigin(origin) ?? 'button'));
  });
  useEffect(() => {
    if (!armedPending) return;
    setArmed(episode.number);
    setArmedPending(false);
  }, [armedPending, episode.number]);
  if (episode.origin === 'button' && armed !== episode.number && !armedPending) {
    return (
      <ArmView
        onConfirm={() => {
          setArmed(episode.number);
          bus.emit('emergency:open', { origin: 'button' });
        }}
      />
    );
  }
  return (
    <Emergency
      key={episode.number}
      protocol={protocol}
      origin={episode.origin}
      onPacketSent={() => setEpisode(markPacketSent)}
    />
  );
}

function Emergency({
  protocol,
  origin,
  onPacketSent,
}: {
  protocol: Protocol;
  origin: EmergencyOrigin;
  onPacketSent: () => void;
}) {
  const t = useTexts(texts);
  const language = useLanguage();
  const mission = useMission();
  const preferences = usePreferences();
  const [startedAt] = useState(() => new Date());
  const crewName =
    mission.crew.find((c) => c.id === preferences.crewMember)?.name ?? t.crewMemberFallback;
  const [crewAlerted] = useState(() =>
    watch.send(watch.envelope('crewHaptic', { message: format(t.crewMessage, { n: crewName }) })),
  );
  const [run, setRun] = useState<ProtocolRun>(() =>
    startRun(protocol, mission.environment, startedAt, crewAlerted ? AUTO_STEP_IDS : []),
  );
  const [view, setView] = useState<'protocol' | 'packet'>('protocol');
  const [packetFrom, setPacketFrom] = useState<'step' | 'end'>('end');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const revealConfirm = useRef(false);
  const [audioOn, setAudioOn] = useState(true);
  const [marked, setMarked] = useState<Symptom[]>([]);
  const [symptoms, setSymptoms] = useState<Reading[]>([]);
  const [vitalsCount, setVitalsCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [packetId] = useState(() => randomUUID());
  const [queued, setQueued] = useState<Packet | undefined>();
  const { photos, attach, failed } = usePhotos();
  const { say, buzz } = useVoice(audioOn, language);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const insets = useScreenInsets({ header: false });
  const headerHeight = useHeaderHeight();
  const top = Math.max(insets.top, headerHeight);

  const step = currentStep(protocol, run);
  const visit = run.visits.length;
  const position = progress(protocol, run);
  const originText = t[ORIGIN_TEXT[origin]];

  // biome-ignore lint/correctness/useExhaustiveDependencies: only when the confirmation opens
  useEffect(() => {
    if (!confirmEnd) return;
    revealConfirm.current = true;
    scroll.current?.scrollToEnd({ animated: false });
    AccessibilityInfo.announceForAccessibility(`${t.endConfirm} ${t.endConfirmDetail}`);
  }, [confirmEnd]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the top on every new step or view
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [visit, view, run.finishedAt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: once per emergency
  useEffect(() => {
    if (crewAlerted) buzz('alert');
  }, []);

  function buildPacket(currentNotes = notes, now = new Date()): Packet {
    return buildEmergencyPacket({
      id: packetId,
      crewMember: preferences.crewMember,
      missionCode: mission.code,
      assessments: store.assessments(),
      readings: store.readings(),
      symptoms,
      startedAt,
      now,
      notes: currentNotes,
      decisions: decisionLog(protocol, run, language),
      originLabel: `${t.originLabel}: ${originText}`,
      photos,
    });
  }

  function enqueue(currentNotes = notes) {
    const packet = buildPacket(currentNotes);
    bus.emit('emergency:close', { packet });
    setQueued(packet);
    onPacketSent();
    return packet;
  }

  function mark(symptom: Symptom) {
    const reading = symptomReading(symptom, preferences.crewMember, new Date(), randomUUID());
    setMarked((list) => [...list, symptom]);
    setSymptoms((list) => [...list, reading]);
    void store.saveReading(reading);
  }

  function saveVitals(values: Partial<Record<VitalId, string>>): number {
    const units = Object.fromEntries(config.indicators.map((i) => [i.id, i.unit]));
    const readings = manualVitalReadings(values, units, preferences.crewMember, new Date(), () =>
      randomUUID(),
    );
    for (const reading of readings) void store.saveReading(reading);
    setVitalsCount((n) => n + readings.length);
    return readings.length;
  }

  function onStepDone(option?: number) {
    if (step?.id === PACKET_STEP_ID) {
      enqueue();
      setPacketFrom('step');
      setView('packet');
      return;
    }
    setRun((r) => advance(protocol, r, new Date(), option));
  }

  function endEmergency() {
    setConfirmEnd(false);
    enqueue();
    setPacketFrom('end');
    setView('packet');
    buzz('tap');
  }

  function followUp() {
    setView('protocol');
    if (step?.id === PACKET_STEP_ID) setRun((r) => advance(protocol, r, new Date()));
  }

  function saveNote(note: string) {
    const next = [notes, note.trim()].filter(Boolean).join('\n');
    setNotes(next);
    enqueue(next);
  }

  function close() {
    const watchData = store
      .readings({ since: startedAt.toISOString() })
      .some((r) => r.source === 'watch');
    const used =
      origin !== 'button' ||
      watchData ||
      run.visits.length > 1 ||
      symptoms.length > 0 ||
      photos.length > 0 ||
      vitalsCount > 0;
    if (!queued && used) enqueue();
    else if (!queued)
      watch.send(watch.envelope('emergencyEnd', { endedAt: new Date().toISOString() }));
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View
      className="bg-background flex-1"
      style={{ paddingTop: top, paddingLeft: insets.left, paddingRight: insets.right }}
    >
      <KeepAwake />
      <View className="gap-1 px-3 pt-1 pb-2">
        <MonitorStrip
          allowChart={view === 'protocol'}
          leading={
            headerHeight > 0 ? undefined : (
              <Button
                variant="ghost"
                size="icon"
                onPress={close}
                accessibilityLabel={t.close}
                className="h-touch w-touch rounded-full"
              >
                <Icon as={X} size={22} className="text-foreground" />
              </Button>
            )
          }
        />
      </View>

      <ScrollView
        ref={scroll}
        onContentSizeChange={() => {
          if (!revealConfirm.current) return;
          revealConfirm.current = false;
          scroll.current?.scrollToEnd({ animated: false });
        }}
        className="flex-1"
        contentContainerClassName="gap-8 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {view === 'packet' && queued ? (
          <PacketView
            packet={queued}
            linkDown={mission.linkDown}
            delayMin={mission.currentDelayMin}
            primary={
              packetFrom === 'step'
                ? { label: t.followUp, onPress: followUp }
                : { label: t.close, onPress: close }
            }
            onSaveNote={saveNote}
          />
        ) : step ? (
          <StepView
            key={`${visit}-${step.id}`}
            step={step}
            phase={stepPhase(step)}
            index={position.index}
            doneLabel={step.id === PACKET_STEP_ID ? t.sendPacket : undefined}
            onDone={onStepDone}
            canGoBack={canGoBack(run)}
            onBack={() => setRun((r) => goBack(r, new Date()))}
            onAttachPhoto={() => void attach(step.id)}
            photoCount={photos.length}
            photoFailed={failed}
            say={say}
            buzz={buzz}
          >
            {SYMPTOM_STEP_IDS.includes(step.id) ? (
              <SymptomChecklist marked={marked} onMark={mark} />
            ) : null}
            {VITALS_STEP_IDS.includes(step.id) ? <VitalsEntry onSave={saveVitals} /> : null}
          </StepView>
        ) : (
          <View className="gap-4">
            <Text role="heading" className="text-title font-bold">
              {t.protocolDone}
            </Text>
            <Text className="text-body text-muted-foreground">{t.protocolDoneHint}</Text>
            <BigButton label={t.endEmergency} size="lg" onPress={() => setConfirmEnd(true)} />
            <BigButton
              label={t.previous}
              variant="ghost"
              onPress={() => setRun((r) => goBack(r, new Date()))}
            />
          </View>
        )}

        {view === 'protocol' ? (
          <View className="gap-3">
            {confirmEnd ? (
              <InlineConfirm
                title={t.endConfirm}
                description={t.endConfirmDetail}
                confirmLabel={t.endYes}
                cancelLabel={t.endNo}
                onConfirm={endEmergency}
                onCancel={() => setConfirmEnd(false)}
              />
            ) : null}
            <View className="border-border flex-row items-center justify-between gap-2 border-t pt-3">
              <View className="flex-1" accessible accessibilityLiveRegion="polite">
                <Text className="text-tertiary text-caption" numberOfLines={1}>
                  {originText}
                </Text>
                <Text className="text-muted-foreground text-caption" numberOfLines={2}>
                  {crewAlerted ? t.crewAlerted : t.crewAlertFailed}
                </Text>
              </View>
              <Button
                variant="ghost"
                onPress={() => setAudioOn((on) => !on)}
                accessibilityLabel={audioOn ? t.audioOn : t.audioOff}
                accessibilityRole="switch"
                accessibilityState={{ checked: audioOn }}
                className="h-touch w-touch rounded-full px-0"
              >
                <Icon
                  as={audioOn ? Volume2 : VolumeX}
                  size={20}
                  className="text-muted-foreground"
                />
              </Button>
              {step && !confirmEnd ? (
                <Button
                  variant="outline"
                  onPress={() => setConfirmEnd(true)}
                  accessibilityLabel={t.endEmergency}
                  className="min-h-touch h-auto rounded-full px-4"
                >
                  <Text className="text-body-sm font-semibold">{t.endShort}</Text>
                </Button>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
