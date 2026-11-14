import { Suspense } from 'react';
import { NotFoundView } from '@/components/not-found-view';

export default function NotFound() {
  return (
    <Suspense fallback={null}>
      <NotFoundView />
    </Suspense>
  );
}
