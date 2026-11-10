import clsx from "clsx";
import type { Team } from "@sequence/shared";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  team,
  size = "md",
  dimmed,
}: {
  name: string;
  team: Team;
  size?: "sm" | "md";
  dimmed?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-grid shrink-0 place-items-center rounded-full font-bold text-white ring-2",
        size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm",
        team === "red"
          ? "bg-linear-to-br from-rose-400 to-rose-700 ring-rose-300/40"
          : "bg-linear-to-br from-sky-400 to-sky-700 ring-sky-300/40",
        dimmed && "opacity-40 grayscale",
      )}
    >
      {initials(name)}
    </span>
  );
}
