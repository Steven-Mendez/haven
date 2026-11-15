import { RulesEditView } from '@/features/extras';

export default function Page({ params }: PageProps<'/rules/[indicator]'>) {
  return <RulesEditView params={params} />;
}
