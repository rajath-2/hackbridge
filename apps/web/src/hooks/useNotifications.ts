import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export type Notification = {
  id: string;
  message: string;
  type: "broadcast" | "mentor_ping" | "idle_warning" | "match_suggestion";
  created_at: string;
  sender_id: string;
  recipient_id?: string;
  team_id?: string;
};

export function useNotifications(eventId: string, userId: string, role: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!eventId || !userId) return;

    const fetchExisting = async () => {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (role === "mentor") {
        query = query.or(`type.eq.broadcast,recipient_id.eq.${userId}`);
      } else if (role === "participant") {
        query = query.or(`type.eq.broadcast,recipient_id.eq.${userId},type.eq.idle_warning`);
      } else {
        query = query.eq("type", "broadcast");
      }
      
      const { data } = await query;
      if (data) setNotifications(data);
    };
    
    fetchExisting();

    const channel = supabase
      .channel(`notifications:${eventId}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const notif = payload.new as Notification;
          // Filtering logic based on role
          if (notif.type === "broadcast") {
            setNotifications((prev) => [notif, ...prev]);
          } else if (notif.recipient_id === userId) {
            setNotifications((prev) => [notif, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, userId, role, supabase]);

  return notifications;
}
