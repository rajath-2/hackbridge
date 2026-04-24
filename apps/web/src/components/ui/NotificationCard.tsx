import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface NotificationCardProps extends React.HTMLAttributes<HTMLDivElement> {
  type: string;
  message: string;
  meta: string;
  variant?: "broadcast" | "mentor-ping" | "ai"
}

export function NotificationCard({ type, message, meta, variant = "broadcast", className, ...props }: NotificationCardProps) {
  const baseClass = "p-3 mb-2 animate-in fade-in slide-in-from-right-4 duration-300 border-l-2 border bg-[var(--surface-2)] transition-all hover:bg-white/5 pointer-events-auto"
  
  const variants = {
    broadcast: "border-l-[var(--signal-info)] border-[var(--border)]",
    "mentor-ping": "border-l-[var(--signal-ping)] border-[var(--border)]",
    ai: "border-l-[var(--signal-live)] border-[var(--border)]"
  }

  const signalColor = variant === "broadcast" ? "var(--signal-info)" : variant === "mentor-ping" ? "var(--signal-ping)" : "var(--signal-live)"

  return (
    <div className={cn(baseClass, variants[variant], className)} {...props}>
      <div className="flex justify-between items-start gap-3 mb-2">
        <span 
          className="t-micro uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-[2px]"
          style={{ backgroundColor: `rgba(${variant === 'broadcast' ? '99,115,210' : variant === 'mentor-ping' ? '255,184,0' : '0,255,194'}, 0.1)`, color: signalColor }}
        >
          {type}
        </span>
        <span className="t-micro uppercase opacity-50">{meta}</span>
      </div>
      <div className="font-body text-[var(--text-primary)] text-[12px] leading-relaxed">
        {message}
      </div>
    </div>
  )
}
