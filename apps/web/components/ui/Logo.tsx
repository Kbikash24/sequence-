import clsx from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4c1d95" />
          <stop offset="1" stopColor="#0c0a2a" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="url(#lm-bg)"
        stroke="rgba(196,181,253,0.45)"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={10 + i * 7}
          cy={38 - i * 7}
          r="4"
          fill={i % 2 ? "#22d3ee" : "#fb4a6b"}
        />
      ))}
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark
        className={clsx(
          "drop-shadow-[0_0_10px_rgba(167,139,250,0.55)]",
          size === "lg" ? "h-12 w-12" : size === "md" ? "h-9 w-9" : "h-7 w-7",
        )}
      />
      <span
        className={clsx(
          "font-display font-extrabold tracking-tight",
          size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-base",
        )}
      >
        Sequence
        <span className="text-gradient"> Arena</span>
      </span>
    </span>
  );
}
