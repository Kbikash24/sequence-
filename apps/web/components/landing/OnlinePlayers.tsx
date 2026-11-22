"use client";

import clsx from "clsx";
import { Loader2, Swords, Users, X } from "lucide-react";
import type { PresenceStatus } from "@sequence/shared";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { usePresenceActions, useWatchPresence } from "@/hooks/usePresence";
import { usePresence } from "@/stores/presence";

const STATUS_LABEL: Record<PresenceStatus, string> = {
  available: "Available",
  in_lobby: "In a lobby",
  in_game: "In a game",
};

export function OnlinePlayers({ selfId }: { selfId: string }) {
  useWatchPresence();
  const online = usePresence((s) => s.online);
  const outgoing = usePresence((s) => s.outgoing);
  const { challenge, cancel } = usePresenceActions();

  const others = online.filter((u) => u.userId !== selfId);
  const selfBusy =
    online.find((u) => u.userId === selfId)?.status === "in_game";

  return (
    <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4 text-violet-300" /> Players online
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-300">
          {others.length}
        </span>
      </p>

      {outgoing && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm ring-1 ring-violet-300/25">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-300" />
          <span className="min-w-0 flex-1 truncate">
            Waiting for <strong>{outgoing.toNickname}</strong>…
          </span>
          <button
            type="button"
            aria-label="Cancel challenge"
            onClick={() => void cancel(outgoing.id)}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {others.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nobody else is online right now. Share the site to get a game going!
        </p>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {others.map((u) => (
            <li
              key={u.userId}
              className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2"
            >
              <Avatar name={u.nickname} team="blue" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.nickname}</p>
                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span
                    className={clsx(
                      "h-1.5 w-1.5 rounded-full",
                      u.status === "available"
                        ? "bg-emerald-400"
                        : u.status === "in_lobby"
                          ? "bg-amber-400"
                          : "bg-rose-400",
                    )}
                  />
                  {STATUS_LABEL[u.status]}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!!outgoing || selfBusy || u.status === "in_game"}
                onClick={() => void challenge(u.userId)}
              >
                <Swords className="h-3.5 w-3.5" /> Challenge
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
