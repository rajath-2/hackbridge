import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ScoreBarProps extends React.HTMLAttributes<HTMLDivElement> {
  criterion: string;
  score: number;
}

export function ScoreBar({ criterion, score, className, ...props }: ScoreBarProps) {
  return (
    <div className={cn("flex items-center gap-2 mb-1.5", className)} {...props}>
      <span className="text-[11px] text-[var(--hb-muted)] w-24 flex-shrink-0">
        {criterion}
      </span>
      <div className="flex-1 h-[5px] rounded-full bg-[rgba(99,115,210,0.12)]">
        <div 
          className="h-[5px] rounded-full score-bar"
          style={{ 
            width: `${(score / 10) * 100}%`,
            background: 'linear-gradient(90deg, var(--hb-indigo) 0%, var(--hb-cyan) 100%)'
          }} 
        />
      </div>
      <span className="text-[11px] text-[var(--hb-text)] w-7 text-right flex-shrink-0">
        {score}
      </span>
    </div>
  )
}
