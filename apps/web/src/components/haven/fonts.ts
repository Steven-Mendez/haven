import localFont from 'next/font/local';

// Local font (OFL, copied from haven-landing): the app runs on a LAN without internet.
// Inter for everything; figures use tabular digits (`.numeric`).

export const fontSans = localFont({
  src: './fonts/inter-var-latin.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});
