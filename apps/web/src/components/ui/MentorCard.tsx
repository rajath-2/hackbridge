import * as React from "react"
import { MentorRequestButton } from "../dashboard/MentorRequestButton"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface MentorCardProps extends React.HTMLAttributes<HTMLDivElement> {
  teamId: string;
  name: string;
  initials: string;
  matchPct: number;
  tags: string[];
}

export function MentorCard({ teamId, name, initials, matchPct, tags, className, ...props }: MentorCardProps) {
  return (
    <div className={cn("bg-[var(--hb-surface2)] border border-[var(--hb-border2)] rounded-[8px] p-2.5 flex items-center gap-2.5 mb-2", className)} {...props}>
      <div className="w-[34px] h-[34px] rounded-full bg-[var(--hb-indigo-dim)] border border-[var(--hb-indigo)] flex items-center justify-center text-[12px] font-semibold text-[#A5ADEE] flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[var(--hb-text)]">{name}</div>
        <div className="text-[11px] text-[var(--hb-indigo-bright)]">{matchPct}% match</div>
        <div className="flex gap-1 mt-1 flex-wrap">
          {tags.map((tag, i) => (
            <span key={i} className="bg-white/[0.04] border border-[var(--hb-border2)] rounded px-1.5 py-[1px] text-[10px] text-[var(--hb-muted)]">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <MentorRequestButton teamId={teamId} className="w-auto px-4" />
    </div>
  )
}
