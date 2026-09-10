"use client";

// MEEV — Shared chat primitives: message bubbles (all kinds),
// reactions, typing indicator, slash-command autocomplete.
// v2 chat upgrades: giant emoji stickers, exploding gift boxes,
// RPS duel cards, shop cosmetics on authors, bilingual hints.

import { useState } from "react";
import { motion } from "framer-motion";
import { MeevCat } from "./cat-avatar";
import { MeevNameUser } from "./username";
import { MeevLogo } from "./logo";
import { GiftBox } from "./gift-box";
import type { MessageDTO, MiniUser, MatchMessage } from "./types";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { api } from "./api";
import { STICKERS, STORY_GRADIENTS } from "@/lib/meev/constants";
import { cn } from "@/lib/utils";
import { Volume2, BarChart3, Camera, Languages, Loader2, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function TypingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground px-1 py-1">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary meev-typing-dot" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary meev-typing-dot" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary meev-typing-dot" />
      </span>
      {label && <span>{label}</span>}
    </div>
  );
}

const QUICK_EMOJI = ["❤️", "😂", "🔥", "🐱", "👏", "😮", "😢", "🎉"];

export function MessageReactions({ message }: { message: MessageDTO }) {
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const react = (emoji: string) => {
    setAdding(false);
    // Reactions are optimistic-local in this build — persisted
    // reactions are on the roadmap (moderation queue integration).
    toast({ title: `Reacted ${emoji}`, duration: 1200 });
  };

  if (message.reactions.length === 0 && message.kind === "system") return null;

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1 px-1">
      {message.reactions.map((r) => (
        <button
          key={r.emoji}
          className="flex items-center gap-1 rounded-full border border-border bg-white/5 px-2 py-0.5 text-xs hover:border-primary/50 transition-colors"
          onClick={() => react(r.emoji)}
        >
          <span>{r.emoji}</span>
          <span className="text-muted-foreground">{r.users.length}</span>
        </button>
      ))}
      <div className="relative">
        <button
          className="rounded-full border border-dashed border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          onClick={() => setAdding((v) => !v)}
          aria-label="Add reaction"
        >
          ＋
        </button>
        {adding && (
          <div className="absolute z-30 bottom-full mb-1 left-0 glass rounded-xl p-1.5 flex gap-1">
            {QUICK_EMOJI.map((e) => (
              <button key={e} className="size-7 grid place-items-center rounded-lg hover:bg-white/10 text-base" onClick={() => react(e)}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** MeevCat mood sticker (as today) OR a giant emoji sticker with optional caption. */
export function StickerView({
  stickerKey,
  mood,
  stickerEmoji,
  caption,
  size = 110,
}: {
  stickerKey?: string;
  mood?: string;
  stickerEmoji?: string;
  caption?: string;
  size?: number;
}) {
  if (stickerEmoji) {
    return (
      <div className="py-1 flex flex-col items-center gap-1.5">
        <span
          className="text-[64px] leading-none meev-sticker-pop select-none"
          style={{ filter: "drop-shadow(0 8px 18px rgba(120,100,40,.38))" }}
          role="img"
          aria-label={caption || stickerEmoji}
        >
          {stickerEmoji}
        </span>
        {caption && <span className="text-xs text-muted-foreground text-center max-w-[220px] leading-snug">{caption}</span>}
      </div>
    );
  }
  const sticker = STICKERS.find((s) => s.key === stickerKey);
  return (
    <div className="py-1">
      <MeevLogo size={size} mood={(sticker?.mood || mood || "happy") as never} speed={1.1} glow />
    </div>
  );
}

function VoicePlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const play = () => {
    if (!audio) {
      const a = new Audio(url);
      a.onended = () => setPlaying(false);
      setAudio(a);
      void a.play();
      setPlaying(true);
    } else if (playing) {
      void audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-3 py-1.5">
      <button
        onClick={play}
        className="size-10 shrink-0 grid place-items-center rounded-full meev-gradient-btn text-white"
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        <Volume2 className={cn("size-5", playing && "animate-pulse")} />
      </button>
      <div className="flex items-end gap-[3px] h-6">
        {[0.5, 0.9, 0.6, 1, 0.7, 0.95, 0.55, 0.85, 0.65, 1, 0.75, 0.5, 0.9, 0.7, 0.6, 0.85, 0.95, 0.55, 0.8, 0.7].map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-primary/70"
            style={{ height: `${h * 100}%`, animation: playing ? `meev-typing 0.9s ${i * 0.05}s infinite` : undefined }}
          />
        ))}
      </div>
    </div>
  );
}

// ------------------------- RPS duel card -------------------------

const MOVE_EMOJI: Record<string, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
const RPS_MOVES_LIST = ["rock", "paper", "scissors"] as const;
type RpsMove = (typeof RPS_MOVES_LIST)[number];

function RpsCard({ message, onMove }: { message: MessageDTO; onMove?: (move: RpsMove) => void }) {
  const { L } = useI18n();
  const me = useMeev((s) => s.me);
  const rps = message.meta?.rps;

  if (!rps) return <div className="text-sm italic">{message.content}</div>;

  const done = rps.status === "done";
  const iAmChallenger = !!me && me.id === rps.challengerId;
  const iWon = done && !!me && rps.winnerId === me.id;
  const draw = done && rps.result === "draw";
  const challenger = message.author;

  const opponentLabel = me && !iAmChallenger ? L("أنت", "You") : L("الخصم", "Opponent");
  const resultText = draw
    ? L("تعادل! 🤝", "Draw! 🤝")
    : iWon
      ? L("فزت! 🏆", "You win! 🏆")
      : done && rps.winnerId === challenger.id
        ? L(`فاز ${challenger.displayName}! 🏆`, `${challenger.displayName} wins! 🏆`)
        : L("فاز الخصم! 🏆", "They win! 🏆");

  return (
    <div className="w-60 sm:w-64 rounded-2xl glass border border-primary/30 p-3 space-y-3 meev-pop">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold flex items-center gap-1.5">
          <span aria-hidden="true">⚔️</span> {L("حجرة ورقة مقص", "RPS Duel")}
        </span>
        <span className={cn("font-semibold", done ? "text-primary" : "text-muted-foreground")}>
          {done ? L("انتهت", "Finished") : L("قيد الانتظار…", "Waiting…")}
        </span>
      </div>

      {/* the two moves */}
      <div className="flex items-center justify-center gap-4 py-1">
        <div className="flex flex-col items-center gap-1 min-w-0">
          <span className="text-4xl leading-none select-none" role="img" aria-label={done ? rps.challengerMove : "hidden move"}>
            {done ? MOVE_EMOJI[rps.challengerMove] ?? "❓" : "❓"}
          </span>
          <span className="text-[10px] text-muted-foreground truncate max-w-24">{challenger.displayName}</span>
        </div>
        <span className="text-[10px] font-black text-muted-foreground tracking-widest">VS</span>
        <div className="flex flex-col items-center gap-1 min-w-0">
          <span className="text-4xl leading-none select-none" role="img" aria-label={done ? rps.opponentMove ?? "waiting" : "waiting"}>
            {done ? MOVE_EMOJI[rps.opponentMove ?? ""] ?? "❓" : "❓"}
          </span>
          <span className="text-[10px] text-muted-foreground truncate max-w-24">{opponentLabel}</span>
        </div>
      </div>

      {!done ? (
        <>
          <div className="text-xs text-center text-muted-foreground">{message.content}</div>
          {!iAmChallenger && onMove ? (
            <div className="grid grid-cols-3 gap-2">
              {RPS_MOVES_LIST.map((mv) => (
                <button
                  key={mv}
                  onClick={() => onMove(mv)}
                  className="flex flex-col items-center gap-0.5 rounded-xl border border-border/60 bg-card py-2.5 hover:border-primary/60 hover:bg-primary/10 hover:-translate-y-0.5 active:scale-95 transition-all"
                  aria-label={L(`العب ${MOVE_EMOJI[mv]}`, `Play ${mv}`)}
                >
                  <span className="text-3xl leading-none select-none">{MOVE_EMOJI[mv]}</span>
                  <span className="text-[11px]">{mv === "rock" ? "🪨" : mv === "paper" ? "📄" : "✂️"}</span>
                </button>
              ))}
            </div>
          ) : iAmChallenger ? (
            <div className="flex justify-center">
              <TypingDots label={L("بانتظار رد الخصم…", "Waiting for their move…")} />
            </div>
          ) : null}
        </>
      ) : (
        <div
          className={cn(
            "rounded-xl border px-3 py-1.5 text-center text-sm font-bold",
            draw
              ? "bg-muted/40 border-border/60 text-muted-foreground"
              : iWon
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/40 text-rose-400"
          )}
        >
          {resultText}
        </div>
      )}
    </div>
  );
}

// ------------------------- v7: message translation row -------------------------

/** The 🌐 translate affordance + rendered translation under a text bubble.
 *  Used by the DM view (manual tap or auto-translate mode). */
function TranslationRow({
  translation,
  translating,
  onTranslate,
  mine,
}: {
  translation?: string | null;
  translating?: boolean;
  onTranslate?: () => void;
  mine: boolean;
}) {
  const { L } = useI18n();
  if (translating) {
    return (
      <span className={cn("flex items-center gap-1 text-[10px] text-muted-foreground px-1 pt-0.5", mine && "flex-row-reverse")}>
        <Loader2 className="size-3 animate-spin" /> {L("جارٍ الترجمة…", "translating…")}
      </span>
    )
  }
  if (translation) {
    return (
      <div
        className={cn(
          "mt-1 max-w-full rounded-xl border border-dashed px-2.5 py-1.5 text-xs leading-relaxed break-words",
          mine ? "border-white/25 bg-black/10 text-white/85" : "border-border/60 bg-primary/[0.06] text-muted-foreground"
        )}
        dir="auto"
      >
        <Languages className="inline size-3 me-1 -mt-0.5 text-primary shrink-0" aria-hidden="true" />
        <span className="italic">{translation}</span>
      </div>
    )
  }
  if (!onTranslate) return null;
  return (
    <button
      onClick={onTranslate}
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors",
        mine && "flex-row-reverse"
      )}
      aria-label={L("ترجم هذه الرسالة", "Translate this message")}
    >
      <Languages className="size-3" /> {L("ترجمة", "Translate")}
    </button>
  );
}

// ------------------------- v13: shared post card -------------------------

/** The Facebook-style "sent you a post" DM card: author row + excerpt +
 *  image thumbnail. Tap → the post author's profile (openProfile). */
function SharedPostCard({ message }: { message: MessageDTO }) {
  const { L } = useI18n();
  const openProfile = useMeev((s) => s.openProfile);
  const post = message.meta?.post;
  if (!post) return <div className="text-sm italic">{message.content}</div>;
  return (
    <motion.button
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      onClick={() => openProfile(post.author.username)}
      className="w-60 sm:w-72 rounded-2xl glass border border-primary/30 p-3 space-y-2.5 text-start meev-pop hover:border-primary/60 transition-colors group"
      aria-label={L("منشور مشترك — اضغط لزيارة الملف", "Shared post — tap to view the profile")}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
        <Share2 className="size-3 flip-rtl" aria-hidden="true" />
        {L("منشور مشترك", "Shared post")}
      </div>
      <div className="flex items-center gap-2.5">
        <MeevCat
          seed={post.author.avatarSeed}
          fallback={post.author.id}
          size={34}
          level={post.author.level ?? 0}
          presence="hidden"
          avatarPhoto={post.author.avatarPhoto ?? null}
          name={post.author.displayName}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">{post.author.displayName}</div>
          <div className="text-[10px] text-muted-foreground truncate" dir="ltr">
            @{post.author.username}
          </div>
        </div>
      </div>
      {post.content && (
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 break-words">{post.content}</p>
      )}
      {post.imageUrl && (
        <div className="rounded-xl overflow-hidden border border-border/40 max-h-40">
          <img
            src={post.imageUrl}
            alt={L("صورة المنشور المشترك", "Shared post image")}
            className="w-full h-40 object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        </div>
      )}
      <div className="text-[9px] text-muted-foreground/70 group-hover:text-primary transition-colors flex items-center gap-1">
        {L("اضغط لزيارة الملف", "Tap to view profile")}
      </div>
    </motion.button>
  );
}

// ------------------------- chat message bubble -------------------------

export function ChatMessage({
  message,
  mine,
  showAuthor = true,
  compact = false,
  onRpsMove,
  translation,
  translating,
  onTranslate,
}: {
  message: MessageDTO | MatchMessage;
  mine: boolean;
  showAuthor?: boolean;
  compact?: boolean;
  /** v2: sends "/rps <move>" through the host view's send path (DMs). */
  onRpsMove?: (move: RpsMove) => void;
  /** v7: live translation of this text message (renders under the bubble). */
  translation?: string | null;
  translating?: boolean;
  /** v7: request a translation (DMs only — needs the conversation context). */
  onTranslate?: () => void;
}) {
  const author: MiniUser = message.author;
  const openProfile = useMeev((s) => s.openProfile);
  const { L } = useI18n();
  const isSystem = message.kind === "system";
  const [pollVotes, setPollVotes] = useState<Record<number, number>>({});
  const meta = ((message as MessageDTO).meta ?? null) as MessageDTO["meta"];

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <div className="rounded-full bg-white/5 border border-border/50 px-3.5 py-1 text-xs text-muted-foreground max-w-[80%] text-center">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2.5 px-2 sm:px-4", mine ? "flex-row-reverse" : "flex-row", compact ? "py-0.5" : "py-1")}
    >
      {showAuthor && !mine ? (
        <button onClick={() => openProfile(author.username)} className="mt-auto shrink-0" aria-label={`View ${author.displayName}`}>
          <MeevCat
            seed={author.avatarSeed}
            fallback={author.id}
            size={compact ? 30 : 36}
            level={author.level}
            presence="hidden"
            avatarPhoto={author.avatarPhoto}
            frameKey={author.frameKey}
            avatarAcc={author.avatarAcc}
            name={author.displayName}
          />
        </button>
      ) : (
        !mine && <span className="w-[30px] shrink-0" />
      )}

      <div className={cn("flex flex-col max-w-[78%] sm:max-w-[68%] min-w-0", mine ? "items-end" : "items-start")}>
        {showAuthor && !mine && !compact && (
          <button onClick={() => openProfile(author.username)} className="flex items-center gap-2 pl-1 pb-0.5 group">
            <MeevNameUser user={author} compact />
            {author.isBot && (
              <span className="rounded bg-primary/15 px-1.5 py-px text-[9px] font-bold text-primary uppercase tracking-wide">bot</span>
            )}
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{timeAgo(message.createdAt)}</span>
          </button>
        )}

        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words",
            // v16: gift/sticker/game/story-react/post-share messages are
            // PLATELESS — no bubble, no border, no shadow (the old inline
            // background-image beat !bg-transparent and kept a plate behind
            // gifts, the exact "خلفية" the user asked to remove).
            message.kind === "gift" || message.kind === "sticker" || message.kind === "game" || message.kind === "story_react" || message.kind === "post_share"
              ? "!bg-transparent !bg-none !border-0 !shadow-none !p-0"
              : cn(
                  "shadow-sm",
                  mine
                    ? "meev-gradient-btn text-white rounded-br-md"
                    : "bg-card border border-border/60 rounded-bl-md",
                ),
          )}
          // v3 chat theme: my bubbles follow the conversation accent gradient
          // (inherited CSS var set by the DM view; falls back to the exact
          // meev-gradient-btn brand gold so themeless chats stay pixel-
          // identical — v15: the old sunset fallback read as a leftover
          // coral background in BOTH themes — v16: never on plateless kinds)
          style={
            mine && message.kind !== "gift" && message.kind !== "sticker" && message.kind !== "game" && message.kind !== "story_react" && message.kind !== "post_share"
              ? { backgroundImage: "var(--chat-accent, linear-gradient(135deg,#C5B767,#DDD6B4))" }
              : undefined
          }
        >
          {message.kind === "text" && <span className="whitespace-pre-wrap">{message.content}</span>}

          {/* v7: translation output inside the bubble (auto/manual mode) */}
          {message.kind === "text" && (translation || translating) && (
            <TranslationRow translation={translation} translating={translating} mine={mine} />
          )}

          {/* v6: story reaction / reply — Instagram-style DM card:
              a mini preview of the story + the big emoji or the reply text */}
          {message.kind === "story_react" && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                <Camera className="size-3" />
                {meta?.reply
                  ? L("ردّ على قصة", "replied to a story")
                  : L("تفاعل مع قصة", "reacted to your story")}
              </div>
              <div className="flex items-end gap-2">
                {/* the story preview chip */}
                <div
                  className="relative w-24 h-32 rounded-xl overflow-hidden shrink-0 grid place-items-center p-2 border border-white/15"
                  style={{ background: STORY_GRADIENTS[(meta?.story?.gradient as string) || ""] || STORY_GRADIENTS.sunset }}
                >
                  {meta?.story?.kind === "image" && meta.story.imageUrl ? (
                    <img src={meta.story.imageUrl} alt="Story" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <p className="relative z-[1] text-[10px] font-bold text-white leading-snug line-clamp-4 break-words text-center drop-shadow">
                      {meta?.story?.content || "…"}
                    </p>
                  )}
                </div>
                {/* the reaction emoji or the reply text */}
                {meta?.reply ? (
                  <span className="whitespace-pre-wrap break-words">{message.content}</span>
                ) : (
                  <motion.span
                    initial={{ scale: 0.4, rotate: -12 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="text-4xl leading-none drop-shadow"
                  >
                    {message.content}
                  </motion.span>
                )}
              </div>
            </div>
          )}

          {message.kind === "sticker" && (
            <StickerView
              stickerKey={meta?.stickerKey}
              mood={meta?.mood}
              stickerEmoji={meta?.stickerEmoji}
              caption={
                meta?.stickerEmoji && message.content && message.content !== meta.stickerEmoji ? message.content : undefined
              }
            />
          )}

          {message.kind === "gift" && <GiftBox message={message as MessageDTO} />}

          {message.kind === "voice" && (message as MessageDTO).attachmentUrl && (
            <div className={cn(mine && "bg-black/15 rounded-xl px-2")}>
              <VoicePlayer url={(message as MessageDTO).attachmentUrl!} />
            </div>
          )}

          {message.kind === "poll" && (
            <div className="min-w-[220px] space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <BarChart3 className="size-4 text-primary" /> {message.content}
              </div>
              {(meta?.options || []).map((opt, i) => (
                <button
                  key={i}
                  className="w-full text-left rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-sm hover:border-primary/50 transition-all group"
                  onClick={() => setPollVotes((v) => ({ ...v, [i]: (v[i] || 0) + 1 }))}
                >
                  <div className="flex justify-between items-center">
                    <span>{["1️⃣", "2️⃣", "3️⃣", "4️⃣"][i] || "•"} {opt}</span>
                    {(pollVotes[i] || 0) > 0 && <span className="text-xs text-primary">{pollVotes[i]} votes</span>}
                  </div>
                  <div className="h-1 mt-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-500" style={{ width: `${Math.min(100, (pollVotes[i] || 0) * 25)}%` }} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {message.kind === "game" && <RpsCard message={message as MessageDTO} onMove={onRpsMove} />}

          {/* v13: shared post — Facebook-style card sent from the feed */}
          {message.kind === "post_share" && <SharedPostCard message={message as MessageDTO} />}
        </div>

        {/* v7: per-message translate button (DMs — shows before translating) */}
        {message.kind === "text" && !translation && !translating && onTranslate && (
          <TranslationRow onTranslate={onTranslate} mine={mine} />
        )}

        {!("reactions" in message) || !message.reactions ? null : <MessageReactions message={message as MessageDTO} />}

        {compact && <span className="text-[10px] text-muted-foreground px-1">{timeAgo(message.createdAt)}</span>}
      </div>
    </motion.div>
  );
}

// ---------- slash command autocomplete ----------
const COMMANDS: { cmd: string; ar: string; en: string }[] = [
  { cmd: "/roll", ar: "ارمِ حجر النرد 🎲", en: "Roll a dice 🎲" },
  { cmd: "/8ball", ar: "اسأل الكرة السحرية 🔮", en: "Ask the magic 8ball 🔮" },
  { cmd: "/poll", ar: "استفتاء: /poll سؤال | خيار | خيار", en: "Create a poll: /poll Q | A | B" },
  { cmd: "/shrug", ar: "¯\\_(ツ)_/¯", en: "¯\\_(ツ)_/¯" },
  { cmd: "/flip", ar: "اقلب ذهب ميف 🪙", en: "Flip a Gold Meev 🪙" },
  { cmd: "/hug", ar: "عناق كبير 🤗", en: "Send a big hug 🤗" },
  { cmd: "/kiss", ar: "قبلة 😘", en: "Send a kiss 😘" },
  { cmd: "/pat", ar: "مسحة على الرأس 🐾", en: "Head pat 🐾" },
  { cmd: "/boop", ar: "بوب على الأنف 🫳", en: "Boop the nose 🫳" },
  { cmd: "/rps", ar: "مبارزة حجرة-ورقة-مقص ⚔️", en: "RPS duel ⚔️ — /rps rock" },
  { cmd: "/gift", ar: "اختر هدية 🎁", en: "Pick a gift 🎁 — /gift fish" },
  { cmd: "/help", ar: "عرض كل الأوامر", en: "Show all commands" },
];

export function SlashHints({ value }: { value: string }) {
  const { L } = useI18n();
  if (!value.startsWith("/")) return null;
  const q = value.slice(1).split(" ")[0];
  const matches = COMMANDS.filter((c) => c.cmd.slice(1).startsWith(q));
  if (matches.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 glass rounded-xl border border-border/60 p-1.5 z-30 max-h-48 overflow-y-auto">
      {matches.map((c) => (
        <button
          key={c.cmd}
          className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/5 text-left"
          onClick={() => {
            const ev = new CustomEvent("meev:slash-pick", { detail: c.cmd });
            window.dispatchEvent(ev);
          }}
        >
          <code className="text-primary font-mono text-xs bg-primary/10 rounded px-1.5 py-0.5 shrink-0">{c.cmd}</code>
          <span className="text-xs text-muted-foreground truncate">{L(c.ar, c.en)}</span>
        </button>
      ))}
    </div>
  );
}

// voice note: synthesize via TTS then hand the URL to the sender
export async function sendVoiceNote(text: string, send: (url: string) => void) {
  const r = await api.tts(text);
  send(r.audioUrl);
}
