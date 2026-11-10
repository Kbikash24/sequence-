"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { BOARD_LAYOUT, FREE_CELL } from "@sequence/game-engine";
import {
  SUIT_SYMBOL,
  cardSuit,
  isRedSuit,
  rankLabel,
  type Team,
} from "@sequence/shared";

// A scripted rally that ends with red completing a diagonal sequence.
const SCRIPT: [number, Team][] = [
  [22, "red"],
  [45, "blue"],
  [33, "red"],
  [46, "blue"],
  [11, "red"],
  [47, "blue"],
  [55, "red"],
  [48, "blue"],
  [44, "red"],
];
const SEQUENCE = new Set([11, 22, 33, 44, 55]);

export function BoardPreview() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => (s >= SCRIPT.length + 4 ? 0 : s + 1)),
      700,
    );
    return () => clearInterval(id);
  }, []);

  const chips = new Map(SCRIPT.slice(0, step));
  const complete = step >= SCRIPT.length;

  return (
    <div className="relative" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-linear-to-br from-rose-500/30 via-fuchsia-500/20 to-sky-500/30 blur-3xl" />
      <div className="relative grid aspect-square w-full grid-cols-10 gap-1 rounded-3xl bg-navy-800/90 p-2.5 shadow-2xl ring-1 ring-white/10">
        {BOARD_LAYOUT.map((card, cell) => {
          const chip = chips.get(cell);
          return (
            <div
              key={cell}
              className={
                card === FREE_CELL
                  ? "relative rounded-md bg-linear-to-br from-amber-300 via-fuchsia-400 to-sky-400"
                  : "card-face relative grid place-items-center rounded-md"
              }
            >
              {card !== FREE_CELL && (
                <span
                  className={`text-[clamp(6px,1.1vw,12px)] font-bold leading-none ${isRedSuit(card) ? "text-rose-600" : "text-slate-800"}`}
                >
                  {rankLabel(card)}
                  {SUIT_SYMBOL[cardSuit(card)]}
                </span>
              )}
              <AnimatePresence>
                {chip && (
                  <motion.span
                    initial={{ scale: 0, y: -12, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={`absolute inset-[12%] rounded-full ${chip === "red" ? "chip-red" : "chip-blue"} ${
                      complete && SEQUENCE.has(cell)
                        ? "ring-2 ring-amber-300 shadow-[0_0_14px_4px_rgba(252,211,77,0.7)]"
                        : ""
                    }`}
                  />
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
