"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, LogIn, Plus, Swords, Trophy, UserRound } from "lucide-react";
import {
  GAME_MODES,
  roomCodeSchema,
  type GameMode,
  type UserStatsDTO,
} from "@sequence/shared";
import { NicknameForm } from "@/components/NicknameForm";
import { Button } from "@/components/ui/Button";
import { useMounted } from "@/hooks/useClient";
import { api, ApiError } from "@/services/api";
import { closeSocket, getSocket, request } from "@/services/socket";
import { useSession } from "@/stores/session";

export function EntryPanel() {
  const mounted = useMounted();
  const router = useRouter();
  const { token, user, clear } = useSession();
  const [mode, setMode] = useState<GameMode>("1v1");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "quick" | "create" | "join">(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStatsDTO | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .stats(token)
      .then((r) => setStats(r.stats))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          closeSocket();
          clear();
        }
      });
  }, [token, clear]);

  const createRoom = async (m: GameMode, kind: "quick" | "create") => {
    if (!token) return;
    setBusy(kind);
    setError(null);
    const res = await request(getSocket(token), "room:create", { mode: m });
    if (res.ok) {
      router.push(`/room/${res.data.room.code}`);
      return;
    }
    if (res.code === "IN_GAME" && res.details?.code) {
      router.push(`/room/${res.details.code}`);
      return;
    }
    setError(res.error);
    setBusy(null);
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError("Enter a 6-character room code");
      return;
    }
    setBusy("join");
    router.push(`/room/${parsed.data}`);
  };

  if (!mounted) return <div className="glass h-72 animate-pulse rounded-3xl" />;

  if (!user || !token) {
    return (
      <div className="glass rounded-3xl p-6 sm:p-7">
        <h2 className="mb-1 font-display text-xl font-bold">
          Jump in as a guest
        </h2>
        <p className="mb-5 text-sm text-slate-400">
          No account needed. Pick a name and start a room in seconds.
        </p>
        <NicknameForm cta="Play now" />
      </div>
    );
  }

  return (
    <div className="glass space-y-5 rounded-3xl p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <UserRound className="h-4 w-4" /> Playing as{" "}
          <strong className="text-white">{user.nickname}</strong>
        </p>
        <button
          type="button"
          className="text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline"
          onClick={() => {
            closeSocket();
            clear();
          }}
        >
          Change
        </button>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!!busy}
        onClick={() => void createRoom("1v1", "quick")}
      >
        {busy === "quick" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Swords className="h-5 w-5" />
        )}{" "}
        Play now · 1v1
      </Button>

      <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
        <p className="mb-3 text-sm font-semibold">Create a private room</p>
        <div className="flex gap-2">
          <div
            role="radiogroup"
            aria-label="Game mode"
            className="flex flex-1 rounded-xl bg-white/5 p-1"
          >
            {GAME_MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={clsx(
                  "flex-1 rounded-lg py-2 text-sm font-semibold transition",
                  mode === m
                    ? "bg-white/15 text-white"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            disabled={!!busy}
            onClick={() => void createRoom(mode, "create")}
          >
            {busy === "create" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}{" "}
            Create
          </Button>
        </div>
      </div>

      <form
        onSubmit={join}
        className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8"
      >
        <label htmlFor="room-code" className="mb-3 block text-sm font-semibold">
          Join with a code
        </label>
        <div className="flex gap-2">
          <input
            id="room-code"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 6),
              )
            }
            placeholder="ABC123"
            autoComplete="off"
            inputMode="text"
            className="h-11 min-w-0 flex-1 rounded-xl bg-white/6 px-4 font-mono text-lg tracking-[0.3em] ring-1 ring-white/12 placeholder:tracking-[0.3em] placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={!!busy || code.length !== 6}
          >
            <LogIn className="h-4 w-4" /> Join
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      {stats && stats.gamesPlayed > 0 && (
        <div className="flex items-center justify-around rounded-2xl bg-white/[0.03] py-3 text-center text-sm ring-1 ring-white/8">
          <Stat label="Played" value={stats.gamesPlayed} />
          <Stat label="Wins" value={stats.wins} icon />
          <Stat label="Sequences" value={stats.sequencesCompleted} />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: boolean;
}) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 font-display text-xl font-bold">
        {icon && <Trophy className="h-4 w-4 text-amber-300" />}
        {value}
      </p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
