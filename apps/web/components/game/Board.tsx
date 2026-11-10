"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { memo, useMemo } from "react";
import { Star } from "lucide-react";
import { BOARD_LAYOUT, FREE_CELL, getLockedCells } from "@sequence/game-engine";
import {
  SUIT_SYMBOL,
  cardName,
  cardSuit,
  cellLabel,
  isRedSuit,
  rankLabel,
  type Sequence,
  type Team,
} from "@sequence/shared";

interface BoardProps {
  chips: (Team | null)[];
  sequences: Sequence[];
  targets?: Set<number>;
  targetMode?: "place" | "remove";
  lastCell?: number | null;
  highlightSequences?: boolean;
  onCellClick?: (cell: number) => void;
  className?: string;
}

export function Board({
  chips,
  sequences,
  targets,
  targetMode = "place",
  lastCell,
  highlightSequences,
  onCellClick,
  className,
}: BoardProps) {
  const locked = useMemo(() => getLockedCells(sequences), [sequences]);
  return (
    <div
      role="grid"
      aria-label="Game board"
      className={clsx(
        "grid aspect-square w-full grid-cols-10 gap-[2px] rounded-2xl bg-navy-800/90 p-1.5 shadow-2xl ring-1 ring-white/10 sm:gap-1 sm:p-2",
        className,
      )}
    >
      {BOARD_LAYOUT.map((card, cell) => (
        <BoardCell
          key={cell}
          cell={cell}
          card={card}
          chip={chips[cell] ?? null}
          locked={locked.has(cell)}
          glow={!!highlightSequences && locked.has(cell)}
          target={targets?.has(cell) ? targetMode : null}
          last={lastCell === cell}
          onClick={onCellClick}
        />
      ))}
    </div>
  );
}

interface CellProps {
  cell: number;
  card: (typeof BOARD_LAYOUT)[number];
  chip: Team | null;
  locked: boolean;
  glow: boolean;
  target: "place" | "remove" | null;
  last: boolean;
  onClick?: (cell: number) => void;
}

const BoardCell = memo(function BoardCell({
  cell,
  card,
  chip,
  locked,
  glow,
  target,
  last,
  onClick,
}: CellProps) {
  const free = card === FREE_CELL;
  const label = [
    cellLabel(cell),
    free ? "free corner" : cardName(card),
    chip ? `${chip} chip` : null,
    locked ? "part of a sequence" : null,
    target ? (target === "remove" ? "can remove" : "can place") : null,
  ]
    .filter(Boolean)
    .join(", ");
  const interactive = !!target && !!onClick;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={label}
      disabled={!interactive}
      onClick={interactive ? () => onClick!(cell) : undefined}
      className={clsx(
        "relative overflow-hidden rounded-[4px] transition sm:rounded-md",
        free
          ? "bg-linear-to-br from-amber-300 via-fuchsia-400 to-sky-400"
          : "card-face",
        interactive && "cursor-pointer",
        target === "place" &&
          "z-10 ring-2 ring-emerald-400 ring-offset-1 ring-offset-navy-800",
        target === "remove" &&
          "z-10 ring-2 ring-amber-400 ring-offset-1 ring-offset-navy-800",
        !target && !chip && "opacity-95",
        last && !target && "ring-2 ring-white/80",
      )}
    >
      {free ? (
        <Star className="absolute inset-0 m-auto h-1/2 w-1/2 fill-white/80 text-white/80" />
      ) : (
        <span
          className={clsx(
            "absolute inset-0 flex flex-col items-center justify-center font-bold leading-none",
            isRedSuit(card) ? "text-rose-600" : "text-slate-800",
          )}
        >
          <span className="text-[clamp(7px,1.6vw,14px)]">
            {rankLabel(card)}
          </span>
          <span className="text-[clamp(8px,2vw,18px)]">
            {SUIT_SYMBOL[cardSuit(card)]}
          </span>
        </span>
      )}

      {target && (
        <span
          className={clsx(
            "pointer-events-none absolute inset-0 animate-pulse",
            target === "place" ? "bg-emerald-400/30" : "bg-amber-400/30",
          )}
        />
      )}

      <AnimatePresence>
        {chip && (
          <motion.span
            key={chip}
            initial={{ scale: 0, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className={clsx(
              "absolute inset-[12%] rounded-full",
              chip === "red" ? "chip-red" : "chip-blue",
              locked && "ring-2 ring-amber-300",
              glow && "shadow-[0_0_14px_4px_rgba(252,211,77,0.75)]",
            )}
          >
            {locked && (
              <span className="absolute inset-[32%] rounded-full bg-white/70" />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
});
