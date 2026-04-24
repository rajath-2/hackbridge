import * as React from "react"
import { LiveDot } from "../ui/LiveDot"
import { NotificationCard } from "../ui/NotificationCard"

export interface NotificationFeedProps {
  notifications: Array<{
    id: string;
    type: string;
    message: string;
    meta: string;
    variant?: "broadcast" | "mentor-ping" | "ai";
  }>;
}

export function NotificationFeed({ notifications }: NotificationFeedProps) {
  return (
    <div className="flex flex-col gap-1 w-full px-6">
      <div className="flex items-center justify-between mb-3">
        <span className="font-ui text-[9px] text-[var(--text-muted)] uppercase tracking-[0.2em]">
          Live telemetry
        </span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--signal-live)] dot-live"></div>
          <span className="font-ui text-[9px] text-[var(--signal-live)] uppercase tracking-widest font-bold">UPLINK_LIVE</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto pr-1 custom-scrollbar">
        {notifications.map((notif) => (
          <NotificationCard 
            key={notif.id}
            type={notif.type}
            message={notif.message}
            meta={notif.meta}
            variant={notif.variant}
          />
        ))}
        {notifications.length === 0 && (
          <div className="font-body text-[11px] text-[var(--text-muted)] italic text-center py-8 border border-dashed border-[var(--border)] rounded-[3px]">
            No signals detected
          </div>
        )}
      </div>
    </div>
  )
}
