"use client";

// MEEV — Home: stories bar + story viewer + feed (Instagram-style)
// with likes, comments, gifting and an image-post composer.

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { MeevCat } from "./cat-avatar";
import { PulseRing } from "./pulse-ring";
import { MeevName, LevelPill } from "./username";
import { ChatMessage, timeAgo } from "./chat-shared";
import { ShareSheet } from "./share-sheet";
import { MeevLogo } from "./logo";
import { PawCoins } from "./pawcoin";
import { SpinWheelDialog } from "./spin-wheel";
import WorldLive from "./world-live";
import type { PostDTO, StoryGroup, StoryDTO, StoryViewerEntry, CommentDTO, MiniUser, ReactionKind, ReactionCounts } from "./types";
import { STORY_GRADIENTS, SPIN_COOLDOWN_HOURS, XP_PER_LEVEL, LEVEL_UNLOCKS, PULSE_VIBES, vibeOf } from "@/lib/meev/constants";
import { cn } from "@/lib/utils";
import { Heart, MessageCircle, Plus, ImagePlus, Send, Sparkles, X, ChevronLeft, ChevronRight, Dices, Trophy, Smile, ChevronDown, Eye, Loader2, Trash2, Activity, Share2, UserCheck } from "lucide-react";

// v5: quick emoji set for the composers (post + story)
const QUICK_EMOJIS = ["😀","😂","🥹","😍","🤩","😎","🥳","😭","🤯","😴","🤗","🫶","🤔","😅","🥺","🤝","👏","🙃","❤️","🔥","✨","🎉","💜","⭐","🍀","🌙","🌈","☕","🍕","🎮","🐱","🎧"];

function EmojiPicker({ onPick, align = "start" }: { onPick: (e: string) => void; align?: "start" | "end" }) {
  const { L } = useI18n();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9 shrink-0" aria-label={L("إيموجي", "Emoji")}>
          <Smile className="size-4" /> <span className="hidden sm:inline">{L("إيموجي", "Emoji")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align={align} className="w-72 rounded-2xl glass p-2">
        <div className="grid grid-cols-8 gap-1">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onPick(e)}
              className="size-8 grid place-items-center rounded-lg text-lg hover:bg-primary/15 hover:scale-110 transition-transform"
              aria-label={e}
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------- v14/v15: MEEV PULSE — the CALM ring ----------------
// The user spec: avatars wearing a pulse = no effects, just the avatar in
// a circle with a LIGHT ring in the site's own gold, Instagram-style,
// refined. v15: the ring lives in its own shared module (pulse-ring.tsx)
// so MY OWN avatar can wear it too (rail tile + top-bar avatar): the
// moment I post a pulse the gold ring glows on my picture, and once I
// watch my story it melts to fully transparent (user: "لما تحمل نبضة
// جديدة تجي دائرة فوق صورتك… ولما ترا سطوري ترجع شفاف").

// ---------------- v6: Story viewer — full Instagram experience ----------------
// Stories progress with a pause-on-hold timer, tap zones, quick emoji
// reactions + a text reply that land in the author's DM, and the owner's
// "vu" viewers sheet (who watched my story, and when).

const STORY_REACTIONS = ["❤️", "😂", "🔥", "😮", "😢", "👏", "💯", "😍"];
const STORY_MS = 5000;

function StoryViewer({
  groups,
  index,
  onClose,
  onIndexChange,
  meId,
  onChanged,
  onAddStory,
}: {
  groups: StoryGroup[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  meId?: string;
  /** v8: fired after my story is deleted so the rail re-loads */
  onChanged?: () => void;
  /** v8: open the composer to add another story (rail + hides when live) */
  onAddStory?: () => void;
}) {
  const { L } = useI18n();
  const { toast } = useToast();
  const group = groups[index] ?? null;
  const stories = group?.stories ?? [];

  const [idx, setIdx] = useState(0);
  const story = stories[idx] ?? null;
  const isMine = !!group && group.author.id === meId;

  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState("");
  const [busyReact, setBusyReact] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerEntry[] | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  // v8: delete-my-story + live 24h countdown
  const [delConfirm, setDelConfirm] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  // v8: live countdown of the 24h window (1s tick)
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remainMs = story ? Math.max(0, new Date(story.expiresAt).getTime() - nowMs) : 0;
  const remain =
    story && remainMs > 0
      ? `${String(Math.floor(remainMs / 3600000)).padStart(2, "0")}:${String(Math.floor((remainMs % 3600000) / 60000)).padStart(2, "0")}:${String(Math.floor((remainMs % 60000) / 1000)).padStart(2, "0")}`
      : null;

  useEffect(() => {
    setViewerCount(story?.viewerCount ?? 0);
  }, [story?.id, story?.viewerCount]);

  const elapsedRef = useRef(0);
  const holdStartRef = useRef(0);
  const suppressTapRef = useRef(false);
  // v12: the cinema STAGE — on desktop the viewer is a centered portrait
  // stage, so viewport coords (reaction bursts) must convert to stage-local
  const stageRef = useRef<HTMLDivElement>(null);

  // reset per group (render-phase state adjust — safe pattern)
  const [prevGroup, setPrevGroup] = useState<string | null>(group?.author.id ?? null);
  if (group && prevGroup !== group.author.id) {
    setPrevGroup(group.author.id);
    setIdx(0);
  }
  // reset per story
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [idx, group?.author.id]);

  // mark every watched pulse as seen — INCLUDING MY OWN (v15). That is
  // the Instagram contract the user asked for: the gold ring glows on my
  // avatar until *I* watch my story, then it returns transparent
  // (viewedByMe feeds both the rail tile and the top-bar avatar ring via
  // the global store's myPulseUnseen).
  useEffect(() => {
    if (!story) return;
    api.viewStory(story.id).catch(() => {});
  }, [story]);

  const advance = useCallback(() => {
    if (idx + 1 < stories.length) setIdx(idx + 1);
    else if (index + 1 < groups.length) onIndexChange(index + 1);
    else onClose();
  }, [idx, stories.length, index, groups.length, onIndexChange, onClose]);

  const back = useCallback(() => {
    if (idx > 0) setIdx(idx - 1);
    else if (index > 0) onIndexChange(index - 1);
  }, [idx, index, onIndexChange]);

  // pause-aware progress driver (100ms ticks — stays in sync with the bar)
  useEffect(() => {
    if (!group || paused) return;
    const t = setInterval(() => {
      elapsedRef.current += 100;
      setProgress(Math.min(1, elapsedRef.current / STORY_MS));
      if (elapsedRef.current >= STORY_MS) advance();
    }, 100);
    return () => clearInterval(t);
  }, [group, paused, idx, advance]);

  // hold anywhere to pause (like Instagram)
  const holdStart = () => {
    setPaused(true);
    holdStartRef.current = Date.now();
    suppressTapRef.current = false;
  };
  const holdEnd = () => {
    const held = Date.now() - holdStartRef.current;
    suppressTapRef.current = held > 350;
    setPaused(false);
  };

  // v12: viewport x → stage-local x (the burst layer lives INSIDE the stage,
  // which is offset from the screen edges on desktop)
  const stageX = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    return rect ? clientX - rect.left : clientX;
  };

  // ---- interactions ----
  const sendReaction = async (emoji: string, x?: number) => {
    if (!story || busyReact || isMine) return;
    setBusyReact(true);
    if (x !== undefined) addBurst(emoji, stageX(x));
    try {
      await api.storyReact(story.id, { emoji });
      toast({ title: L(`أُرسل تفاعلك إلى ${group?.author.displayName} 💬`, `Reaction sent to ${group?.author.displayName} 💬`) });
    } catch (e) {
      toast({ title: L("تعذّر إرسال التفاعل", "Couldn't send the reaction"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyReact(false);
    }
  };

  const sendReply = async () => {
    if (!story || busyReact || !reply.trim() || isMine) return;
    setBusyReact(true);
    try {
      await api.storyReact(story.id, { text: reply.trim() });
      setReply("");
      toast({ title: L("وصل ردّك إلى الخاص ✉️", "Your reply landed in their DMs ✉️") });
    } catch (e) {
      toast({ title: L("تعذّر إرسال الرد", "Couldn't send the reply"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyReact(false);
    }
  };

  const openViewers = async () => {
    if (!story) return;
    setViewersOpen(true);
    setViewers(null);
    try {
      const r = await api.storyViewers(story.id);
      setViewers(r.viewers);
      setViewerCount(r.count);
    } catch {
      setViewers([]);
    }
  };

  // v8: delete MY story — author-only (server-checked), then advance
  const deleteStory = async () => {
    if (!story || delBusy) return;
    setDelBusy(true);
    try {
      await api.deleteStory(story.id);
      toast({ title: L("حُذفت القصة 🗑️", "Story deleted 🗑️") });
      onChanged?.();
      if (idx + 1 < stories.length) setIdx(idx + 1);
      else if (index + 1 < groups.length) onIndexChange(index + 1);
      else onClose();
    } catch (e) {
      toast({ title: L("تعذّر حذف القصة", "Couldn't delete the story"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDelBusy(false);
      setDelConfirm(false);
    }
  };

  // v9: reaction bursts — emoji rockets that fly up over the full screen
  const [bursts, setBursts] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const burstIdRef = useRef(0);
  const addBurst = useCallback((emoji: string, x: number) => {
    const id = ++burstIdRef.current;
    setBursts((b) => [...b, { id, emoji, x }]);
    window.setTimeout(() => setBursts((b) => b.filter((z) => z.id !== id)), 1000);
  }, []);

  // v9: double-tap heart (Instagram) — a big center heart + auto ❤️ reaction
  const [bigHeart, setBigHeart] = useState(0);
  const heartTimerRef = useRef<number | null>(null);
  const doubleTapHeart = useCallback(() => {
    setBigHeart(Date.now());
    setPaused(false);
    if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
    heartTimerRef.current = window.setTimeout(() => setBigHeart(0), 1100);
    const stageW = stageRef.current?.clientWidth ?? window.innerWidth;
    addBurst("❤️", Math.round(stageW * (0.35 + Math.random() * 0.3)));
    if (story && !isMine) api.storyReact(story.id, { emoji: "❤️" }).catch(() => {});
  }, [story, isMine, addBurst]);

  // v9: the middle third — tap = pause/resume, quick double-tap = heart
  const lastMidTapRef = useRef(0);
  const middleTap = useCallback(() => {
    if (suppressTapRef.current) return;
    const now = Date.now();
    if (now - lastMidTapRef.current < 320) {
      lastMidTapRef.current = 0;
      doubleTapHeart();
    } else {
      lastMidTapRef.current = now;
      setPaused((p) => !p);
    }
  }, [doubleTapHeart]);

  // v11: ambient particles drifting over the full-bleed pulse — the VIBE
  // of the current pulse picks the particle cast (love → hearts, hype →
  // lightning…); image pulses without a vibe get the classic star set
  const ambientVibe = vibeOf(story?.gradient);
  const ambientSet = ambientVibe?.particles ?? ["✨", "💫", "🌟", "⭐", "✦"];
  // v13: a calmer cast — 6 gentle drifters (was 12; the old density
  // read as clutter — user: "عدد كبير يخرب واجهة النبض"). Never a wall
  // of hearts: each vibe now mixes 1–2 hearts max among soft sparkles.
  const ambient = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        emoji: ambientSet[i % ambientSet.length],
        left: 4 + Math.random() * 92,
        delay: -Math.random() * 12,
        dur: 9 + Math.random() * 8,
        size: 11 + Math.random() * 7,
        sway: Math.round(Math.random() * 60 - 30),
      })),
    [ambientSet.join(",")]
  );

  // v9: keyboard control — ←/→ navigate, space pauses, Esc closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (viewersOpen || delConfirm) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") { e.preventDefault(); advance(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [advance, back, onClose, viewersOpen, delConfirm]);

  if (!group || stories.length === 0) return null;
  const cur = stories[idx];
  // v12: the desktop side-nav "prev" arrow rests when there's nowhere back
  const atStart = idx === 0 && index === 0;

  return (
    <AnimatePresence>
      {/* v12: THE CINEMA — mobile (<lg) stays FULL-BLEED edge-to-edge (the
          photo + effects cover the ENTIRE screen, exactly as v9 built it);
          desktop (lg+) becomes a CENTERED PORTRAIT STAGE floating over a
          dimmed, blurred backdrop (user: "فالكمبيوتر تظهر شاشة كاملة نبض" —
          the full-screen takeover felt heavy on desktop). Every internal
          layer (photo, particles, scrims, progress, header, tap zones,
          footer, viewers sheet, delete confirm) lives INSIDE the stage so
          nothing leaks past the rounded corners. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black overflow-hidden select-none lg:bg-black/70 lg:backdrop-blur-md lg:grid lg:place-items-center"
        onPointerDown={holdStart}
        onPointerUp={holdEnd}
        onPointerLeave={holdEnd}
      >
        {/* ---- THE STAGE — the positioned parent of every layer below:
            fullscreen on mobile, a rounded portrait card on desktop ---- */}
        <div
          ref={stageRef}
          className="relative w-full h-full mx-auto lg:w-[26rem] lg:h-[min(90vh,44rem)] lg:rounded-[1.75rem] lg:overflow-hidden lg:shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)] lg:ring-1 lg:ring-white/10"
        >
        {/* ---- the story body, edge to edge ---- */}
        {cur.kind === "image" ? (
          <img
            key={cur.id}
            src={cur.imageUrl || ""}
            alt="Story"
            className="absolute inset-0 w-full h-full object-cover meev-kenburns"
          />
        ) : (
          <div
            key={cur.id + "-g"}
            className="absolute inset-0 grid place-items-center p-8 sm:p-16 lg:p-10 text-center meev-gradient-pan"
            style={{ backgroundImage: STORY_GRADIENTS[cur.gradient] || STORY_GRADIENTS.sunset }}
          >
            <p className="text-3xl sm:text-5xl lg:text-4xl font-black text-white drop-shadow-[0_4px_18px_rgba(0,0,0,.5)] leading-relaxed break-words max-w-3xl">
              {cur.content}
            </p>
          </div>
        )}

        {/* v9: ambient particles drifting across the whole screen — the
            "effects" live OVER the photo, not trapped in a frame */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[5]" aria-hidden="true">
          {ambient.map((p, i) => (
            <span
              key={i}
              className="meev-float-particle"
              style={{
                left: `${p.left}%`,
                fontSize: p.size,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.dur}s`,
                ["--sway" as string]: `${p.sway}px`,
              }}
            >
              {p.emoji}
            </span>
          ))}
        </div>

        {/* scrims — v10: kept LIGHT (softened from /75+/85) so the photo
            itself stays vivid (user: "the picture looks a bit washed"),
            while the floating UI chips carry their own glass shading */}
        <div className="absolute inset-x-0 top-0 h-32 sm:h-40 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-48 sm:h-56 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />

        {/* progress bars — safe-area aware, full width */}
        <div className="absolute top-0 inset-x-0 z-20 px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] flex gap-1 pointer-events-none">
          {stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>

          {/* header — floats over the photo (safe-area aware) */}
          <div className="absolute top-0 inset-x-0 z-20 pt-[calc(env(safe-area-inset-top,0px)+24px)] px-3 pointer-events-none">
            <div className="max-w-2xl mx-auto w-full flex items-center gap-2.5">
              <MeevCat
                seed={group.author.avatarSeed}
                fallback={group.author.id}
                size={40}
                level={group.author.level}
                presence="hidden"
                avatarPhoto={group.author.avatarPhoto}
                frameKey={group.author.frameKey}
                avatarAcc={group.author.avatarAcc}
                name={group.author.displayName}
              />
              <div className="flex-1 min-w-0">
                <MeevName displayName={group.author.displayName} level={group.author.level} nameColor={group.author.nameColor} nameFx={group.author.nameFx} compact />
                <div className="text-[11px] text-white/75 flex items-center gap-1.5 flex-wrap">
                  {/* v11: the pulse badge — PULSE · the living vibe chip */}
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur px-1.5 py-px font-bold" title={L("نبض Meev — حيّ لمدة ٢٤ ساعة", "Meev Pulse — alive for 24h")}>
                    <Activity className="size-2.5" />
                    {L("نبض", "PULSE")}
                  </span>
                  {ambientVibe && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-bold"
                      style={{ background: `${ambientVibe.hue}33`, border: `1px solid ${ambientVibe.hue}66` }}
                      title={L("مزج النبضة", "The pulse vibe")}
                    >
                      {ambientVibe.emoji} {L(ambientVibe.labelAr, ambientVibe.label)}
                    </span>
                  )}
                  <span>{timeAgo(cur.createdAt)}{paused && ` · ${L("إيقاف مؤقت", "paused")}`}</span>
                  {/* v8: live 24h countdown — the story's lifetime on screen */}
                  {remain && (
                    <span className="inline-flex items-center gap-0.5 tabular-nums" title={L("متبقٍ قبل اختفاء القصة", "Time left before the story disappears")}>
                      ⏳ {remain} <span className="text-white/50">{L("متبقٍ", "left")}</span>
                    </span>
                  )}
                </div>
              </div>
              {/* v8: my story tools — add another (the rail + vanished) + delete */}
              {isMine && onAddStory && (
                <button
                  className="size-10 grid place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/15 hover:bg-primary/50 transition-colors text-white pointer-events-auto"
                  onClick={onAddStory}
                  aria-label={L("إضافة قصة جديدة", "Add another story")}
                  title={L("إضافة قصة جديدة", "Add another story")}
                >
                  <Plus className="size-5" />
                </button>
              )}
              {/* v8: delete MY story (author-only) */}
              {isMine && (
                <button
                  className="size-10 grid place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/15 hover:bg-rose-500/60 transition-colors text-white pointer-events-auto"
                  onClick={() => { setPaused(true); setDelConfirm(true); }}
                  aria-label={L("حذف القصة", "Delete story")}
                  title={L("حذف القصة", "Delete story")}
                >
                  <Trash2 className="size-4.5" />
                </button>
              )}
              <button
                className="size-10 grid place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/15 hover:bg-white/25 transition-colors pointer-events-auto"
                onClick={onClose}
                aria-label="Close story"
              >
                <X className="size-5 text-white" />
              </button>
            </div>
          </div>

          {/* v9: tap zones — left = previous · middle = tap to pause,
              quick double-tap = big heart + ❤️ reaction · right = next */}
          <button
            className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
            aria-label="Previous story"
            onClick={() => !suppressTapRef.current && back()}
          />
          <button
            className="absolute left-1/3 top-0 bottom-0 w-1/3 z-10"
            aria-label={L("إيقاف/متابعة — نقرة مزدوجة للإعجاب", "Pause/resume — double-tap to like")}
            onClick={middleTap}
          />
          <button
            className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
            aria-label="Next story"
            onClick={() => !suppressTapRef.current && advance()}
          />

          {/* footer — others' story: reactions + reply (Instagram). Each
              reaction fires a burst that rockets up over the full screen. */}
          {!isMine && (
            <div className="absolute bottom-0 inset-x-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-6 pointer-events-none">
              <div className="max-w-2xl mx-auto w-full space-y-2.5">
                <div className="flex items-center gap-1.5 pointer-events-auto">
                  {STORY_REACTIONS.map((e) => (
                    <button
                      key={e}
                      disabled={busyReact}
                      onClick={(ev) => sendReaction(e, ev.clientX)}
                      className="size-11 lg:size-9 grid place-items-center rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-2xl lg:text-xl transition-all hover:bg-white/25 hover:scale-125 active:scale-90 disabled:opacity-50"
                      aria-label={`React ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <form
                  className="flex items-center gap-2 pointer-events-auto"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    sendReply();
                  }}
                >
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value.slice(0, 500))}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    placeholder={L("ردّ على القصة…", "Reply to story…")}
                    className="rounded-full bg-black/40 backdrop-blur-md border-white/20 text-white placeholder:text-white/50 h-11"
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    disabled={busyReact || !reply.trim()}
                    className="size-11 grid place-items-center rounded-full meev-gradient-btn text-white shrink-0 disabled:opacity-40"
                    aria-label={L("إرسال الرد", "Send reply")}
                  >
                    {busyReact ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 flip-rtl" />}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* footer — MY story: the viewers ("vu") button */}
          {isMine && (
            <div className="absolute bottom-0 inset-x-0 z-20 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pointer-events-none">
              <button
                onClick={openViewers}
                className="mx-auto w-fit flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-black/70 transition-colors pointer-events-auto"
                aria-label={L("من شاهد قصتك", "Who viewed your story")}
              >
                <Eye className="size-4" /> {viewerCount} {L("شوهدت", "viewed")}
              </button>
            </div>
          )}

          {/* v9: the effects layer — reaction bursts + the double-tap heart,
              flying over the ENTIRE screen (above every UI layer) */}
          <div className="absolute inset-0 z-[95] pointer-events-none overflow-hidden" aria-hidden="true">
            {bursts.map((b) => (
              <span
                key={b.id}
                className="meev-story-burst text-5xl"
                style={{ left: b.x, ["--rot" as string]: `${((b.id % 3) - 1) * 14}deg` }}
              >
                {b.emoji}
              </span>
            ))}
            {bigHeart > 0 && (
              <span
                className="absolute left-1/2 top-1/2 text-[110px] sm:text-[140px] meev-big-heart"
                style={{ filter: "drop-shadow(0 12px 32px rgba(0,0,0,.55))" }}
              >
                ❤️
              </span>
            )}
          </div>

          {/* viewers sheet (my stories only) — full-screen overlay, docked
              sheet centered with max width so desktop stays elegant */}
          {viewersOpen && (
            <div className="absolute inset-0 z-[100] bg-black/70 backdrop-blur-md flex flex-col" onClick={() => setViewersOpen(false)}>
              <div
                className="mt-auto mx-auto w-full max-w-md rounded-t-3xl bg-card border-t border-x border-border flex flex-col max-h-[75%] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 flex items-center justify-between border-b border-border/50">
                  <span className="font-black flex items-center gap-2">
                    <Eye className="size-4 text-primary" /> {L("مشاهدو القصة", "Story viewers")}
                  </span>
                  <button className="size-8 grid place-items-center rounded-full hover:bg-white/10" onClick={() => setViewersOpen(false)} aria-label="Close">
                    <X className="size-4" />
                  </button>
                </div>
                <div className="overflow-y-auto p-2 space-y-0.5 max-h-72 meev-scroll">
                  {viewers === null && (
                    <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> {L("جارٍ التحميل…", "Loading…")}
                    </div>
                  )}
                  {viewers?.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {L("لا مشاهدات بعد — انتظر قليلاً 👀", "No views yet — wait for it 👀")}
                    </div>
                  )}
                  {viewers?.map((v) => (
                    <div key={v.user.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
                      <MeevCat
                        seed={v.user.avatarSeed}
                        fallback={v.user.id}
                        size={38}
                        level={v.user.level}
                        presence="hidden"
                        avatarPhoto={v.user.avatarPhoto}
                        name={v.user.displayName}
                      />
                      <div className="min-w-0 flex-1">
                        <MeevName displayName={v.user.displayName} level={v.user.level} nameColor={v.user.nameColor} nameFx={v.user.nameFx} compact />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(v.viewedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* v8: delete confirmation (my stories only) */}
          {delConfirm && (
            <div className="absolute inset-0 z-[110] bg-black/70 backdrop-blur-md grid place-items-center p-6" onClick={() => !delBusy && setDelConfirm(false)}>
              <div className="glass rounded-3xl p-5 w-full max-w-xs text-center space-y-3" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={L("حذف القصة", "Delete story")}>
                <div className="size-12 mx-auto grid place-items-center rounded-full bg-rose-500/15 text-rose-400">
                  <Trash2 className="size-6" />
                </div>
                <div className="font-black">{L("حذف هذه القصة؟", "Delete this story?")}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {L("ستختفي فوراً عن الجميع ولا يمكن التراجع.", "It disappears for everyone immediately — this can't be undone.")}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="rounded-xl flex-1" disabled={delBusy} onClick={() => setDelConfirm(false)}>
                    {L("إلغاء", "Cancel")}
                  </Button>
                  <Button variant="destructive" className="rounded-xl flex-1 gap-1.5" disabled={delBusy} onClick={deleteStory}>
                    {delBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    {L("حذف", "Delete")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>{/* /THE STAGE — every layer above is confined to it */}

        {/* v12: desktop side-nav — elegant glass arrows flanking the stage
            (the left/right tap halves get small on a narrow 26rem stage).
            Physical left/right, matching the tap zones + arrow keys.
            20rem = 13 (half stage) + 4 (gap) + 3 (button width). */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); back(); }}
          className={cn(
            "hidden lg:grid absolute top-1/2 -translate-y-1/2 size-12 place-items-center rounded-full bg-white/10 backdrop-blur-md border border-white/25 text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,.55)] transition-all hover:bg-white/25 hover:scale-110 active:scale-95 z-[80]",
            atStart && "opacity-40 pointer-events-none"
          )}
          style={{ left: "calc(50% - 20rem)" }}
          aria-label="Previous pulse"
        >
          <ChevronLeft className="size-7" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); advance(); }}
          className="hidden lg:grid absolute top-1/2 -translate-y-1/2 size-12 place-items-center rounded-full bg-white/10 backdrop-blur-md border border-white/25 text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,.55)] transition-all hover:bg-white/25 hover:scale-110 active:scale-95 z-[80]"
          style={{ right: "calc(50% - 20rem)" }}
          aria-label="Next pulse"
        >
          <ChevronRight className="size-7" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------- Post card ----------------

// v16: the seven Facebook-style reactions — real, beautiful emojis (the user
// spec: "مش دوائر" — no circles, no icon chips). Facebook's own set, polished:
// Like, Love, Care, Haha, Wow, Sad, Angry. Each renders as the bare emoji with
// a soft glow — precise, joyful, instantly readable.
const REACTIONS: {
  kind: ReactionKind;
  ar: string;
  en: string;
  emoji: string;
  label: string;
}[] = [
  { kind: "like", ar: "جام", en: "Like", emoji: "👍", label: "text-amber-400" },
  { kind: "love", ar: "أحببته", en: "Love", emoji: "❤️", label: "text-rose-500" },
  { kind: "care", ar: "يدعم", en: "Care", emoji: "🥰", label: "text-amber-300" },
  { kind: "laugh", ar: "أضحكني", en: "Haha", emoji: "😂", label: "text-amber-300" },
  { kind: "wow", ar: "أذهلني", en: "Wow", emoji: "😮", label: "text-sky-300" },
  { kind: "sad", ar: "أحزنني", en: "Sad", emoji: "😢", label: "text-slate-300" },
  { kind: "angry", ar: "أغضبني", en: "Angry", emoji: "😡", label: "text-red-400" },
];

const reactionOf = (kind: ReactionKind) => REACTIONS.find((r) => r.kind === kind) ?? REACTIONS[0];

function PostCard({ post }: { post: PostDTO }) {
  const me = useMeev((s) => s.me);
  const openProfile = useMeev((s) => s.openProfile);
  const { toast } = useToast();
  const { L } = useI18n();
  // v13: reaction state (my kind + per-kind counts) — tolerates older payloads
  const [myReaction, setMyReaction] = useState<ReactionKind | null>(
    post.myReaction ?? (post.likedByMe ? "like" : null),
  );
  const [reactions, setReactions] = useState<ReactionCounts>(
    post.reactions ?? { like: post.likeCount, love: 0, care: 0, laugh: 0, wow: 0, sad: 0, angry: 0 },
  );
  const [burst, setBurst] = useState<{ n: number; kind: ReactionKind } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentDTO[] | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [shareOpen, setShareOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  // v13: follow chip (feed passes the current state)
  const [following, setFollowing] = useState(!!post.authorFollowedByMe);
  const [followBusy, setFollowBusy] = useState(false);

  const total = REACTIONS.reduce((sum, r) => sum + reactions[r.kind], 0);
  const mine = myReaction ? reactionOf(myReaction) : null;

  // long-press (mobile) + hover (desktop) timers for the reaction picker
  const pressTimer = useRef<number | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  useEffect(
    () => () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    },
    [],
  );

  // auto-dismiss the reaction burst (Facebook-style pop then fade)
  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(null), 950);
    return () => window.clearTimeout(t);
  }, [burst]);

  // reaction engine: optimistic switch/remove, then the server truth
  const doReact = async (kind: ReactionKind) => {
    const prevCounts = { ...reactions };
    const prevMine = myReaction;
    const nextCounts = { ...reactions };
    if (myReaction) nextCounts[myReaction] = Math.max(0, nextCounts[myReaction] - 1);
    const removing = myReaction === kind;
    if (!removing) {
      nextCounts[kind] += 1;
      try {
        localStorage.setItem("meev:last-reaction", kind);
      } catch { /* private mode */ }
    }
    setReactions(nextCounts);
    setMyReaction(removing ? null : kind);
    if (!removing) setBurst({ n: (burst?.n ?? 0) + 1, kind });
    setPickerOpen(false);
    try {
      const r = await api.react(post.id, kind);
      setReactions(r.counts);
      setMyReaction(r.liked ? (r.kind ?? kind) : null);
    } catch {
      setReactions(prevCounts);
      setMyReaction(prevMine);
    }
  };

  // click = last-used-or-default reaction; long-press / hover = the picker
  const quickReact = () => {
    if (myReaction) {
      doReact(myReaction);
      return;
    }
    let last: ReactionKind = "like";
    try {
      const saved = localStorage.getItem("meev:last-reaction");
      if (saved && REACTIONS.some((r) => r.kind === saved)) last = saved as ReactionKind;
    } catch { /* private mode */ }
    doReact(last);
  };

  const onLikePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    suppressClick.current = false;
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      suppressClick.current = true;
      setPickerOpen(true);
      navigator.vibrate?.(12);
    }, 380);
  };
  const clearPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const clearHover = () => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const toggleFollow = async () => {
    if (followBusy) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      if (next) await api.follow(post.author.id);
      else await api.unfollow(post.author.id);
    } catch {
      setFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  };

  const loadComments = () => {
    setShowComments((v) => !v);
    if (comments === null && !showComments) {
      api.comments(post.id).then((r) => setComments(r.comments)).catch(() => setComments([]));
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText("");
    try {
      const r = await api.addComment(post.id, text);
      setComments((c) => [...(c || []), r.comment]);
      setCommentCount((n) => n + 1);
    } catch (e) {
      toast({
        title: L("فشل إرسال التعليق", "Comment failed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
  };

  // reaction summary chips: kinds present (max 3), biggest first
  const kindsPresent = REACTIONS.filter((r) => reactions[r.kind] > 0)
    .sort((a, b) => reactions[b.kind] - reactions[a.kind])
    .slice(0, 3);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl overflow-hidden transition-all hover:border-primary/30 hover:shadow-[0_24px_60px_-32px_rgba(0,0,0,0.5)]"
    >
      {/* header — avatar + MeevName + time + follow state + gift */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <button onClick={() => openProfile(post.author.username)} className="shrink-0 rounded-full" aria-label={L(`ملف ${post.author.displayName}`, `Open ${post.author.displayName}`)}>
          <MeevCat seed={post.author.avatarSeed} fallback={post.author.id} size={44} level={post.author.level} presence={post.author.presence} avatarPhoto={post.author.avatarPhoto} frameKey={post.author.frameKey} avatarAcc={post.author.avatarAcc} name={post.author.displayName} />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => openProfile(post.author.username)} className="flex items-center gap-1.5 flex-wrap text-start">
            <MeevName displayName={post.author.displayName} level={post.author.level} nameColor={post.author.nameColor} nameFx={post.author.nameFx} />
            <LevelPill level={post.author.level} />
          </button>
          <div className="text-[11px] text-muted-foreground truncate">
            <span dir="ltr">@{post.author.username}</span> · {timeAgo(post.createdAt)}
          </div>
        </div>
        {me && post.author.id !== me.id && (
          <button
            onClick={toggleFollow}
            disabled={followBusy}
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-bold shrink-0 transition-all active:scale-95",
              following
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "meev-gradient-btn shadow-[0_6px_16px_-8px_rgba(120,100,40,0.9)]"
            )}
            aria-pressed={following}
            aria-label={following ? L(`إلغاء متابعة ${post.author.displayName}`, `Unfollow ${post.author.displayName}`) : L(`متابعة ${post.author.displayName}`, `Follow ${post.author.displayName}`)}
          >
            {following ? <UserCheck className="size-3.5" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
            {following ? L("متابع", "Following") : L("متابعة", "Follow")}
          </button>
        )}
        {/* (v16: post gifting is REMOVED — gifts live only in live rooms and private chats, per spec) */}
      </div>

      {/* content */}
      {post.content && (
        <p className="px-5 pb-3 text-[15px] leading-relaxed whitespace-pre-wrap">{post.content}</p>
      )}

      {/* image — rounded card + reaction burst */}
      {post.imageUrl && !imgError && (
        <div className="px-4 pb-3">
          <button
            className="relative w-full rounded-2xl overflow-hidden group ring-1 ring-border/40"
            onClick={() => doReact(myReaction ?? "love")}
            aria-label={L("تفاعل مع المنشور", "React to post")}
          >
            <img
              src={post.imageUrl}
              alt={L("صورة المنشور", "Post image")}
              className="w-full max-h-[460px] object-cover group-hover:scale-[1.015] transition-transform duration-500"
              onError={() => setImgError(true)}
            />
            <AnimatePresence>
              {burst && (
                <motion.div
                  key={burst.n}
                  initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
                  animate={{ scale: 1.15, opacity: 1, rotate: 0 }}
                  exit={{ scale: 1.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                  className="absolute inset-0 grid place-items-center pointer-events-none"
                >
                  {(() => {
                    const r = reactionOf(burst.kind);
                    return (
                      <span className="text-[92px] leading-none select-none drop-shadow-[0_10px_28px_rgba(0,0,0,.45)]" role="img" aria-label={r.en}>
                        {r.emoji}
                      </span>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>
      )}

      {/* reaction summary — bare emojis stacked Facebook-style + total
          (v16: no circles, no chips — the emojis themselves, softly stacked) */}
      {(total > 0 || commentCount > 0) && (
        <div className="flex items-center gap-2 px-5 pb-2 text-xs text-muted-foreground">
          {kindsPresent.length > 0 && (
            <button
              className="flex items-center hover:opacity-80 transition-opacity"
              onClick={() => setPickerOpen(true)}
              aria-label={L(`${total} تفاعل`, `${total} reactions`)}
            >
              {kindsPresent.map((r, i) => (
                <span
                  key={r.kind}
                  className={cn("text-[17px] leading-none select-none", i > 0 && "-ms-1.5")}
                  style={{ zIndex: kindsPresent.length - i }}
                  aria-hidden="true"
                >
                  {r.emoji}
                </span>
              ))}
              <span className="ms-1.5 font-semibold tabular-nums">{total}</span>
            </button>
          )}
          {total > 0 && commentCount > 0 && <span aria-hidden="true">·</span>}
          {commentCount > 0 && (
            <button className="hover:underline font-semibold" onClick={loadComments}>
              {commentCount} {L("تعليق", commentCount === 1 ? "comment" : "comments")}
            </button>
          )}
          <span className="ms-auto text-[10px]">{timeAgo(post.createdAt)}</span>
        </div>
      )}

      {/* actions — جام | تعليق | مشاركة (44px touch targets) */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-1">
        {/* like + the reaction picker */}
        <div className="relative flex-1 min-w-0">
          <Button
            variant="ghost"
            className={cn(
              "w-full h-11 rounded-xl gap-2 font-semibold transition-all active:scale-95 select-none touch-none",
              mine ? mine.label : "text-muted-foreground",
              mine && "hover:bg-white/5"
            )}
            aria-pressed={!!myReaction}
            aria-label={mine ? L(`${mine.ar} — اضغط للإلغاء`, `${mine.en} — press to remove`) : L("جام — اضغط مطولاً لمزيد", "Like — hold for more")}
            aria-expanded={pickerOpen}
            aria-haspopup="menu"
            onPointerDown={onLikePointerDown}
            onPointerUp={clearPress}
            onPointerCancel={clearPress}
            onPointerLeave={() => {
              clearPress();
              clearHover();
            }}
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              hoverTimer.current = window.setTimeout(() => setPickerOpen(true), 240);
            }}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              quickReact();
            }}
          >
            <motion.span whileTap={{ scale: 1.4 }} className="grid place-items-center">
              {(() => {
                const r = mine ?? reactionOf("like");
                return (
                  <span className={cn("text-lg leading-none select-none", mine && "drop-shadow-[0_2px_6px_rgba(0,0,0,.25)]")} role="img" aria-hidden="true">
                    {r.emoji}
                  </span>
                );
              })()}
            </motion.span>
            <span className="text-sm truncate">{mine ? L(mine.ar, mine.en) : L("جام", "Like")}</span>
          </Button>

          {/* the 7-emoji reaction picker (long-press / hover) — the Facebook
              bar: each emoji springs in, then pops up + wiggles on hover */}
          <AnimatePresence>
            {pickerOpen && (
              <>
                <button
                  className="fixed inset-0 z-20 cursor-default"
                  aria-label={L("إغلاق قائمة التفاعلات", "Close reaction picker")}
                  onClick={() => setPickerOpen(false)}
                  tabIndex={-1}
                />
                <motion.div
                  role="menu"
                  aria-label={L("اختر تفاعلك", "Pick your reaction")}
                  initial={{ opacity: 0, y: 8, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 420, damping: 24 }}
                  className="absolute bottom-full mb-2 start-1 z-30 glass rounded-full border border-border/60 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] px-2 py-1.5 flex items-center gap-0.5"
                >
                  {REACTIONS.map((r, i) => {
                    const active = myReaction === r.kind;
                    return (
                      <motion.button
                        key={r.kind}
                        role="menuitem"
                        initial={{ scale: 0, y: 10 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: i * 0.04, type: "spring", stiffness: 400, damping: 18 }}
                        whileHover={{ scale: 1.45, y: -7 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => doReact(r.kind)}
                        className={cn(
                          "relative size-11 grid place-items-center rounded-full transition-colors group",
                          active ? "bg-white/15 ring-1 ring-white/20" : "hover:bg-white/10"
                        )}
                        aria-label={L(r.ar, r.en)}
                        title={L(r.ar, r.en)}
                      >
                        <span className="text-[26px] leading-none select-none meev-react-emoji" aria-hidden="true">
                          {r.emoji}
                        </span>
                        {/* the floating label on hover (Facebook's tooltip) */}
                        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background opacity-0 scale-90 transition-all group-hover:opacity-100 group-hover:scale-100">
                          {L(r.ar, r.en)}
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <Button
          variant="ghost"
          className={cn("flex-1 min-w-0 h-11 rounded-xl gap-2 font-semibold transition-all active:scale-95", showComments ? "text-primary bg-primary/10" : "text-muted-foreground")}
          onClick={loadComments}
          aria-expanded={showComments}
          aria-label={L("التعليقات", "Comments")}
        >
          <MessageCircle className="size-5 shrink-0" />
          <span className="text-sm truncate">{L("تعليق", "Comment")}</span>
        </Button>

        <Button
          variant="ghost"
          className="flex-1 min-w-0 h-11 rounded-xl gap-2 font-semibold text-muted-foreground transition-all active:scale-95"
          onClick={() => setShareOpen(true)}
          aria-label={L("شارك مع صديق", "Share with a friend")}
        >
          <Share2 className="size-5 shrink-0" />
          <span className="text-sm truncate">{L("مشاركة", "Share")}</span>
        </Button>
      </div>

      {/* comments — bubbles with avatars, names, timestamps */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/50 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
              {comments === null && (
                <div className="space-y-2.5">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-2.5 items-start animate-pulse">
                      <div className="size-8 rounded-full bg-white/10 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-24 rounded bg-white/10" />
                        <div className="h-3 w-3/4 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {comments?.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-2">
                  {L("لا تعليقات بعد — ابدأ النقاش!", "No comments yet — start the conversation!")}
                </div>
              )}
              {comments?.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5 items-start group"
                >
                  <button onClick={() => openProfile(c.author.username)} className="shrink-0 mt-0.5" aria-label={L(`ملف ${c.author.displayName}`, `Open ${c.author.displayName}`)}>
                    <MeevCat seed={c.author.avatarSeed} fallback={c.author.id} size={32} level={c.author.level} presence="hidden" avatarPhoto={c.author.avatarPhoto} name={c.author.displayName} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="rounded-2xl rounded-ss-md bg-white/[0.06] border border-border/40 px-3 py-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => openProfile(c.author.username)} className="hover:underline">
                          <MeevName displayName={c.author.displayName} level={c.author.level} nameColor={c.author.nameColor} nameFx={c.author.nameFx} compact />
                        </button>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      </div>
                      <div className="text-sm leading-relaxed break-words whitespace-pre-wrap mt-0.5">{c.content}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex gap-2 items-center px-4 pb-4">
              {me && (
                <MeevCat seed={me.avatarSeed || ""} fallback={me.id || "me"} size={32} level={me.level} presence="hidden" avatarPhoto={me.avatarPhoto} name={me.displayName} className="shrink-0" />
              )}
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                placeholder={me ? L("اكتب تعليقاً…", "Write a comment…") : L("سجّق للتعليق", "Sign in to comment")}
                disabled={!me}
                className="flex-1 rounded-full bg-background/60 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
                aria-label={L("تعليق جديد", "New comment")}
              />
              <Button
                size="icon"
                className="rounded-full meev-gradient-btn text-white shrink-0 size-10"
                onClick={submitComment}
                disabled={!commentText.trim()}
                aria-label={L("إرسال التعليق", "Send comment")}
              >
                <Send className="size-4 flip-rtl" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareSheet post={{ id: post.id, author: post.author.username }} open={shareOpen} onClose={() => setShareOpen(false)} />
    </motion.article>
  );
}

// ---------------- Today's Rewards bento (v2) ----------------
function RewardsBento() {
  const me = useMeev((s) => s.me);
  const setView = useMeev((s) => s.setView);
  const { L } = useI18n();
  const { toast } = useToast();
  const [spinOpen, setSpinOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  const nextSpinAt = me?.lastSpinAt ? new Date(me.lastSpinAt).getTime() + SPIN_COOLDOWN_HOURS * 3600 * 1000 : 0;
  const available = !nextSpinAt || nextSpinAt <= now;

  // live countdown while the wheel is on cooldown
  useEffect(() => {
    if (available) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [available]);

  const countdown = nextSpinAt ? nextSpinAt - now : 0;
  const h = Math.floor(countdown / 3600000);
  const m = Math.floor((countdown % 3600000) / 60000);
  const s = Math.floor((countdown % 60000) / 1000);

  const intoLevel = (me?.xp ?? 0) % XP_PER_LEVEL;
  const levelPct = Math.min(100, (intoLevel / XP_PER_LEVEL) * 100);
  const nextUnlock = LEVEL_UNLOCKS.find((u) => u.level > (me?.level ?? 0));

  // v5: closable rewards — the user can dismiss the bento and keep browsing
  // the feed; a slim strip keeps the weekly spin one tap away.
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <section aria-label={L("مكافآت الأسبوع", "This week's rewards")}>
        <button
          onClick={() => setDismissed(false)}
          className="w-full glass rounded-2xl px-4 h-11 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          <Dices className="size-4 text-amber-400" />
          {L("مكافآت الأسبوع — اضغط للعرض", "This week's rewards — tap to view")}
          <ChevronDown className="size-4 ms-auto" />
        </button>
      </section>
    );
  }

  return (
    <section aria-label={L("مكافآت الأسبوع", "This week's rewards")} className="space-y-2.5">
      <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Sparkles className="size-3.5 text-amber-400" />
        {L("مكافآت الأسبوع", "This week's rewards")}
        <button
          onClick={() => setDismissed(true)}
          className="ms-auto size-6 grid place-items-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-colors"
          aria-label={L("إغلاق المكافآت ومتابعة التصفح", "Close rewards & keep browsing")}
          title={L("إغلاق", "Close")}
        >
          <X className="size-3.5" />
        </button>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* ---- weekly spin (v3 economy: 0–5 coins/week) — v14: brand gold border ---- */}
        <div className="rounded-3xl p-[1.5px] bg-gradient-to-br from-[#C5B767] via-[#DDD6B4] to-[#C5B767] shadow-lg">
          <div className="rounded-3xl bg-card h-full p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <Dices className="size-7 text-amber-400" aria-hidden="true" />
              <PawCoins amount={me?.coins ?? 0} size={16} />
            </div>
            <div className="font-black leading-tight">{L("عجلة الأسبوع", "Weekly Spin")}</div>
            <Button
              className={cn(
                "w-full rounded-2xl font-bold gap-1.5 h-11",
                available ? "meev-gradient-btn text-white" : "bg-white/5 hover:bg-white/10"
              )}
              disabled={!available}
              onClick={() => setSpinOpen(true)}
            >
              <Dices className="size-4" />
              {available
                ? L("دوّر العجلة!", "SPIN THE WHEEL!")
                : L(
                    `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} للفة القادمة`,
                    `Next spin ${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                  )}
            </Button>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {L(`حتى ٥ ذهب ميف أسبوعياً 💎 — لفة كل أسبوع`, `Up to 5 Gold Meev weekly 💎 — one spin per week`)}
            </p>
          </div>
        </div>

        {/* ---- level progress ---- */}
        <div className="glass rounded-3xl p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-400" />
              <div className="font-black leading-tight">{L("مستواك", "Your level")}</div>
            </div>
            <span className="text-2xl font-black meev-aurora-text leading-none">{me?.level ?? 0}</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={Math.round(levelPct)} aria-valuemin={0} aria-valuemax={100} aria-label={L("تقدم المستوى", "Level progress")}>
            <motion.div
              className="h-full rounded-full meev-gradient-btn"
              initial={{ width: 0 }}
              animate={{ width: `${levelPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {L(
              `${intoLevel}/${XP_PER_LEVEL} نحو المستوى ${(me?.level ?? 0) + 1} · كل ساعة تفاعل = نقطة`,
              `${intoLevel}/${XP_PER_LEVEL} to level ${(me?.level ?? 0) + 1} · 1 active hour = 1 point`
            )}
            {nextUnlock ? (
              <span className="block mt-0.5">
                {L(
                  `(${nextUnlock.level}: ${nextUnlock.title})`,
                  `(lvl ${nextUnlock.level} — ${nextUnlock.title})`
                )}
              </span>
            ) : (
              <span className="block mt-0.5">{L("أنت أسطورة ميف! 👑", "You are a Meev legend! 👑")}</span>
            )}
          </p>
        </div>
      </div>

      <SpinWheelDialog open={spinOpen} onClose={() => setSpinOpen(false)} />
    </section>
  );
}

// ---------------- Home view ----------------
export function HomeView() {
  const me = useMeev((s) => s.me);
  const { L } = useI18n();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "following">("all");
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  // v6: myStories is the FLAT list from the API — my group is built locally
  const [myStories, setMyStories] = useState<StoryDTO[]>([]);
  const [viewingStory, setViewingStory] = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeText, setComposeText] = useState("");
  const [composeImage, setComposeImage] = useState<File | null>(null);
  const [composeImageUrl, setComposeImageUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [storyGradient, setStoryGradient] = useState("sunset");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFeed = useCallback(async (p: number, f: "all" | "following", replace = false) => {
    try {
      const r = await api.feed(p, f);
      setPosts((prev) => (replace ? r.posts : [...prev, ...r.posts]));
      setHasMore(r.hasMore);
      setPage(p);
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, []);

  const loadStories = useCallback(async () => {
    try {
      const r = await api.stories();
      setStoryGroups(r.groups);
      const mine = Array.isArray(r.myStories) ? r.myStories : [];
      setMyStories(mine);
      // v15: MY avatar wears the gold ring while my own pulse is unseen
      // (a fresh post I haven't watched yet) — powers the top-bar avatar
      // ring; the rail tile reads the same flag from myStories
      useMeev
        .getState()
        .setMyPulseUnseen(mine.length > 0 && !mine.every((s) => s.viewedByMe));
    } catch { /* offline */ }
  }, []);

  // v6: my group first (like Instagram's "Your story" at the head of the rail)
  const allGroups = useMemo<StoryGroup[]>(() => {
    if (!me || myStories.length === 0) return storyGroups;
    return [{ author: me, stories: myStories }, ...storyGroups];
  }, [me, myStories, storyGroups]);

  // v15: my own pulse is UNSEEN (fresh post I haven't watched) — my tile
  // and my top-bar avatar wear the gold ring until I watch it, then the
  // ring melts to fully transparent ("لما ترا سطوري ترجع شفاف")
  const myUnviewed = myStories.length > 0 && !myStories.every((s) => s.viewedByMe);

  // v14: the SMART REVEAL — while there are UNSEEN pulses ("منشورات
  // جديدة"), the World Live panel and the weekly rewards bento stay
  // hidden so the new pulses own the stage; the moment every new pulse
  // has been watched, both sections glide in (user: "تختفي كليا لما تكون
  // منشورات جديدة… تجي فقط عندما تنتهي منشورات جديدة… بذكاء").
  const unseenCount = useMemo(
    () => storyGroups.filter((g) => !g.stories.every((s) => s.viewedByMe)).length,
    [storyGroups],
  );
  const hasUnseen = unseenCount > 0;

  const openStoriesAt = (i: number) => setViewingStory({ groups: allGroups, index: i });

  useEffect(() => {
    setLoading(true);
    loadFeed(1, filter, true);
  }, [filter, loadFeed]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const submitPost = async () => {
    const content = composeText.trim();
    if (!content && !composeImage) return;
    setComposing(true);
    try {
      let imageUrl: string | undefined;
      if (composeImage) {
        const up = await api.upload(composeImage);
        imageUrl = up.url;
      }
      const r = await api.createPost({ content, imageUrl });
      setPosts((prev) => [r.post, ...prev]);
      useMeev.getState().patchMe({ xp: (me?.xp ?? 0) + 5 });
      setComposerOpen(false);
      setComposeText("");
      setComposeImage(null);
      setComposeImageUrl(null);
      toast({ title: L("نُشر! ✨", "Posted! ✨") });
    } catch (e) {
      toast({ title: L("فشل النشر", "Post failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setComposing(false);
    }
  };

  const submitStory = async () => {
    const content = storyText.trim();
    if (!content) return;
    try {
      await api.createStory({ kind: "text", content, gradient: storyGradient });
      setStoryComposerOpen(false);
      setStoryText("");
      loadStories();
      toast({ title: L("نبضتك حيّة ٢٤ ساعة — ظاهرة للجميع الآن ✨", "Your pulse is live for 24h — visible to everyone now ✨") });
    } catch (e) {
      toast({ title: L("فشل نشر القصة", "Story failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24 md:pb-8">
        {/* header — v13: NOT sticky anymore (the old sticky band was the
            "black window" that slid over the pulse rail). v14: the rail
            itself is now calm — clean gold rings, nothing to cover. */}
        <div className="flex items-center gap-3 px-0.5 py-2">
          <MeevLogo size={34} mood="happy" />
          <h1 className="text-xl font-black tracking-tight">{L("الرئيسية", "Home")}</h1>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "following")} className="ml-auto">
            <TabsList className="glass rounded-full h-8 p-0.5">
              <TabsTrigger value="all" className="rounded-full h-7 px-3 text-xs data-[state=active]:bg-primary/20">{L("لك", "For you")}</TabsTrigger>
              <TabsTrigger value="following" className="rounded-full h-7 px-3 text-xs data-[state=active]:bg-primary/20">{L("متابَعوك", "Following")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ============ v14: MEEV PULSE — النبض (the CALM rail) ============
            One identity, zero noise: every pulse is an avatar in a clean
            circle wearing a LIGHT ring in the site's gold gradient —
            exactly like Instagram, "مطور ومتقن". Unseen = full ring;
            seen = the ring at rest. No decay arcs, no satellites, no
            constellation threads, no glow, no per-vibe neon hues, and
            avatars ride the rail WITHOUT their frame effects (user:
            "بروفيلات الناس يلي حاطين نبض بدون افكت"). Tap opens the
            full-bleed cinema. */}
        <section aria-label={L("نبض Meev", "Meev Pulse")} className="pt-2 pb-1 relative">
          <div className="flex gap-3 overflow-x-auto no-scrollbar pt-5 pb-1.5 px-0.5 relative meev-drag-rail">
            {/* v14: the launch tile — a clean MARK only: dashed gold circle
                + gold glyph. No gradient fill, no glow, no ping halo
                (user: "خلي تبع اطلق نبض شعار فقط بدون اي ضوء وخلفية").
                It vanishes once your pulse is live; add-another lives in
                the viewer. */}
            {myStories.length === 0 ? (
              <button
                className="flex flex-col items-center gap-1.5 shrink-0 group"
                onClick={() => setStoryComposerOpen(true)}
                aria-label={L("أطلق نبضة", "Launch a pulse")}
                title={L("نبضتك تعيش ٢٤ ساعة — شارك لحظة واحدة مع العالم", "Your pulse lives 24h — share one moment with the world")}
              >
                <span className="relative size-16 grid place-items-center rounded-full border-2 border-dashed border-primary/45 group-hover:border-primary group-hover:scale-105 group-active:scale-95 transition-all">
                  <Activity className="size-7 text-primary" strokeWidth={2.2} />
                </span>
                <span className="text-[10px] font-bold text-primary">{L("أطلق نبضة", "New pulse")}</span>
              </button>
            ) : (
              <button className="flex flex-col items-center gap-1 shrink-0" onClick={() => openStoriesAt(0)} aria-label={L("نبضتك", "Your pulse")} title={L("نبضتك — حيّة ٢٤ ساعة", "Your pulse — alive for 24h")}>
                <PulseRing unviewed={myUnviewed} rest="clear" label={L("نبضتك", "Your pulse")}>
                  <MeevCat seed={me?.avatarSeed || ""} fallback={me?.id || "me"} size={50} presence="hidden" avatarPhoto={me?.avatarPhoto} avatarAcc={me?.avatarAcc} name={me?.displayName} />
                </PulseRing>
                <span className="text-[10px] text-muted-foreground">{L("نبضتك", "Your pulse")}</span>
              </button>
            )}
            {storyGroups.map((g) => {
              const gi = allGroups.findIndex((a) => a.author.id === g.author.id);
              const unviewed = !g.stories.every((s) => s.viewedByMe);
              return (
                <button key={g.author.id} className="flex flex-col items-center gap-1 shrink-0" onClick={() => openStoriesAt(gi < 0 ? 0 : gi)} aria-label={`${g.author.displayName} — ${L("نبضة حية", "live pulse")}`} title={L("نبضة تختفي بعد ٢٤ ساعة", "A pulse — gone in 24h")}>
                  <PulseRing unviewed={unviewed} label={`${g.author.displayName}`}>
                    <MeevCat seed={g.author.avatarSeed} fallback={g.author.id} size={50} presence="hidden" avatarPhoto={g.author.avatarPhoto} avatarAcc={g.author.avatarAcc} name={g.author.displayName} />
                  </PulseRing>
                  <span className="text-[10px] text-muted-foreground max-w-16 truncate">{g.author.displayName}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* v14: THE SMART REVEAL — while new pulses are waiting, World Live
            + the rewards bento stay completely hidden; once every new pulse
            has been watched they glide in together ("بذكاء"). A one-line
            hint keeps the behavior discoverable. */}
        {hasUnseen ? (
          <div className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-2xl border border-dashed border-border/70 text-[11px] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary shrink-0" aria-hidden="true" />
            <span>
              {L(
                `${unseenCount} ${unseenCount === 1 ? "نبضة جديدة" : "نبضات جديدة"} — شاهدها لتظهر نبض العالم ومكافآت الأسبوع`,
                `${unseenCount} new ${unseenCount === 1 ? "pulse" : "pulses"} — watch them to reveal World Live & this week's rewards`
              )}
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <motion.div
              key="meev-smart-reveal"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="space-y-4"
            >
              {/* v12: MEEV WORLD LIVE — the planet's always-alive ticker (2-d):
                  live world stats + rotating facts/news/weather, zero network */}
              <WorldLive />

              {/* v2: today's rewards bento (spin / level) */}
              <RewardsBento />
            </motion.div>
          </AnimatePresence>
        )}

        {/* composer trigger */}
        <button
          onClick={() => setComposerOpen(true)}
          className="glass rounded-3xl p-4 flex items-center gap-3 text-left hover:border-primary/30 transition-colors w-full"
        >
          <MeevCat seed={me?.avatarSeed || ""} fallback={me?.id || "me"} size={40} level={me?.level} presence="hidden" avatarPhoto={me?.avatarPhoto} frameKey={me?.frameKey} avatarAcc={me?.avatarAcc} name={me?.displayName} />
          <span className="text-sm text-muted-foreground flex-1">{L("شارك شيئاً مع أصدقائك يا", "Share something with your friends,")} {me?.displayName?.split(" ")[0]}…</span>
          <span className="size-9 grid place-items-center rounded-full meev-gradient-btn text-white shrink-0">
            <ImagePlus className="size-4" />
          </span>
        </button>

        {/* feed */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-3xl p-4 space-y-3 animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="size-11 rounded-full bg-white/10" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-28 rounded bg-white/10" />
                    <div className="h-2.5 w-16 rounded bg-white/5" />
                  </div>
                </div>
                <div className="h-2.5 w-3/4 rounded bg-white/10" />
                <div className="h-56 rounded-2xl bg-white/5" />
              </div>
            ))}
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="glass rounded-3xl p-10 text-center space-y-3">
            <MeevLogo size={70} mood="sad" />
            <div className="font-semibold">{L("لا شيء هنا بعد", "Nothing here yet")}</div>
            <div className="text-sm text-muted-foreground">{L("تابع بعض الأصدقاء أو بدّل إلى «لك».", "Follow some friends or switch to “For you”.")}</div>
          </div>
        )}
        {posts.map((p) => <PostCard key={p.id} post={p} />)}

        {hasMore && (
          <Button variant="outline" className="w-full rounded-2xl" onClick={() => loadFeed(page + 1, filter)}>
            {L("تحميل المزيد", "Load more")} <ChevronRight className="size-4 flip-rtl" />
          </Button>
        )}
      </div>

      {/* post composer dialog — v5: emoji + image + counter */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-lg rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> {L("إنشاء منشور", "Create a post")}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value.slice(0, 2000))}
              placeholder={L("ما الجديد في عالمك؟", "What's happening in your world?")}
              className="min-h-28 rounded-2xl bg-background/50 resize-none pe-14"
            />
            <span className="absolute bottom-3 end-3 text-[10px] text-muted-foreground tabular-nums bg-background/80 rounded-full px-1.5 py-0.5">
              {composeText.length}/2000
            </span>
          </div>
          {composeImage && (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={composeImageUrl || ""} alt={L("معاينة الصورة", "Upload preview")} className="max-h-64 w-full object-cover" />
              <button className="absolute top-2 end-2 size-8 grid place-items-center rounded-full bg-black/60 text-white" onClick={() => { setComposeImage(null); setComposeImageUrl(null); }} aria-label={L("إزالة الصورة", "Remove image")}>
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="rounded-xl gap-2 h-9" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-4" /> {composeImage ? L("تغيير الصورة", "Change image") : L("إضافة صورة", "Add image")}
            </Button>
            <EmojiPicker onPick={(e) => setComposeText((t) => (t + e).slice(0, 2000))} />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setComposeImage(f);
                  setComposeImageUrl(URL.createObjectURL(f));
                }
              }}
            />
            <Button className="rounded-xl meev-gradient-btn text-white font-bold px-6 ms-auto" disabled={composing || (!composeText.trim() && !composeImage)} onClick={submitPost}>
              {composing ? L("جارٍ النشر…", "Posting…") : L("نشر", "Post")}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3 text-amber-400" />
            {L("حماية تلقائية: سبام محدود ٦ منشورات/ساعة + فلترة إساءة + فحص ذكي للصور 🛡️", "Automatic protection: 6 posts/hour limit + abuse filtering + smart image screening 🛡️")}
          </p>
        </DialogContent>
      </Dialog>

      {/* v14: the PULSE COMPOSER — a calm launch form: the gradient
          preview + the thought + the vibe picker. The v12 particle
          preview inside the box is RETIRED (user: the lights/effects
          inside the bordered box looked bad — "بدون اي ضوء وخلفية");
          the vibe still paints the gradient + the cinema's particles. */}
      <Dialog open={storyComposerOpen} onOpenChange={setStoryComposerOpen}>
        <DialogContent className="max-w-sm rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" /> {L("أطلق نبضة", "Launch a pulse")}</DialogTitle>
          </DialogHeader>
          <div
            className="rounded-2xl h-52 grid place-items-center p-6 text-center cursor-pointer relative overflow-hidden"
            style={{ background: STORY_GRADIENTS[storyGradient] }}
          >
            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value.slice(0, 30))}
              placeholder={L("ماذا ينبض في عالمك الآن؟", "What's pulsing in your world right now?")}
              className="bg-transparent border-none outline-none text-center text-xl font-bold text-white placeholder:text-white/60 w-full resize-none focus:outline-none"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PULSE_VIBES.map((v) => (
              <button
                key={v.key}
                className={cn(
                  "rounded-2xl p-2 flex flex-col items-center gap-0.5 transition-all",
                  storyGradient === v.key
                    ? "scale-105 shadow-md"
                    : "bg-white/5 hover:bg-white/10 hover:scale-105"
                )}
                style={storyGradient === v.key ? { background: `${v.hue}24` } : undefined}
                onClick={() => setStoryGradient(v.key)}
                aria-pressed={storyGradient === v.key}
                aria-label={L(v.labelAr, v.label)}
              >
                <span className="text-xl leading-none">{v.emoji}</span>
                <span className="text-[10px] font-bold" style={{ color: v.hue }}>{L(v.labelAr, v.label)}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <EmojiPicker onPick={(e) => setStoryText((t) => (t + e).slice(0, 30))} align="end" />
            <span className="text-[10px] text-muted-foreground tabular-nums ms-auto">{storyText.length}/30</span>
          </div>
          <Button className="w-full rounded-xl meev-gradient-btn font-bold" disabled={!storyText.trim()} onClick={submitStory}>
            {L("أطلقها — حيّة ٢٤ ساعة", "Launch it — alive 24h")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* v6: Instagram-style story viewer (reactions / reply / viewers "vu")
          v8: + delete my story, live 24h countdown, add-another */}
      {viewingStory && (
        <StoryViewer
          key={viewingStory.groups[viewingStory.index]?.author.id ?? "x"}
          groups={viewingStory.groups}
          index={viewingStory.index}
          meId={me?.id}
          onClose={() => {
            setViewingStory(null);
            // v14: refresh the rail so "seen" lands immediately — the smart
            // reveal (World Live + rewards) waits for exactly this update
            loadStories();
          }}
          onIndexChange={(i) => setViewingStory((v) => (v ? { ...v, index: i } : v))}
          onChanged={loadStories}
          onAddStory={() => {
            setViewingStory(null);
            setStoryComposerOpen(true);
          }}
        />
      )}
    </div>
  );
}

export type { MiniUser };
