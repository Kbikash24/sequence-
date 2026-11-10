import { notFound } from "next/navigation";
import { roomCodeSchema } from "@sequence/shared";
import { RoomScreen } from "@/components/room/RoomScreen";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const parsed = roomCodeSchema.safeParse(code);
  if (!parsed.success) notFound();
  return <RoomScreen code={parsed.data} />;
}
