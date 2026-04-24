import * as React from "react"
import { Badge } from "./badge"
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
  const baseClass = "p-3 rounded-[3px] mb-2 animate-notif-in border-l-2 border bg-[var(--surface-2)] transition-all hover:border-[var(--border-hot)] pointer-events-auto"
  
  const variants = {
    broadcast: "border-l-[var(--signal-info)] border-[var(--border)]",
    "mentor-ping": "border-l-[var(--signal-ping)] border-[var(--border)]",
    ai: "border-l-[var(--signal-live)] border-[var(--border)]"
  }

  const badgeVariant = variant === "broadcast" ? "indigo" : variant === "mentor-ping" ? "amber" : "green"

  return (
    <div className={cn(baseClass, variants[variant], className)} {...props}>
      <div className="flex justify-between items-start gap-3">
        <span className="font-body text-[var(--text-primary)] text-[12px] leading-tight flex-1">{message}</span>
        <Badge variant={badgeVariant} className="flex-shrink-0">{type}</Badge>
      </div>
      <div className="font-ui text-[9px] text-[var(--text-muted)] mt-2 uppercase tracking-widest">{meta}</div>
    </div>
  )
}
