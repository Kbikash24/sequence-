import clsx from "clsx";
import { Eye, Skull } from "lucide-react";
import {
  SUIT_SYMBOL,
  cardName,
  cardSuit,
  isOneEyedJack,
  isRedSuit,
  isTwoEyedJack,
  rankLabel,
  type CardCode,
} from "@sequence/shared";

interface PlayingCardProps {
  code: CardCode;
  size?: "sm" | "md";
  selected?: boolean;
  dead?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function PlayingCard({
  code,
  size = "md",
  selected,
  dead,
  disabled,
  onClick,
}: PlayingCardProps) {
  const red = isRedSuit(code);
  const suit = SUIT_SYMBOL[cardSuit(code)];
  const twoEyed = isTwoEyedJack(code);
  const oneEyed = isOneEyedJack(code);
  const label = `${cardName(code)}${twoEyed ? " (wild: place anywhere)" : ""}${oneEyed ? " (remove an opponent chip)" : ""}${dead ? " (dead card)" : ""}`;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick
        ? {
            type: "button" as const,
            onClick,
            disabled,
            "aria-pressed": !!selected,
          }
        : { role: "img" })}
      aria-label={label}
      title={label}
      className={clsx(
        "card-face relative flex shrink-0 flex-col justify-between rounded-lg border border-slate-300/70 text-left shadow-md transition",
        size === "sm"
          ? "h-14 w-10 p-1"
          : "h-[5.25rem] w-14 p-1.5 sm:h-24 sm:w-16",
        red ? "text-rose-600" : "text-slate-900",
        onClick && !disabled && "hover:-translate-y-1.5 hover:shadow-xl",
        selected && "-translate-y-3 ring-4 ring-amber-300 shadow-amber-400/40",
        disabled && "opacity-60",
      )}
    >
      <span
        className={clsx(
          "font-bold leading-none",
          size === "sm" ? "text-xs" : "text-sm sm:text-base",
        )}
      >
        {rankLabel(code)}
        <span className="ml-0.5">{suit}</span>
      </span>
      <span
        className={clsx(
          "self-center leading-none",
          size === "sm" ? "text-lg" : "text-2xl sm:text-3xl",
        )}
      >
        {twoEyed || oneEyed ? (
          <span className="flex items-center gap-0.5">
            <Eye className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            {twoEyed && (
              <Eye className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            )}
          </span>
        ) : (
          suit
        )}
      </span>
      {(twoEyed || oneEyed) && size === "md" && (
        <span
          className={clsx(
            "absolute inset-x-1 bottom-1 rounded px-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white",
            twoEyed ? "bg-emerald-600" : "bg-rose-600",
          )}
        >
          {twoEyed ? "Wild" : "Remove"}
        </span>
      )}
      {dead && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-800 text-amber-300 ring-2 ring-navy-900">
          <Skull className="h-3 w-3" />
        </span>
      )}
    </Tag>
  );
}
