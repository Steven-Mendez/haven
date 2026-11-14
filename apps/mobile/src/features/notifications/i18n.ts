import { defineTexts } from '@/shared/i18n';

// Notification copy. Medical explanations come from the config (Assessment.explanation).
export const texts = defineTexts({
  es: {
    title: 'Notificaciones accionables',
    actionRegister: 'Registrar',
    actionOpenEmergency: 'Abrir emergencia',
    valuePlaceholder: 'Valor',
    valueSubmit: 'Guardar',
    alertTitle: 'Emergencia · {name}',
    alertFallback: 'Abre el protocolo de emergencia ahora.',
    reminderTitle: 'Hora de medir: {name}',
    reminderBody: 'Registra la medición o abre la ficha.',
    reminderScreenTitle: 'Pendiente: {name}',
    reminderScreenBody: 'Abre la pantalla para completarlo.',
    cognition: 'Batería cognitiva',
    wellbeing: 'Bienestar',
    savedTitle: 'Guardado: {name}',
    channelAlerts: 'Alertas de salud',
    channelReminders: 'Recordatorios de medición',
  },
  en: {
    title: 'Actionable notifications',
    actionRegister: 'Log value',
    actionOpenEmergency: 'Open emergency',
    valuePlaceholder: 'Value',
    valueSubmit: 'Save',
    alertTitle: 'Emergency · {name}',
    alertFallback: 'Open the emergency protocol now.',
    reminderTitle: 'Time to measure: {name}',
    reminderBody: 'Log the measurement or open its page.',
    reminderScreenTitle: 'Pending: {name}',
    reminderScreenBody: 'Open the screen to complete it.',
    cognition: 'Cognitive battery',
    wellbeing: 'Wellbeing',
    savedTitle: 'Saved: {name}',
    channelAlerts: 'Health alerts',
    channelReminders: 'Measurement reminders',
  },
});

export type NotificationTexts = (typeof texts)['es'];
