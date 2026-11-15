import { SamplesView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/samples'>) {
  return <SamplesView searchParams={searchParams} />;
}
