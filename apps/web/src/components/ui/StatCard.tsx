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
}

export function StatCard({ label, value, sub, className, ...props }: StatCardProps) {
  return (
    <div className={cn("bg-[var(--hb-surface2)] border border-[var(--hb-border)] rounded-[8px] p-2.5 px-3", className)} {...props}>
      <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.07em] mb-1">
        {label}
      </div>
      <div className="text-[20px] font-semibold leading-none text-[var(--hb-text)]">
        {value}
      </div>
      <div className="text-[10px] text-[var(--hb-muted)] mt-0.5">{sub}</div>
    </div>
  )
}
