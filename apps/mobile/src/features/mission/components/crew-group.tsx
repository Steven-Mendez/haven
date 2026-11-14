import type { Mission } from '@haven/core';
import { Check } from 'lucide-react-native';
import { Fragment } from 'react';
import { View } from 'react-native';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { Icon } from '@/shared/components/ui/icon';
import { Text } from '@/shared/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { usePreferences } from '@/shared/data';
import { useTexts } from '@/shared/i18n';
import { cn } from '@/shared/lib/utils';
import { texts } from '../i18n';
import { Group } from './rows';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Linked crew: avatar, name, watch. Tapping a person makes this phone theirs (`crewMember`). */
export function CrewGroup({ mission }: { mission: Mission }) {
  const t = useTexts(texts);
  const preferences = usePreferences();
  const crew = mission.crew;

  return (
    <Group title={t.crewGroup} hint={t.crewHint}>
      {/* One ToggleGroup child: the separators `Group` adds between rows are drawn here. */}
      <ToggleGroup
        type="single"
        value={preferences.crewMember}
        onValueChange={(id) => {
          if (id && id !== preferences.crewMember) void preferences.set({ crewMember: id });
        }}
        className="flex-col items-stretch rounded-none"
      >
        {crew.map((member, i) => {
          const you = member.id === preferences.crewMember;
          const detail = member.hasWatch ? t.hasWatch : t.noWatch;
          return (
            <Fragment key={member.id}>
              {i > 0 ? <View className="bg-border ml-4 h-px" /> : null}
              <ToggleGroupItem
                value={member.id}
                accessibilityLabel={`${member.name}. ${detail}${you ? `. ${t.you}` : ''}`}
                className={cn(
                  'h-auto min-h-16 justify-start gap-3 px-4 py-3 sm:h-auto sm:min-w-0 sm:px-4',
                  you ? 'bg-muted active:bg-muted' : 'bg-transparent active:bg-transparent',
                )}
              >
                <Avatar alt={member.name} className="size-11">
                  <AvatarFallback>
                    <Text className="text-foreground text-base font-semibold">
                      {initials(member.name)}
                    </Text>
                  </AvatarFallback>
                </Avatar>
                <View className="flex-1 gap-0.5">
                  <Text className="text-body text-foreground font-semibold">{member.name}</Text>
                  <Text className="text-muted-foreground text-sm font-normal">{detail}</Text>
                </View>
                {you ? (
                  <Badge variant="outline" className="flex-row gap-1">
                    <Icon as={Check} size={14} className="text-foreground" />
                    <Text>{t.you}</Text>
                  </Badge>
                ) : null}
              </ToggleGroupItem>
            </Fragment>
          );
        })}
      </ToggleGroup>
    </Group>
  );
}
