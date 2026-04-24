import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type LiveDotProps = React.HTMLAttributes<HTMLDivElement>;

function LiveDot({ className, ...props }: LiveDotProps) {
  return (
    <div 
      className={cn("w-1.5 h-1.5 rounded-full bg-[var(--hb-green)] flex-shrink-0 animate-hb-pulse", className)} 
      {...props} 
    />
  )
}

export { LiveDot }
