'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Language } from '@/lib/i18n';
import { bridge } from '../store';

/**
 * Lends Orion's chats the router of whatever page is open. The root layout
 * mounts it, so a turn keeps working after the chat page is left.
 */
export function OrionBridge({ lang }: { lang: Language }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    bridge.router = router;
    bridge.lang = lang;
    bridge.pathname = pathname;
  }, [router, lang, pathname]);
  return null;
}
