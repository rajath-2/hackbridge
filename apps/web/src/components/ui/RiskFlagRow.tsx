import * as React from "react"
import { Badge } from "./badge"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface RiskFlagRowProps extends React.HTMLAttributes<HTMLDivElement> {
  teamName: string;
  evidence: string;
  riskLevel: 'High' | 'Medium' | 'Clean';
}

export function RiskFlagRow({ teamName, evidence, riskLevel, className, ...props }: RiskFlagRowProps) {
  return (
    <div className={cn("flex items-center justify-between px-2.5 py-1.5 bg-[var(--hb-surface2)] rounded-[6px] mb-1.5 border border-[var(--hb-border)]", className)} {...props}>
      <div>
        <div className="text-[11px] font-medium text-[var(--hb-text)]">{teamName}</div>
        <div className="text-[10px] text-[var(--hb-muted)]">{evidence}</div>
      </div>
      <Badge variant={riskLevel === 'High' ? 'red' : riskLevel === 'Medium' ? 'amber' : 'green'}>
        {riskLevel}
      </Badge>
    </div>
  )
}
