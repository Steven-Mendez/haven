'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type Props = {
  /** Seconds between refreshes. */
  intervalSec: number;
};

/**
 * Periodic light refresh of the Crew page (T01).
 *
 * Why `router.refresh()` every N seconds instead of polling the API from the client: the page is a
 * server component that reads `getCrew()` directly, so refreshing re-renders it on the server with the
 * packets received since, and React merges the new payload without a flash (no skeleton, scroll and
 * focus kept). One request per interval, no client data layer, no websockets. A packet therefore shows
 * up at most `intervalSec` after the phone sends it. The timer pauses while the tab is hidden and
 * refreshes immediately when it becomes visible again. Renders nothing.
 */
export function AutoRefresh({ intervalSec }: Props) {
  const router = useRouter();

  useEffect(() => {
    let id: number | undefined;
    const start = () => {
      if (id === undefined) id = window.setInterval(() => router.refresh(), intervalSec * 1000);
    };
    const stop = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router, intervalSec]);

  return null;
}
