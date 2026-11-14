import { Suspense } from 'react';
import { NotFoundView } from '@/components/not-found-view';

// The language comes from a cookie (request-time API): stream it inside Suspense (Cache Components).
export default function NotFound() {
  return (
    <Suspense fallback={null}>
      <NotFoundView />
    </Suspense>
  );
}
