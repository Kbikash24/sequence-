"use client";

import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { isDeadCard } from "@sequence/game-engine";
import type { Card, Team } from "@sequence/shared";
import { Button } from "@/components/ui/Button";
import { PlayingCard } from "./PlayingCard";

interface HandProps {
  cards: Card[];
  chips: (Team | null)[];
  selectedId: string | null;
  canAct: boolean;
  canExchange: boolean;
  onSelect: (id: string | null) => void;
  onExchange: (id: string) => void;
}

export function Hand({
  cards,
  chips,
  selectedId,
  canAct,
  canExchange,
  onSelect,
  onExchange,
}: HandProps) {
  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const selectedDead = selected ? isDeadCard(chips, selected.code) : false;

  return (
    <section aria-label="Your hand" className="glass rounded-2xl p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Your hand
        </h2>
        {selected && selectedDead && canAct && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canExchange}
            onClick={() => onExchange(selected.id)}
          >
            <RefreshCw className="h-4 w-4" />
            {canExchange ? "Exchange dead card" : "Already exchanged"}
          </Button>
        )}
      </div>
      <ul className="flex flex-wrap justify-center gap-1.5 pt-3 sm:gap-2.5">
        {cards.map((card, i) => (
          <motion.li
            key={card.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <PlayingCard
              code={card.code}
              selected={card.id === selectedId}
              dead={isDeadCard(chips, card.code)}
              disabled={!canAct}
              onClick={() => onSelect(card.id === selectedId ? null : card.id)}
            />
          </motion.li>
        ))}
      </ul>
      {!canAct && (
        <p className="mt-2 text-center text-xs text-slate-400">
          Waiting for your turn…
        </p>
      )}
    </section>
  );
}
