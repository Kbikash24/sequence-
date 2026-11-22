"use client";

import { useEffect, useMemo } from "react";
import { getSocket, request } from "@/services/socket";
import { notifyPresence, usePresence } from "@/stores/presence";
import { useSession } from "@/stores/session";

/** Subscribes to the live list of online players while the caller is mounted. */
export function useWatchPresence() {
  const token = useSession((s) => s.token);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    const watch = async () => {
      const res = await request(socket, "presence:watch", { watch: true });
      if (res.ok) usePresence.getState().setOnline(res.data);
    };
    socket.on("connect", watch);
    void watch();
    return () => {
      socket.off("connect", watch);
      if (socket.connected)
        void request(socket, "presence:watch", { watch: false });
    };
  }, [token]);
}

export function usePresenceActions() {
  const token = useSession((s) => s.token);

  return useMemo(
    () => ({
      challenge: async (toUserId: string) => {
        if (!token) return;
        const res = await request(getSocket(token), "challenge:send", {
          toUserId,
        });
        if (res.ok) usePresence.getState().setOutgoing(res.data);
        else notifyPresence(res.error);
      },
      cancel: async (challengeId: string) => {
        if (!token) return;
        const res = await request(getSocket(token), "challenge:cancel", {
          challengeId,
        });
        if (!res.ok) notifyPresence(res.error);
        usePresence.getState().setOutgoing(null);
      },
      respond: async (challengeId: string, accept: boolean) => {
        if (!token) return;
        usePresence.getState().dismissIncoming(challengeId);
        const res = await request(getSocket(token), "challenge:respond", {
          challengeId,
          accept,
        });
        if (!res.ok) notifyPresence(res.error);
      },
    }),
    [token],
  );
}
