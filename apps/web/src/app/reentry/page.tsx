import { ReentryView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/reentry'>) {
  return <ReentryView searchParams={searchParams} />;
}
