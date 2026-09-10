"use client";

// ============================================================
// MEEV v3 — NotifPanel: a small, beautiful Facebook-style
// notifications window (glass popover on the TopBar bell).
// Live-updates via the notif:new socket event, marks-read on
// click, and links out to the full page.
// ============================================================

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "./api";
import { meevSocket } from "./socket";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import type { NotificationDTO } from "./types";
import { Bell, Check, Inbox, ArrowLeft, Handshake, User, MessageCircle, Heart, Dices, ShieldAlert } from "lucide-react";
import { BoltMark, GiftMark } from "./symbols";
import { cn } from "@/lib/utils";

// v12: kind glyphs are crisp vector symbols (lucide + Meev marks), not emoji
const KIND_STYLE: Record<string, { icon: ReactNode; color: string; bg: string }> = {
  gift: { icon: <GiftMark size={18} />, color: "#ffc24d", bg: "rgba(255,194,77,.12)" },
  friend_request: { icon: <Handshake size={18} strokeWidth={2.1} />, color: "#22c55e", bg: "rgba(34,197,94,.12)" },
  follow: { icon: <User size={18} strokeWidth={2.1} />, color: "#0ea5e9", bg: "rgba(14,165,233,.12)" },
  comment: { icon: <MessageCircle size={18} strokeWidth={2.1} />, color: "#f04a6e", bg: "rgba(240,74,110,.12)" },
  like: { icon: <Heart size={18} strokeWidth={2.1} className="fill-current" />, color: "#f43f5e", bg: "rgba(244,63,94,.12)" },
  level_up: { icon: <BoltMark size={18} />, color: "#eab308", bg: "rgba(234,179,8,.14)" },
  match: { icon: <Dices size={18} strokeWidth={2.1} />, color: "#ff7e5f", bg: "rgba(255,126,95,.12)" },
  moderation: { icon: <ShieldAlert size={18} strokeWidth={2.1} />, color: "#ef4444", bg: "rgba(239,68,68,.12)" },
  system: { icon: <Bell size={18} strokeWidth={2.1} />, color: "#64748b", bg: "rgba(100,116,139,.14)" },
};

function kindStyle(kind: string) {
  return KIND_STYLE[kind] ?? KIND_STYLE.system;
}

function shortTime(iso: string, L: (a: string, e: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return L("الآن", "now");
  if (m < 60) return L(`قبل ${m} د`, `${m}m`);
  const h = Math.floor(m / 60);
  if (h < 24) return L(`قبل ${h} س`, `${h}h`);
  const d = Math.floor(h / 24);
  if (d < 7) return L(`قبل ${d} ي`, `${d}d`);
  return new Date(iso).toLocaleDateString();
}

export function NotifBell() {
  const { L } = useI18n();
  const unread = useMeev((s) => s.unread);
  const setView = useMeev((s) => s.setView);
  const setNotifications = useMeev((s) => s.setNotifications);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDTO[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.notifications();
      setItems(r.notifications);
      setNotifications(r.notifications, r.unread);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [setNotifications]);

  // fetch on open
  useEffect(() => {
    if (open && items === null) load();
  }, [open, items, load]);

  // live prepend while open
  useEffect(() => {
    if (!open) return;
    return meevSocket.on("notif:new", () => {
      load();
    });
  }, [open, load]);

  const markOne = async (n: NotificationDTO) => {
    if (n.read) return;
    try {
      const r = await api.readNotifications([n.id]);
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
      setNotifications(items ?? [], r.unread);
      // keep the store unread in sync via the response
      useMeev.setState({ unread: r.unread });
    } catch { /* offline */ }
  };

  const markAll = async () => {
    try {
      const r = await api.readNotifications();
      setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? prev);
      useMeev.setState({ unread: r.unread });
    } catch { /* offline */ }
  };

  const visible = (items ?? []).slice(0, 15);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative size-9 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label={L("الإشعارات", "Notifications")}
          title={L("الإشعارات", "Notifications")}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute top-1 end-1 min-w-[16px] h-4 px-0.5 grid place-items-center rounded-full bg-rose-500 text-[9px] font-bold text-white animate-pulse">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={10}
        className="w-[min(92vw,360px)] p-0 rounded-2xl glass border-border/60 shadow-2xl meev-pop overflow-hidden"
      >
        {/* header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/50">
          <span className="flex items-center gap-2 text-sm font-extrabold">
            {L("الإشعارات", "Notifications")}
            {unread > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full bg-rose-500/15 text-rose-400 text-[11px] font-bold tabular-nums">
                {unread}
              </span>
            )}
          </span>
          <button
            onClick={markAll}
            disabled={unread === 0}
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="size-3.5" /> {L("علّم الكل كمقروء", "Mark all read")}
          </button>
        </div>

        {/* list */}
        <div className="max-h-[380px] overflow-y-auto meev-scroll">
          {loading && items === null ? (
            <div className="px-3.5 py-8 grid place-items-center text-muted-foreground text-sm">
              <span className="size-5 rounded-full border-2 border-border border-t-primary animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="px-3.5 py-10 flex flex-col items-center gap-2 text-muted-foreground">
              <Inbox className="size-8 opacity-40" />
              <span className="text-sm">{L("ما وصلك شيء بعد… ابدأ محادثة!", "Nothing yet… start chatting!")}</span>
            </div>
          ) : (
            visible.map((n) => {
              const st = kindStyle(n.kind);
              return (
                <button
                  key={n.id}
                  onClick={() => markOne(n)}
                  className={cn(
                    "w-full flex items-start gap-3 px-3.5 py-2.5 text-start border-b border-border/25 last:border-0 transition-colors hover:bg-white/[.04]",
                    !n.read && "bg-primary/[.06]"
                  )}
                >
                  <span
                    className="shrink-0 size-9 grid place-items-center rounded-xl"
                    style={{ background: st.bg, color: st.color, boxShadow: `inset 0 0 0 1px ${st.color}33` }}
                    aria-hidden="true"
                  >
                    {st.icon}
                  </span>
                  <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <span className="text-[13px] font-bold leading-snug line-clamp-2">{n.title}</span>
                    {n.body && <span className="text-[11px] text-muted-foreground leading-snug line-clamp-1">{n.body}</span>}
                    <span className="text-[10px] text-muted-foreground/70">{shortTime(n.createdAt, L)}</span>
                  </span>
                  {!n.read && <span className="shrink-0 mt-1.5 size-2 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </div>

        {/* footer — full page */}
        <button
          onClick={() => { setOpen(false); setView("notifications"); }}
          className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors border-t border-border/50"
        >
          {L("عرض كل الإشعارات", "See all notifications")}
          <ArrowLeft className="size-3.5 flip-rtl" />
        </button>
      </PopoverContent>
    </Popover>
  );
}
