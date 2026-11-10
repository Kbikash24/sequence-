import clsx from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2654" />
          <stop offset="1" stopColor="#0a1130" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="url(#lm-bg)"
        stroke="rgba(255,255,255,0.12)"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={10 + i * 7}
          cy={38 - i * 7}
          r="4"
          fill={i % 2 ? "#38bdf8" : "#f43f5e"}
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
        <span className="bg-linear-to-r from-rose-400 to-sky-400 bg-clip-text text-transparent">
          {" "}
          Arena
        </span>
      </span>
    </span>
  );
}
