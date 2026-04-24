import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type TimelineStatus = 'done' | 'active' | 'pending';

export interface TimelineItem {
  status: TimelineStatus;
  label: string;
  time: string;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[];
}

export function Timeline({ items, className, ...props }: TimelineProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2.5 relative">
          {i < items.length - 1 && (
            <div className="absolute left-[3.5px] top-[11px] bottom-[-6px] w-px bg-[var(--hb-border)]" />
          )}
          <div className={cn(
            "w-2 h-2 rounded-full mt-[3px] flex-shrink-0",
            item.status === 'done' ? 'bg-[var(--hb-green)]' :
            item.status === 'active' ? 'bg-[var(--hb-cyan)] shadow-[0_0_7px_rgba(56,189,248,0.5)]' :
            'border border-[var(--hb-border2)] bg-transparent'
          )} />
          <div>
            <div className={cn(
              "text-[11px] font-medium",
              item.status === 'done' ? 'text-[var(--hb-muted)]' :
              item.status === 'active' ? 'text-[var(--hb-text)]' :
              'text-[var(--hb-dim)]'
            )}>
              {item.label}
            </div>
            <div className={cn(
              "text-[10px]",
              item.status === 'active' ? 'text-[var(--hb-cyan)]' : 'text-[var(--hb-dim)]'
            )}>
              {item.time}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
