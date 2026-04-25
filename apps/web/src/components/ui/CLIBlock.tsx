import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface CLIBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  prompt: string;
  successMessage?: string;
  lines?: string[];
}

export function CLIBlock({ prompt, successMessage, lines = [], className, ...props }: CLIBlockProps) {
  return (
    <div className={cn("bg-[var(--void)] border border-[var(--border)] rounded-[4px] p-4 font-display text-[12px] text-[var(--text-secondary)] mb-4", className)} {...props}>
      <div className="flex gap-2">
        <span className="text-[var(--signal-live)] font-bold">$ </span>
        <span className="text-[var(--text-primary)]">{prompt}</span>
      </div>
      {successMessage && (
        <div className="text-[var(--signal-clean)] mt-1.5 font-bold">✓ {successMessage}</div>
      )}
      {lines.map((line, i) => (
        <div key={i} className="text-[var(--text-muted)] mt-1 ml-4 border-l-2 border-[var(--border)] pl-3">{line}</div>
      ))}
    </div>
  )
}
