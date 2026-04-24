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
  const baseClass = "p-2.5 px-3 rounded-[8px] mb-1.5 animate-notif-in border-l-[2.5px]"
  
  const variants = {
    broadcast: "border-[var(--hb-cyan)] bg-[rgba(56,189,248,0.06)]",
    "mentor-ping": "border-[var(--hb-amber)] bg-[rgba(232,160,32,0.07)]",
    ai: "border-[var(--hb-indigo-bright)] bg-[rgba(79,98,216,0.09)]"
  }

  const badgeVariant = variant === "broadcast" ? "cyan" : variant === "mentor-ping" ? "amber" : "indigo"

  return (
    <div className={cn(baseClass, variants[variant], className)} {...props}>
      <div className="flex justify-between items-center">
        <span className="font-medium text-[var(--hb-text)] text-[12px]">{message}</span>
        <Badge variant={badgeVariant}>{type}</Badge>
      </div>
      <div className="text-[10px] text-[var(--hb-dim)] mt-[3px]">{meta}</div>
    </div>
  )
}
