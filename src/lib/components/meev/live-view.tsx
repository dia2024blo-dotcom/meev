"use client";

// MEEV — Live 1v1: Omegle-style random rooms (text mode with a
// video-style layout). Real matchmaking over the realtime service
// with an AI companion fallback when no humans are queued.
// v5: fully bilingual (AR default) — every string runs through L().

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { interestLabel } from "./i18n-dict";
import { meevSocket } from "./socket";
import { MeevCat } from "./cat-avatar";
import { MeevName, LevelPill } from "./username";
import { MeevLogo } from "./logo";
import { ChatMessage, TypingDots } from "./chat-shared";
import { GiftCinema, type CinemaShow } from "./gift-cinema";
import { INTERESTS, GIFTS } from "@/lib/meev/constants";
import type { MiniUser, MatchMessage, GiftDTO } from "./types";
import { cn } from "@/lib/utils";
import { Zap, SkipForward, Flag, MessageSquare, Video, UserPlus, X, Search, Radio, Sparkles, Ban, PartyPopper, CheckCircle2, Bot } from "lucide-react";
import { GiftMark } from "./symbols";

type Phase = "idle" | "searching" | "matched";

// v8: the TikTok tray — quick live effects (free, both partners see them
// float) + quick gifts (real Gold Meev, lands in the partner's gifts + a
// float-up in the room). Gifts hidden for AI companions.
// v11: the support family (doves 🕊️ butterflies 🦋 kitten 🐱) leads the
// tray — support is the point of the room now.
const LIVE_FX = ["❤️", "🔥", "✨", "🎉", "👏", "😂"];
const LIVE_GIFTS = ["dove", "butterflies", "meevkitten", "rose", "heart", "rocket", "dragon"];

// one floating item over the live room (gift or effect)
type LiveFloat = { id: number; emoji: string; label: string; big: boolean; left: number; dur: number };

const REPORT_REASONS = [
  { key: "harassment", ar: "مضايقة أو تنمّر", en: "Harassment or bullying" },
  { key: "nsfw", ar: "محتوى غير لائق", en: "Inappropriate content" },
  { key: "spam", ar: "سبام أو نصب", en: "Spam or scam" },
  { key: "impersonation", ar: "انتحال شخصية", en: "Impersonation" },
  { key: "other", ar: "شيء آخر", en: "Something else" },
];

export function LiveView() {
  const { L, lang } = useI18n();
  const me = useMeev((s) => s.me);
  const patchMe = useMeev((s) => s.patchMe);
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [mode, setMode] = useState<"text" | "video">("text");
  const [smartMatch, setSmartMatch] = useState(true);
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [partner, setPartner] = useState<MiniUser | null>(null);
  const [isAI, setIsAI] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MatchMessage[]>([]);
  const [input, setInput] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [summary, setSummary] = useState<{ seconds: number; isAI: boolean; partner: MiniUser | null } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [addFriendState, setAddFriendState] = useState<"idle" | "sent" | "friends">("idle");
  // v8: TikTok-style floating layer (live effects + gifts)
  const [floats, setFloats] = useState<LiveFloat[]>([]);
  // v11: the SUPPORT CINEMA — a gift in the live room now detonates as the
  // full-screen scene (box → explosion → doves) on BOTH sides, TikTok-style
  const [cinema, setCinema] = useState<CinemaShow | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const matchIdRef = useRef<string | null>(null);
  const partnerRef = useRef<MiniUser | null>(null);
  const floatSeq = useRef(0);

  // keep refs in sync for socket handlers (assign in effect, not render)
  useEffect(() => {
    matchIdRef.current = matchId;
    partnerRef.current = partner;
  }, [matchId, partner]);

  const endChatLocal = () => {
    setPhase("idle");
    setPartner(null);
    setMatchId(null);
    setMessages([]);
    setFloats([]);
    matchIdRef.current = null;
  };

  // v8: spawn a floating emoji that rises across the room (TikTok-style)
  const addFloat = useCallback((emoji: string, label: string, big = false) => {
    const id = ++floatSeq.current;
    const dur = 3.2 + Math.random() * 1.1;
    const left = 14 + Math.random() * 66;
    setFloats((prev) => [...prev.slice(-12), { id, emoji, label, big, left, dur }]);
    window.setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), (dur + 0.4) * 1000);
  }, []);

  // v8: send a quick gift right from the room (TikTok-style) — one tap,
  // real Gold Meev, floats up for me and (via gift:received) for them
  // v11: the sender now gets the full SUPPORT CINEMA takeover too
  const sendLiveGift = useCallback(
    async (giftKey: string) => {
      if (!partner || !matchId || partner.isBot) return;
      const def = GIFTS.find((g) => g.key === giftKey);
      if (!def) return;
      try {
        const r = await api.sendGift({ giftKey, recipientId: partner.id, note: "", contextType: "live", contextId: matchId });
        patchMe({ coins: r.coinsLeft });
        addFloat(def.emoji || "🎁", me?.displayName.split(" ")[0] ?? "", def.rarity === "epic" || def.rarity === "legendary");
        setCinema({
          giftKey: giftKey,
          viewer: "sender",
          partner: partner.displayName,
          context: "live",
        });
        toast({
          title: (
            <span className="flex items-center gap-2">
              <GiftMark size={16} className="text-amber-400" />
              {L(`أُرسلت ${def.name}!`, `${def.name} sent!`)}
            </span>
          ),
          description: L(`-${def.price} ذهب ميف · +${def.xpReward} نقطة`, `-${def.price} Gold Meev · +${def.xpReward} XP`),
        });
      } catch (e) {
        toast({ title: L("تعذّر إرسال الهدية", "Couldn't send the gift"), description: e instanceof Error ? e.message : "", variant: "destructive" });
      }
    },
    [partner, matchId, patchMe, addFloat, me, toast, L]
  );

  // v8: fire a live effect — floats for me + broadcasts to the partner
  const sendEffect = useCallback(
    (emoji: string) => {
      if (!matchId) return;
      addFloat(emoji, me?.displayName.split(" ")[0] ?? "");
      meevSocket.matchEffect(matchId, emoji);
    },
    [matchId, addFloat, me]
  );

  // ---- socket wiring ----
  useEffect(() => {
    const off: (() => void)[] = [];

    off.push(
      meevSocket.on("match:found", (p) => {
        const d = p as { matchId: string; partner: MiniUser; mode: string; isAI: boolean };
        setMatchId(d.matchId);
        setPartner(d.partner);
        setIsAI(d.isAI);
        setPhase("matched");
        setMessages([]);
        setSeconds(0);
        setAddFriendState("idle");
        setSummary(null);
        toast({
          title: d.isAI ? (
            <span className="flex items-center gap-2">
              <Bot className="size-4 text-primary" aria-hidden="true" />
              {L("انتظرنا لك رفيقاً ذكياً!", "Matched with the AI companion!")}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <PartyPopper className="size-4 text-amber-400" aria-hidden="true" />
              {L("وجدنا لك شخصاً!", "You found a stranger!")}
            </span>
          ),
          description: d.isAI ? L("لا أحد في الطابور الآن — تدرّع مع رفيقنا الذكي.", "Nobody's queued right now — warm up with our AI companion.") : L("كن لطيفاً. البلاغ بضغطة واحدة.", "Be kind. One tap to report."),
          duration: 3500,
        });
      }),

      meevSocket.on("match:new", (p) => {
        const d = p as { matchId: string; message: MatchMessage };
        if (d.matchId !== matchIdRef.current) return;
        setMessages((prev) => [...prev, d.message]);
        setPartnerTyping(false);
      }),

      meevSocket.on("match:typing", () => {
        if (matchIdRef.current) {
          setPartnerTyping(true);
          setTimeout(() => setPartnerTyping(false), 4000);
        }
      }),

      meevSocket.on("match:partner-left", (p) => {
        const d = p as { matchId: string; reason: string };
        if (d.matchId !== matchIdRef.current) return;
        toast({ title: L("غادر الطرف الآخر", "Stranger disconnected"), description: L("أغلق الغرفة.", "They left the room."), variant: "destructive" });
        endChatLocal();
      }),

      meevSocket.on("match:ended", (p) => {
        const d = p as { matchId: string };
        if (d.matchId !== matchIdRef.current && matchIdRef.current) return;
        endChatLocal();
      }),

      meevSocket.on("match:summary", (p) => {
        const d = p as { matchId: string; seconds: number; isAI: boolean };
        if (matchIdRef.current && d.matchId !== matchIdRef.current) return;
        setSummary({ seconds: d.seconds, isAI: d.isAI, partner: partnerRef.current });
      }),

      meevSocket.on("match:report:ok", () => {
        toast({
          title: (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
              {L("سُجّل البلاغ", "Report filed")}
            </span>
          ),
          description: L("فريق الإشراف يراجعه الآن.", "Our moderation team is on it."),
        });
        setReportOpen(false);
      }),

      // v8: the partner fired a live effect — float their emoji in my room
      meevSocket.on("match:effect", (p) => {
        const d = p as { matchId: string; emoji: string; user: MiniUser };
        if (d.matchId !== matchIdRef.current) return;
        addFloat(d.emoji, (d.user?.displayName ?? "").split(" ")[0]);
      }),

      // v11: a support gift from my live partner now detonates as the FULL
      // support cinema (the box explodes and the creatures fly out) — the
      // float stays as a little ambient echo after the scene ends
      meevSocket.on("gift:received", (p) => {
        const d = p as { gift: GiftDTO };
        const partnerNow = partnerRef.current;
        if (!matchIdRef.current || !partnerNow || !d.gift) return;
        if (d.gift.sender.id !== partnerNow.id) return;
        const def = GIFTS.find((g) => g.key === d.gift.giftKey);
        addFloat(
          def?.emoji || d.gift.gift?.name?.slice(0, 2) || "🎁",
          (d.gift.sender.displayName ?? "").split(" ")[0],
          def ? def.rarity === "epic" || def.rarity === "legendary" : false
        );
        setCinema({
          giftKey: d.gift.giftKey,
          viewer: "receiver",
          partner: d.gift.sender.displayName,
          context: "live",
        });
      }),

      meevSocket.on("match:waiting", () => {
        // keep searching UI
      })
    );

    return () => off.forEach((f) => f());

  }, [addFloat]);

  // session timer
  useEffect(() => {
    if (phase !== "matched") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  const startSearch = () => {
    setPhase("searching");
    setSummary(null);
    meevSocket.queueMatch(mode, smartMatch ? myInterests : undefined);
  };

  const skip = (requeue = false) => {
    if (matchIdRef.current) {
      meevSocket.skipMatch(matchIdRef.current, requeue);
      if (requeue) {
        setPhase("searching");
        setPartner(null);
        setMessages([]);
        matchIdRef.current = null;
      } else {
        endChatLocal();
      }
    }
  };

  const send = () => {
    const content = input.trim();
    if (!content || !matchId) return;
    setInput("");
    // append own message locally (AI matches don't echo)
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, author: me as MiniUser, content, kind: "text", createdAt: new Date().toISOString() },
    ]);
    meevSocket.sendMatch(matchId, content);
  };

  const addFriend = async () => {
    if (!partner || partner.isBot) return;
    try {
      const r = await api.friendRequest(partner.id);
      setAddFriendState(r.status === "friends" ? "friends" : "sent");
      toast({
        title: r.status === "friends" ? (
          <span className="flex items-center gap-2">
            <PartyPopper className="size-4 text-amber-400" aria-hidden="true" />
            {L("أصبحتم أصدقاء!", "You're friends now!")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" aria-hidden="true" />
            {L("أُرسل طلب الصداقة", "Friend request sent")}
          </span>
        ),
      });
    } catch (e) {
      toast({ title: L("تعذّر إرسال الطلب", "Couldn't add friend"), description: e instanceof Error ? e.message : "" });
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="h-full overflow-y-auto">
      {/* v8: pb-28 on desktop too — the flat paw dock (~95px tall) used to
          overlap the Start-Matching button's center on md+ screens */}
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24 md:pb-28">
        <div className="flex items-center gap-3">
          <Radio className="size-6 text-primary animate-pulse" />
          <h1 className="text-xl font-black tracking-tight">{L("مباشر ١v١", "Live 1v1")}</h1>
          <span className="ml-auto text-xs text-muted-foreground">{L("غرف عشوائية · كن لطيفاً", "random rooms · be kind")}</span>
        </div>

        <AnimatePresence mode="wait">
          {/* ---------- idle: mode picker ---------- */}
          {phase === "idle" && !summary && (
            <motion.div key="idle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="glass rounded-3xl p-6 space-y-5">
              <div className="text-center space-y-2 pt-2">
                <MeevLogo size={90} mood="playful" speed={1.2} glow className="mx-auto" />
                <h2 className="text-lg font-bold">{L("تحدّث مع شخص لا تعرفه", "Talk to a random stranger")}</h2>
                <p className="text-sm text-muted-foreground">{L("ملايين الأصدقاء. ضغطة واحدة. بدون سحب.", "Millions of friends. One tap. No swiping.")}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {([
                  ["text", MessageSquare, L("دردشة نصية", "Text chat"), L("الكلاسيكية — بالكتابة", "Type it out classic style")],
                  ["video", Video, L("غرفة فيديو", "Video room"), L("تجربة بأسلوب الكاميرا", "Camera-style live room")],
                ] as const).map(([m, Icon, title, desc]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-2xl border p-4 text-start transition-all",
                      mode === m ? "border-primary ring-2 ring-primary/30 bg-primary/10" : "border-border/60 bg-card hover:border-primary/40"
                    )}
                  >
                    <Icon className={cn("size-6 mb-2", mode === m ? "text-primary" : "text-muted-foreground")} />
                    <div className="font-bold text-sm">{title}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-border/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="size-4 text-primary" /> {L("المطابقة الذكية", "Smart match")}</div>
                    <div className="text-xs text-muted-foreground">{L("يطابقك بمن يشاركك الاهتمامات إن أمكن", "Match by shared interests when possible")}</div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={smartMatch}
                    onClick={() => setSmartMatch(!smartMatch)}
                    className={cn("w-11 h-6 rounded-full transition-colors relative", smartMatch ? "bg-primary" : "bg-border")}
                  >
                    <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", smartMatch ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
                {smartMatch && (
                  <div className="flex flex-wrap gap-1.5">
                    {(me ? INTERESTS.slice(0, 12) : INTERESTS).map((i) => (
                      <button
                        key={i.key}
                        onClick={() => setMyInterests((prev) => (prev.includes(i.key) ? prev.filter((k) => k !== i.key) : [...prev, i.key].slice(0, 6)))}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs border transition-colors",
                          myInterests.includes(i.key) ? "border-primary bg-primary/15 text-primary font-medium" : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {i.emoji} {interestLabel(i.key, i.label, lang)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button className="w-full h-12 rounded-2xl meev-gradient-btn text-white text-base font-bold" onClick={startSearch}>
                <Zap className="size-5" /> {L("ابدأ المطابقة", "Start matching")}
              </Button>
            </motion.div>
          )}

          {/* ---------- searching ---------- */}
          {phase === "searching" && (
            <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass rounded-3xl p-10 flex flex-col items-center gap-5">
              <div className="relative">
                <MeevLogo size={110} mood="shocked" speed={2} glow />
                <span className="absolute -inset-6 rounded-full border-2 border-dashed border-primary/40 animate-spin" style={{ animationDuration: "3s" }} />
              </div>
              <div className="text-center space-y-1">
                <div className="font-bold text-lg">{L("نبحث عن شخص لك…", "Finding a stranger…")}</div>
                <div className="text-sm text-muted-foreground">{L("إذا لم يكن أحد متصلاً، يدخل رفيقنا الذكي.", "If nobody's around, our AI companion steps in.")}</div>
              </div>
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary meev-typing-dot" />
                <span className="h-2 w-2 rounded-full bg-primary meev-typing-dot" />
                <span className="h-2 w-2 rounded-full bg-primary meev-typing-dot" />
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => { meevSocket.skipMatch("__none__"); setPhase("idle"); }}>
                <X className="size-4" /> {L("إلغاء", "Cancel")}
              </Button>
            </motion.div>
          )}

          {/* ---------- matched ---------- */}
          {phase === "matched" && (
            <motion.div key="matched" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="glass rounded-3xl overflow-hidden flex flex-col" style={{ height: "calc(100dvh - 180px)", minHeight: 480 }}>
              {/* partner header */}
              <div className="p-4 border-b border-border/50 flex items-center gap-3 shrink-0">
                {mode === "video" ? (
                  <div className="relative size-20 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/25 to-primary/5 grid place-items-center border border-primary/20">
                    <MeevCat seed={partner?.avatarSeed || ""} fallback={partner?.id || "p"} size={64} presence="hidden" avatarPhoto={partner?.avatarPhoto} name={partner?.displayName} />
                    <span className="absolute bottom-1 right-1 size-2.5 rounded-full bg-red-500 animate-pulse" title={L("مباشر", "Live")} />
                  </div>
                ) : (
                  <MeevCat seed={partner?.avatarSeed || ""} fallback={partner?.id || "p"} size={48} level={partner?.level} presence="online" avatarPhoto={partner?.avatarPhoto} name={partner?.displayName} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MeevName displayName={partner?.displayName || L("شخص غريب", "Stranger")} level={partner?.level} nameColor={partner?.nameColor} nameFx={partner?.nameFx} role={partner?.role} verified={partner?.verified} />
                    <LevelPill level={partner?.level ?? 0} />
                    {isAI && <span className="rounded bg-primary/15 px-1.5 py-px text-[9px] font-bold text-primary uppercase">{L("رفيق ذكي", "AI companion")}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="tabular-nums font-mono">{mmss}</span>
                    <span>· {L("محادثة مجهولة", "anonymous chat")}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="rounded-full text-destructive hover:bg-destructive/10" onClick={() => setReportOpen(true)} aria-label={L("إبلاغ", "Report")}>
                    <Flag className="size-4" />
                  </Button>
                  <Button size="sm" className="rounded-xl h-8 text-xs gap-1 meev-gradient-btn text-white" onClick={() => skip(true)}>
                    <SkipForward className="size-3.5" /> {L("التالي", "Next")}
                  </Button>
                </div>
              </div>

              {/* video mode fake self view */}
              {mode === "video" && (
                <div className="px-4 pt-3 flex gap-3 shrink-0">
                  <div className="relative size-24 rounded-xl overflow-hidden bg-card border border-border/60 grid place-items-center">
                    <MeevCat seed={me?.avatarSeed || ""} fallback={me?.id || "me"} size={56} presence="hidden" avatarPhoto={me?.avatarPhoto} name={me?.displayName} />
                    <span className="absolute bottom-1 inset-x-0 text-center text-[8px] text-muted-foreground">{L("أنت", "You")}</span>
                  </div>
                  <div className="flex-1 rounded-xl bg-card border border-border/60 grid place-items-center text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><Video className="size-4 text-primary" /> {L("غرفة مباشرة ·", "Live room ·")} {partner?.displayName}</div>
                  </div>
                </div>
              )}

              {/* chat + v8 floating layer (TikTok-style rising gifts/effects) */}
              <div className="relative flex-1 overflow-y-auto py-3 space-y-1 min-h-0">
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden="true">
                  {floats.map((f) => (
                    <div key={f.id} className="absolute inset-y-0" style={{ left: `${f.left}%` }}>
                      {/* full-height column → translateY % = distance across the room */}
                      <div
                        className="h-full w-max flex flex-col justify-end items-center gap-1 pb-3 meev-gift-float"
                        style={{ ["--float-dur" as string]: `${f.dur}s` }}
                      >
                        <span
                          className={cn(
                            "leading-none drop-shadow-[0_4px_14px_rgba(0,0,0,.55)] select-none",
                            f.big ? "text-5xl" : "text-3xl"
                          )}
                        >
                          {f.emoji}
                        </span>
                        <span className="text-[9px] font-bold text-white/90 rounded-full bg-black/55 px-2 py-0.5 backdrop-blur-sm whitespace-nowrap max-w-24 truncate" dir="auto">
                          {f.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center pb-2">
                  <span className="rounded-full bg-white/5 border border-border/50 px-3 py-1 text-[10px] text-muted-foreground">
                    {L("تتحدث الآن مع شخص عشوائي — قل مرحباً!", "You're now chatting with a random stranger — say hi!")} · <Ban className="inline size-3" /> {L("بلاغ بضغطة", "1-tap report")}
                  </span>
                </div>
                {messages.map((m) => (
                  <ChatMessage key={m.id} message={m} mine={m.author?.id === me?.id} compact />
                ))}
                {partnerTyping && <TypingDots label={L("يكتب الآن…", "Stranger is typing…")} />}
                <div ref={chatEndRef} />
              </div>

              {/* v8: the TikTok tray — live effects + quick gifts */}
              <div className="px-3 pt-2 pb-3 border-t border-border/50 flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar meev-drag-rail">
                {LIVE_FX.map((e) => (
                  <button
                    key={e}
                    onClick={() => sendEffect(e)}
                    className="size-9 grid place-items-center rounded-full border border-border/60 bg-white/5 text-lg leading-none hover:scale-110 hover:border-primary/50 active:scale-90 transition-transform shrink-0 select-none"
                    aria-label={L(`تفاعل ${e}`, `Send ${e}`)}
                  >
                    {e}
                  </button>
                ))}
                {!isAI && (
                  <>
                    <span className="w-px h-7 bg-border/60 shrink-0 mx-0.5" aria-hidden="true" />
                    {LIVE_GIFTS.map((key) => {
                      const def = GIFTS.find((g) => g.key === key);
                      if (!def) return null;
                      const afford = (me?.coins ?? 0) >= def.price;
                      return (
                        <button
                          key={key}
                          onClick={() => sendLiveGift(key)}
                          disabled={!afford}
                          className="relative size-10 grid place-items-center rounded-full border border-amber-500/35 bg-amber-500/10 text-lg leading-none hover:scale-110 hover:border-amber-400/70 active:scale-90 transition-transform shrink-0 select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                          aria-label={L(`${def.name} — ${def.price} ذهب ميف`, `${def.name} — ${def.price} Gold Meev`)}
                          title={`${def.name} · ${def.price}`}
                        >
                          {def.emoji || "🎁"}
                          <span className="absolute bottom-0 inset-x-0 text-center text-[8px] font-bold text-amber-300 tabular-nums pointer-events-none">
                            {def.price}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>

              {/* input */}
              <div className="p-3 border-t border-border/50 flex gap-2 shrink-0">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={L("اكتب رسالة…", "Type a message…")}
                  className="flex-1 rounded-xl bg-background/60 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-primary/50"
                  maxLength={1000}
                />
                <Button size="icon" className="rounded-xl meev-gradient-btn text-white shrink-0" onClick={send} disabled={!input.trim()} aria-label={L("إرسال", "Send")}>
                  <Zap className="size-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ---------- summary ---------- */}
          {summary && phase !== "matched" && (
            <motion.div key="summary" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
              <MeevLogo size={90} mood={summary.isAI ? "love" : "happy"} speed={1.2} glow />
              <div>
                <div className="font-bold text-lg">{L("انتهت المحادثة", "Chat ended")}</div>
                <div className="text-sm text-muted-foreground">
                  {L(`${Math.floor(summary.seconds / 60)} د ${summary.seconds % 60} ث مع`, `${Math.floor(summary.seconds / 60)}m ${summary.seconds % 60}s with`)}{" "}
                  {summary.isAI ? L("رفيق ذكي (AI)", "the AI companion") : summary.partner?.displayName || L("شخص غريب", "a stranger")}
                </div>
              </div>
              {summary.partner && !summary.isAI && (
                <Button className="rounded-xl meev-gradient-btn text-white gap-2" onClick={addFriend} disabled={addFriendState !== "idle"}>
                  <UserPlus className="size-4" />
                  {addFriendState === "friends" ? L("أصبحتم أصدقاء!", "You're friends now!") : addFriendState === "sent" ? L("أُرسل الطلب", "Request sent") : L(`أضف ${summary.partner.displayName} صديقاً`, `Add ${summary.partner.displayName} as friend`)}
                </Button>
              )}
              <Button variant="outline" className="rounded-xl gap-2" onClick={startSearch}>
                <Search className="size-4" /> {L("ابحث عن شخص آخر", "Find another stranger")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Flag className="size-5 text-destructive" /> {L("الإبلاغ عن المحادثة", "Report this chat")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setReportReason(r.key)}
                className={cn(
                  "w-full text-start rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                  reportReason === r.key ? "border-destructive/60 bg-destructive/10" : "border-border/60 hover:border-destructive/40"
                )}
              >
                {L(r.ar, r.en)}
              </button>
            ))}
          </div>
          <Button
            className="w-full rounded-xl bg-destructive text-white hover:bg-destructive/90 gap-2"
            onClick={() => {
              if (matchId) meevSocket.reportMatch(matchId, reportReason);
              setReportOpen(false);
              toast({ title: L("جارٍ الإبلاغ…", "Reporting…"), description: L("سيتم فصلك من هذه المحادثة أيضاً.", "You'll also be disconnected from this chat.") });
            }}
          >
            <Flag className="size-4" /> {L("إرسال البلاغ والمغادرة", "Submit report & leave")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* v11: the SUPPORT CINEMA — gifts in the live room detonate as the
          full-screen scene (box → explosion → doves) on BOTH sides */}
      <GiftCinema show={cinema} onClose={() => setCinema(null)} />
    </div>
  );
}
