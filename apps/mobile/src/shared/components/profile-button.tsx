import { router } from 'expo-router';
import { Button } from '@/shared/components/ui/button';
import { Text } from '@/shared/components/ui/text';
import { useMission, usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { navigationTexts } from '@/shared/i18n/navigation';
import { cn } from '@/shared/lib/utils';

export function initialsOf(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function useCrewMemberName(): string {
  const mission = useMission();
  const { crewMember } = usePreferences();
  return mission.crew.find((c) => c.id === crewMember)?.name ?? crewMember;
}

export function CrewAvatar({ size = 32, className }: { size?: number; className?: string }) {
  const name = useCrewMemberName();
  return (
    <Text
      aria-hidden
      className={cn(
        'bg-muted border-border text-foreground overflow-hidden rounded-full border text-center font-semibold',
        className,
      )}
      style={{
        width: size,
        height: size,
        lineHeight: size - 2,
        fontSize: Math.round(size * 0.38),
      }}
    >
      {initialsOf(name)}
    </Text>
  );
}

export function ProfileButton({ className }: { className?: string }) {
  const t = useTexts(navigationTexts);
  const name = useCrewMemberName();
  return (
    <Button
      variant="ghost"
      accessibilityRole="button"
      accessibilityLabel={`${t.profile}, ${name}`}
      hitSlop={8}
      onPress={() => router.push('/profile')}
      className={cn(
        'h-auto rounded-none px-0 py-0 active:bg-transparent active:opacity-70 sm:h-auto',
        className,
      )}
    >
      <CrewAvatar size={32} />
    </Button>
  );
}
