import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export interface StoreNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string;
  data?: any;
  created_at: string;
}

interface NotificationState {
  notifications: StoreNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  channel: any | null;

  fetch: (userId: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  subscribe: (userId: string) => void;
  unsubscribe: () => void;
  addNotification: (n: StoreNotification) => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  channel: null,

  fetch: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const notifs = (data || []) as StoreNotification[];
      set({
        notifications: notifs,
        unreadCount: notifs.filter((n) => !n.is_read).length,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  markRead: async (id: string) => {
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  markAllRead: async (userId: string) => {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
  },

  subscribe: (userId: string) => {
    const { channel: oldChan } = get();
    if (oldChan) {
      const supabase = createClient();
      supabase.removeChannel(oldChan);
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const newNotif = payload.new as StoreNotification;
          set((s) => ({
            notifications: [newNotif, ...s.notifications],
            unreadCount: s.unreadCount + 1,
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const updated = payload.new as StoreNotification;
          set((s) => ({
            notifications: s.notifications.map((n) =>
              n.id === updated.id ? updated : n,
            ),
            unreadCount: s.notifications.filter((n) =>
              n.id === updated.id ? !updated.is_read : !n.is_read
            ).length,
          }));
        },
      )
      .subscribe();

    set({ channel });
  },

  unsubscribe: () => {
    const { channel } = get();
    if (channel) {
      const supabase = createClient();
      supabase.removeChannel(channel);
      set({ channel: null });
    }
  },

  addNotification: (n: StoreNotification) => {
    set((s) => ({
      notifications: [n, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }));
  },
}));
