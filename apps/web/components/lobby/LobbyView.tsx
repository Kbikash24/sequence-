"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Link2,
  Play,
  UserPlus,
  WifiOff,
} from "lucide-react";
import {
  GAME_MODES,
  type GameMode,
  type RoomPlayerInfo,
  type Team,
} from "@sequence/shared";
import { ChatPanel } from "@/components/game/Sidebar";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { RoomActions } from "@/hooks/useRoom";
import { copyText } from "@/lib/utils";
import { useGameStore } from "@/stores/game";

export function LobbyView({
  meId,
  actions,
}: {
  meId: string;
  actions: RoomActions;
}) {
  const room = useGameStore((s) => s.room)!;
  const chat = useGameStore((s) => s.chat);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const me = room.players.find((p) => p.userId === meId);
  const isHost = room.hostId === meId;
  const perTeam = room.capacity / 2;
  const full = room.players.length === room.capacity;
  const balanced = (["red", "blue"] as const).every(
    (t) => room.players.filter((p) => p.team === t).length === perTeam,
  );
  const othersReady = room.players.every((p) => p.isHost || p.ready);
  const allConnected = room.players.every((p) => p.connected);
  const canStart = isHost && full && balanced && othersReady && allConnected;
  const startHint = !full
    ? `Waiting for ${room.capacity - room.players.length} more player${room.capacity - room.players.length === 1 ? "" : "s"}`
    : !balanced
      ? "Teams must be balanced"
      : !allConnected
        ? "Waiting for players to reconnect"
        : !othersReady
          ? "Waiting for everyone to ready up"
          : isHost
            ? "Everyone is ready!"
            : "Waiting for the host to start";

  const copy = async (kind: "code" | "link") => {
    const text =
      kind === "code"
        ? room.code
        : `${window.location.origin}/room/${room.code}`;
    if (await copyText(text)) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <section className="glass flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Room code
            </p>
            <p className="font-mono text-4xl font-black tracking-[0.25em] sm:text-5xl">
              {room.code}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void copy("code")}>
              {copied === "code" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}{" "}
              Copy code
            </Button>
            <Button variant="secondary" onClick={() => void copy("link")}>
              {copied === "link" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}{" "}
              Invite link
            </Button>
          </div>
        </section>

        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Teams</h2>
            <div
              role="radiogroup"
              aria-label="Game mode"
              className="flex rounded-xl bg-white/5 p-1"
            >
              {GAME_MODES.map((mode: GameMode) => (
                <button
                  key={mode}
                  role="radio"
                  type="button"
                  aria-checked={room.mode === mode}
                  disabled={!isHost}
                  onClick={() => void actions.setMode(mode)}
                  className={clsx(
                    "rounded-lg px-4 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed",
                    room.mode === mode
                      ? "bg-white/15 text-white"
                      : "text-slate-400 enabled:hover:text-white",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(["red", "blue"] as const).map((team) => (
              <TeamColumn
                key={team}
                team={team}
                players={room.players.filter((p) => p.team === team)}
                slots={perTeam}
                meId={meId}
                canJoin={
                  !!me &&
                  me.team !== team &&
                  room.players.filter((p) => p.team === team).length < perTeam
                }
                onJoin={() => void actions.setTeam(team)}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-between">
            <p className="text-sm text-slate-300" aria-live="polite">
              {startHint}
            </p>
            <div className="flex gap-2">
              {me && !isHost && (
                <Button
                  variant={me.ready ? "secondary" : "primary"}
                  onClick={() => void actions.setReady(!me.ready)}
                >
                  <Check className="h-4 w-4" />{" "}
                  {me.ready ? "Not ready" : "Ready up"}
                </Button>
              )}
              {isHost && (
                <Button
                  size="lg"
                  disabled={!canStart}
                  onClick={() => void actions.start()}
                >
                  <Play className="h-4 w-4" /> Start game
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <aside className="glass flex h-[28rem] flex-col rounded-3xl p-4 lg:h-auto lg:min-h-[28rem]">
        <h2 className="mb-3 font-display font-bold">Lobby chat</h2>
        <div className="min-h-0 flex-1">
          <ChatPanel messages={chat} meId={meId} onSend={actions.chat} />
        </div>
      </aside>
    </div>
  );
}

function TeamColumn({
  team,
  players,
  slots,
  meId,
  canJoin,
  onJoin,
}: {
  team: Team;
  players: RoomPlayerInfo[];
  slots: number;
  meId: string;
  canJoin: boolean;
  onJoin: () => void;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl p-4 ring-1",
        team === "red"
          ? "bg-rose-500/[0.07] ring-rose-400/25"
          : "bg-sky-500/[0.07] ring-sky-400/25",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3
          className={clsx(
            "font-display font-bold uppercase tracking-wider",
            team === "red" ? "text-rose-300" : "text-sky-300",
          )}
        >
          {team} team
        </h3>
        {canJoin && (
          <button
            type="button"
            onClick={onJoin}
            className="flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <UserPlus className="h-3.5 w-3.5" /> Switch here
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {Array.from({ length: slots }, (_, i) => {
          const p = players[i];
          if (!p) {
            return (
              <li
                key={`empty-${i}`}
                className="flex h-14 items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-slate-500"
              >
                Open seat
              </li>
            );
          }
          return (
            <motion.li
              key={p.userId}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-14 items-center gap-3 rounded-xl bg-white/5 px-3"
            >
              <Avatar
                name={p.nickname}
                team={team}
                size="sm"
                dimmed={!p.connected}
              />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {p.nickname}
                {p.userId === meId && (
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    (you)
                  </span>
                )}
              </span>
              {!p.connected && (
                <WifiOff
                  className="h-4 w-4 text-amber-300"
                  aria-label="disconnected"
                />
              )}
              {p.isHost ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-300">
                  <Crown className="h-3.5 w-3.5" /> Host
                </span>
              ) : (
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    p.ready
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/8 text-slate-400",
                  )}
                >
                  {p.ready ? "Ready" : "Not ready"}
                </span>
              )}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
