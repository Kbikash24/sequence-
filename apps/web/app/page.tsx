"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Radio, ShieldCheck, Users } from "lucide-react";
import { BoardPreview } from "@/components/landing/BoardPreview";
import { EntryPanel } from "@/components/landing/EntryPanel";
import { OnlinePlayers } from "@/components/landing/OnlinePlayers";
import { FriendsPanel } from "@/components/landing/FriendsPanel";
import { HowToPlay } from "@/components/landing/HowToPlay";
import { Logo } from "@/components/ui/Logo";
import { useSession } from "@/stores/session";

const FEATURES = [
  { icon: Users, label: "1v1 & 2v2 teams" },
  { icon: Radio, label: "Real-time play" },
  { icon: ShieldCheck, label: "Server-verified moves" },
];

function RightColumnContent() {
  const user = useSession((s) => s.user);

  return (
    <div
      className="reveal space-y-7 relative mx-auto w-full max-w-md lg:max-w-none"
      style={{ "--d": "0.35s" } as CSSProperties}
    >
      <div className="relative">
        <FloatingCard
          symbol="♠"
          rank="A"
          className="-left-4 -top-6 sm:-left-8"
          style={{ "--r": "-12deg" } as CSSProperties}
        />
        <FloatingCard
          symbol="♥"
          rank="K"
          red
          className="-right-3 top-1/3 sm:-right-8"
          style={{ "--r": "10deg", animationDelay: "1.2s" } as CSSProperties}
        />
        <FloatingCard
          symbol="♦"
          rank="Q"
          red
          className="-bottom-6 left-6"
          style={{ "--r": "-6deg", animationDelay: "2.4s" } as CSSProperties}
        />
        <BoardPreview />
      </div>
      {user && <OnlinePlayers selfId={user.id} />}
      {user && <FriendsPanel />}
    </div>
  );
}

export default function HomePage() {
  const user = useSession((s) => s.user);

  return (
    <main>
      <header className="reveal mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex items-center gap-3">
          <Link
            href="#how-to-play"
            className="glass glass-hover rounded-full px-4 py-1.5 text-sm font-medium text-slate-200 hover:text-white"
          >
            How to play
          </Link>
          {user && (
            <Link
              href="/settings"
              className="glass glass-hover rounded-full px-4 py-1.5 text-sm font-medium text-slate-200 hover:text-white"
              title="Profile Settings"
            >
              ⚙️ Settings
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div className="space-y-7">
          <div className="space-y-4">
            <p
              className="reveal glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-200"
              style={{ "--d": "0.1s" } as CSSProperties}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.8)]" />{" "}
              Multiplayer card strategy
            </p>
            <h1
              className="reveal font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl"
              style={{ "--d": "0.2s" } as CSSProperties}
            >
              Five in a row.
              <br />
              <span className="text-gradient">Outplay your friends.</span>
            </h1>
            <p
              className="reveal text-lg text-slate-300"
              style={{ "--d": "0.3s" } as CSSProperties}
            >
              Play cards, claim spaces and build sequences on a 10×10 board.
              Create a private room, share the code, and play live from any
              device.
            </p>
          </div>
          <div className="reveal" style={{ "--d": "0.4s" } as CSSProperties}>
            <EntryPanel />
          </div>
          <ul
            className="reveal flex flex-wrap gap-2.5 text-sm text-slate-300"
            style={{ "--d": "0.5s" } as CSSProperties}
          >
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="glass flex items-center gap-2 rounded-full px-3.5 py-1.5"
              >
                <Icon className="h-4 w-4 text-violet-300" /> {label}
              </li>
            ))}
          </ul>
        </div>
        <RightColumnContent />
      </section>

      <HowToPlay />

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-400">
        Sequence Arena · An original fan-made take on classic five-in-a-row card
        games.
        <p className="mt-2 font-medium text-slate-300">
          Developed by <span className="text-gradient">BIKASH K</span>
        </p>
      </footer>
    </main>
  );
}

function FloatingCard({
  symbol,
  rank,
  red,
  className,
  style,
}: {
  symbol: string;
  rank: string;
  red?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`animate-float card-face absolute z-10 hidden h-20 w-14 flex-col justify-between rounded-xl p-2 text-lg font-black shadow-2xl shadow-violet-950/60 ring-1 ring-white/60 sm:flex ${red ? "text-rose-600" : "text-slate-900"} ${className ?? ""}`}
    >
      <span className="leading-none">{rank}</span>
      <span className="self-center text-3xl leading-none">{symbol}</span>
    </div>
  );
}
