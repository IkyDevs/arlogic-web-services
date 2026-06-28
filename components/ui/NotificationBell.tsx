'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, X, Package, Star, AlertCircle, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

const typeIcon = (type: string) => {
  switch (type) {
    case 'service_status': return <Package size={14} />;
    case 'qc_approved': return <Check size={14} />;
    case 'qc_rejected': return <X size={14} />;
    case 'feedback': return <Star size={14} />;
    case 'new_service': return <AlertCircle size={14} />;
    default: return <Info size={14} />;
  }
};

const typeBg = (type: string, isRead: boolean) => {
  if (isRead) return 'bg-slate-50';
  switch (type) {
    case 'service_status': return 'bg-blue-50';
    case 'qc_approved': return 'bg-emerald-50';
    case 'qc_rejected': return 'bg-red-50';
    case 'feedback': return 'bg-amber-50';
    case 'new_service': return 'bg-blue-50';
    default: return 'bg-slate-50';
  }
};

export default function NotificationBell() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();

    // Real-time subscription
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        setUnread(prev => prev + 1);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const notifs = data || [];
    setNotifications(notifs);
    setUnread(notifs.filter(n => !n.is_read).length);
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleBellClick = () => {
    setOpen(prev => !prev);
    if (!open) fetchNotifications();
  };

return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleBellClick}
        className="relative p-2 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 hover:shadow-sm transition-all duration-200"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center px-0.5 rounded-full"
          >
            {unread > 99 ? '99+' : unread}
          </motion.span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-sm z-50 max-h-[480px] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-200 bg-blue-50">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-blue-600" />
                <span className="font-semibold text-sm">NOTIFICATIONS</span>
                {unread > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="p-1 border border-slate-200 bg-white hover:bg-slate-50 rounded transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 border border-slate-200 bg-white hover:bg-slate-50 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-sm text-slate-500">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm text-slate-500">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif, i) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => !notif.is_read && markAsRead(notif.id)}
                    className={`p-3 border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors ${typeBg(notif.type, notif.is_read)}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 border border-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5 ${notif.is_read ? 'bg-slate-100' : 'bg-blue-600 text-white'}`}>
                        {typeIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm font-medium truncate ${notif.is_read ? 'text-slate-600' : 'text-slate-900'}`}>
                            {notif.title}
                          </p>
                          {!notif.is_read && (
                            <div className="w-2 h-2 bg-blue-600 flex-shrink-0 rounded-full" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-slate-200 bg-slate-50">
                <p className="text-center text-[10px] text-slate-500">
                  Showing last {notifications.length} notifications
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
