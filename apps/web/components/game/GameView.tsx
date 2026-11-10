"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { Activity, MessageSquare } from "lucide-react";
import { getCardTargets } from "@sequence/game-engine";
import {
  isOneEyedJack,
  isTwoEyedJack,
  type GameAction,
} from "@sequence/shared";
import type { RoomActions } from "@/hooks/useRoom";
import { useGameStore } from "@/stores/game";
import { Board } from "./Board";
import { Hand } from "./Hand";
import { DeckInfo, PlayerList, TeamScore, TurnTimer } from "./Panels";
import { ActivityLog, ChatPanel } from "./Sidebar";

export function GameView({
  meId,
  actions,
}: {
  meId: string;
  actions: RoomActions;
}) {
  const game = useGameStore((s) => s.game)!;
  const room = useGameStore((s) => s.room)!;
  const hand = useGameStore((s) => s.hand);
  const chat = useGameStore((s) => s.chat);
  const log = useGameStore((s) => s.log);
  const disconnects = useGameStore((s) => s.disconnects);
  const clockOffset = useGameStore((s) => s.clockOffset);
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const selectCard = useGameStore((s) => s.selectCard);
  const [tab, setTab] = useState<"chat" | "log">("log");
  const [pending, setPending] = useState(false);

  const me = game.players.find((p) => p.userId === meId) ?? null;
  const current = game.players[game.currentSeat]!;
  const myTurn = game.status === "playing" && current.userId === meId;
  const selected = hand.find((c) => c.id === selectedCardId) ?? null;
  const removeMode = selected ? isOneEyedJack(selected.code) : false;

  // Highlights only; the server re-validates every move.
  const targets = useMemo(() => {
    if (!myTurn || !selected || !me) return new Set<number>();
    return new Set(
      getCardTargets(game.chips, game.sequences, selected.code, me.team),
    );
  }, [myTurn, selected, me, game.chips, game.sequences]);

  const send = async (action: GameAction) => {
    if (pending) return;
    setPending(true);
    try {
      await actions.play(action);
    } finally {
      setPending(false);
    }
  };

  const onCellClick = (cell: number) => {
    if (!selected) return;
    void send({
      type: removeMode ? "remove" : "place",
      cardId: selected.id,
      cell,
    });
  };

  const hint = !myTurn
    ? `${current.nickname}'s turn`
    : !selected
      ? "Your turn — pick a card"
      : removeMode
        ? "Pick an opponent chip to remove"
        : isTwoEyedJack(selected.code)
          ? "Wild jack — place anywhere open"
          : targets.size === 0
            ? "No open spot for this card"
            : "Pick a highlighted spot";

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-3 px-2 pb-6 sm:px-4 lg:grid-cols-[17rem_minmax(0,1fr)_19rem]">
      <aside className="order-2 space-y-3 lg:order-1">
        <section className="glass space-y-3 rounded-2xl p-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Sequences · first to {game.sequencesToWin}
          </h2>
          <TeamScore game={game} myTeam={me?.team ?? null} />
        </section>
        <section className="glass rounded-2xl p-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Players
          </h2>
          <PlayerList
            game={game}
            hostId={room.hostId}
            meId={meId}
            disconnects={disconnects}
            clockOffset={clockOffset}
          />
        </section>
        <section className="glass rounded-2xl p-3">
          <DeckInfo game={game} />
        </section>
      </aside>

      <main className="order-1 flex flex-col gap-3 lg:order-2">
        <div
          className={clsx(
            "glass flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5",
            myTurn && "ring-2 ring-amber-300/60",
          )}
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "h-3 w-3 rounded-full",
                current.team === "red" ? "chip-red" : "chip-blue",
                game.status === "playing" && "animate-pulse",
              )}
            />
            <p className="font-display font-semibold">
              {game.status === "playing" ? hint : "Game over"}
            </p>
          </div>
          {game.status === "playing" && (
            <TurnTimer
              deadline={game.turnDeadline}
              offset={clockOffset}
              total={game.turnDurationMs ?? 60_000}
            />
          )}
        </div>
        <div className="mx-auto w-full lg:max-w-[calc(100dvh-17rem)]">
          <Board
            chips={game.chips}
            sequences={game.sequences}
            targets={targets}
            targetMode={removeMode ? "remove" : "place"}
            lastCell={game.lastAction?.cell ?? null}
            highlightSequences={game.status === "finished"}
            onCellClick={myTurn && !pending ? onCellClick : undefined}
          />
        </div>
        {me && (
          <Hand
            cards={hand}
            chips={game.chips}
            selectedId={selectedCardId}
            canAct={myTurn && !pending}
            canExchange={!game.deadCardExchanged}
            onSelect={selectCard}
            onExchange={(cardId) => void send({ type: "exchangeDead", cardId })}
          />
        )}
      </main>

      <aside className="glass order-3 flex h-[26rem] min-h-0 flex-col rounded-2xl p-3 lg:h-[calc(100dvh-6rem)]">
        <div
          role="tablist"
          className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1"
        >
          {(
            [
              ["log", "Activity", Activity],
              ["chat", "Chat", MessageSquare],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx(
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition",
                tab === id
                  ? "bg-white/12 text-white"
                  : "text-slate-400 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1">
          {tab === "chat" ? (
            <ChatPanel messages={chat} meId={meId} onSend={actions.chat} />
          ) : (
            <ActivityLog entries={log} />
          )}
        </div>
      </aside>
    </div>
  );
}
