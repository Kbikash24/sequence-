"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { GameView } from "@/components/game/GameView";
import { ResultsView } from "@/components/game/ResultsView";
import { LobbyView } from "@/components/lobby/LobbyView";
import { NicknameForm } from "@/components/NicknameForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { RoomHeader } from "@/components/room/RoomHeader";
import { useMounted } from "@/hooks/useClient";
import { useRoom } from "@/hooks/useRoom";
import { getSocket } from "@/services/socket";
import { useGameStore } from "@/stores/game";
import { useSession } from "@/stores/session";

export function RoomScreen({ code }: { code: string }) {
  const mounted = useMounted();
  const user = useSession((s) => s.user);
  const token = useSession((s) => s.token);

  if (!mounted) return <FullScreenMessage title="Loading…" spinner />;
  if (!user || !token) {
    return (
      <Shell code={code}>
        <div className="mx-auto mt-16 max-w-md px-4">
          <div className="glass rounded-3xl p-6">
            <h1 className="mb-1 font-display text-2xl font-bold">
              Join room {code}
            </h1>
            <p className="mb-5 text-sm text-slate-400">
              Pick a nickname to take your seat.
            </p>
            <NicknameForm cta="Join" />
          </div>
        </div>
      </Shell>
    );
  }
  return <ConnectedRoom code={code} meId={user.id} token={token} />;
}

function ConnectedRoom({
  code,
  meId,
  token,
}: {
  code: string;
  meId: string;
  token: string;
}) {
  const router = useRouter();
  const actions = useRoom(code);
  const room = useGameStore((s) => s.room);
  const game = useGameStore((s) => s.game);
  const gameOver = useGameStore((s) => s.gameOver);
  const connection = useGameStore((s) => s.connection);
  const fatal = useGameStore((s) => s.fatal);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const leave = async () => {
    await actions.leave();
    setConfirmLeave(false);
    router.push("/");
  };

  if (connection === "replaced") {
    return (
      <FullScreenMessage
        title="Opened in another tab"
        body="This game is active in another window or device."
      >
        <Button
          onClick={() => {
            getSocket(token).connect();
            useGameStore.getState().setConnection("connecting");
          }}
        >
          Play here instead
        </Button>
      </FullScreenMessage>
    );
  }

  if (fatal) {
    const otherRoom =
      fatal.code === "IN_GAME" ? fatal.details?.code : undefined;
    return (
      <FullScreenMessage title="Can't join this room" body={fatal.message}>
        <div className="flex gap-2">
          {otherRoom && (
            <Button onClick={() => router.push(`/room/${otherRoom}`)}>
              Go to my game
            </Button>
          )}
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-xl bg-white/8 px-5 text-sm font-semibold ring-1 ring-white/12 hover:bg-white/12"
          >
            Back home
          </Link>
        </div>
      </FullScreenMessage>
    );
  }

  if (!room) return <FullScreenMessage title="Connecting to room…" spinner />;

  const inGame = room.status !== "lobby" && game;
  const onLeave = () =>
    room.status === "playing" ? setConfirmLeave(true) : void leave();
  return (
    <Shell
      code={room.code}
      connection={connection}
      onLeave={onLeave}
      hideHeader={!!inGame}
    >
      {inGame ? (
        <GameView
          meId={meId}
          actions={actions}
          header={
            <RoomHeader
              variant="panel"
              code={room.code}
              connection={connection}
              onLeave={onLeave}
            />
          }
        />
      ) : (
        <LobbyView meId={meId} actions={actions} />
      )}
      {room.status === "finished" && gameOver && (
        <ResultsView
          meId={meId}
          actions={actions}
          onLeave={() => void leave()}
        />
      )}
      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave the game?"
      >
        <p className="text-sm text-slate-300">
          Leaving now forfeits the match for your team. Your opponents will be
          declared the winners.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button variant="danger" onClick={() => void leave()}>
            Leave & forfeit
          </Button>
        </div>
      </Modal>
    </Shell>
  );
}

function Shell({
  code,
  connection,
  onLeave,
  hideHeader,
  children,
}: {
  code: string;
  connection?: string;
  onLeave?: () => void;
  hideHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <NoticeToast />
      {!hideHeader && (
        <RoomHeader code={code} connection={connection} onLeave={onLeave} />
      )}
      {children}
    </div>
  );
}

function FullScreenMessage({
  title,
  body,
  spinner,
  children,
}: {
  title: string;
  body?: string;
  spinner?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="glass flex max-w-sm flex-col items-center gap-3 rounded-3xl p-8 text-center">
        {spinner && (
          <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
        )}
        <h1 className="font-display text-xl font-bold">{title}</h1>
        {body && <p className="text-sm text-slate-400">{body}</p>}
        {children}
      </div>
    </div>
  );
}
