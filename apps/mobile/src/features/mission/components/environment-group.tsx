import type { Destination, Environment, Mission } from '@haven/core';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { View } from 'react-native';
import { format } from '@/shared/components/haven';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/icon';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { config } from '@/shared/config';
import { store } from '@/shared/data';
import { useLanguage, useTexts, useTranslate } from '@/shared/i18n';
import { texts } from '../i18n';
import { delayForDestination, delayForEnvironment } from '../logic/environment';
import { DESTINATION_IMAGES } from './destination-images';
import { formatDelay, formatDelayRange, formatNumber } from './format';
import { DetailView, Group, Row } from './rows';

export type EnvironmentChange = {
  environment: string;
  currentDelayMin: number;
  destination?: string;
};

const overrideCount = (environmentId: string) =>
  config.indicators.filter((i) => i.environmentOverrides?.[environmentId]).length;

function applyChange(change: EnvironmentChange, onChange?: (change: EnvironmentChange) => void) {
  void store.setMission({
    environment: change.environment,
    currentDelayMin: change.currentDelayMin,
  });
  onChange?.(change);
}

function findDestination(id: string | undefined) {
  for (const environment of config.environments) {
    const destination = environment.destinations?.find((d) => d.id === id);
    if (destination) return { environment, destination };
  }
  return undefined;
}

export function useEnvironmentLabel(mission: Mission, destination?: string) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const language = useLanguage();
  const current = config.environments.find((e) => e.id === mission.environment);
  const chosen = findDestination(destination);
  const destinationName =
    chosen && chosen.environment.id === mission.environment
      ? translate(chosen.destination.name)
      : undefined;
  return {
    value: [current ? translate(current.name) : mission.environment, destinationName]
      .filter(Boolean)
      .join(' · '),
    hint: [
      format(t.delayValue, { delay: formatDelay(mission.currentDelayMin, language) }),
      current ? (current.evacuation ? t.evacuationYes : t.evacuationNo) : undefined,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

function DelayGroup({ mission }: { mission: Mission }) {
  const t = useTexts(texts);
  const language = useLanguage();
  const current = config.environments.find((e) => e.id === mission.environment);
  if (!current) return null;
  return (
    <Group title={t.currentDelay} hint={t.currentDelayHint}>
      <Row label={t.oneWay}>
        <Text className="text-body tabular-nums">
          {formatDelay(mission.currentDelayMin, language)}
        </Text>
      </Row>
    </Group>
  );
}

function EnvironmentRow({
  environment,
  selected,
  onSelect,
}: {
  environment: Environment;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const language = useLanguage();
  const id = `environment-${environment.id}`;
  const overrides = overrideCount(environment.id);
  const facts = [
    format(t.gravity, { g: formatNumber(environment.gravity, language) }),
    format(t.delayRange, { range: formatDelayRange(environment, language) }),
    environment.dailyDoseMSv !== undefined
      ? format(t.dose, { dose: formatNumber(environment.dailyDoseMSv, language) })
      : undefined,
  ].filter(Boolean);
  const second = [
    environment.evacuation ? t.evacuationYes : t.evacuationNo,
    overrides > 0 ? format(t.overrides, { n: overrides }) : t.noOverrides,
  ];

  return (
    <Button
      variant="ghost"
      onPress={onSelect}
      role="radio"
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${translate(environment.name)}. ${[...facts, ...second].join('. ')}`}
      className="active:bg-muted h-auto min-h-16 justify-start gap-4 rounded-none px-4 py-3 sm:h-auto"
    >
      <RadioGroupItem value={environment.id} aria-labelledby={id} className="size-6" />
      <View className="flex-1 gap-0.5">
        <Text nativeID={id} className="text-body font-medium">
          {translate(environment.name)}
        </Text>
        <Text className="text-muted-foreground group-active:text-muted-foreground text-sm font-normal tabular-nums">
          {facts.join(' · ')}
        </Text>
        <Text className="text-muted-foreground group-active:text-muted-foreground text-sm font-normal">
          {second.join(' · ')}
        </Text>
      </View>
    </Button>
  );
}

function DestinationRow({
  destination,
  environment,
  selected,
  first,
}: {
  destination: Destination;
  environment: Environment;
  selected: boolean;
  first: boolean;
}) {
  const t = useTexts(texts);
  const translate = useTranslate();
  const language = useLanguage();
  const source = destination.image ? DESTINATION_IMAGES[destination.image] : undefined;
  const detail = format(t.destinationDetail, {
    delay: formatDelay(delayForDestination(environment, destination), language),
    days: destination.durationDays,
  });
  return (
    <>
      {first ? null : <View className="bg-border ml-4 h-px" />}
      <ToggleGroupItem
        value={destination.id}
        accessibilityLabel={`${translate(destination.name)}. ${translate(environment.name)}. ${detail}`}
        className="active:bg-muted h-auto min-h-16 justify-start gap-3 bg-transparent px-4 py-2 sm:h-auto sm:min-w-0 sm:px-4"
      >
        <View className="bg-muted size-14 overflow-hidden rounded-md">
          {source ? (
            <Image
              source={source}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-body font-medium" numberOfLines={1}>
            {translate(destination.name)}
          </Text>
          <Text
            className="text-muted-foreground text-sm font-normal tabular-nums"
            numberOfLines={1}
          >
            {translate(environment.name)} · {detail}
          </Text>
        </View>
        {selected ? <Icon as={Check} size={20} className="text-foreground" /> : null}
      </ToggleGroupItem>
    </>
  );
}

export function EnvironmentPicker({
  mission,
  destination,
  onChange,
  onDone,
}: {
  mission: Mission;
  destination?: string;
  onChange?: (change: EnvironmentChange) => void;
  onDone: () => void;
}) {
  const t = useTexts(texts);

  function selectEnvironment(id: string) {
    const environment = config.environments.find((e) => e.id === id);
    if (!environment) return;
    if (id !== mission.environment) {
      applyChange(
        {
          environment: id,
          currentDelayMin: delayForEnvironment(environment, mission.currentDelayMin),
        },
        onChange,
      );
    }
    onDone();
  }

  const destinations = config.environments.flatMap((environment) =>
    (environment.destinations ?? []).map((item) => ({ environment, item })),
  );
  const selectedDestination = destinations.find(
    ({ environment, item }) => item.id === destination && environment.id === mission.environment,
  )?.item.id;

  function selectDestination(environment: Environment, item: Destination) {
    applyChange(
      {
        environment: environment.id,
        currentDelayMin: delayForDestination(environment, item),
        destination: item.id,
      },
      onChange,
    );
    onDone();
  }

  return (
    <DetailView
      title={t.environmentAndDestination}
      subtitle={t.environmentHint}
      backLabel={t.title}
      onBack={onDone}
    >
      <DelayGroup mission={mission} />

      <Group title={t.environmentGroup}>
        <RadioGroup value={mission.environment} onValueChange={selectEnvironment} className="gap-0">
          {config.environments.map((environment) => (
            <EnvironmentRow
              key={environment.id}
              environment={environment}
              selected={environment.id === mission.environment}
              onSelect={() => selectEnvironment(environment.id)}
            />
          ))}
        </RadioGroup>
      </Group>

      <Group title={t.destinationsGroup} hint={`${t.destinationsHint} ${t.aiImage}.`}>
        <ToggleGroup
          type="single"
          value={selectedDestination}
          onValueChange={(id) => {
            const hit = destinations.find(({ item }) => item.id === (id ?? selectedDestination));
            if (hit) selectDestination(hit.environment, hit.item);
          }}
          className="flex-col items-stretch rounded-none"
        >
          {destinations.map(({ environment, item }, i) => (
            <DestinationRow
              key={item.id}
              destination={item}
              environment={environment}
              selected={item.id === selectedDestination}
              first={i === 0}
            />
          ))}
        </ToggleGroup>
      </Group>
    </DetailView>
  );
}
