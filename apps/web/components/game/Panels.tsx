"use client";

import clsx from "clsx";
import { Crown, Layers, WifiOff } from "lucide-react";
import type { PublicGameState, Team } from "@sequence/shared";
import { Avatar } from "@/components/ui/Avatar";
import { useCountdown } from "@/hooks/useClient";
import { PlayingCard } from "./PlayingCard";

export function TeamScore({
  game,
  myTeam,
}: {
  game: PublicGameState;
  myTeam: Team | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["red", "blue"] as const).map((team) => (
        <div
          key={team}
          className={clsx(
            "rounded-xl p-3 ring-1",
            team === "red"
              ? "bg-rose-500/10 ring-rose-400/25"
              : "bg-sky-500/10 ring-sky-400/25",
          )}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
            <span className={team === "red" ? "text-rose-300" : "text-sky-300"}>
              {team}
              {myTeam === team && (
                <span className="ml-1 text-slate-400">(you)</span>
              )}
            </span>
          </div>
          <div
            className="mt-1 flex items-center gap-1.5"
            aria-label={`${team} sequences: ${game.sequenceCounts[team]} of ${game.sequencesToWin}`}
          >
            {Array.from({ length: game.sequencesToWin }, (_, i) => (
              <span
                key={i}
                className={clsx(
                  "h-3 flex-1 rounded-full",
                  i < game.sequenceCounts[team]
                    ? team === "red"
                      ? "chip-red"
                      : "chip-blue"
                    : "bg-white/10",
                )}
              />
            ))}
            <span className="ml-1 font-display text-lg font-bold">
              {game.sequenceCounts[team]}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PlayerList({
  game,
  hostId,
  meId,
  disconnects,
  clockOffset,
}: {
  game: PublicGameState;
  hostId: string;
  meId: string;
  disconnects: Record<string, number>;
  clockOffset: number;
}) {
  return (
    <ul className="space-y-1.5" aria-label="Players">
      {game.players.map((p) => {
        const active = game.status === "playing" && p.seat === game.currentSeat;
        return (
          <li
            key={p.userId}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-2.5 py-2 transition",
              active
                ? p.team === "red"
                  ? "bg-rose-500/15 ring-1 ring-rose-400/50"
                  : "bg-sky-500/15 ring-1 ring-sky-400/50"
                : "bg-white/[0.03]",
            )}
          >
            <Avatar
              name={p.nickname}
              team={p.team}
              size="sm"
              dimmed={!p.connected}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold">
                {p.nickname}
                {p.userId === meId && (
                  <span className="text-xs font-normal text-slate-400">
                    (you)
                  </span>
                )}
                {p.userId === hostId && (
                  <Crown
                    className="h-3.5 w-3.5 text-amber-300"
                    aria-label="host"
                  />
                )}
              </p>
              <p className="flex items-center gap-1 text-xs text-slate-400">
                <Layers className="h-3 w-3" /> {p.handCount} cards
                {!p.connected && disconnects[p.userId] && (
                  <ReconnectBadge
                    deadline={disconnects[p.userId]!}
                    offset={clockOffset}
                  />
                )}
              </p>
            </div>
            {active && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Turn
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ReconnectBadge({
  deadline,
  offset,
}: {
  deadline: number;
  offset: number;
}) {
  const ms = useCountdown(deadline, offset);
  return (
    <span className="ml-1 inline-flex items-center gap-1 text-amber-300">
      <WifiOff className="h-3 w-3" /> {Math.ceil(ms / 1000)}s
    </span>
  );
}

export function TurnTimer({
  deadline,
  offset,
  total = 60_000,
}: {
  deadline: number | null;
  offset: number;
  total?: number;
}) {
  const ms = useCountdown(deadline, offset);
  if (!deadline) return null;
  const pct = Math.min(100, (ms / total) * 100);
  const urgent = ms < 10_000;
  return (
    <div
      className="flex items-center gap-2"
      role="timer"
      aria-label={`${Math.ceil(ms / 1000)} seconds left`}
    >
      <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10 sm:w-32">
        <div
          className={clsx(
            "h-full rounded-full transition-[width] duration-300",
            urgent ? "bg-rose-400" : "bg-emerald-400",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={clsx(
          "w-8 font-mono text-sm tabular-nums",
          urgent && "text-rose-300",
        )}
      >
        {Math.ceil(ms / 1000)}s
      </span>
    </div>
  );
}

export function DeckInfo({ game }: { game: PublicGameState }) {
  const top = game.recentDiscards.at(-1);
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="relative h-14 w-10">
          <span className="absolute inset-0 translate-x-1 translate-y-1 rounded-lg bg-indigo-900 ring-1 ring-white/10" />
          <span className="absolute inset-0 rounded-lg bg-linear-to-br from-indigo-500 to-fuchsia-600 ring-1 ring-white/20" />
        </div>
        <div className="text-xs text-slate-400">
          Deck
          <p className="font-display text-lg font-bold text-white">
            {game.deckCount}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {top ? (
          <PlayingCard code={top} size="sm" />
        ) : (
          <span className="h-14 w-10 rounded-lg border border-dashed border-white/20" />
        )}
        <div className="text-xs text-slate-400">
          Discard
          <p className="font-display text-lg font-bold text-white">
            {game.discardCount}
          </p>
        </div>
      </div>
    </div>
  );
}
