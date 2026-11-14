import { View } from '@/features/astronaut';

export default function Page(props: PageProps<'/astronaut/[id]'>) {
  return <View params={props.params} searchParams={props.searchParams} />;
}
