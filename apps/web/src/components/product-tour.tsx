'use client';

import { type DriveStep, driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './product-tour.css';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { defineTexts, type Language } from '@/lib/i18n';

export const START_TOUR_EVENT = 'haven:tour-start';

const SEEN_KEY = 'haven.tour.crew.v1';

const texts = defineTexts({
  es: {
    missionTitle: 'Misión activa',
    missionBody: 'Cambia de misión aquí. Todo lo que ves es de la misión elegida.',
    navTitle: 'Secciones',
    navBody:
      'Tripulación, reglas de umbral, tendencias, aptitud para EVA y misiones. Atajo: g y la inicial.',
    headerTitle: 'La misión',
    headerBody:
      'Día, entorno y estado del enlace. Los datos llegan con el retardo real de la misión.',
    statsTitle: 'Resumen',
    statsBody: 'Acciones hechas hoy y zonas a revisar. Pulsa una cifra para filtrar la lista.',
    crewTitle: 'Tripulación',
    crewBody:
      'Cada astronauta con su peor nivel arriba. Ábrelo para ver detalle; j y k para moverte con el teclado.',
    searchTitle: 'Buscar y comandos',
    searchBody: '⌘K busca astronautas, páginas y acciones. ? muestra todos los atajos.',
    progress: '{{current}} de {{total}}',
    next: 'Siguiente',
    prev: 'Atrás',
    done: 'Listo',
    close: 'Cerrar el recorrido',
  },
  en: {
    missionTitle: 'Active mission',
    missionBody: 'Switch missions here. Everything you see belongs to the chosen mission.',
    navTitle: 'Sections',
    navBody:
      'Crew, threshold rules, trends, EVA readiness and missions. Shortcut: g and the initial.',
    headerTitle: 'The mission',
    headerBody: 'Day, environment and link status. Data arrives with the real mission delay.',
    statsTitle: 'Summary',
    statsBody: 'Actions done today and zones to check. Click a figure to filter the list.',
    crewTitle: 'Crew',
    crewBody:
      'Each astronaut with their worst level first. Open one for details; j and k move with the keyboard.',
    searchTitle: 'Search and commands',
    searchBody: '⌘K finds astronauts, pages and actions. ? shows every shortcut.',
    progress: '{{current}} of {{total}}',
    next: 'Next',
    prev: 'Back',
    done: 'Done',
    close: 'Close the tour',
  },
});

type Anchor = 'mission' | 'nav' | 'header' | 'stats' | 'crew' | 'search';
const ORDER: Anchor[] = ['mission', 'nav', 'header', 'stats', 'crew', 'search'];

function visible(anchor: Anchor): Element | undefined {
  return [...document.querySelectorAll(`[data-tour="${anchor}"]`)].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {}
}

function start(lang: Language) {
  const t = texts[lang];
  const copy: Record<Anchor, { title: string; description: string }> = {
    mission: { title: t.missionTitle, description: t.missionBody },
    nav: { title: t.navTitle, description: t.navBody },
    header: { title: t.headerTitle, description: t.headerBody },
    stats: { title: t.statsTitle, description: t.statsBody },
    crew: { title: t.crewTitle, description: t.crewBody },
    search: { title: t.searchTitle, description: t.searchBody },
  };
  const steps: DriveStep[] = ORDER.flatMap((anchor) => {
    const element = visible(anchor);
    return element ? [{ element, popover: copy[anchor] }] : [];
  });
  if (steps.length === 0) return;
  driver({
    steps,
    showProgress: steps.length > 1,
    progressText: t.progress,
    nextBtnText: t.next,
    prevBtnText: t.prev,
    doneBtnText: t.done,
    closeBtnLabel: t.close,
    popoverClass: 'haven-tour',
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 8,
    smoothScroll: true,
    overlayClickBehavior: 'none',
    onDestroyed: markSeen,
  }).drive();
}

function whenPageShows(fn: () => void): () => void {
  let tries = 0;
  const id = window.setInterval(() => {
    tries++;
    if (visible('header') || tries > 20) {
      window.clearInterval(id);
      fn();
    }
  }, 250);
  return () => window.clearInterval(id);
}

export function ProductTour({ lang }: { lang: Language }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== '/' || seen()) return;
    return whenPageShows(() => start(lang));
  }, [pathname, lang]);

  useEffect(() => {
    const onStart = () => {
      if (pathname !== '/') router.push('/');
      whenPageShows(() => start(lang));
    };
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [pathname, lang, router]);

  return null;
}
