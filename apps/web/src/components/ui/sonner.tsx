'use client';

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * shadcn Sonner, adapted: the theme follows the `dark` class on <html> (HAVEN has no next-themes). Toasts are
 * only for confirmations («Copied»), bottom-right, on the elevated layer.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState<ToasterProps['theme']>('dark');
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => setTheme(html.classList.contains('dark') ? 'dark' : 'light');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      duration={2000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="text-level-green size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': '8px',
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: 'cn-toast text-sm! shadow-none!' } }}
      {...props}
    />
  );
};

export { Toaster };
