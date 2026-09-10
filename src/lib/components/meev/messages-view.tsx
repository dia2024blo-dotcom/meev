"use client";

// MEEV — Direct messages: realtime chat with emoji + MeevCat stickers,
// exploding gifts, RPS duels, TTS voice notes, the in-chat XO mini-game,
// typing indicators + the full bilingual safety menu (gift/profile/report/block).

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { meevSocket } from "./socket";
import { MeevCat } from "./cat-avatar";
import { MeevNameUser, LevelPill } from "./username";
import { MeevLogo } from "./logo";
import { ChatMessage, TypingDots, timeAgo, SlashHints } from "./chat-shared";
import { GiftDialog } from "./gift-dialog";
import { GiftCinema, type CinemaShow } from "./gift-cinema";
import { ReportDialog, BlockButton } from "./moderation";
import { STICKERS, EMOJI_STICKER_SETS, GIFTS, CHAT_THEMES, chatTheme, streakTier, STREAK_THEME_STEP } from "@/lib/meev/constants";
import { parseCommand } from "@/lib/meev/commands";
import type { Conversation, MessageDTO, MiniUser, GameXO } from "./types";
import { setMuted as registerMuted } from "./mute-registry";
import { ThoughtBubble } from "./note-bubble";
import { cn } from "@/lib/utils";
import { Search, Send, Sticker, Mic, Gift, Gamepad2, ArrowLeft, Volume2, MoreHorizontal, Bell, BellOff, Trash2, Sparkles, Loader2, Languages, MessageCircleHeart, PenLine, Palette, User, Flag, Flame, Lock, Users, Smile, Swords, BarChart3, Trophy } from "lucide-react";
import { PawMark, GiftMark, CatMark } from "./symbols";

type RpsMove = "rock" | "paper" | "scissors";

const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

// ---------------- v5→v14: Instagram-style Notes (thought bubbles) ----------------
// A short thought floating in a real 💭 CLOUD above the profile avatar.
// Mine is editable (click the cloud); partners' open the chat.
// v14: the bubble is the shared ThoughtBubble SVG (note-bubble.tsx) —
// a cloud with three crown puffs + a sinking tail, never a "cat head".

function NoteBubble({ text, mine, className }: { text: string; mine: boolean; className?: string }) {
  return <ThoughtBubble text={text.slice(0, 30)} mine={mine} className={className} />;
}

function NotesBar({ conversations, onEditNote }: { conversations: Conversation[]; onEditNote: () => void }) {
  const me = useMeev((s) => s.me);
  const openDm = useMeev((s) => s.openDm);
  const openProfile = useMeev((s) => s.openProfile);
  const { L } = useI18n();

  const withNotes = conversations.filter((c) => c.partner.note).slice(0, 12);
  const myNote = me?.note ?? null;

  return (
    <div className="px-2 pb-1 shrink-0">
      <div className="flex items-center gap-1 pb-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          <MessageCircleHeart className="size-3" aria-hidden="true" /> {L("ملاحظات الأصدقاء", "Friends' notes")}
        </span>
      </div>
      {/* v14: the note zone is TALLER (72px) and the bubble sits at its
          bottom — a long (2-line) note now grows upward INSIDE its own
          space instead of tunneling into the search window above (user:
          "هبطها شوي… تدخل فالنافذة يلي فوقها"). Columns are a touch wider
          so a full 30-char thought is readable at a glance. */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar meev-drag-rail pt-3 pb-3.5 px-0.5">
        {/* ---- my note (v8: click the CLOUD itself to edit/delete —
              the avatar now opens my profile, per user spec) ---- */}
        <div className="flex flex-col items-center gap-1.5 w-[92px] shrink-0">
          <div className="h-[72px] w-full flex items-end justify-center">
            {myNote ? (
              <button
                onClick={onEditNote}
                className="relative w-full rounded-2xl"
                aria-label={L("تعديل أو حذف ملاحظتك", "Edit or delete your note")}
                title={L("اضغط على الملاحظة لتعديلها أو حذفها", "Click the note to edit or delete it")}
              >
                <NoteBubble text={myNote} mine />
                {/* v14: the pencil chip is ALWAYS visible (hover-only never
                    showed on touch, and hid on desktop too — user report) */}
                <span className="absolute -top-1 -end-1 size-5 grid place-items-center rounded-full meev-gradient-btn shadow" aria-hidden="true">
                  <PenLine className="size-3" />
                </span>
              </button>
            ) : (
              <button
                onClick={onEditNote}
                className="mb-1 rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-[9px] font-bold text-muted-foreground hover:text-primary hover:border-primary/60 transition-colors"
              >
                + {L("ملاحظة", "note")}
              </button>
            )}
          </div>
          <button
            onClick={() => me?.username && openProfile(me.username)}
            aria-label={L("ملفك الشخصي", "Your profile")}
            className="relative rounded-full hover:scale-105 transition-transform"
          >
            <MeevCat seed={me?.avatarSeed || ""} fallback={me?.id || "me"} size={54} level={me?.level} presence="hidden" avatarPhoto={me?.avatarPhoto} frameKey={me?.frameKey} avatarAcc={me?.avatarAcc} name={me?.displayName} />
          </button>
          <span className="text-[9px] font-bold text-muted-foreground truncate w-full text-center">
            {L("ملاحظتك", "Your note")}
          </span>
        </div>

        {/* ---- partners with notes ---- */}
        {withNotes.map((c) => (
          <div key={c.id} className="flex flex-col items-center gap-1.5 w-[92px] shrink-0">
            <div className="h-[72px] w-full flex items-end justify-center">
              {c.partner.note ? <NoteBubble text={c.partner.note} mine={false} /> : null}
            </div>
            <button
              onClick={() => openDm(c.id, c.partner.id)}
              aria-label={L(`محادثة ${c.partner.displayName}`, `Chat with ${c.partner.displayName}`)}
              className="relative rounded-full hover:scale-105 transition-transform"
            >
              <MeevCat
                seed={c.partner.avatarSeed}
                fallback={c.partner.id}
                size={54}
                level={c.partner.level}
                presence={c.partner.presence}
                avatarPhoto={c.partner.avatarPhoto}
                frameKey={c.partner.frameKey}
                avatarAcc={c.partner.avatarAcc}
                name={c.partner.displayName}
              />
            </button>
            <span className="text-[9px] font-bold text-muted-foreground truncate w-full text-center">
              {c.partner.displayName.split(" ")[0]}
            </span>
          </div>
        ))}

        {withNotes.length === 0 && !myNote && (
          <div className="h-[132px] flex items-center text-[10px] text-muted-foreground/70 px-2">
            {L("اكتب أول ملاحظة — فقاعة أفكار فوق صورتك", "Write the first note — a thought bubble above your photo")}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteEditorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMeev((s) => s.me);
  const patchMe = useMeev((s) => s.patchMe);
  const { L } = useI18n();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setDraft(me?.note ?? "");
  }, [open, me?.note]);

  const save = async (clear = false) => {
    if (busy) return;
    if (!clear && !draft.trim()) return;
    setBusy(true);
    try {
      // v14: notes are one tiny thought — 30 chars (matches the API's
      // sanitize MAX_FIELD.note and the rail's 2-line bubble)
      const r = await api.updateMe(clear || !draft.trim() ? { note: null } : { note: draft.trim().slice(0, 30) });
      patchMe(r.user);
      toast({
        title: clear || !draft.trim() ? L("حُذفت ملاحظتك", "Note cleared") : L("ملاحظتك الآن فوق صورتك!", "Your note is floating above your photo!"),
      });
      onClose();
    } catch (e) {
      toast({ title: L("تعذّر حفظ الملاحظة", "Couldn't save the note"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleHeart className="size-5 text-primary" aria-hidden="true" /> {L("ملاحظتك", "Your note")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* v14: the live preview is a normal FLOW column (bubble above
              avatar, tail pointing down at the thinker) — the old absolute
              -top-9 offset clipped long notes into the dialog header */}
          <div className="flex flex-col items-center gap-1 py-2">
            <div className="w-28">
              <NoteBubble text={draft.slice(0, 30) || L("…", "…")} mine />
            </div>
            <MeevCat seed={me?.avatarSeed || ""} fallback={me?.id || "me"} size={64} level={me?.level} presence="hidden" avatarPhoto={me?.avatarPhoto} frameKey={me?.frameKey} avatarAcc={me?.avatarAcc} name={me?.displayName} />
          </div>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 30))}
            placeholder={L("بم تفكر الآن؟", "What's on your mind?")}
            className="rounded-xl bg-background/60 h-11"
            maxLength={30}
            autoFocus
          />
          {/* v6: quick emoji row — notes CAN carry emojis 🐾 */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground me-1">{L("إيموجي سريع:", "Quick emoji:")}</span>
            {["🐾", "💭", "🍕", "🎮", "🌙", "✨", "😂", "❤️", "🎧", "☕"].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setDraft((d) => (d + e).slice(0, 30))}
                className="size-7 grid place-items-center rounded-lg text-base hover:bg-primary/15 hover:scale-110 active:scale-95 transition-transform"
                aria-label={`Add ${e}`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>{L("تظهر في فقاعة فوق بروفايلك في الرسائل — مثل انستا", "Floats in a bubble above your profile in Messages — Instagram-style")}</span>
            <span className="tabular-nums shrink-0">{draft.length}/30</span>
          </div>
          <div className="flex gap-2">
            {me?.note && (
              <Button variant="outline" className="rounded-xl flex-1" disabled={busy} onClick={() => save(true)}>
                {L("حذف", "Clear")}
              </Button>
            )}
            <Button className="rounded-xl meev-gradient-btn text-white font-bold flex-1" disabled={busy || !draft.trim()} onClick={() => save(false)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {L("نشر الملاحظة", "Post note")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function checkWinner(board: (string | null)[]): string | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(Boolean)) return "draw";
  return null;
}

// ---------------- XO game board ----------------
function XOGame({ conversationId, game, myId, L }: { conversationId: string; game: GameXO; myId: string; L: (ar: string, en: string) => string }) {
  const mySymbol = game.players ? (game.players.x === myId ? "x" : "o") : "x";
  const myTurn = game.status === "active" && game.turn === mySymbol;
  const winner = game.winner;

  return (
    <div className="glass rounded-2xl p-3 w-64 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold flex items-center gap-1.5"><Gamepad2 className="size-3.5 text-primary" /> {L("معركة XO", "XO battle")}</span>
        {game.status === "active" ? (
          <span className={cn("font-semibold", myTurn ? "text-primary" : "text-muted-foreground")}>
            {myTurn ? L("دورك", "Your turn") : L("دورهم", "Their turn")}
          </span>
        ) : (
          <span className="font-bold text-primary inline-flex items-center gap-1">
            {winner === "draw" ? (
              L("تعادل!", "Draw!")
            ) : winner === mySymbol ? (
              <>
                <Trophy className="size-3.5" aria-hidden="true" /> {L("فزت!", "You won!")}
              </>
            ) : (
              <>
                <PawMark size={13} /> {L("فازوا", "They won")}
              </>
            )}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {game.board.map((cell, i) => (
          <button
            key={i}
            disabled={!!cell || !myTurn || game.status !== "active"}
            onClick={() => meevSocket.gameMove(conversationId, i)}
            className={cn(
              "aspect-square rounded-xl grid place-items-center text-2xl font-black transition-all",
              !cell && myTurn && "hover:bg-primary/10 border border-primary/30",
              !cell && !myTurn && "border border-border/50",
              cell === "x" && "bg-rose-500/15 text-rose-400 border border-rose-500/30",
              cell === "o" && "bg-rose-500/15 text-rose-400 border border-rose-500/30"
            )}
          >
            {cell === "x" ? "✕" : cell === "o" ? "○" : ""}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-center text-muted-foreground">
        {L(`أنت: ${mySymbol === "x" ? "✕" : "○"} · للفخر فقط 🏆`, `You: ${mySymbol === "x" ? "✕" : "○"} · for the bragging rights 🏆`)}
      </div>
    </div>
  );
}

/** Conversation-list last message preview (v12: symbol glyphs, not emoji). */
function previewText(last: Conversation["lastMessage"], L: (ar: string, en: string) => string): ReactNode {
  if (!last) return L("قل مرحباً", "Say hi");
  switch (last.kind) {
    case "gift":
      return (
        <span className="inline-flex items-center gap-1">
          <GiftMark size={12} /> {L("هدية", "Gift")}
        </span>
      );
    case "voice":
      return (
        <span className="inline-flex items-center gap-1">
          <Mic className="size-3" aria-hidden="true" /> {L("رسالة صوتية", "Voice note")}
        </span>
      );
    case "game":
      return (
        <span className="inline-flex items-center gap-1">
          <Swords className="size-3" aria-hidden="true" /> RPS
        </span>
      );
    case "sticker": {
      // emoji stickers carry the emoji as content; MeevCat stickers carry a label
      const emojiish = !!last.content && last.content.length <= 4 && /[^\u0000-\u007F]/.test(last.content);
      return emojiish ? last.content : (
        <span className="inline-flex items-center gap-1">
          <CatMark size={12} /> {L("ملصق", "Sticker")}
        </span>
      );
    }
    case "poll":
      return (
        <span className="inline-flex items-center gap-1">
          <BarChart3 className="size-3" aria-hidden="true" /> {last.content.slice(0, 36)}
        </span>
      );
    default:
      return last.content.slice(0, 42);
  }
}

// ---------------- v8: unseen-gift explosion bookkeeping ----------------
// Gift messages the viewer has already "met" (cinema played). Capped so
// localStorage never grows unbounded.
const GIFT_SEEN_KEY = "meev:giftcinema:seen";
function readSeenGifts(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(GIFT_SEEN_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function markGiftSeen(id: string) {
  try {
    const next = [...readSeenGifts(), id].slice(-300);
    localStorage.setItem(GIFT_SEEN_KEY, JSON.stringify(next));
  } catch {
    /* private mode — cinema just replays next open, harmless */
  }
}

// ---------------- Messages view ----------------
export function MessagesView() {
  const me = useMeev((s) => s.me);
  const activeConvId = useMeev((s) => s.dmConversation);
  const openDm = useMeev((s) => s.openDm);
  const openProfile = useMeev((s) => s.openProfile);
  const setView = useMeev((s) => s.setView);
  const { L } = useI18n();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [partner, setPartner] = useState<MiniUser | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState<MiniUser | null>(null);
  const [game, setGame] = useState<GameXO | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftPreselect, setGiftPreselect] = useState<string | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [stickerOpen, setStickerOpen] = useState(false);
  const [stickerTab, setStickerTab] = useState<"cats" | "emoji">("cats");
  // v3: streak flame + chat theme + mute/delete for the active conversation
  const [streakDays, setStreakDays] = useState(0);
  const [themeKey, setThemeKey] = useState<string | null>(null);
  const [convMuted, setConvMuted] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // v4: Instagram-style notes
  const [noteEditOpen, setNoteEditOpen] = useState(false);
  // v6: Instagram-style read receipts ("vu") — partner's read pointer
  const [partnerReadAt, setPartnerReadAt] = useState<string | null>(null);
  // v7: real-time translation — per-message translations + auto mode
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [autoTranslate, setAutoTranslate] = useState(false);
  // v8: the center-screen gift cinema (sender + receiver modes)
  const [cinema, setCinema] = useState<CinemaShow | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeConvRef = useRef<string | null>(null);
  const typingTimeout = useRef<number>(0);
  const nearBottomRef = useRef(true);
  const refetchTimer = useRef<number>(0);

  // v8: unread messages waiting in the OTHER chats — rides the chat header
  // back button (the floating orb was removed; the badge gives the button a
  // real job: "you have N unread messages behind this chat")
  const otherUnread = useMemo(
    () =>
      conversations.filter((c) => c.id !== activeConvId && !c.muted).filter((c) => {
        if (!c.lastMessage || c.lastMessage.authorId === me?.id) return false;
        return !c.myReadAt || new Date(c.lastMessage.createdAt).getTime() > new Date(c.myReadAt).getTime();
      }).length,
    [conversations, activeConvId, me?.id]
  );

  activeConvRef.current = activeConvId;

  const loadConversations = useCallback(async () => {
    try {
      const r = await api.conversations();
      setConversations(r.conversations);
      // mirror caller-side mute flags into the shared registry so the app
      // shell's dm:new toast guard can suppress toasts for muted chats
      r.conversations.forEach((c) => registerMuted(c.id, !!c.muted));
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    loadConversations();
    api.blocklist().then((r) => setBlockedIds(new Set(r.blocked.map((u) => u.id)))).catch(() => {});
  }, [loadConversations]);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const r = await api.dmMessages(convId);
      setMessages(r.messages);
      setPartner(r.partner);
      setStreakDays(r.streakDays ?? 0);
      setThemeKey(r.themeKey ?? null);
      setConvMuted(!!r.muted);
      setPartnerReadAt(r.partnerReadAt ?? null);
      registerMuted(convId, !!r.muted);
      meevSocket.joinDm(convId);

      // v8: THE GIFT EXPLOSION ON OPEN — if this conversation holds a gift
      // from the partner that this viewer hasn't "met" yet (≤48h old),
      // the newest one detonates over the screen (GiftCinema receiver).
      const myId = useMeev.getState().me?.id;
      const FRESH = 48 * 3600_000;
      const now = Date.now();
      const candidate = [...r.messages]
        .reverse()
        .find(
          (m) =>
            m.kind === "gift" &&
            m.author.id !== myId &&
            now - new Date(m.createdAt).getTime() < FRESH
        );
      if (candidate) {
        const seen = readSeenGifts();
        const meta = (candidate.meta ?? {}) as { giftKey?: string; note?: string };
        if (meta.giftKey && !seen.includes(candidate.id)) {
          markGiftSeen(candidate.id);
          setCinema({
            giftKey: meta.giftKey,
            viewer: "receiver",
            partner: r.partner.displayName,
            note: typeof meta.note === "string" && meta.note.trim() ? meta.note : undefined,
            context: "dm",
          });
        }
      }
    } catch (e) {
      toast({ title: L("تعذّر تحميل المحادثة", "Couldn't load chat"), description: e instanceof Error ? e.message : "" });
      openDm(null);
    }
  }, [openDm, toast, L]);

  useEffect(() => {
    if (activeConvId) {
      setMessages([]);
      setGame(null);
      setTyping(null);
      setStreakDays(0);
      setThemeKey(null);
      setConvMuted(false);
      setPartnerReadAt(null);
      setTranslations({});
      setTranslatingIds(new Set());
      try {
        setAutoTranslate(localStorage.getItem(`meev:autoTr:${activeConvId}`) === "1");
      } catch {
        setAutoTranslate(false);
      }
      nearBottomRef.current = true;
      loadMessages(activeConvId);
    } else {
      setPartner(null);
    }
  }, [activeConvId]);

  // ---- v7: translation engine (manual + auto) ----
  const translateOne = useCallback(
    async (convId: string, msgId: string) => {
      setTranslatingIds((prev) => {
        if (prev.has(msgId)) return prev;
        const next = new Set(prev);
        next.add(msgId);
        return next;
      });
      try {
        const r = await api.translateMessage(convId, msgId);
        setTranslations((prev) => ({ ...prev, [msgId]: r.translation }));
      } catch {
        // silent — the per-message button stays available to retry
      } finally {
        setTranslatingIds((prev) => {
          const next = new Set(prev);
          next.delete(msgId);
          return next;
        });
      }
    },
    []
  );

  const toggleAutoTranslate = useCallback(() => {
    setAutoTranslate((prev) => {
      const next = !prev;
      try {
        if (activeConvId) localStorage.setItem(`meev:autoTr:${activeConvId}`, next ? "1" : "0");
      } catch { /* private mode */ }
      return next;
    });
  }, [activeConvId]);

  // auto mode: translate the partner's latest text messages as they appear
  const autoTrRef = useRef(false);
  autoTrRef.current = autoTranslate;
  useEffect(() => {
    if (!autoTranslate || !activeConvId || !partner || messages.length === 0) return;
    const targets = messages
      .filter((m) => m.kind === "text" && m.author.id !== me?.id && (m.content || "").trim().length > 2)
      .slice(-30)
      .filter((m) => !translations[m.id] && !translatingIds.has(m.id));
    if (targets.length === 0) return;
    // stagger: newest first, max 3 in flight at a time
    let alive = true;
    (async () => {
      for (const m of [...targets].reverse().slice(0, 3)) {
        if (!alive || !autoTrRef.current) break;
        void translateOne(activeConvId, m.id);
      }
    })();
    return () => {
      alive = false;
    };
  }, [autoTranslate, activeConvId, partner, messages, translations, translatingIds, me?.id, translateOne]);

  /** Debounced reconcile for the open conversation — the message pipeline can
   *  mutate older messages (RPS duel resolution rewrites the challenge meta)
   *  and the partner can change the chat theme, so every dm:new schedules a
   *  silent refetch that also re-syncs streak/theme/mute. */
  const scheduleConvRefetch = useCallback((convId: string) => {
    window.clearTimeout(refetchTimer.current);
    refetchTimer.current = window.setTimeout(() => {
      if (activeConvRef.current === convId) {
        api.dmMessages(convId).then((r) => {
          if (activeConvRef.current !== convId) return;
          setMessages(r.messages);
          setStreakDays(r.streakDays ?? 0);
          setThemeKey(r.themeKey ?? null);
          setConvMuted(!!r.muted);
          setPartnerReadAt(r.partnerReadAt ?? null);
          registerMuted(convId, !!r.muted);
        }).catch(() => {});
      }
    }, 500);
  }, []);

  // ---- realtime ----
  useEffect(() => {
    const off: (() => void)[] = [];
    off.push(
      meevSocket.on("dm:new", (p) => {
        const d = p as { conversationId: string; message: MessageDTO };
        if (d.conversationId === activeConvRef.current) {
          setMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message]));
          setTyping(null);
          scheduleConvRefetch(d.conversationId);
          // v8: a gift landing LIVE in the open chat detonates immediately
          if (d.message.kind === "gift" && d.message.author.id !== me?.id) {
            const meta = (d.message.meta ?? {}) as { giftKey?: string; note?: string };
            if (meta.giftKey) {
              markGiftSeen(d.message.id);
              setCinema({
                giftKey: meta.giftKey,
                viewer: "receiver",
                partner: d.message.author.displayName,
                note: typeof meta.note === "string" && meta.note.trim() ? meta.note : undefined,
                context: "dm",
              });
            }
          }
        }
        setConversations((prev) => {
          if (!prev.some((c) => c.id === d.conversationId)) {
            // v3: a "deleted for me" (hidden) conversation just got a newer
            // message → the server list will un-hide it, refresh it
            window.setTimeout(() => void loadConversations(), 0);
            return prev;
          }
          return prev.map((c) =>
            c.id === d.conversationId
              ? { ...c, lastMessage: { content: d.message.content, kind: d.message.kind, authorId: d.message.author.id, createdAt: d.message.createdAt }, updatedAt: d.message.createdAt }
              : c
          );
        });
      }),
      meevSocket.on("dm:typing", (p) => {
        const d = p as { conversationId: string; user: MiniUser };
        if (d.conversationId === activeConvRef.current && d.user.id !== me?.id) {
          setTyping(d.user);
          window.setTimeout(() => setTyping(null), 3500);
        }
      }),
      meevSocket.on("dm:game:state", (p) => {
        const d = p as { conversationId: string; game: GameXO };
        if (d.conversationId === activeConvRef.current) setGame(d.game);
        if (d.game.status === "finished" && d.game.winner && d.game.winner !== "draw") {
          const mySym = d.game.players?.x === me?.id ? "x" : "o";
          if (d.game.winner === mySym)
            toast({
              title: (
                <span className="flex items-center gap-2">
                  <Trophy className="size-4 text-amber-400" aria-hidden="true" />
                  {L("فزت بمعركة XO! 🏆", "You won the XO battle! 🏆")}
                </span>
              ),
            });
          else
            toast({
              title: (
                <span className="flex items-center gap-2">
                  <PawMark size={15} className="text-amber-500" />
                  {L("خسرت معركة XO… إعادة؟", "Lost the XO battle… rematch?")}
                </span>
              ),
            });
        }
      }),
      meevSocket.on("dm:read", (p) => {
        // v6: the partner opened the chat — their read pointer moved;
        // flip my last message's ticks to "vu / Seen" live
        const d = p as { conversationId: string; at: string };
        if (d.conversationId === activeConvRef.current) setPartnerReadAt(d.at);
      }),
      meevSocket.on("msg:error", (p) => {
        const d = p as { conversationId: string; error: string };
        if (d.conversationId === activeConvRef.current) toast({ title: L("تعذّر إرسال الرسالة", "Message failed"), description: d.error, variant: "destructive" });
      }),
      meevSocket.on("game:error", (p) => {
        const d = p as { error: string };
        toast({ title: L("خطأ في اللعبة", "Game error"), description: d.error, variant: "destructive" });
      })
    );
    return () => {
      off.forEach((f) => f());
      window.clearTimeout(refetchTimer.current);
    };
  }, [me?.id, scheduleConvRefetch, loadConversations, toast, L]);

  // stick to the bottom while the user is near it (refetches never yank history)
  useEffect(() => {
    if (nearBottomRef.current) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, game]);

  const onScrollMessages = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  };

  // slash hint pickup
  useEffect(() => {
    const pick = (e: Event) => {
      const cmd = (e as CustomEvent).detail as string;
      setInput((v) => (v.startsWith("/") ? cmd + " " : v));
      inputRef.current?.focus();
    };
    window.addEventListener("meev:slash-pick", pick);
    return () => window.removeEventListener("meev:slash-pick", pick);
  }, []);

  const onInputChange = (v: string) => {
    setInput(v);
    if (activeConvId && v && Date.now() - typingTimeout.current > 2000) {
      typingTimeout.current = Date.now();
      meevSocket.dmTyping(activeConvId);
    }
  };

  const send = (kind: "text" | "sticker" | "voice" = "text", content = input, meta?: unknown, attachmentUrl?: string) => {
    if (!activeConvId) return;
    if (kind === "text") {
      const text = content.trim();
      if (!text) return;
      // client-side interception: /gift opens the gift picker instead of sending
      if (text.startsWith("/")) {
        const { name, arg } = parseCommand(text);
        if (name === "gift") {
          const frag = arg.toLowerCase();
          const match = frag
            ? GIFTS.find((g) => g.key.toLowerCase() === frag || g.name.toLowerCase().includes(frag))
            : undefined;
          setGiftPreselect(match?.key ?? null);
          setGiftOpen(true);
          setInput("");
          toast({
            title: (
              <span className="flex items-center gap-2">
                <GiftMark size={16} className="text-amber-400" />
                {L("اختر هديتك", "Pick your gift")}
              </span>
            ),
          });
          return;
        }
      }
      meevSocket.sendDm(activeConvId, text);
    } else {
      meevSocket.sendDm(activeConvId, content, kind, meta, attachmentUrl);
    }
    setInput("");
  };

  const playRps = (move: RpsMove) => send("text", `/rps ${move}`);

  const sendStickerCat = (s: (typeof STICKERS)[number]) => {
    send("sticker", s.label, { stickerKey: s.key, mood: s.mood });
    setStickerOpen(false);
  };

  const sendStickerEmoji = (emoji: string) => {
    // content carries the emoji so the realtime service's non-empty check passes;
    // the renderer blows it up from meta.stickerEmoji and skips the twin caption
    send("sticker", emoji, { stickerEmoji: emoji });
    setStickerOpen(false);
  };

  const sendVoice = async () => {
    if (!voiceText.trim() || !activeConvId) return;
    setVoiceBusy(true);
    try {
      const r = await api.tts(voiceText.trim());
      meevSocket.sendDm(activeConvId, "🎙️ Voice note", "voice", undefined, r.audioUrl);
      setVoiceText("");
      setVoiceOpen(false);
    } catch (e) {
      toast({ title: L("تعذّر توليد الصوت", "Voice synthesis failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setVoiceBusy(false);
    }
  };

  // ---- v3 chat settings: theme / mute / delete ----

  const applyTheme = async (key: string) => {
    if (!activeConvId) return;
    setThemeBusy(true);
    try {
      const r = await api.dmSettings(activeConvId, { themeKey: key });
      setThemeKey(r.themeKey ?? key);
      if (typeof r.streakDays === "number") setStreakDays(r.streakDays);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? { ...c, themeKey: r.themeKey ?? key, streakDays: typeof r.streakDays === "number" ? r.streakDays : c.streakDays }
            : c
        )
      );
      setThemeOpen(false);
      toast({
        title: (
          <span className="flex items-center gap-2">
            <Palette className="size-4 text-primary" aria-hidden="true" />
            {L("تم تغيير سمة المحادثة!", "Chat theme changed!")}
          </span>
        ),
      });
    } catch (e) {
      toast({ title: L("تعذّر تغيير السمة", "Couldn't change the theme"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setThemeBusy(false);
    }
  };

  const toggleMute = async () => {
    if (!activeConvId) return;
    const next = !convMuted;
    setConvMuted(next); // optimistic
    registerMuted(activeConvId, next);
    try {
      await api.dmSettings(activeConvId, { muted: next });
      setConversations((prev) => prev.map((c) => (c.id === activeConvId ? { ...c, muted: next } : c)));
      toast({
        title: next ? (
          <span className="flex items-center gap-2">
            <BellOff className="size-4 text-muted-foreground" aria-hidden="true" />
            {L("تم كتم إشعارات المحادثة", "Conversation notifications muted")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Bell className="size-4 text-primary" aria-hidden="true" />
            {L("تم تشغيل الإشعارات", "Notifications unmuted")}
          </span>
        ),
      });
    } catch (e) {
      setConvMuted(!next); // rollback
      registerMuted(activeConvId, !next);
      toast({ title: L("تعذّر تحديث الكتم", "Couldn't update mute"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!activeConvId) return;
    const convId = activeConvId;
    setDeleteBusy(true);
    try {
      await api.deleteDm(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      registerMuted(convId, false);
      setDeleteOpen(false);
      openDm(null);
      toast({
        title: (
          <span className="flex items-center gap-2">
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            {L("تم حذف المحادثة", "Chat deleted")}
          </span>
        ),
      });
    } catch (e) {
      toast({ title: L("تعذّر حذف المحادثة", "Couldn't delete the chat"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtered = conversations.filter(
    (c) => !search || c.partner.displayName.toLowerCase().includes(search.toLowerCase()) || c.partner.username.includes(search.toLowerCase())
  );

  // v3 derived: active theme + flame tier for the open conversation
  const activeTheme = themeKey ? chatTheme(themeKey) : undefined;
  const flame = streakTier(streakDays);

  // ---------- mobile: show list or chat ----------
  const showChatMobile = !!activeConvId;

  return (
    <div className="h-full flex overflow-hidden">
      {/* conversation list */}
      <div className={cn("w-full md:w-80 shrink-0 border-r border-border/50 flex flex-col overflow-hidden", showChatMobile && "hidden md:flex")}>
        <div className="p-4 pb-3 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-black tracking-tight font-display">{L("الرسائل", "Messages")}</h1>
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => setView("explore")}>
              <Search className="size-3.5" /> {L("محادثة جديدة", "New chat")}
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L("ابحث في المحادثات…", "Search conversations…")}
              className="w-full rounded-xl bg-background/50 border border-border/60 ps-9 pe-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* v4: Instagram-style notes — thought bubbles above the profiles */}
        <NotesBar conversations={conversations} onEditNote={() => setNoteEditOpen(true)} />

        <div className="flex-1 overflow-y-auto px-2 pb-20 md:pb-2 space-y-1">
          {filtered.length === 0 && (
            <div className="p-8 text-center space-y-3">
              <MeevLogo size={64} mood="blep" className="mx-auto" />
              <div className="text-sm text-muted-foreground">
                {L("لا توجد محادثات بعد.", "No conversations yet.")}
                <br />
                {L("اعثر على أصدقاء في الاستكشاف!", "Find friends in Explore!")}
              </div>
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => openDm(c.id, c.partner.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-2xl p-2.5 text-start transition-colors",
                activeConvId === c.id ? "bg-primary/10 border border-primary/25" : "hover:bg-white/5 border border-transparent"
              )}
            >
              <MeevCat
                seed={c.partner.avatarSeed}
                fallback={c.partner.id}
                size={44}
                level={c.partner.level}
                presence={c.partner.presence}
                avatarPhoto={c.partner.avatarPhoto}
                frameKey={c.partner.frameKey}
                avatarAcc={c.partner.avatarAcc}
                name={c.partner.displayName}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <MeevNameUser user={c.partner} compact />
                  {(c.streakDays ?? 0) >= 1 && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold shrink-0"
                      style={{ color: streakTier(c.streakDays ?? 0).flameColor }}
                      title={L(`سلسلة ${c.streakDays} يوم`, `${c.streakDays}-day streak`)}
                    >
                      <Flame className="size-3 fill-current" aria-hidden="true" />{c.streakDays}
                    </span>
                  )}
                  {c.muted && (
                    <span className="shrink-0 text-muted-foreground" title={L("مكتومة", "Muted")} aria-label={L("مكتومة", "Muted")}>
                      <BellOff className="size-3" />
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {previewText(c.lastMessage, L)}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.updatedAt)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* chat pane */}
      <div
        className={cn("flex-1 min-w-0 flex flex-col overflow-hidden", !showChatMobile && "hidden md:flex")}
        style={activeTheme ? ({ "--chat-accent": activeTheme.accent } as CSSProperties) : undefined}
      >
        {activeConvId && partner ? (
          <>
            {/* chat header */}
            <div className="p-3 border-b border-border/50 flex items-center gap-3 shrink-0 bg-card/40 backdrop-blur-xl">
              {/* v8: back-to-chats — upgraded with a live unread badge for the
                  other chats (the old floating orb over the send button is gone) */}
              <button
                className="md:hidden relative size-10 grid place-items-center rounded-full hover:bg-white/5 active:scale-95 transition-all"
                onClick={() => openDm(null)}
                aria-label={L("رجوع للمحادثات", "Back to chats")}
              >
                <ArrowLeft className="size-5 flip-rtl" />
                {otherUnread > 0 && (
                  <motion.span
                    key={otherUnread}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute -top-0.5 -end-0.5 min-w-[17px] h-[17px] px-1 grid place-items-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 text-[9px] font-bold text-white border-2 border-background shadow pointer-events-none"
                  >
                    {otherUnread > 9 ? "9+" : otherUnread}
                  </motion.span>
                )}
              </button>
              <button onClick={() => openProfile(partner.username)} className="flex items-center gap-3 min-w-0">
                <MeevCat
                  seed={partner.avatarSeed}
                  fallback={partner.id}
                  size={40}
                  level={partner.level}
                  presence={partner.presence}
                  avatarPhoto={partner.avatarPhoto}
                  frameKey={partner.frameKey}
                  avatarAcc={partner.avatarAcc}
                  name={partner.displayName}
                />
                <div className="min-w-0 text-start">
                  <div className="flex items-center gap-1.5">
                    <MeevNameUser user={partner} compact />
                    <LevelPill level={partner.level} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {typing
                      ? L("يكتب الآن…", "typing…")
                      : partner.presence === "online"
                        ? L("متصل الآن", "online")
                        : `@${partner.username}`}
                  </div>
                </div>
              </button>
              {streakDays >= 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-1 rounded-full border border-border/60 bg-white/5 px-2.5 py-1 shrink-0 cursor-default"
                      role="status"
                      aria-label={L(`سلسلة ${streakDays} يوم`, `${streakDays}-day streak`)}
                    >
                      <span className="leading-none meev-flame" aria-hidden="true" style={{ color: flame.flameColor }}>
                        <Flame className="size-4 fill-current" />
                      </span>
                      <span className="text-xs font-black tabular-nums" style={{ color: flame.flameColor }}>
                        {streakDays}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-56 text-center leading-relaxed">
                    <span className="font-bold">
                      {L(flame.labelAr, flame.label)} · {L(`سلسلة ${streakDays} يوم`, `${streakDays}-day streak`)}
                    </span>
                    <br />
                    <span className="opacity-80">
                      {L(`كل ${STREAK_THEME_STEP} أيام تُفتح سمة جديدة`, `Every ${STREAK_THEME_STEP} days unlocks a new theme`)}
                    </span>
                  </TooltipContent>
                </Tooltip>
              )}
              <div className="ms-auto flex items-center gap-1">
                {/* v7: real-time translation toggle — 🌐 auto-translates the
                    partner's messages into MY app language (persisted per chat) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={toggleAutoTranslate}
                      aria-pressed={autoTranslate}
                      aria-label={L("الترجمة الفورية", "Live translation")}
                      className={cn("rounded-full", autoTranslate && "text-primary bg-primary/10")}
                    >
                      <Languages className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-center">
                    {autoTranslate
                      ? L("الترجمة الفورية مفعّلة — تُترجم رسائلهم للغتك", "Live translation ON — their messages arrive in your language")
                      : L("فعّل الترجمة الفورية لرسائل الشريك", "Turn on live translation for their messages")}
                  </TooltipContent>
                </Tooltip>
                <Button size="icon" variant="ghost" className="rounded-full" onClick={() => { if (activeConvId) meevSocket.startGame(activeConvId); }} aria-label={L("بدء لعبة XO", "Start XO game")}>
                  <Gamepad2 className="size-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="rounded-full" aria-label={L("خيارات المحادثة", "Conversation options")}>
                      <MoreHorizontal className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl glass p-1.5">
                    <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-xl py-2.5 text-sm" onClick={() => setThemeOpen(true)}>
                      <Palette className="size-4 shrink-0" aria-hidden="true" /> {L("سمة المحادثة", "Chat theme")}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-xl py-2.5 text-sm" onClick={toggleMute}>
                      {convMuted ? <BellOff className="size-4 shrink-0" /> : <Bell className="size-4 shrink-0" />}
                      {convMuted ? L("إلغاء كتم الإشعارات", "Unmute notifications") : L("كتم الإشعارات", "Mute notifications")}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-xl py-2.5 text-sm" onClick={() => setGiftOpen(true)}>
                      <GiftMark size={15} className="shrink-0" /> {L("إرسال هدية", "Send gift")}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-xl py-2.5 text-sm" onClick={() => openProfile(partner.username)}>
                      <User className="size-4 shrink-0" aria-hidden="true" /> {L("عرض الملف الشخصي", "View profile")}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-xl py-2.5 text-sm text-destructive focus:text-destructive" onClick={() => setReportOpen(true)}>
                      <Flag className="size-4 shrink-0" aria-hidden="true" /> {L("الإبلاغ", "Report")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1" />
                    <div className="px-1 py-0.5">
                      <BlockButton
                        userId={partner.id}
                        displayName={partner.displayName}
                        blocked={blockedIds.has(partner.id)}
                        onChange={(b) =>
                          setBlockedIds((prev) => {
                            const next = new Set(prev);
                            if (b) next.add(partner.id);
                            else next.delete(partner.id);
                            return next;
                          })
                        }
                        className="w-full justify-start rounded-xl px-2 py-2 h-auto text-sm font-normal"
                      />
                    </div>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      className="gap-2.5 cursor-pointer rounded-xl py-2.5 text-sm text-destructive focus:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-4 shrink-0" /> {L("حذف المحادثة", "Delete chat")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* messages */}
            <div
              ref={messagesScrollRef}
              onScroll={onScrollMessages}
              className="flex-1 overflow-y-auto py-3 min-h-0"
              style={{
                backgroundImage: (activeTheme ?? CHAT_THEMES[0]).bg,
                backgroundSize: "24px 24px",
              }}
            >
              {messages.map((m, i) => {
                const lastOwn = m.author.id === me?.id && messages.slice(i + 1).every((x) => x.author.id !== me?.id);
                const seen = lastOwn && !!partnerReadAt && new Date(partnerReadAt).getTime() >= new Date(m.createdAt).getTime();
                return (
                  <div key={m.id}>
                    <ChatMessage
                      message={m}
                      mine={m.author.id === me?.id}
                      onRpsMove={playRps}
                      translation={translations[m.id]}
                      translating={translatingIds.has(m.id)}
                      onTranslate={activeConvId && m.kind === "text" ? () => translateOne(activeConvId, m.id) : undefined}
                    />
                    {/* v6: Instagram-style "vu" ticks under my last message */}
                    {lastOwn && (
                      <div className={cn("flex items-center gap-1 px-4 sm:px-6 text-[10px] font-bold", seen ? "text-primary" : "text-muted-foreground/70")}>
                        {seen ? <span className="meev-pop">✓✓ {L("شوهدت", "Seen")}</span> : <span>✓✓</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {typing && <TypingDots label={L(`${typing.displayName} يكتب…`, `${typing.displayName} is typing…`)} />}
              {game && me && (
                <div className="flex justify-center py-3">
                  <XOGame conversationId={activeConvId} game={game} myId={me.id} L={L} />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* input bar */}
            <div className="p-3 border-t border-border/50 shrink-0 bg-card/40 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                {/* sticker picker: MeevCat moods + big emoji */}
                <Popover open={stickerOpen} onOpenChange={setStickerOpen}>
                  <PopoverTrigger asChild>
                    <Button size="icon" variant="ghost" className="rounded-full shrink-0" aria-label={L("إرسال ملصق", "Send sticker")}>
                      <Sticker className={cn("size-5", stickerOpen && "text-primary")} />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-80 rounded-2xl glass p-2">
                    {/* tabs */}
                    <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-2">
                      <button
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors",
                          stickerTab === "cats" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setStickerTab("cats")}
                      >
                        <Users className="size-3.5" aria-hidden="true" /> {L("مجتمع ميف", "Meev Community")}
                      </button>
                      <button
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors",
                          stickerTab === "emoji" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setStickerTab("emoji")}
                      >
                        <Smile className="size-3.5" aria-hidden="true" /> {L("إيموجي", "Emoji")}
                      </button>
                    </div>

                    {stickerTab === "cats" ? (
                      <div className="grid grid-cols-3 gap-2">
                        {STICKERS.map((s) => (
                          <button
                            key={s.key}
                            className="flex flex-col items-center gap-1 rounded-xl border border-border/50 p-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                            onClick={() => sendStickerCat(s)}
                          >
                            <MeevLogo size={52} mood={s.mood as never} speed={1} />
                            <span className="text-[10px] text-muted-foreground">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto">
                        {EMOJI_STICKER_SETS.map((set) => (
                          <div key={set.key}>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">
                              {L(set.labelAr, set.label)}
                            </div>
                            <div className="grid grid-cols-6 gap-1">
                              {set.emojis.map((e) => (
                                <button
                                  key={e}
                                  className="aspect-square grid place-items-center rounded-xl border border-border/40 bg-card/60 hover:border-primary/50 hover:bg-primary/10 hover:scale-110 transition-all text-3xl leading-none select-none"
                                  onClick={() => sendStickerEmoji(e)}
                                  aria-label={L(`إرسال ${e}`, `Send ${e}`)}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </PopoverContent>
                </Popover>

                <Button size="icon" variant="ghost" className="rounded-full shrink-0 text-amber-400 hover:bg-amber-400/10" onClick={() => setGiftOpen(true)} aria-label={L("إرسال هدية", "Send gift")}>
                  <Gift className="size-5" />
                </Button>

                <Button size="icon" variant="ghost" className="rounded-full shrink-0" onClick={() => setVoiceOpen(!voiceOpen)} aria-label={L("رسالة صوتية", "Voice note")}>
                  <Mic className={cn("size-5", voiceOpen && "text-primary")} />
                </Button>

                <div className="relative flex-1 min-w-0 flex items-center gap-1.5">
                  <SlashHints value={input} />
                  <button
                    onClick={() => {
                      setInput("/");
                      inputRef.current?.focus();
                    }}
                    className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shrink-0"
                    aria-label={L("عرض الأوامر", "Show commands")}
                  >
                    <span className="font-mono font-bold">/</span>
                    {L("أوامر", "cmds")}
                  </button>
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={L(
                      `راسل ${partner.displayName?.split(" ")[0] ?? ""}… ( / للأوامر)`,
                      `Message ${partner.displayName?.split(" ")[0] ?? ""}… ( / for commands)`
                    )}
                    className="w-full rounded-2xl bg-background/60 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-primary/50 meev-input-glow"
                    maxLength={2000}
                  />
                </div>

                <Button
                  size="icon"
                  className="rounded-full meev-gradient-btn text-white shrink-0"
                  style={{ backgroundImage: "var(--chat-accent, linear-gradient(135deg,#C5B767,#DDD6B4))" }}
                  onClick={() => send()}
                  disabled={!input.trim()}
                  aria-label={L("إرسال", "Send message")}
                >
                  <Send className="size-4 flip-rtl" />
                </Button>
              </div>

              {/* voice composer */}
              <AnimatePresence>
                {voiceOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pt-2 flex gap-2">
                      <input
                        value={voiceText}
                        onChange={(e) => setVoiceText(e.target.value.slice(0, 280))}
                        onKeyDown={(e) => e.key === "Enter" && sendVoice()}
                        placeholder={L("اكتب ما سيتحدث به الصوت…", "Type what your voice note should say…")}
                        className="flex-1 rounded-xl bg-background/60 border border-border/60 px-3.5 py-2 text-sm outline-none focus:border-primary/50"
                      />
                      <Button size="sm" className="rounded-xl meev-gradient-btn text-white gap-1.5" disabled={!voiceText.trim() || voiceBusy} onClick={sendVoice}>
                        <Volume2 className="size-3.5" /> {voiceBusy ? L("جارٍ التوليد…", "Synthesizing…") : L("إرسال الصوت", "Send voice")}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center p-8">
            <div className="text-center space-y-4 max-w-xs">
              <MeevLogo size={100} mood="love" className="mx-auto meev-float" speed={0.8} />
              <div className="font-bold text-lg">{L("رسائلك", "Your messages")}</div>
              <div className="text-sm text-muted-foreground">
                {L("اختر محادثة، أو اعثر على أصدقاء جدد في الاستكشاف لتبدأ الدردشة.", "Pick a conversation, or find new friends in Explore to start chatting.")}
              </div>
              <Button className="rounded-xl meev-gradient-btn text-white" onClick={() => setView("explore")}>
                <Search className="size-4" /> {L("اعثر على أصدقاء", "Find friends")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <GiftDialog
        open={giftOpen}
        onClose={() => {
          setGiftOpen(false);
          setGiftPreselect(null);
        }}
        recipient={partner ? { id: partner.id, displayName: partner.displayName, avatarSeed: partner.avatarSeed } : { id: "", displayName: "" }}
        preselectKey={giftPreselect}
        contextType="dm"
        contextId={activeConvId || undefined}
        onSent={(g, giftNote) =>
          setCinema({
            giftKey: g.key,
            viewer: "sender",
            partner: partner?.displayName ?? "",
            note: giftNote || undefined,
            context: "dm",
          })
        }
      />

      {/* v8: the center-screen gift cinema — sender takeover + receiver explosion */}
      <GiftCinema show={cinema} onClose={() => setCinema(null)} />

      {/* v4: my note editor (Instagram-style thought bubble) */}
      <NoteEditorDialog open={noteEditOpen} onClose={() => setNoteEditOpen(false)} />

      {partner && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          target={{ id: partner.id, displayName: partner.displayName }}
          contextLabel={L("المحادثة الخاصة", "direct messages")}
        />
      )}

      {/* v3: chat theme picker — mini previews, locked themes show 🔒 + streak days */}
      <Dialog open={themeOpen} onOpenChange={setThemeOpen}>
        <DialogContent className="max-w-md rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="size-5 text-primary" aria-hidden="true" /> {L("سمة المحادثة", "Chat theme")}
              {streakDays >= 1 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: flame.flameColor }}>
                  <Flame className="size-3.5 fill-current" aria-hidden="true" /> {streakDays}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {L(
                `كل ${STREAK_THEME_STEP} أيام متتالية تُفتح سمة جديدة. يمكنكما تغييرها معًا!`,
                `Every ${STREAK_THEME_STEP} consecutive days unlocks a new theme. You can both change it!`
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto px-0.5">
            {CHAT_THEMES.map((t) => {
              const locked = t.requiredStreak > streakDays;
              const current = themeKey === t.key;
              return (
                <button
                  key={t.key}
                  disabled={locked || themeBusy}
                  onClick={() => applyTheme(t.key)}
                  aria-label={L(
                    locked ? `${L(t.nameAr, t.name)} — تُفتح عند ${t.requiredStreak} يوم` : `${L(t.nameAr, t.name)}`,
                    locked ? `${t.name} — unlocks at ${t.requiredStreak} days` : t.name
                  )}
                  className={cn(
                    "rounded-2xl border p-2.5 text-start transition-all",
                    current ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border/60 hover:border-primary/50 hover:bg-white/5",
                    locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5"
                  )}
                >
                  <div className="h-12 rounded-xl border border-border/40 mb-2 relative overflow-hidden" style={{ backgroundImage: t.bg }}>
                    <div className="absolute bottom-1.5 start-1.5 end-1.5 h-2 rounded-full" style={{ backgroundImage: t.accent }} />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate">{L(t.nameAr, t.name)}</span>
                    {locked ? (
                      <span
                        className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0"
                        title={L(`تُفتح عند سلسلة ${t.requiredStreak} يوم`, `Unlocks at a ${t.requiredStreak}-day streak`)}
                      >
                        <Lock className="size-3" aria-hidden="true" /> {t.requiredStreak}
                      </span>
                    ) : current ? (
                      <span className="text-[10px] text-primary font-black shrink-0" aria-label={L("المفعّلة", "Active")}>✓</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* v3: delete ("hide for me") confirm */}
      <Dialog open={deleteOpen} onOpenChange={(v) => !v && setDeleteOpen(false)}>
        <DialogContent className="max-w-sm rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" aria-hidden="true" /> {L("حذف المحادثة؟", "Delete chat?")}
            </DialogTitle>
            <DialogDescription>
              {L(
                `ستُخفى المحادثة مع ${partner?.displayName ?? ""} من رسائلك حتى تصل رسالة جديدة. يحتفظ الطرف الآخر بنسخته.`,
                `The chat with ${partner?.displayName ?? ""} will be hidden from your messages until a new message arrives. They keep their copy.`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>
              {L("إلغاء", "Cancel")}
            </Button>
            <Button variant="destructive" className="rounded-xl" disabled={deleteBusy} onClick={confirmDelete}>
              {deleteBusy ? L("جارٍ الحذف…", "Deleting…") : L("حذف", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
