import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "primary" | "secondary" | "ghost" | "danger" | "mentor-request"
  size?: "sm" | "md"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const baseStyles = "inline-flex items-center justify-center gap-1.5 font-bold rounded-[4px] transition-all duration-200 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal-info)] disabled:pointer-events-none disabled:opacity-50 uppercase tracking-wider"
    
    const variants = {
      primary: "bg-[var(--signal-live)] text-[var(--void)] border-transparent hover:brightness-110 active:scale-[0.98] shadow-[0_4px_14px_rgba(0,255,194,0.3)]",
      secondary: "bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--signal-live)] hover:bg-[var(--surface-2)]/50",
      ghost: "bg-transparent text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/10",
      danger: "bg-[var(--signal-alert)] text-[var(--void)] border-transparent hover:brightness-110 active:scale-[0.98] shadow-[0_4px_14px_rgba(255,45,85,0.3)]",
      "mentor-request": "w-full bg-[var(--signal-ping)]/20 border-[var(--signal-ping)]/50 text-[var(--signal-ping)] hover:bg-[var(--signal-ping)]/30",
    }
    
    const sizes = {
      md: "px-3.5 py-1.5 text-[13px]",
      sm: "px-2.5 py-1 text-[11px]",
    }

    // Special sizing for mentor-request to match design
    const finalSize = variant === "mentor-request" ? "py-2 text-[12px]" : sizes[size];

    return (
      <Comp
        className={cn(baseStyles, variants[variant], finalSize, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
