import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "base" | "elevated" | "danger" | "ai"
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "base", ...props }, ref) => {
    const variants = {
      base: "bg-[var(--hb-surface2)] border border-[var(--hb-border)] rounded-[10px] p-4",
      elevated: "bg-[var(--hb-surface2)] border border-[var(--hb-border2)] rounded-[10px] p-4",
      danger: "bg-[var(--hb-surface2)] border border-l-[2.5px] border-[var(--hb-border)] border-l-[var(--hb-red)] rounded-[8px] p-3",
      ai: "bg-[var(--hb-indigo-dim)] border border-[rgba(79,98,216,0.2)] rounded-[7px] p-2.5 text-[#A5ADEE] text-[11px] italic"
    }

    return (
      <div
        ref={ref}
        className={cn(variants[variant], className)}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

export { Card }
