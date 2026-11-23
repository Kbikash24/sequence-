"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Info, Swords } from "lucide-react";
import type { Challenge, ChallengeResolved } from "@sequence/shared";
import { Button } from "@/components/ui/Button";
import { usePresenceActions } from "@/hooks/usePresence";
import { getSocket } from "@/services/socket";
import { usePresence } from "@/stores/presence";
import { useSession } from "@/stores/session";

/**
 * Mounted once in the root layout so the player is online, and can receive
 * and answer direct challenges, on every page.
 */
export function ChallengeHost() {
  const token = useSession((s) => s.token);
  const clearSession = useSession((s) => s.clear);
  const router = useRouter();
  const incoming = usePresence((s) => s.incoming);
  const message = usePresence((s) => s.message);
  const { respond } = usePresenceActions();

  useEffect(() => {
    const presence = usePresence.getState;
    if (!token) {
      presence().reset();
      return;
    }
    const socket = getSocket(token);
    const onReceived = (c: Challenge) => presence().receive(c);
    const onResolved = (payload: ChallengeResolved) => {
      presence().resolve(payload);
      if (payload.outcome === "accepted" && payload.code) {
        router.push(`/room/${payload.code}`);
      }
    };
    const onConnectError = (err: Error) => {
      if (err.message === "unauthorized") clearSession();
    };
    // Pending challenges don't survive a dropped connection on the server.
    const onDisconnect = () => {
      presence().setOutgoing(null);
      usePresence.setState({ incoming: [] });
    };
    socket.on("presence:update", presence().setOnline);
    socket.on("challenge:received", onReceived);
    socket.on("challenge:resolved", onResolved);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("presence:update", presence().setOnline);
      socket.off("challenge:received", onReceived);
      socket.off("challenge:resolved", onResolved);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
    };
  }, [token, router, clearSession]);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => {
      if (usePresence.getState().message?.id === message.id)
        usePresence.getState().clearMessage();
    }, 4000);
    return () => clearTimeout(id);
  }, [message]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            key={`msg-${message.id}`}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role="status"
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-navy-900 px-4 py-2.5 text-sm shadow-xl"
          >
            <Info className="h-4 w-4 text-sky-400" /> {message.text}
          </motion.div>
        )}
        {incoming.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            role="alertdialog"
            aria-label={`Challenge from ${c.fromNickname}`}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-navy-900 p-3.5 shadow-2xl ring-1 ring-violet-300/30"
          >
            <Swords className="h-6 w-6 shrink-0 text-violet-300" />
            <p className="min-w-0 flex-1 text-sm">
              <strong className="block truncate text-white">
                {c.fromNickname}
              </strong>
              <span className="text-slate-300">challenges you to a 1v1</span>
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void respond(c.id, false)}
            >
              Decline
            </Button>
            <Button size="sm" onClick={() => void respond(c.id, true)}>
              Accept
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
