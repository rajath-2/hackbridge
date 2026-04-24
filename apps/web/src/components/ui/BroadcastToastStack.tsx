"use client"

import * as React from "react"
import type { Notification } from "@/hooks/useNotifications"
import { cn } from "@/components/ui/NotificationCard"

export function BroadcastToastStack({
  notifications,
  maxVisible = 2,
  autoHideMs = 12000,
}: {
  notifications: Notification[]
  maxVisible?: number
  autoHideMs?: number
}) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set())

  const broadcasts = React.useMemo(() => {
    return notifications
      .filter((n) => n.type === "broadcast")
      .filter((n) => !dismissed.has(n.id))
      .slice(0, maxVisible)
  }, [notifications, dismissed, maxVisible])

  React.useEffect(() => {
    if (!autoHideMs) return
    if (broadcasts.length === 0) return

    const timers = broadcasts.map((b) =>
      window.setTimeout(() => {
        setDismissed((prev) => {
          const next = new Set(prev)
          next.add(b.id)
          return next
        })
      }, autoHideMs)
    )

    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [broadcasts, autoHideMs])

  if (broadcasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none">
      <div className="flex flex-col gap-2">
        {broadcasts.map((b) => (
          <div
            key={b.id}
            className={cn(
              "pointer-events-auto rounded-[10px] border border-[var(--hb-border)] bg-[rgba(8,12,22,0.92)] backdrop-blur",
              "shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
            )}
          >
            <div className="flex items-start gap-3 p-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-[var(--hb-cyan)] shadow-[0_0_12px_rgba(56,189,248,0.6)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--hb-cyan)]">
                    Broadcast
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDismissed((prev) => {
                        const next = new Set(prev)
                        next.add(b.id)
                        return next
                      })
                    }
                    className="text-[10px] text-[var(--hb-dim)] hover:text-[var(--hb-text)]"
                    aria-label="Dismiss broadcast"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="mt-1 text-[12px] font-medium text-[var(--hb-text)] break-words">
                  {b.message}
                </div>
                <div className="mt-1 text-[10px] text-[var(--hb-dim)]">
                  {new Date(b.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

