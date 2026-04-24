import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface CommitFeedItemProps extends React.HTMLAttributes<HTMLDivElement> {
  hash: string;
  message: string;
  aiSummary: string;
  teamName?: string;
}

export function CommitFeedItem({ hash, message, aiSummary, teamName, className, ...props }: CommitFeedItemProps) {
  return (
    <div className={cn("flex items-start gap-2 py-1.5 border-b border-[var(--hb-border)] animate-notif-in", className)} {...props}>
      <div className="flex flex-col gap-1 flex-shrink-0 items-start">
        <span className="font-mono text-[10px] text-[var(--hb-indigo-bright)] bg-[var(--hb-indigo-dim)] px-1.5 py-[1px] rounded mt-[1px]">
          {hash.slice(0, 6)}
        </span>
        {teamName && (
          <span className="text-[9px] text-[var(--hb-dim)] uppercase tracking-wider bg-[var(--hb-surface3)] px-1 rounded">
            {teamName}
          </span>
        )}
      </div>
      <div>
        <div className="text-[11px] text-[var(--hb-text)] leading-snug">{message}</div>
        <div className="text-[10px] text-[var(--hb-muted)] mt-0.5 italic">{aiSummary}</div>
      </div>
    </div>
  )
}
