"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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

  return (
    <nav className="bg-[var(--surface-1)] border-b border-[var(--border)] px-6 h-[64px] flex items-center justify-between relative z-20 w-full shrink-0">
      <div className="flex items-center gap-10 h-full">
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => router.push("/dashboard")}>
          <span className="font-display text-[18px] font-bold tracking-tight text-[var(--text-primary)] uppercase">
            HACK<span className="text-[var(--signal-live)]">BRIDGE</span>
          </span>
        </div>
        
        <div className="flex items-center gap-8 h-full">
          {/* Event Dropdown or Code */}
          <div className="h-full flex items-center">
            {eventDropdown ? eventDropdown : (eventCode && (
              <div className="font-ui text-[11px] text-[var(--signal-live)] border border-[var(--signal-live)]/30 bg-[var(--signal-live)]/5 px-2.5 py-1 rounded-[3px] uppercase tracking-tight font-medium">
                {eventCode}
              </div>
            ))}
          </div>

          {/* Live Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--signal-live)] dot-live shadow-[0_0_8px_rgba(0,255,194,0.4)]"></div>
            <span className="font-ui text-[10px] text-[var(--signal-live)] uppercase tracking-[0.12em] font-medium">LIVE</span>
          </div>

          {/* Role Badge */}
          <div className="h-full flex items-center">
             <div className="px-3 py-1 border border-[var(--border-hot)] rounded-[4px] font-ui text-[11px] text-[var(--text-primary)] uppercase tracking-wider">
                SECTOR: {role}
             </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSignOut}
          className="font-ui text-[10px] text-[var(--text-muted)] hover:text-[var(--signal-alert)] uppercase tracking-[0.15em] border-none bg-transparent h-auto p-0"
        >
          TERMINATE_SESSION
        </Button>
      </div>
    </nav>
  )
}