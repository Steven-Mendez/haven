import { symptomById } from '@haven/core';
import { useLanguage } from '@/shared/i18n';

/**
 * Name of a symptom id («chest-pain») from the config (`symptoms.json`), in the current language.
 * Lower-cased first letter: it is read inside a sentence («With an active symptom: chest pain»).
 */
export function useSymptomLabel() {
  const language = useLanguage();
  return (id: string): string => {
    const name = symptomById(id)?.name[language];
    return name ? name.charAt(0).toLocaleLowerCase(language) + name.slice(1) : id;
  };
}
