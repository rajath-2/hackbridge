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
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em]">
          Live notifications
        </span>
        <div className="flex items-center gap-1.5">
          <LiveDot />
          <span className="text-[11px] text-[var(--hb-green)]">Live</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
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
          <div className="text-[11px] text-[var(--hb-dim)] italic text-center py-4">
            No recent notifications
          </div>
        )}
      </div>
    </div>
  )
}
