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
  const baseStyles = "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-bold border uppercase tracking-widest font-ui"
  
  const variants = {
    indigo: "bg-[rgba(58,158,191,0.12)] text-[var(--signal-info)] border-[rgba(58,158,191,0.4)]",
    cyan: "bg-[rgba(58,158,191,0.12)] text-[var(--signal-info)] border-[rgba(58,158,191,0.4)]",
    amber: "bg-[rgba(255,184,0,0.12)] text-[var(--signal-ping)] border-[rgba(255,184,0,0.4)]",
    green: "bg-[rgba(46,204,113,0.12)] text-[var(--signal-clean)] border-[rgba(46,204,113,0.4)]",
    red: "bg-[rgba(255,45,85,0.12)] text-[var(--signal-alert)] border-[rgba(255,45,85,0.4)]",
  }

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  )
}

export { Badge }
