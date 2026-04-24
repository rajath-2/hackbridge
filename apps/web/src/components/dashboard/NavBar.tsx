"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "../ui/badge"
import { LiveDot } from "../ui/LiveDot"
import { Button } from "../ui/button"

export interface NavBarProps {
  eventCode?: string;
  eventDropdown?: React.ReactNode;
  role: "organizer" | "participant" | "mentor" | "judge";
}

export function NavBar({ eventCode, eventDropdown, role }: NavBarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const roleBadgeVariants = {
    organizer: "indigo" as const,
    participant: "green" as const,
    mentor: "amber" as const,
    judge: "cyan" as const,
  }

  return (
    <div className="bg-[var(--surface-1)] border-b border-[var(--border)] px-6 h-[64px] flex items-center justify-between relative z-20 w-full shrink-0">
      <div className="flex items-center gap-10">
        <span className="font-display text-[18px] font-bold tracking-tight text-[var(--text-primary)]">
          HACK<span className="text-[var(--signal-live)]">BRIDGE</span>
        </span>
        <div className="flex items-center gap-4">
          {eventDropdown ? eventDropdown : (eventCode && (
            <div className="font-ui text-[11px] text-[var(--signal-info)] border border-[rgba(58,158,191,0.3)] bg-[rgba(58,158,191,0.05)] px-2 py-0.5 rounded-[3px] uppercase tracking-widest font-bold">
              {eventCode}
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--signal-live)] dot-live"></div>
            <span className="font-ui text-[10px] text-[var(--signal-live)] uppercase tracking-[0.12em] font-bold">LIVE</span>
          </div>
          <div className="font-ui text-[10px] text-[var(--text-muted)] uppercase tracking-widest border-l border-[var(--border)] pl-4">
            SECTOR: {role.toUpperCase()}
          </div>
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleSignOut}
        className="font-ui text-[10px] text-[var(--text-muted)] hover:text-[var(--signal-alert)] uppercase tracking-widest border-none bg-transparent"
      >
        TERMINATE_SESSION
      </Button>
    </div>
  )
}