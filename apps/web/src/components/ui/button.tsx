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
    
    const baseStyles = "inline-flex items-center justify-center gap-1.5 font-medium rounded-[7px] transition-all duration-150 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hb-indigo)] disabled:pointer-events-none disabled:opacity-50"
    
    const variants = {
      primary: "bg-[var(--hb-indigo)] text-white hover:bg-[var(--hb-indigo-bright)] border-transparent",
      secondary: "bg-[var(--hb-indigo-dim)] text-[#A5ADEE] border-[var(--hb-indigo-glow)] hover:bg-[rgba(79,98,216,0.18)]",
      ghost: "bg-transparent text-[var(--hb-muted)] border-[var(--hb-border2)] hover:bg-[var(--hb-surface3)] hover:text-[var(--hb-text)]",
      danger: "bg-[var(--hb-red-dim)] text-[#F9A0A0] border-[rgba(240,76,76,0.28)] hover:bg-[rgba(240,76,76,0.18)]",
      "mentor-request": "w-full bg-[var(--hb-amber-dim)] border-[rgba(232,160,32,0.28)] text-[#F0C060] hover:bg-[rgba(232,160,32,0.2)]",
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
