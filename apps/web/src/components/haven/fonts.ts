import localFont from 'next/font/local';

export const fontSans = localFont({
  src: './fonts/inter-var-latin.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});
