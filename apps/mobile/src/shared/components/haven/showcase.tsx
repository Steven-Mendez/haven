import { HeartPulse } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  ActionRow,
  BigButton,
  BodyFigure,
  DataLabel,
  DayRing,
  EmptyState,
  IndicatorCard,
  InlineConfirm,
  LevelBadge,
  ListGroup,
  MissionStrip,
  ScaleInput,
  type ScaleValue,
  ScreenHeader,
  Section,
  SeriesChart,
  SosButton,
  StepTimer,
  TrendDelta,
  useCountdown,
  WeekDots,
} from './index';

const NOW = Date.UTC(2026, 9, 31, 12);
const DAY = 86_400_000;
const HR_SERIES: [number, number][] = Array.from({ length: 30 }, (_, i) => [
  NOW - (29 - i) * DAY,
  62 + Math.round(Math.sin(i / 3) * 4) + (i === 27 ? 26 : 0),
]);

export function DesignShowcase() {
  const [zone, setZone] = useState<string | undefined>('vitals');
  const [mood, setMood] = useState<ScaleValue | null>(null);
  const [running, setRunning] = useState(false);
  const { remaining, reset } = useCountdown(120, running);

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="pb-32">
      <MissionStrip
        code="ARES01"
        day={142}
        environment="Tránsito"
        delayMin={11}
        linkDown={false}
        queued={2}
        onPressQueue={() => {}}
      />
      <View className="gap-8 p-4">
        <ScreenHeader
          title="Cuerpo"
          subtitle="Elena Vega · evaluado hace 6 min"
          right={<LevelBadge level="amber" />}
        />

        <Section title="Niveles">
          <View className="flex-row flex-wrap gap-2">
            <LevelBadge level="green" />
            <LevelBadge level="amber" />
            <LevelBadge level="red" />
            <LevelBadge level="pending" />
          </View>
          <DataLabel source="watch" ageMin={12} onPressOrigin={() => {}} />
        </Section>

        <Section title="Figura humana">
          <BodyFigure
            selected={zone}
            onPressZone={setZone}
            zones={[
              { zone: 'vitals', level: 'amber' },
              { zone: 'mind', level: 'red' },
              { zone: 'performance', level: 'green' },
              { zone: 'metabolism', level: 'pending' },
              { zone: 'environment', level: 'green' },
            ]}
          />
        </Section>

        <Section title="Acciones del día">
          <View className="items-center gap-4">
            <DayRing
              segments={[
                { zone: 'vitals', progress: 1 },
                { zone: 'mind', progress: 0 },
                { zone: 'performance', progress: 0.5 },
                { zone: 'metabolism', progress: 0 },
                { zone: 'environment', progress: 1 },
              ]}
            />
            <WeekDots
              days={['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, i) => ({
                label,
                complete: i < 4,
                today: i === 4,
              }))}
            />
          </View>
          <ListGroup>
            <ActionRow
              grouped
              title="Presión arterial"
              detail="Vence hace 2 h"
              zone="vitals"
              onStart={() => {}}
            />
            <ActionRow
              grouped
              title="Ejercicio resistivo"
              detail="45 min"
              zone="performance"
              onDone={() => {}}
              onSkip={() => {}}
            />
            <ActionRow
              grouped
              title="Batería cognitiva"
              detail="3 pruebas · menos de 4 min"
              zone="performance"
              startLabel="Empezar"
              onStart={() => {}}
            />
          </ListGroup>
        </Section>

        <Section title="Indicador">
          <IndicatorCard
            name="Frecuencia cardíaca"
            value={88}
            unit="lpm"
            level="amber"
            baseline={{ median: 62, range: [55, 70] }}
            explanation="26 lpm por encima de tu línea base en reposo."
            source="watch"
            ageMin={3}
            onPress={() => {}}
            onPressOrigin={() => {}}
          />
          <IndicatorCard name="Glucosa" unit="mg/dL" level="pending" compact />
          <SeriesChart
            data={HR_SERIES}
            baseline={{ median: 62, range: [55, 70] }}
            events={[{ t: NOW - 2 * DAY, label: 'Emergencia', kind: 'emergency' }]}
            unit="lpm"
            lastLevel="amber"
          />
          <TrendDelta value={88} baseline={{ median: 62, range: [55, 70] }} />
          <SeriesChart data={[]} height={120} readout={false} />
        </Section>

        <Section title="Emergencia">
          <View className="items-center">
            <StepTimer total={120} remaining={remaining} label="Compresiones" paused={!running} />
          </View>
          <BigButton
            label={running ? 'Pausar' : 'Empezar'}
            onPress={() => setRunning((r) => !r)}
            size="lg"
          />
          <BigButton label="Reiniciar" variant="outline" onPress={() => reset()} />
          <BigButton
            label="Abrir protocolo"
            variant="emergency"
            icon={HeartPulse}
            size="lg"
            onPress={() => {}}
          />
        </Section>

        <Section title="Bienestar">
          <ScaleInput kind="mood" title="¿Cómo te sientes ahora?" value={mood} onChange={setMood} />
        </Section>

        <InlineConfirm
          title="¿Terminar la emergencia?"
          description="Se enviará el paquete a Tierra."
          confirmLabel="Sí, terminar"
          cancelLabel="Seguir"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
        <EmptyState
          title="Sin lecturas de glucosa"
          description="Regístrala a mano o conecta un glucómetro."
          action={{ label: 'Registrar', onPress: () => {} }}
        />
      </View>
      <View className="absolute right-4 bottom-8">
        <SosButton onPress={() => {}} />
      </View>
    </ScrollView>
  );
}
