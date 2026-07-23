"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  X,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { getNotifIcon, getNotifColor } from "@/lib/notificationService";

export default function NotificationBell({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { user } = useAuthStore();
  const {
    notifications,
    unreadCount,
    loading,
    fetch,
    markRead,
    markAllRead,
    subscribe,
    unsubscribe,
  } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    fetch(user.id);
    if (!subscribedRef.current) {
      subscribe(user.id);
      subscribedRef.current = true;
    }
    return () => {
      unsubscribe();
      subscribedRef.current = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest(".notification-trigger")
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setOpen]);

  const handleNotifClick = async (n: (typeof notifications)[0]) => {
    if (!n.is_read) await markRead(n.id);
    if (n.link) {
      window.location.href = n.link;
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-lg z-50 max-h-[520px] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Bell size={16} />
                <span className="font-semibold text-sm tracking-wide">
                  NOTIFIKASI
                </span>
                {unreadCount > 0 && (
                  <span className="bg-white/20 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                    {unreadCount} baru
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => user?.id && markAllRead(user.id)}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    title="Tandai semua telah dibaca"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto max-h-[400px]">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Memuat...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                  <p className="text-sm font-medium text-slate-400">
                    Belum ada notifikasi
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Notifikasi akan muncul di sini
                  </p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.015 }}
                    onClick={() => handleNotifClick(n)}
                    className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-all hover:bg-slate-50 ${
                      !n.is_read ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${getNotifColor(n.type)}`}
                        style={{ background: !n.is_read ? undefined : "#f1f5f9" }}
                      >
                        {!n.is_read ? (
                          <span className="text-white text-sm">
                            {getNotifIcon(n.type)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">
                            {getNotifIcon(n.type)}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-medium leading-snug ${
                              !n.is_read ? "text-slate-900" : "text-slate-600"
                            }`}
                          >
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-400">
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                              locale: id,
                            })}
                          </p>
                          {n.link && (
                            <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
                              Buka <ChevronRight size={10} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <p className="text-[10px] text-slate-400">
                  {unreadCount > 0
                    ? `${unreadCount} belum dibaca`
                    : "Semua sudah dibaca"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {notifications.length} notifikasi
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
