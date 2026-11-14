import { RulesView } from '@/features/extras';

export default function Page({ searchParams }: PageProps<'/rules'>) {
  return <RulesView searchParams={searchParams} />;
}
