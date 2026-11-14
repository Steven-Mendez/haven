import { symptomById } from '@haven/core';
import { useLanguage } from '@/shared/i18n';

export function useSymptomLabel() {
  const language = useLanguage();
  return (id: string): string => {
    const name = symptomById(id)?.name[language];
    return name ? name.charAt(0).toLocaleLowerCase(language) + name.slice(1) : id;
  };
}
