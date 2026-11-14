import { TrendsView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/trends'>) {
  return <TrendsView searchParams={searchParams} />;
}
