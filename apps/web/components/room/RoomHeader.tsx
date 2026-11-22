"use client";

import Link from "next/link";
import { LogOut, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

interface RoomHeaderProps {
  code: string;
  connection?: string;
  onLeave?: () => void;
  /** `bar` spans the page top; `panel` is a stacked card for a sidebar. */
  variant?: "bar" | "panel";
}

function ConnectionStatus({ connection }: { connection: string }) {
  const ok = connection === "connected";
  return (
    <span
      className="flex items-center gap-1 text-xs text-slate-400"
      aria-live="polite"
      title={ok ? "Connected" : "Reconnecting"}
    >
      {ok ? (
        <>
          <Wifi className="h-4 w-4 text-emerald-400" /> Connected
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-amber-300" /> Reconnecting…
        </>
      )}
    </span>
  );
}

export function RoomHeader({
  code,
  connection,
  onLeave,
  variant = "bar",
}: RoomHeaderProps) {
  if (variant === "panel") {
    return (
      <header className="glass space-y-3 rounded-2xl p-3">
        <Link href="/" aria-label="Sequence Arena home" className="block">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-lg bg-white/5 px-2.5 py-1 font-mono text-sm tracking-widest text-slate-300">
            {code}
          </span>
          {connection && <ConnectionStatus connection={connection} />}
        </div>
        {onLeave && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={onLeave}
            aria-label="Leave room"
          >
            <LogOut className="h-4 w-4" /> Leave
          </Button>
        )}
      </header>
    );
  }

  return (
    <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-3">
      <Link href="/" aria-label="Sequence Arena home">
        <Logo size="sm" />
      </Link>
      <div className="flex items-center gap-2">
        <span className="hidden rounded-lg bg-white/5 px-2.5 py-1 font-mono text-sm tracking-widest text-slate-300 sm:inline">
          {code}
        </span>
        {connection && <ConnectionStatus connection={connection} />}
        {onLeave && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onLeave}
            aria-label="Leave room"
          >
            <LogOut className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">Leave</span>
          </Button>
        )}
      </div>
    </header>
  );
}
