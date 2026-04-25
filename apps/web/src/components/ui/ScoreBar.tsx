import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ScoreBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  criterion: string;
  score: number;
  maxScore?: number;
  onChange?: (newScore: number) => void;
}

export function ScoreBar({ criterion, score, maxScore = 10, onChange, className, ...props }: ScoreBarProps) {
  return (
    <div className={cn("flex items-center gap-2 mb-1.5 group", className)} {...props}>
      <span className="text-[11px] text-[var(--hb-muted)] w-24 flex-shrink-0">
        {criterion}
      </span>
      <div className="flex-1 relative h-[5px] rounded-full bg-[rgba(99,115,210,0.12)]">
        <div 
          className="absolute top-0 left-0 h-[5px] rounded-full score-bar pointer-events-none"
          style={{ 
            width: `${(score / maxScore) * 100}%`,
            background: 'linear-gradient(90deg, var(--hb-indigo, var(--signal-info)) 0%, var(--hb-cyan, var(--signal-live)) 100%)'
          }} 
        />
        {onChange && (
          <input
            type="range"
            min="0"
            max={maxScore}
            value={score}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute top-0 left-0 w-full h-[5px] opacity-0 cursor-pointer"
          />
        )}
      </div>
      <span className="text-[11px] text-[var(--text-primary)] w-7 text-right flex-shrink-0 font-bold">
        {score}
      </span>
    </div>
  )
}
