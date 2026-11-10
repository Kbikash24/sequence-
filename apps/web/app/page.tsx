import Link from "next/link";
import { Radio, ShieldCheck, Users } from "lucide-react";
import { BoardPreview } from "@/components/landing/BoardPreview";
import { EntryPanel } from "@/components/landing/EntryPanel";
import { HowToPlay } from "@/components/landing/HowToPlay";
import { Logo } from "@/components/ui/Logo";

const FEATURES = [
  { icon: Users, label: "1v1 & 2v2 teams" },
  { icon: Radio, label: "Real-time play" },
  { icon: ShieldCheck, label: "Server-verified moves" },
];

export default function HomePage() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <Link
          href="#how-to-play"
          className="text-sm font-medium text-slate-300 hover:text-white"
        >
          How to play
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-14">
        <div className="space-y-7">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-300 ring-1 ring-white/10">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />{" "}
              Multiplayer card strategy
            </p>
            <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Five in a row.
              <br />
              <span className="bg-linear-to-r from-rose-400 via-fuchsia-400 to-sky-400 bg-clip-text text-transparent">
                Outplay your friends.
              </span>
            </h1>
            <p className="max-w-lg text-lg text-slate-300">
              Play cards, claim spaces and build sequences on a 10×10 board.
              Create a private room, share the code, and play live from any
              device.
            </p>
          </div>
          <EntryPanel />
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-300" /> {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <BoardPreview />
        </div>
      </section>

      <HowToPlay />

      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        Sequence Arena · An original fan-made take on classic five-in-a-row card
        games.
      </footer>
    </main>
  );
}
