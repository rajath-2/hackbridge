"use client"

import * as React from "react"
import type { Notification } from "@/hooks/useNotifications"
import { cn } from "@/components/ui/NotificationCard"

/** A local-only toast entry for immediate organizer feedback (not a DB notification) */
export interface LocalToast {
  id: string
  type: "send_success" | "send_error"
  message: string
  created_at: string
}

function ProgressBar({ durationMs }: { durationMs: number }) {
  const [width, setWidth] = React.useState(100)
  React.useEffect(() => {
    const start = Date.now()
    const raf = () => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100)
      setWidth(remaining)
      if (remaining > 0) requestAnimationFrame(raf)
    }
    const id = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(id)
  }, [durationMs])
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-[10px]">
      <div
        className="h-full bg-[var(--signal-live)] opacity-40 transition-none"
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function LocalToastItem({
  toast,
  onDismiss,
  autoHideMs,
}: {
  toast: LocalToast
  onDismiss: () => void
  autoHideMs: number
}) {
  const isSuccess = toast.type === "send_success"
  React.useEffect(() => {
    const t = window.setTimeout(onDismiss, autoHideMs)
    return () => window.clearTimeout(t)
  }, [autoHideMs, onDismiss])

  return (
    <div
      className={cn(
        "pointer-events-auto relative rounded-[10px] border backdrop-blur overflow-hidden",
        "shadow-[0_10px_30px_rgba(0,0,0,0.45)] animate-hb-slide-in",
        isSuccess
          ? "border-[var(--border)] bg-[rgba(6,18,12,0.95)]"
          : "border-[rgba(220,50,50,0.3)] bg-[rgba(18,6,6,0.95)]"
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={cn(
            "mt-[3px] h-2 w-2 flex-shrink-0 rounded-full",
            isSuccess
              ? "bg-[var(--signal-clean)] shadow-[0_0_10px_rgba(110,231,160,0.7)]"
              : "bg-[var(--signal-alert)] shadow-[0_0_10px_rgba(220,50,50,0.7)]"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div
              className={cn(
                "text-[10px] uppercase tracking-[0.12em] font-semibold",
                isSuccess ? "text-[var(--signal-clean)]" : "text-[var(--signal-alert)]"
              )}
            >
              {isSuccess ? "✓ Broadcast Sent" : "✗ Send Failed"}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-primary)] break-words leading-relaxed">
            {toast.message}
          </div>
          <div className="mt-1 text-[10px] text-[var(--text-muted)]">
            {new Date(toast.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>
      </div>
      <ProgressBar durationMs={autoHideMs} />
    </div>
  )
}

export function BroadcastToastStack({
  notifications,
  localToasts = [],
  onDismissLocal,
  maxVisible = 3,
  autoHideMs = 12000,
  localAutoHideMs = 4000,
}: {
  notifications: Notification[]
  localToasts?: LocalToast[]
  onDismissLocal?: (id: string) => void
  maxVisible?: number
  autoHideMs?: number
  localAutoHideMs?: number
}) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set())

  const broadcasts = React.useMemo(() => {
    return notifications
      .filter((n) => n.type === "broadcast")
      .filter((n) => !dismissed.has(n.id))
      .slice(0, maxVisible)
  }, [notifications, dismissed, maxVisible])

  React.useEffect(() => {
    if (!autoHideMs || broadcasts.length === 0) return
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

  const hasContent = broadcasts.length > 0 || localToasts.length > 0
  if (!hasContent) return null

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none">
      <div className="flex flex-col gap-2">
        {/* Local feedback toasts (send success / error) — shown first */}
        {localToasts.map((lt) => (
          <LocalToastItem
            key={lt.id}
            toast={lt}
            onDismiss={() => onDismissLocal?.(lt.id)}
            autoHideMs={localAutoHideMs}
          />
        ))}

        {/* Realtime broadcast toasts */}
        {broadcasts.map((b) => (
          <div
            key={b.id}
            className={cn(
              "pointer-events-auto relative rounded-[10px] border border-[var(--border)] bg-[rgba(8,12,22,0.92)] backdrop-blur overflow-hidden",
              "shadow-[0_10px_30px_rgba(0,0,0,0.45)] animate-hb-slide-in"
            )}
          >
            <div className="flex items-start gap-3 p-3">
              <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--signal-live)] shadow-[0_0_12px_rgba(56,189,248,0.6)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--signal-live)] font-semibold">
                    📢 Broadcast
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
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label="Dismiss broadcast"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-1 text-[12px] font-medium text-[var(--text-primary)] break-words leading-relaxed">
                  {b.message}
                </div>
                <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                  {new Date(b.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
            <ProgressBar durationMs={autoHideMs} />
          </div>
        ))}
      </div>
    </div>
  )
}
