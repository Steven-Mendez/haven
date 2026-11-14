'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type Props = {
  intervalSec: number;
};

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
