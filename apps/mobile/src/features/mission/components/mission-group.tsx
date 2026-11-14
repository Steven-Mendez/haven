import type { Mission } from '@haven/core';
import { useState } from 'react';
import { View } from 'react-native';
import { BigButton, format, missionPhase, useMissionPhaseText } from '@/shared/components/haven';
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
import { config } from '@/shared/config';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import type { useMissionRecords } from '../hooks/missions';
import { texts } from '../i18n';
import { isValidMissionCode, MISSION_CODE_LENGTH, normalizeMissionCode } from '../logic/code';
import { type CrewOption, cleanCrewName } from '../logic/crew';
import {
  type DraftError,
  isoDate,
  type MissionRecord,
  validateDraft,
} from '../logic/mission-record';
import { Group, Row } from './rows';
import { WhoGroup } from './who-group';

type Records = ReturnType<typeof useMissionRecords>;
type Mode = 'idle' | 'join' | 'create' | 'who';
type Joined = { code: string; message: string; crew: CrewOption[]; offline: boolean };

function CodeBoxes({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <View className="relative">
      <View
        className="flex-row justify-between gap-2"
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: MISSION_CODE_LENGTH }, (_, i) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed six positions
            key={i}
            className={cn(
              'border-input h-16 flex-1 items-center justify-center rounded-md border-2',
              i === value.length && 'border-ring',
            )}
          >
            <Text className="text-metric font-mono font-semibold">{value[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      <Input
        value={value}
        onChangeText={(text) => onChange(normalizeMissionCode(text))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={MISSION_CODE_LENGTH}
        accessibilityLabel={label}
        caretHidden
        selectionColor="transparent"
        className="absolute inset-0 h-16 border-0 bg-transparent text-transparent shadow-none"
      />
    </View>
  );
}

function JoinForm({
  records,
  mission,
  onJoined,
}: {
  records: Records;
  mission: Mission;
  onJoined: (joined: Joined) => void;
}) {
  const t = useTexts(texts);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState<string | undefined>();
  const valid = isValidMissionCode(code);

  async function join() {
    setBusy(true);
    setUnknown(undefined);
    try {
      const result = await records.join(code);
      if (result.from === 'unknown') {
        setUnknown(code);
        return;
      }
      if (result.from === 'unreachable') return;
      const { record, from } = result;
      const message =
        from === 'local' ? t.joinedLocal : from === 'earth' ? t.joinedEarth : t.joinedOffline;
      onJoined({
        code: record.code,
        message: format(message, { code: record.code }),
        crew: record.crew ?? mission.crew,
        offline: from === 'offline',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Row stacked>
      <Label nativeID="join-code">{t.joinTitle}</Label>
      <CodeBoxes
        value={code}
        onChange={(next) => {
          setCode(next);
          setUnknown(undefined);
        }}
        label={t.missionCode}
      />
      {code.length > 0 && !valid ? (
        <Text className="text-muted-foreground text-sm">{t.invalidCode}</Text>
      ) : null}
      {unknown ? (
        <Text accessibilityLiveRegion="assertive" className="text-level-amber text-body">
          {format(t.unknownCode, { code: unknown })}
        </Text>
      ) : null}
      <BigButton
        label={busy ? t.joining : t.joinAction}
        onPress={join}
        disabled={!valid || busy}
        loading={busy}
      />
    </Row>
  );
}

function CreateForm({
  records,
  mission,
  onDone,
}: {
  records: Records;
  mission: Mission;
  onDone: (message: string) => void;
}) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState(mission.environment);
  const [start, setStart] = useState(() => isoDate(new Date()));
  const env = config.environments.find((e) => e.id === environment);
  const [duration, setDuration] = useState(String(env?.destinations?.[0]?.durationDays ?? 540));
  const [errors, setErrors] = useState<DraftError[]>([]);
  const [busy, setBusy] = useState(false);
  const options = config.environments.map((e) => ({ value: e.id, label: translate(e.name) }));
  const errorText: Record<DraftError, string> = {
    name: t.errorName,
    environment: t.errorEnvironment,
    start: t.errorStart,
    duration: t.errorDuration,
  };

  async function create() {
    const draft = { name, environment, start, durationDays: duration };
    const found = validateDraft(draft, config.environments);
    setErrors(found);
    if (found.length > 0) return;
    setBusy(true);
    try {
      const { record, registered } = await records.create(draft);
      onDone(
        `${format(t.created, { code: record.code })} ${registered ? t.createdEarth : t.createdLocal}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const error = (key: DraftError) =>
    errors.includes(key) ? (
      <Text className="text-level-amber text-sm">{errorText[key]}</Text>
    ) : null;

  return (
    <Row stacked>
      <View className="gap-2">
        <Label nativeID="mission-name">{t.name}</Label>
        <Input
          aria-labelledby="mission-name"
          value={name}
          onChangeText={setName}
          placeholder={t.namePlaceholder}
          maxLength={40}
          className="min-h-touch text-body"
        />
        {error('name')}
      </View>
      <View className="gap-2">
        <Label nativeID="mission-environment">{t.environment}</Label>
        <Select
          value={options.find((o) => o.value === environment)}
          onValueChange={(option) => {
            if (!option) return;
            setEnvironment(option.value);
            const next = config.environments.find((e) => e.id === option.value);
            const days = next?.destinations?.[0]?.durationDays;
            if (days) setDuration(String(days));
          }}
        >
          <SelectTrigger className="min-h-touch w-full" aria-labelledby="mission-environment">
            <SelectValue placeholder={t.environment} className="text-body" />
          </SelectTrigger>
          <SelectContent className="w-72">
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} label={o.label} className="min-h-touch" />
            ))}
          </SelectContent>
        </Select>
        {error('environment')}
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-2">
          <Label nativeID="mission-start">{t.start}</Label>
          <Input
            aria-labelledby="mission-start"
            value={start}
            onChangeText={setStart}
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            className="min-h-touch text-body tabular-nums"
          />
          {error('start')}
        </View>
        <View className="w-32 gap-2">
          <Label nativeID="mission-duration">{t.duration}</Label>
          <Input
            aria-labelledby="mission-duration"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            className="min-h-touch text-body tabular-nums"
          />
          {error('duration')}
        </View>
      </View>
      <BigButton label={t.createAction} onPress={create} disabled={busy} loading={busy} />
    </Row>
  );
}

export function MissionGroup({
  mission,
  records,
  record,
}: {
  mission: Mission;
  records: Records;
  record: MissionRecord | undefined;
}) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const language = useLanguage();
  const [mode, setMode] = useState<Mode>('idle');
  const [message, setMessage] = useState<string | undefined>();
  const [joined, setJoined] = useState<Joined | undefined>();
  const environment = config.environments.find((e) => e.id === mission.environment);
  const startDate = record ? new Date(`${record.start}T00:00:00Z`) : undefined;
  const phase = missionPhase(mission);
  const phaseText = useMissionPhaseText();

  const done = (text: string) => {
    setMessage(text);
    setMode('idle');
  };

  const onJoined = (next: Joined) => {
    setJoined(next);
    setMessage(next.message);
    setMode('who');
  };

  const chosen = (name: string) =>
    done([joined?.message, format(t.whoChosen, { name })].filter(Boolean).join(' '));

  if (mode === 'who' && joined) {
    return (
      <View className="gap-8">
        {message ? (
          <Text accessibilityLiveRegion="polite" className="text-body px-1">
            {message}
          </Text>
        ) : null}
        <WhoGroup
          crew={joined.crew}
          offline={joined.offline}
          onChoose={(member) => {
            void records.chooseCrewMember(member.id).then(() => chosen(member.name));
          }}
          onTyped={async (name) => {
            await records.addTypedCrewMember(joined.code, name);
            chosen(cleanCrewName(name));
          }}
        />
      </View>
    );
  }

  const toggle = (next: Mode) => {
    setMessage(undefined);
    setMode((current) => (current === next ? 'idle' : next));
  };

  return (
    <Group title={t.missionGroup} hint={t.qrHint}>
      <Row stacked>
        <View className="gap-1">
          <Text role="heading" aria-level="2" className="text-title font-semibold">
            {record?.name ?? mission.name ?? mission.code}
          </Text>
          <Text className="text-body">
            {environment ? translate(environment.name) : mission.environment}
          </Text>
          <Text className="text-muted-foreground text-sm tabular-nums">
            {phase.kind === 'running' && record
              ? format(t.dayOf, { day: phase.day, total: record.durationDays })
              : phaseText(mission)}
            {phase.kind === 'running' && startDate
              ? ` · ${format(t.startedOn, {
                  date: startDate.toLocaleDateString(language, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }),
                })}`
              : ''}
          </Text>
          <Text
            className="text-tertiary text-caption"
            accessibilityLabel={`${t.missionCode}: ${mission.code.split('').join(' ')}`}
          >
            {format(t.codeSmall, { code: mission.code })}
          </Text>
        </View>
        {message ? (
          <Text accessibilityLiveRegion="polite" className="text-body">
            {message}
          </Text>
        ) : null}
        <Button
          variant={mode === 'create' ? 'secondary' : 'outline'}
          className="min-h-touch h-auto"
          onPress={() => toggle('create')}
        >
          <Text>{mode === 'create' ? t.cancel : t.create}</Text>
        </Button>
        <Button
          variant="ghost"
          className="min-h-touch h-auto self-start px-0 sm:h-auto"
          onPress={() => toggle('join')}
        >
          <Text className="text-link text-body-sm font-medium">
            {mode === 'join' ? t.cancel : t.joinNoQr}
          </Text>
        </Button>
      </Row>
      {mode === 'join' ? (
        <JoinForm key="join" records={records} mission={mission} onJoined={onJoined} />
      ) : null}
      {mode === 'create' ? (
        <CreateForm key="create" records={records} mission={mission} onDone={done} />
      ) : null}
    </Group>
  );
}
