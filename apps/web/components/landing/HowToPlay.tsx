import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { ICON_PATHS } from "@/lib/icons";

const STEPS = [
  {
    icon: ICON_PATHS.ace,
    title: "Play a card",
    body: "On your turn, play a card from your hand and place a chip on one of the two matching spaces. You then draw a replacement.",
  },
  {
    icon: ICON_PATHS.jackOfSpades,
    title: "Use the jacks",
    body: "Two-eyed jacks are wild: place a chip on any open space. One-eyed jacks remove an opponent chip — but never one inside a finished sequence.",
  },
  {
    icon: ICON_PATHS.threeDots,
    title: "Build sequences",
    body: "Five chips in a row — across, down or diagonally — form a sequence. The star corners count for everyone.",
  },
  {
    icon: ICON_PATHS.trophy,
    title: "Win with two",
    body: "First team to two sequences wins. Two sequences may share at most one chip. Holding a dead card? Swap it once per turn.",
  },
];

export function HowToPlay() {
  return (
    <section id="how-to-play" className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <Reveal>
        <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">
          How to <span className="text-gradient">play</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-300">
          Learn in a minute, master over many matches. Play 1v1 or team up 2v2.
        </p>
      </Reveal>
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: iconPath, title, body }, i) => (
          <li key={title}>
            <Reveal delay={i * 0.1} className="h-full">
              <div className="glass glass-hover h-full rounded-2xl p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="relative h-11 w-11 rounded-xl bg-linear-to-br from-rose-500/40 via-violet-500/40 to-cyan-400/40 shadow-[0_0_20px_-4px_rgba(167,139,250,0.7)] ring-1 ring-white/20 overflow-hidden">
                    <Image
                      src={iconPath}
                      alt={title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="font-mono text-sm text-violet-300/70">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {body}
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
