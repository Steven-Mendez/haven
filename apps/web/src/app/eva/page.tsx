import { EvaView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/eva'>) {
  return <EvaView searchParams={searchParams} />;
}
