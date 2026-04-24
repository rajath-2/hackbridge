import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "indigo" | "cyan" | "amber" | "green" | "red"
}

function Badge({ className, variant = "indigo", ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
  
  const variants = {
    indigo: "bg-[var(--hb-indigo-dim)] text-[#A5ADEE] border-[var(--hb-indigo-glow)]",
    cyan: "bg-[var(--hb-cyan-dim)] text-[#7DD3F8] border-[rgba(56,189,248,0.25)]",
    amber: "bg-[var(--hb-amber-dim)] text-[#F0C060] border-[rgba(232,160,32,0.28)]",
    green: "bg-[var(--hb-green-dim)] text-[#6EE7A0] border-[rgba(34,197,94,0.28)]",
    red: "bg-[var(--hb-red-dim)] text-[#F9A0A0] border-[rgba(240,76,76,0.28)]",
  }

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  )
}

export { Badge }
