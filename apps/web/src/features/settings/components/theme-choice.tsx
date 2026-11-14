'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { THEME_COOKIE } from '@/components/haven/theme';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Theme = 'dark' | 'light';

export function ThemeChoice({
  labels,
}: {
  labels: { label: string; dark: string; light: string };
}) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const choose = (next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
    // biome-ignore lint/suspicious/noDocumentCookie: a plain preference cookie, read by THEME_SCRIPT
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  };

  return (
    <ToggleGroup
      aria-label={labels.label}
      value={[theme]}
      onValueChange={(value) => {
        const next = value[0] as Theme | undefined;
        if (next) choose(next);
      }}
      variant="outline"
      size="sm"
      spacing={0}
    >
      <ToggleGroupItem value="dark" className="gap-1.5 px-2.5 text-xs">
        <Moon aria-hidden="true" />
        {labels.dark}
      </ToggleGroupItem>
      <ToggleGroupItem value="light" className="gap-1.5 px-2.5 text-xs">
        <Sun aria-hidden="true" />
        {labels.light}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
