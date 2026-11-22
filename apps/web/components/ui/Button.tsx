import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "btn-glow relative overflow-hidden text-white hover:-translate-y-0.5 hover:brightness-110 before:absolute before:inset-0 before:-translate-x-full before:bg-linear-to-r before:from-transparent before:via-white/35 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-full",
  secondary:
    "bg-white/8 text-slate-100 ring-1 ring-white/15 backdrop-blur-md hover:-translate-y-0.5 hover:bg-white/14 hover:ring-violet-300/40",
  ghost: "text-slate-300 hover:bg-white/8 hover:text-white",
  danger:
    "bg-linear-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-900/40 hover:-translate-y-0.5 hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center rounded-xl font-semibold transition active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
