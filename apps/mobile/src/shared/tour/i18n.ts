import { defineTexts } from '@/shared/i18n';

// First-run tour: what the app needs to work. Interpolation with `format` ({n}, {total}).
export const tourTexts = defineTexts({
  es: {
    verdictTitle: 'Tu estado',
    verdictBody:
      'Cómo estás ahora frente a tus propios valores. Si algo se sale, aquí mismo te dice qué hacer.',
    startTitle: 'Empieza aquí',
    startBody:
      'Sin lecturas HAVEN no puede evaluarte. Toca para registrar tu primera medición o conectar tu reloj.',
    nextTitle: 'Tu siguiente acción',
    nextBody:
      'Lo que toca ahora. Toca el botón para hacerlo: cada lectura le enseña a HAVEN qué es normal para ti.',
    todayTitle: 'Rutina: tus acciones de hoy',
    todayBody:
      'Una acción por zona del cuerpo. Toca una para hacerla o marcarla como hecha; con todas, el día suma a tu racha.',
    checkinTitle: 'Rutina: cómo estás hoy',
    checkinBody:
      'Dos preguntas, ánimo y estrés. Contéstalas cada día: también son datos de tu salud.',
    trendsTitle: 'Tendencias',
    trendsBody:
      'Tus indicadores por zona, el peor primero. Toca uno para ver su gráfica frente a tu línea base.',
    missionTitle: 'Misión: enlace con Tierra',
    missionBody:
      'Se detecta solo. Si se corta, tus datos esperan en el teléfono y se envían solos cuando vuelve.',
    sosTitle: 'SOS',
    sosBody: 'Tócalo en una emergencia. Mantenlo 3 segundos para empezarla directamente.',
    alertsTitle: 'Para revisar',
    alertsBody: 'Indicadores fuera de tu rango. Toca uno para ver su evolución y qué hacer.',
    figureTitle: 'Tu cuerpo por zonas',
    figureBody:
      'Cada zona toma el color de su peor indicador: verde en rango, ámbar revisar, rojo emergencia. Toca una para ver sus indicadores.',
    profileTitle: 'Tu perfil',
    profileBody:
      'Tu línea base, las fuentes de datos y los ajustes. Desde Ajustes puedes repetir este recorrido.',
    step: '{n} de {total}',
    next: 'Siguiente',
    back: 'Atrás',
    done: 'Listo',
    close: 'Cerrar el recorrido',
  },
  en: {
    verdictTitle: 'Your status',
    verdictBody:
      'How you are now against your own values. If something is off, right here it tells you what to do.',
    startTitle: 'Start here',
    startBody:
      'Without readings HAVEN cannot assess you. Tap to record your first measurement or connect your watch.',
    nextTitle: 'Your next action',
    nextBody:
      'What is due now. Tap the button to do it: each reading teaches HAVEN what is normal for you.',
    todayTitle: 'Routine: your actions for today',
    todayBody:
      'One action per body zone. Tap one to do it or mark it done; with all of them, the day adds to your streak.',
    checkinTitle: 'Routine: how you feel today',
    checkinBody: 'Two questions, mood and stress. Answer them every day: they are health data too.',
    trendsTitle: 'Trends',
    trendsBody:
      'Your indicators by zone, worst first. Tap one to see its chart against your baseline.',
    missionTitle: 'Mission: link with Earth',
    missionBody:
      'Detected automatically. If it drops, your data waits on the phone and is sent on its own when it is back.',
    sosTitle: 'SOS',
    sosBody: 'Tap it in an emergency. Hold it 3 seconds to start one right away.',
    alertsTitle: 'To check',
    alertsBody: 'Indicators outside your range. Tap one to see its trend and what to do.',
    figureTitle: 'Your body by zone',
    figureBody:
      'Each zone takes the colour of its worst indicator: green in range, amber check, red emergency. Tap one to see its indicators.',
    profileTitle: 'Your profile',
    profileBody:
      'Your baseline, data sources and settings. You can replay this tour from Settings.',
    step: '{n} of {total}',
    next: 'Next',
    back: 'Back',
    done: 'Done',
    close: 'Close the tour',
  },
});
