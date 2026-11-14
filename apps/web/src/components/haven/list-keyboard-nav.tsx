'use client';

import { useEffect } from 'react';

/**
 * j / k (and ↓ / ↑ once a row has focus) move the focus between the `[data-row-link]` links of a list;
 * ↵ opens the focused one (native link behaviour). Ignored while typing or when a modifier is held.
 * Renders nothing.
 */
export function ListKeyboardNav({ containerId }: { containerId: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return;
      const container = document.getElementById(containerId);
      if (!container) return;
      const rows = [...container.querySelectorAll<HTMLElement>('[data-row-link]')];
      if (!rows.length) return;
      const current = rows.indexOf(document.activeElement as HTMLElement);
      const inList = current !== -1;
      let next: number | null = null;
      if (e.key === 'j' || (inList && e.key === 'ArrowDown'))
        next = inList ? Math.min(rows.length - 1, current + 1) : 0;
      else if (e.key === 'k' || (inList && e.key === 'ArrowUp'))
        next = inList ? Math.max(0, current - 1) : 0;
      if (next === null) return;
      e.preventDefault();
      rows[next]?.focus();
      rows[next]?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [containerId]);
  return null;
}
