"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import {
  ArrowLeftToLine,
  Clock,
  Hash,
  LogOut,
  RotateCcw,
  Trophy,
} from "lucide-react";
import type { FinishReason } from "@sequence/shared";
import { Button } from "@/components/ui/Button";
import type { RoomActions } from "@/hooks/useRoom";
import { formatDuration } from "@/lib/utils";
import { useGameStore } from "@/stores/game";
import { Confetti } from "./Confetti";

const REASON: Record<FinishReason, string> = {
  sequences: "by completing sequences",
  forfeit: "by forfeit",
  disconnect: "after an opponent disconnected",
  stalemate: "after the turn limit",
};

export function ResultsView({
  meId,
  actions,
  onLeave,
}: {
  meId: string;
  actions: RoomActions;
  onLeave: () => void;
}) {
  const result = useGameStore((s) => s.gameOver)!;
  const room = useGameStore((s) => s.room)!;
  const game = useGameStore((s) => s.game);
  const votes = useGameStore((s) => s.rematchVotes);
  const [hidden, setHidden] = useState(false);

  const myTeam = game?.players.find((p) => p.userId === meId)?.team ?? null;
  const won = !!result.winner && result.winner === myTeam;
  const isHost = room.hostId === meId;
  const voted = votes.includes(meId);
  const canRematch = room.players.length === room.capacity;

  if (hidden) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center">
        <Button onClick={() => setHidden(false)}>
          <Trophy className="h-4 w-4" /> Show results
        </Button>
      </div>
    );
  }

  return (
    <>
      {won && <Confetti />}
      <div className="fixed inset-0 z-30 grid place-items-center bg-navy-950/60 p-4 backdrop-blur-[2px]">
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-title"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="glass w-full max-w-lg rounded-3xl p-6 text-center shadow-2xl sm:p-8"
        >
          <motion.div
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.15, type: "spring" }}
            className={clsx(
              "mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full",
              result.winner === "red"
                ? "chip-red"
                : result.winner === "blue"
                  ? "chip-blue"
                  : "bg-slate-600",
            )}
          >
            <Trophy className="h-9 w-9 text-white" />
          </motion.div>
          <h2
            id="results-title"
            className="font-display text-3xl font-extrabold"
          >
            {result.winner
              ? won
                ? "Victory!"
                : myTeam
                  ? "Defeat"
                  : `${result.winner} wins`
              : "Draw"}
          </h2>
          <p className="mt-1 text-slate-300">
            {result.winner ? (
              <>
                <span
                  className={
                    result.winner === "red" ? "text-rose-300" : "text-sky-300"
                  }
                >
                  {result.winners.map((w) => w.nickname).join(" & ") ||
                    `${result.winner} team`}
                </span>{" "}
                won {REASON[result.reason]}
              </>
            ) : (
              "No team reached the required sequences"
            )}
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-2 text-sm">
            <Stat
              icon={<Clock className="h-4 w-4" />}
              label="Duration"
              value={formatDuration(result.durationMs)}
            />
            <Stat
              icon={<Hash className="h-4 w-4" />}
              label="Moves"
              value={String(result.totalMoves)}
            />
            <Stat
              icon={<Trophy className="h-4 w-4" />}
              label="Sequences"
              value={String(result.sequences.length)}
            />
          </dl>

          <div className="mt-6 flex flex-col gap-2">
            <Button
              size="lg"
              disabled={!canRematch}
              onClick={() => void actions.rematch(!voted)}
            >
              <RotateCcw className="h-4 w-4" />
              {voted ? "Cancel rematch vote" : "Rematch"} ({votes.length}/
              {room.capacity})
            </Button>
            {!canRematch && (
              <p className="text-xs text-slate-400">
                A player left — return to the lobby to refill seats.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                disabled={!isHost}
                onClick={() => void actions.toLobby()}
                title={isHost ? undefined : "Only the host can do this"}
              >
                <ArrowLeftToLine className="h-4 w-4" /> Lobby
              </Button>
              <Button variant="ghost" onClick={onLeave}>
                <LogOut className="h-4 w-4" /> Leave
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setHidden(true)}
              className="mt-1 text-xs text-slate-400 underline-offset-2 hover:underline"
            >
              View final board
            </button>
          </div>
        </motion.section>
      </div>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <dt className="flex items-center justify-center gap-1 text-xs text-slate-400">
        {icon} {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-bold">{value}</dd>
    </div>
  );
}
