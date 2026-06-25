import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  titre: string;
  message: string;
  data: Record<string, unknown>;
  lue: boolean;
  lien?: string;
  created_at: string;
}

export function useNotifications(userId: string | undefined): {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // Track IDs dismissed via the ✕ button so Realtime UPDATE doesn't re-add them
  const dismissedRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    // Re-fetch filters out already-dismissed rows
    dismissedRef.current = new Set();
    setNotifications(data ?? []);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev].slice(0, 50));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as Notification;
          // Don't re-show rows the user already dismissed via ✕
          if (dismissedRef.current.has(updated.id)) return;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, lue: updated.lue } : n))
          );
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // Mark read but keep the row visible (used when clicking the row to navigate)
  const markRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ lue: true })
      .eq('id', id)
      .eq('user_id', userId ?? '');
    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lue: true } : n))
      );
    }
  }, [userId]);

  // Mark read AND remove from the list (used by the ✕ dismiss button)
  const dismiss = useCallback(async (id: string) => {
    dismissedRef.current.add(id);
    // Optimistic removal first for instant feedback
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await supabase
      .from('notifications')
      .update({ lue: true })
      .eq('id', id)
      .eq('user_id', userId ?? '');
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('notifications')
      .update({ lue: true })
      .eq('user_id', userId)
      .eq('lue', false);
    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, lue: true })));
    }
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.lue).length;

  return { notifications, unreadCount, markRead, dismiss, markAllRead, refresh };
}
