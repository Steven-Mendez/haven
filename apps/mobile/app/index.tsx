import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Stack } from 'expo-router';
import { MoonStarIcon, PlusIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ScrollView, View } from 'react-native';
import type { Item } from '@haven/shared';
import { createItem, getItems } from '@/lib/api';
import { sendToWatch, useWatchMessages, useWatchReachable } from '@/lib/watch';

const SCREEN_OPTIONS = {
  title: 'HAVEN',
  headerRight: () => <ThemeToggle />,
};

export default function Screen() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const watchReachable = useWatchReachable();

  const load = React.useCallback(() => {
    getItems()
      .then((data) => {
        setItems(data);
        setError(null);
        sendToWatch('items', { items: data });
      })
      .catch((e) => setError(String(e)));
  }, []);

  React.useEffect(load, [load]);

  // El reloj no habla con la API: pide acciones y el iPhone le devuelve el estado.
  useWatchMessages((message) => {
    if (message.type === 'sync') load();
    if (message.type === 'addItem') {
      const { title } = message.payload as { title: string };
      createItem({ title }).then(load).catch((e) => setError(String(e)));
    }
  });

  async function addItem() {
    await createItem({ title: `Item desde iOS ${new Date().toLocaleTimeString()}` });
    load();
  }

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <ScrollView contentContainerClassName="gap-4 p-4" contentInsetAdjustmentBehavior="automatic">
        <View className="flex-row gap-2">
          <Button onPress={addItem}>
            <Icon as={PlusIcon} className="text-primary-foreground" />
            <Text>Agregar item</Text>
          </Button>
          <Button variant="outline" onPress={load}>
            <Text>Recargar</Text>
          </Button>
        </View>
        {watchReachable && <Text className="text-sm text-muted-foreground">⌚ Apple Watch conectado</Text>}
        {error && <Text className="text-destructive">{error}</Text>}
        {items.map((item) => (
          <View key={item._id} className="rounded-lg border border-border bg-card p-4">
            <Text className="font-medium">{item.title}</Text>
            <Text className="text-sm text-muted-foreground">
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        ))}
        {!error && items.length === 0 && (
          <Text className="text-muted-foreground">Sin items todavía. Agrega uno.</Text>
        )}
      </ScrollView>
    </>
  );
}

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
};

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button
      onPressIn={toggleColorScheme}
      size="icon"
      variant="ghost"
      className="ios:size-9 rounded-full web:mx-4">
      <Icon as={THEME_ICONS[colorScheme ?? 'light']} className="size-5" />
    </Button>
  );
}
