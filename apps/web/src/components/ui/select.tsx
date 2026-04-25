import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--signal-info)] focus:ring-1 focus:ring-[var(--signal-info)]/30 transition-all duration-200 font-body appearance-none",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Select }
