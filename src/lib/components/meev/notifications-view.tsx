"use client";

// MEEV — Notification center: unified feed with real-time pushes,
// mark-all-read, kind icons and deep links.

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { api } from "./api";
import { MeevLogo } from "./logo";
import { timeAgo } from "./chat-shared";
import type { NotificationDTO } from "./types";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, Heart, UserPlus, MessageCircle, Gift, TrendingUp, ShieldAlert, Sparkles, Moon } from "lucide-react";

const KIND_META: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  friend_request: { icon: UserPlus, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  follow: { icon: UserPlus, color: "text-sky-400", bg: "bg-sky-500/10" },
  comment: { icon: MessageCircle, color: "text-rose-400", bg: "bg-rose-500/10" },
  like: { icon: Heart, color: "text-rose-400", bg: "bg-rose-500/10" },
  gift: { icon: Gift, color: "text-amber-400", bg: "bg-amber-500/10" },
  level_up: { icon: TrendingUp, color: "text-orange-400", bg: "bg-orange-400/10" },
  moderation: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
  system: { icon: Sparkles, color: "text-primary", bg: "bg-primary/10" },
  match: { icon: Sparkles, color: "text-primary", bg: "bg-primary/10" },
};

export function NotificationsView() {
  const { L } = useI18n();
  const notifications = useMeev((s) => s.notifications);
  const unread = useMeev((s) => s.unread);
  const markAllRead = useMeev((s) => s.markAllRead);
  const openDm = useMeev((s) => s.openDm);
  const openProfile = useMeev((s) => s.openProfile);

  useEffect(() => {
    api.notifications().then((r) => useMeev.getState().setNotifications(r.notifications, r.unread)).catch(() => {});
  }, []);

  const markRead = async () => {
    markAllRead();
    try {
      await api.readNotifications();
    } catch { /* offline */ }
  };

  const deepLink = (n: NotificationDTO) => {
    const data = (n.data || {}) as Record<string, string>;
    if (data.username) openProfile(data.username);
    else if (data.userId) openProfile("me");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24 md:pb-8">
        <div className="flex items-center gap-3">
          <Bell className="size-6 text-primary" />
          <h1 className="text-xl font-black tracking-tight">{L("الإشعارات", "Notifications")}</h1>
          {unread > 0 && (
            <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-400">
              {unread} new
            </span>
          )}
          <Button size="sm" variant="outline" className="ml-auto rounded-xl h-8 text-xs gap-1.5" onClick={markRead} disabled={unread === 0}>
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>

        {notifications.length === 0 && (
          <div className="glass rounded-3xl p-10 text-center space-y-3">
            <MeevLogo size={70} mood="sleepy" className="mx-auto" />
            <div className="font-semibold flex items-center justify-center gap-1.5">
              <Moon className="size-4 text-amber-400" aria-hidden="true" /> All quiet
            </div>
            <div className="text-sm text-muted-foreground">New likes, comments, gifts and friend requests will land here.</div>
          </div>
        )}

        <div className="space-y-2">
          {notifications.map((n, i) => {
            const meta = KIND_META[n.kind] || KIND_META.system;
            return (
              <motion.button
                key={n.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => deepLink(n)}
                className={cn(
                  "w-full text-left glass rounded-2xl p-3.5 flex items-start gap-3 transition-colors hover:border-primary/30",
                  !n.read && "border-primary/25 bg-primary/[0.06]"
                )}
              >
                <span className={cn("size-10 shrink-0 grid place-items-center rounded-xl", meta.bg)}>
                  <meta.icon className={cn("size-5", meta.color)} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.createdAt)} ago</div>
                </div>
                {!n.read && <span className="size-2 rounded-full bg-primary shrink-0 mt-2" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
