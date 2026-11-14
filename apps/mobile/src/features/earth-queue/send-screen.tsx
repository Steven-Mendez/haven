import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoutineComposer } from './components/routine-composer';

export default function SendScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="bg-background flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-section p-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <RoutineComposer onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </ScrollView>
  );
}
