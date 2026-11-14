import { PacketView } from '@/features/astronaut';

export default function Page(props: PageProps<'/astronaut/[id]/packet/[packetId]'>) {
  return <PacketView params={props.params} />;
}
