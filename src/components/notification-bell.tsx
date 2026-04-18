"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

/** Human-friendly age — "now", "5m", "2h", "3d". */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

/**
 * Notification bell — sits in the nav bar. Polls for new notifications on
 * mount and every 60s; shows a dropdown with the last 10. Clicking a row
 * marks it read and navigates to its action_url.
 *
 * Rendering is intentionally self-contained so it can be dropped into both
 * the desktop and mobile drawer variants of the nav.
 */
export default function NotificationBell({ userId, className }: { userId: string; className?: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, read, action_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setNotifications(data as Notification[]);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic — flip locally then persist.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      await supabase.from("notifications").update({ read: true }).eq("id", id);
    },
    []
  );

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unread.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unread);
  }, [notifications]);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-11 h-11 text-white/80 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-nw-danger text-white text-[10px] font-bold rounded-full border border-stone-blue">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-0 sm:right-0 top-14 sm:top-full sm:mt-1 left-0 sm:left-auto mx-2 sm:mx-0 sm:w-[360px] max-h-[70vh] sm:max-h-[520px] overflow-hidden flex flex-col bg-white border border-[rgba(59,88,100,0.15)] shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(59,88,100,0.15)] bg-[rgba(91,134,153,0.06)]/60">
            <p className="text-[11px] tracking-[0.12em] uppercase text-[rgba(59,88,100,0.55)] font-medium">
              Notifications
            </p>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-stone-blue hover:underline underline-offset-2"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-[rgba(59,88,100,0.55)]">No notifications yet</p>
                <p className="mt-1 text-xs text-[rgba(59,88,100,0.55)]/70">
                  You&apos;ll see updates here when invoices and draws move forward.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-brand-row-border">
                {notifications.map((n) => {
                  const inner = (
                    <div
                      className={`px-4 py-3 flex gap-3 hover:bg-[rgba(91,134,153,0.06)]/60 transition-colors ${
                        n.read ? "" : "bg-slate-deep/5"
                      }`}
                    >
                      <span
                        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                          n.read ? "bg-transparent border border-cream-dim/40" : "bg-slate-deep"
                        }`}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-tile font-medium leading-tight">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-[rgba(59,88,100,0.70)] line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-[rgba(59,88,100,0.55)]">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.action_url ? (
                        <Link
                          href={n.action_url}
                          onClick={() => {
                            markRead(n.id);
                            setOpen(false);
                          }}
                          className="block"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          className="w-full text-left"
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
