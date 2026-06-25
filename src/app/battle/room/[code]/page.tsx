import { auth } from "@/auth";
import { RoomClient } from "./RoomClient";

export const dynamic = "force-dynamic";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function GameRoomPage({ params }: RoomPageProps) {
  const session = await auth();
  const { code } = await params;

  return <RoomClient initialSession={session} roomCode={code} />;
}
