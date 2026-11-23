"use client";

import { useEffect, useState } from "react";
import type { HeadToHead, MatchOutcome } from "@sequence/shared";
import { api } from "@/services/api";
import { useSession } from "@/stores/session";

const OUTCOME_STYLE: Record<MatchOutcome, { label: string; color: string }> = {
  win: { label: "Won", color: "text-emerald-400" },
  loss: { label: "Lost", color: "text-red-400" },
  draw: { label: "Draw", color: "text-slate-400" },
};

export function HeadToHeadCard({ userId }: { userId: string }) {
  const token = useSession((s) => s.token);
  const [data, setData] = useState<HeadToHead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .headToHead(token, userId)
      .then((res) => {
        if (!cancelled) setData(res.headToHead);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  return (
    <div className="mt-8 border-t border-white/10 pt-8">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-300">
        You vs {data?.opponent.nickname ?? "this player"}
      </h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && !data && <p className="text-sm text-slate-400">Loading…</p>}
      {data && <Content data={data} />}
    </div>
  );
}

function Content({ data }: { data: HeadToHead }) {
  const { versus, together } = data.summary;
  if (versus.matches + together.matches === 0) {
    return (
      <p className="text-sm text-slate-400">
        You haven&apos;t played any finished games with {data.opponent.nickname} yet.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="Matches vs" value={versus.matches} color="text-violet-400" />
        <Tile label="Your wins" value={versus.wins} color="text-emerald-400" />
        <Tile label="Their wins" value={versus.losses} color="text-red-400" />
        <Tile label="Draws" value={versus.draws} color="text-slate-400" />
      </div>
      {together.matches > 0 && (
        <p className="text-sm text-slate-400">
          As teammates: {together.wins} won of {together.matches}
          {together.matches === 1 ? " game" : " games"}
        </p>
      )}
      <ul className="divide-y divide-white/5">
        {data.recent.map((m) => {
          const style = OUTCOME_STYLE[m.outcome];
          return (
            <li
              key={m.gameId}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className={`font-semibold ${style.color}`}>
                {style.label}
              </span>
              <span className="text-slate-400">
                {m.mode} · {m.relation === "teammate" ? "teammates" : "opponents"}
              </span>
              <span className="text-slate-500">
                {new Date(m.endedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
