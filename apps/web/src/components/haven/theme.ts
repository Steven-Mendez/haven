// Theme preference (server-safe module: the root layout imports THEME_SCRIPT).

import { LANGUAGE_COOKIE } from '@/lib/i18n';

/** Cookie that stores the chosen theme (`light` | `dark`). Dark is the default. */
export const THEME_COOKIE = 'haven-theme';

/**
 * Inline script for <head>: applies the stored theme and `<html lang>` (haven-lang cookie) before first
 * paint. No request-time API, so the root layout stays prerenderable with Cache Components; the server
 * HTML still carries the default `lang` (see DISENO.md § Idioma).
 */
export const THEME_SCRIPT = `(function(){try{var c=document.cookie,d=document.documentElement,m=c.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(m&&m[1]==='light'){d.classList.remove('dark')}var l=c.match(/(?:^|; )${LANGUAGE_COOKIE}=(es|en)/);if(l){d.lang=l[1]}}catch(e){}})();`;
