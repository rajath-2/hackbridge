import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number | React.ReactNode;
  sub: string;
  variant?: "live" | "alert" | "ping" | "info" | "default";
}

export function StatCard({ label, value, sub, variant = "default", className, ...props }: StatCardProps) {
  const variantColors = {
    live: "text-[var(--signal-live)]",
    alert: "text-[var(--signal-alert)]",
    ping: "text-[var(--signal-ping)]",
    info: "text-[var(--signal-info)]",
    default: "text-[var(--text-primary)]",
  }

  const borderColors = {
    live: "border-t-[var(--signal-live)]",
    alert: "border-t-[var(--signal-alert)]",
    ping: "border-t-[var(--signal-ping)]",
    info: "border-t-[var(--signal-info)]",
    default: "border-t-[var(--border)]",
  }

  return (
    <div 
      className={cn(
        "bg-[var(--surface-1)] border border-[var(--border)] border-t-[2px] rounded-[2px] p-[20px_24px] hover:bg-white/5 transition-all duration-150 group shadow-[0_4px_20px_rgba(0,0,0,0.1)]",
        borderColors[variant],
        className
      )} 
      {...props}
    >
      <div className="t-micro uppercase opacity-50 mb-2 tracking-[0.2em] group-hover:opacity-100 transition-opacity">
        {label}
      </div>
      <div className={cn("t-stat mb-1 tracking-tighter", variantColors[variant])}>
        {value}
      </div>
      <div className="t-micro uppercase opacity-30 mt-2 font-bold">
        {sub}
      </div>
    </div>
  )
}
