"use client";

// MEEV v13 — ShareSheet: the Facebook-style "send this post to a friend"
// dialog. Lists friends (accepted friend requests) first, then people I
// follow, with a live search filter. Each row has an إرسال button that
// POSTs to /api/posts/:id/share → the friend receives a beautiful
// post_share card in the DM (chat-shared.tsx). Sent rows flip to a
// check + an "open chat" affordance.

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { MeevCat } from "./cat-avatar";
import { MeevName } from "./username";
import type { MiniUser } from "./types";
import { cn } from "@/lib/utils";
import { Share2, Send, Check, Loader2, Search, MessageCircle, UserPlus } from "lucide-react";

type ShareTarget = MiniUser & { isFriend: boolean };

export function ShareSheet({ post, open, onClose }: { post: { id: string; author: string } | null; open: boolean; onClose: () => void }) {
  const { L } = useI18n();
  const { toast } = useToast();
  const openDm = useMeev((s) => s.openDm);
  const [friends, setFriends] = useState<ShareTarget[] | null>(null);
  const [query, setQuery] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Record<string, string>>({}); // userId → conversationId

  // load the share targets each time the sheet opens (stable deps — the
  // parent passes a fresh `post` object every render, so key on ids only)
  const postId = post?.id;
  useEffect(() => {
    if (!open || !postId) return;
    setFriends(null);
    setQuery("");
    setSendingTo(null);
    setSentTo({});
    api.shareTargets(postId).then((r) => setFriends(r.friends)).catch(() => setFriends([]));
  }, [open, postId]);

  const filtered = useMemo(() => {
    if (!friends) return null;
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.displayName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q));
  }, [friends, query]);

  const send = async (f: ShareTarget) => {
    if (!post || sendingTo) return;
    setSendingTo(f.id);
    try {
      const r = await api.sharePost(post.id, f.id);
      setSentTo((s) => ({ ...s, [f.id]: r.conversationId }));
      toast({
        title: L(`تمت المشاركة مع ${f.displayName}`, `Shared with ${f.displayName}`),
        description: L("راح توصلها في المحادثة الآن", "It just landed in your chat"),
        duration: 2600,
      });
    } catch (e) {
      toast({
        title: L("تعذّرت المشاركة", "Couldn't share"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-3xl glass p-0 overflow-hidden max-h-[85dvh] flex flex-col">
        <DialogHeader className="p-5 pb-3 text-start space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="size-9 grid place-items-center rounded-2xl meev-gradient-btn text-white shadow-[0_8px_20px_-8px_rgba(190,177,92,.8)]">
              <Share2 className="size-4.5" />
            </span>
            {L("شارك المنشور مع صديق", "Share post with a friend")}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {L("يوصله كبطاقة جميلة في المحادثة الخاصة 🐾", "They'll get a pretty card in your private chat 🐾")}
          </DialogDescription>
        </DialogHeader>

        {/* search */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={L("ابحث بالاسم أو @المعرف…", "Search by name or @username…")}
              className="rounded-xl bg-background/60 ps-9 h-10"
              aria-label={L("بحث الأصدقاء", "Search friends")}
            />
          </div>
        </div>

        {/* list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4" role="list" aria-label={L("قائمة الأصدقاء", "Friends list")}>
          {friends === null && (
            <div className="p-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              {L("نجيب أصدقاءك…", "Fetching your friends…")}
            </div>
          )}
          {friends?.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <span className="inline-grid place-items-center size-12 rounded-2xl bg-primary/10 text-primary">
                <UserPlus className="size-6" />
              </span>
              <div className="text-sm font-semibold">{L("لا أحد للمشاركة بعد", "No one to share with yet")}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {L("أضف أصدقاء أو تابع أشخاصاً وستظهر هنا للمشاركة معهم.", "Add friends or follow people and they'll show up here for sharing.")}
              </p>
            </div>
          )}
          {filtered?.map((f, i) => {
            const sent = sentTo[f.id];
            return (
              <motion.div
                key={f.id}
                role="listitem"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.25) }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-2.5 py-2 hover:bg-white/5 transition-colors",
                  sent && "bg-emerald-500/[0.07]"
                )}
              >
                <button onClick={() => onClose()} className="shrink-0" aria-label={L(`الملف الشخصي لـ ${f.displayName}`, `${f.displayName}'s profile`)}>
                  <MeevCat seed={f.avatarSeed} fallback={f.id} size={40} level={f.level} presence={f.presence} avatarPhoto={f.avatarPhoto} name={f.displayName} />
                </button>
                <button onClick={() => onClose()} className="flex-1 min-w-0 text-start">
                  <MeevName displayName={f.displayName} level={f.level} nameColor={f.nameColor} nameFx={f.nameFx} compact />
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span dir="ltr" className="truncate">@{f.username}</span>
                    {f.isFriend && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-bold text-primary shrink-0">
                        <UserPlus className="size-2.5" aria-hidden="true" /> {L("صديق", "friend")}
                      </span>
                    )}
                  </div>
                </button>
                {sent ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-500 meev-pop">
                      <Check className="size-3.5" aria-hidden="true" /> {L("أُرسلت", "Sent")}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full size-9 text-primary hover:bg-primary/10"
                      onClick={() => {
                        onClose();
                        openDm(sent, f.id);
                      }}
                      aria-label={L("افتح المحادثة", "Open chat")}
                      title={L("افتح المحادثة", "Open chat")}
                    >
                      <MessageCircle className="size-4.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-xl h-9 gap-1.5 meev-gradient-btn text-white font-bold px-3.5 shrink-0"
                    disabled={!!sendingTo}
                    onClick={() => send(f)}
                    aria-label={L(`أرسل إلى ${f.displayName}`, `Send to ${f.displayName}`)}
                  >
                    {sendingTo === f.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 flip-rtl" />}
                    <span className="hidden sm:inline">{L("إرسال", "Send")}</span>
                  </Button>
                )}
              </motion.div>
            );
          })}
          {filtered && friends && filtered.length === 0 && friends.length > 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {L("لا نتائج لهذا البحث…", "No matches for this search…")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
