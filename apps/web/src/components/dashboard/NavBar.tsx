import * as React from "react"
import { Badge } from "../ui/badge"
import { LiveDot } from "../ui/LiveDot"

export interface NavBarProps {
  eventCode: string;
  role: "organizer" | "participant" | "mentor" | "judge";
}

export function NavBar({ eventCode, role }: NavBarProps) {
  const roleBadgeVariants = {
    organizer: "indigo" as const,
    participant: "green" as const,
    mentor: "amber" as const,
    judge: "cyan" as const,
  }

  return (
    <div className="bg-[var(--hb-surface)] border-b border-[var(--hb-border)] px-4 py-0 h-12 flex items-center justify-between sticky top-0 z-50 w-full">
      <span className="text-[13px] font-bold tracking-[-0.03em] text-[var(--hb-text)]">
        Hack<span className="text-[var(--hb-indigo-bright)]">Bridge</span>
      </span>
      <div className="flex items-center gap-2">
        <Badge variant="indigo">{eventCode}</Badge>
        <Badge variant={roleBadgeVariants[role]}>{role.charAt(0).toUpperCase() + role.slice(1)}</Badge>
        <LiveDot />
        <span className="text-[11px] text-[var(--hb-green)]">Live</span>
      </div>
    </div>
  )
}
