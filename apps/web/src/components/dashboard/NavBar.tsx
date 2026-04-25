"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "../ui/button"

export interface NavBarProps {
  eventCode?: string;
  eventName?: string;
  eventDropdown?: React.ReactNode;
  role: "organizer" | "participant" | "mentor" | "judge";
}

export function NavBar({ eventCode, eventName, eventDropdown, role }: NavBarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <nav className="bg-[var(--surface-1)] border-b border-[var(--border)] px-6 h-[64px] flex items-center justify-between relative z-20 w-full shrink-0">
      <div className="flex items-center gap-6 h-full">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/")}>
          <span className="font-display text-[18px] font-bold tracking-tight text-[var(--text-primary)] uppercase">
            HACK<span className="text-[var(--signal-live)]">BRIDGE</span>
          </span>
          {eventName && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px]">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--signal-live)] dot-live"></div>
              <span className="font-ui text-[10px] text-[var(--text-primary)] uppercase tracking-widest font-bold truncate max-w-[180px]">{eventName}</span>
            </div>
          )}
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
          variant="danger" 
          size="sm" 
          onClick={handleSignOut}
          className="h-[36px] px-4 font-ui text-[11px] font-bold tracking-widest"
        >
          TERMINATE_SESSION
        </Button>
      </div>
    </nav>
  )
}
