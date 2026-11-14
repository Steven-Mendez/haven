import { MissionPlanView } from '@/features/extras';

export default function Page({ params }: PageProps<'/missions/[code]/plan'>) {
  return <MissionPlanView params={params} />;
}
