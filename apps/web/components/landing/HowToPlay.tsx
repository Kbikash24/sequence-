import { Eye, Layers, Star, Trophy } from "lucide-react";

const STEPS = [
  {
    icon: Layers,
    title: "Play a card",
    body: "On your turn, play a card from your hand and place a chip on one of the two matching spaces. You then draw a replacement.",
  },
  {
    icon: Eye,
    title: "Use the jacks",
    body: "Two-eyed jacks are wild: place a chip on any open space. One-eyed jacks remove an opponent chip — but never one inside a finished sequence.",
  },
  {
    icon: Star,
    title: "Build sequences",
    body: "Five chips in a row — across, down or diagonally — form a sequence. The star corners count for everyone.",
  },
  {
    icon: Trophy,
    title: "Win with two",
    body: "First team to two sequences wins. Two sequences may share at most one chip. Holding a dead card? Swap it once per turn.",
  },
];

export function HowToPlay() {
  return (
    <section id="how-to-play" className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">
        How to play
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
        Learn in a minute, master over many matches. Play 1v1 or team up 2v2.
      </p>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="glass rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br from-rose-500/30 to-sky-500/30 ring-1 ring-white/10">
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-mono text-sm text-slate-500">0{i + 1}</span>
            </div>
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
