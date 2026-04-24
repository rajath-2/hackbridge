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
    <div className={cn("bg-[#050710] border border-[rgba(99,115,210,0.18)] rounded-[8px] p-2.5 px-3 font-mono text-[11px] text-[#A5ADEE] mb-2", className)} {...props}>
      <div>
        <span className="text-[var(--hb-indigo-bright)]">$ </span>
        <span>{prompt}</span>
      </div>
      {successMessage && (
        <div className="text-[#6EE7A0] mt-1">✓ {successMessage}</div>
      )}
      {lines.map((line, i) => (
        <div key={i} className="text-[var(--hb-muted)] mt-[3px]">{line}</div>
      ))}
    </div>
  )
}
