import { LANGUAGE_COOKIE } from '@/lib/i18n';

export const THEME_COOKIE = 'haven-theme';

export const THEME_SCRIPT = `(function(){try{var c=document.cookie,d=document.documentElement,m=c.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(m&&m[1]==='light'){d.classList.remove('dark')}var l=c.match(/(?:^|; )${LANGUAGE_COOKIE}=(es|en)/);if(l){d.lang=l[1]}}catch(e){}})();`;
