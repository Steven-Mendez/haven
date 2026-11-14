import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type { Language } from '@/shared/i18n';

const VOICE_LANGUAGE: Record<Language, string> = { es: 'es-ES', en: 'en-US' };

/** Speech (expo-speech) and haptics (expo-haptics) for hands-busy use. Stops on unmount. */
export function useVoice(enabled: boolean, language: Language) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) void Speech.stop();
  }, [enabled]);
  useEffect(() => () => void Speech.stop(), []);

  const say = useCallback(
    (text: string | undefined, force = false) => {
      if (!text || (!enabledRef.current && !force)) return;
      try {
        void Speech.stop();
        Speech.speak(text, { language: VOICE_LANGUAGE[language], rate: 0.95 });
      } catch (error) {
        console.warn('[emergency] speech unavailable', error);
      }
    },
    [language],
  );

  const buzz = useCallback((kind: 'tap' | 'alert') => {
    if (Platform.OS === 'web') return;
    try {
      if (kind === 'alert')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics are a bonus; never block the protocol.
    }
  }, []);

  return { say, buzz };
}
