"use client";

import { useEffect, useMemo } from "react";
import type {
  Ack,
  ClientEventName,
  GameAction,
  GameMode,
  Team,
} from "@sequence/shared";
import { randomId } from "@/lib/utils";
import { getSocket, request, type EventPayload } from "@/services/socket";
import { useGameStore } from "@/stores/game";
import { useSession } from "@/stores/session";

/** Connects to a room, keeps the store in sync and exposes typed room/game actions. */
export function useRoom(code: string) {
  const token = useSession((s) => s.token);
  const clearSession = useSession((s) => s.clear);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const store = useGameStore.getState;
    store().reset();
    store().setConnection("connecting");

    const join = async () => {
      const res = await request(socket, "room:join", { code });
      if (res.ok) store().hydrate(res.data);
      else
        store().setFatal({
          code: res.code,
          message: res.error,
          details: res.details,
        });
    };

    const onConnect = () => {
      store().setConnection("connected");
      void join();
    };
    const onDisconnect = () => {
      if (store().connection !== "replaced")
        store().setConnection("reconnecting");
    };
    const onConnectError = (err: Error) => {
      if (err.message === "unauthorized") {
        clearSession();
        return;
      }
      store().setConnection("reconnecting");
    };
    const onReplaced = () => store().setConnection("replaced");
    const onClosed = ({ reason }: { reason: string }) =>
      store().setFatal({ message: reason });

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("session:replaced", onReplaced);
    socket.on("room:closed", onClosed);
    socket.on("room:state", store().setRoom);
    socket.on("game:state", store().setGame);
    socket.on("game:hand", store().setHand);
    socket.on("game:event", store().addLog);
    socket.on("game:over", store().setGameOver);
    socket.on("game:rematch", ({ votes }) => store().setRematchVotes(votes));
    socket.on("chat:message", store().addChat);
    socket.on("player:disconnected", ({ userId, deadline }) =>
      store().markDisconnected(userId, deadline),
    );
    socket.on("player:reconnected", ({ userId }) =>
      store().markReconnected(userId),
    );

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("session:replaced", onReplaced);
      socket.off("room:closed", onClosed);
      for (const event of [
        "room:state",
        "game:state",
        "game:hand",
        "game:event",
        "game:over",
        "game:rematch",
        "chat:message",
        "player:disconnected",
        "player:reconnected",
      ] as const) {
        socket.off(event);
      }
    };
  }, [token, code, clearSession]);

  return useMemo(() => {
    const run = async <E extends ClientEventName>(
      event: E,
      payload: EventPayload<E>,
    ) => {
      if (!token) return { ok: false, error: "Not signed in" } as Ack<unknown>;
      const res = (await request(
        getSocket(token),
        event,
        payload,
      )) as Ack<unknown>;
      if (!res.ok) useGameStore.getState().notify(res.error);
      return res;
    };

    return {
      setReady: (ready: boolean) => run("room:ready", { ready }),
      setTeam: (team: Team) => run("room:setTeam", { team }),
      setMode: (mode: GameMode) => run("room:setMode", { mode }),
      start: () => run("room:start", {}),
      leave: () => run("room:leave", {}),
      toLobby: () => run("room:toLobby", {}),
      rematch: (vote: boolean) => run("game:rematch", { vote }),
      chat: (text: string) => run("chat:send", { text }),
      play: async (action: GameAction) => {
        const store = useGameStore.getState();
        if (!store.game || !token) return;
        const res = await request(getSocket(token), "game:action", {
          actionId: randomId(),
          expectedVersion: store.game.version,
          action,
        });
        if (res.ok) {
          useGameStore.getState().selectCard(null);
          return;
        }
        if (res.code === "STALE_STATE") {
          const sync = await request(getSocket(token), "game:sync", {});
          if (sync.ok) useGameStore.getState().hydrate(sync.data);
        }
        useGameStore.getState().notify(res.error);
      },
    };
  }, [token]);
}

export type RoomActions = ReturnType<typeof useRoom>;
