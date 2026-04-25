import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--signal-info)] focus:ring-1 focus:ring-[var(--signal-info)]/30 transition-all duration-200 font-body",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
