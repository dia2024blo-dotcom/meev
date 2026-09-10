"use client";

// MEEV — Profile (v3): living profile page.
// Hero: animated shop cover (cv-*) or seeded gradient + profile
// effects (pe-*) + badge shelf (Discord-style) + stats grid +
// XP bar + interests + equipped-cosmetics showcase + posts grid.
// Level-999 users (Legends) get the animated avatar, legend cover
// shimmer sweep and a crown chip. Account settings live in the
// dedicated settings-view hub (v2).

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
// v17: shared superset map (adds science/crypto/cars the local one lacked)
import { INTEREST_AR } from "./i18n-dict";
import { MeevCat, PresenceDot } from "./cat-avatar";
import { MeevName, LevelPill, RoleBadge } from "./username";
import { BadgeGlyph } from "./badge-glyph";
import { ThoughtBubble } from "./note-bubble";
import { meevSocket } from "./socket";
import { PawCoins } from "./pawcoin";
import { ProfileEffect, CoverArt, effectOf, HERO_EFFECTS } from "./profile-fx";
import { GiftDialog } from "./gift-dialog";
import { GiftCinema, type CinemaShow } from "./gift-cinema";
import { levelProgress } from "@/lib/meev/xp";
import { BADGES, INTERESTS, NAME_COLORS, LEVEL_UNLOCKS, SHOP_ITEMS, PRESENCE, type PresenceKey } from "@/lib/meev/constants";
import type { PublicUser, PostDTO } from "./types";
import { cn } from "@/lib/utils";
import {
  UserPlus, Check, MessageCircle, Settings, Pencil, MapPin, CalendarDays, Gift,
  TrendingUp, Lock, Palette, Ban, Flag,
  ShoppingBag, ImagePlus, Loader2, Crown, Smile, Zap, Sparkles,
  Sprout, Medal, Frame, Image as ImageIcon, PartyPopper, CheckCircle2, Hourglass, ThumbsUp,
} from "lucide-react";
import { XpSpark, GemMark, BoltMark } from "./symbols";

// ------------------------- bilingual label maps (v3) -------------------------

const BADGE_AR: Record<string, { name: string; description: string }> = {
  founder: { name: "المؤسِّس", description: "انضم في عهد تأسيس ميف" },
  "social-butterfly": { name: "الفراشة الاجتماعية", description: "صادق ٥+ أصدقاء على ميف" },
  "night-owl": { name: "بومة الليل", description: "نشِط في أعماق الليل" },
  gifted: { name: "كريم", description: "أرسلت أول هدية ميف" },
  "lvl-10": { name: "نجم صاعد", description: "وصلت للمستوى ١٠" },
  "lvl-50": { name: "محارب ميف", description: "وصلت للمستوى ٥٠" },
  "lvl-100": { name: "القائد المئوي", description: "وصلت للمستوى ١٠٠" },
  "lvl-999": { name: "أسطورة ميف", description: "المكانة العليا — مستوى ٩٩٩" },
};

// (INTEREST_AR moved to i18n-dict.ts in v17 — shared with explore/auth/live)

const PRESENCE_AR: Record<string, string> = {
  online: "متصل", busy: "مشغول", dnd: "لا تُزعج", offline: "غير متصل",
};

const STAT_AR: Record<string, string> = {
  followers: "متابِع", following: "يتابِع", friends: "أصدقاء", posts: "منشورات",
};

/** Latin digits → Arabic-Indic digits (for RTL-safe XP counters) */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toAr = (n: number | string) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

// ------------------------- v5: Discord-style status picker -------------------------

const STATUS_AR: Record<string, string> = {
  online: "متصل",
  busy: "مشغول",
  dnd: "لا تُزعج",
  offline: "غير متصل",
};

function StatusPicker({ user, onCover = false }: { user: PublicUser; onCover?: boolean }) {
  const { L } = useI18n();
  const { toast } = useToast();
  const patchMe = useMeev((s) => s.patchMe);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(user.customStatus || "");
  const [busy, setBusy] = useState(false);
  const current = (user.presence as PresenceKey) || "online";

  useEffect(() => {
    if (open) setCustom(user.customStatus || "");
  }, [open, user.customStatus]);

  const apply = async (presence: PresenceKey, customStatus?: string | null) => {
    setBusy(true);
    meevSocket.setPresence(presence);
    try {
      const body: Record<string, unknown> = { presence };
      if (customStatus !== undefined) body.customStatus = customStatus;
      const r = await api.updateMe(body);
      patchMe(r.user);
      if (customStatus !== undefined)
        toast({
          title: (
            <span className="flex items-center gap-2">
              <XpSpark size={15} className="text-amber-400" />
              {L("تم حفظ الحالة", "Status saved")}
            </span>
          ),
        });
    } catch (e) {
      toast({ title: L("فشل تغيير الحالة", "Couldn't set status"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant={onCover ? "ghost" : "outline"}
          className={cn(
            "shrink-0 relative active:scale-95 transition-all",
            onCover
              ? "size-9 rounded-full bg-black/35 backdrop-blur-md border border-white/25 text-white hover:bg-black/55 hover:text-white"
              : "rounded-xl"
          )}
          aria-label={L("تغيير الحالة", "Set status")}
          title={L("تغيير الحالة", "Set status")}
        >
          <span
            className={cn("absolute -bottom-0.5 -right-0.5 rounded-full border-2", onCover ? "border-black/60" : "border-background")}
            style={{ width: 11, height: 11, background: PRESENCE[current]?.color || "#6b7280" }}
            aria-hidden="true"
          />
          <Smile className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-64 rounded-2xl glass p-2.5 space-y-2.5">
        <div className="text-xs font-black uppercase tracking-wide text-muted-foreground px-1">
          {L("حالتك — مثل ديسكورد", "Your status — Discord style")}
        </div>
        <div className="space-y-1">
          {(["online", "busy", "dnd", "offline"] as PresenceKey[]).map((p) => (
            <button
              key={p}
              onClick={() => apply(p)}
              disabled={busy}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
                current === p ? "bg-primary/15 text-primary font-bold" : "hover:bg-white/5"
              )}
            >
              <span className="relative size-4 grid place-items-center shrink-0">
                <span className="rounded-full border-2 border-background" style={{ width: 12, height: 12, background: PRESENCE[p].color, boxShadow: p === "offline" ? "inset 0 0 0 3px " + PRESENCE[p].color : undefined }} />
              </span>
              {L(STATUS_AR[p] || p, PRESENCE[p].label)}
              {current === p && <Check className="size-3.5 ms-auto" />}
            </button>
          ))}
        </div>
        <div className="h-px bg-border/60" />
        <div className="px-1 space-y-1.5">
          <div className="text-[11px] font-bold text-muted-foreground">{L("حالة مخصصة", "Custom status")}</div>
          <div className="flex gap-1.5">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, 60))}
              placeholder={L("بم تشتغل الآن؟", "What are you up to?")}
              className="h-9 rounded-xl bg-background/60 text-xs"
              maxLength={60}
            />
            <Button
              size="sm"
              className="rounded-xl meev-gradient-btn text-white h-9 px-3"
              disabled={busy}
              onClick={() => apply(current, custom.trim() || null)}
              aria-label={L("حفظ الحالة المخصصة", "Save custom status")}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            </Button>
          </div>
          {user.customStatus && (
            <button
              onClick={() => { setCustom(""); apply(current, null); }}
              className="text-[11px] text-destructive hover:underline"
            >
              {L("مسح الحالة المخصصة", "Clear custom status")}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** cosmetic type → shelf glyph (v12: symbols, not emoji) for the equipped-cosmetics showcase */
const SLOT_GLYPH: Record<string, React.ReactNode> = {
  name_gradient: <GemMark size={12} />,
  name_color: <Palette className="size-3" aria-hidden="true" />,
  frame: <Frame className="size-3" aria-hidden="true" />,
  badge: <Medal className="size-3" aria-hidden="true" />,
  accessory: <Crown className="size-3" aria-hidden="true" />,
  profile_effect: <Sparkles className="size-3" aria-hidden="true" />,
  cover: <ImageIcon className="size-3" aria-hidden="true" />,
  animated_avatar: <BoltMark size={12} />,
};

export function ProfileView() {
  const profileTarget = useMeev((s) => s.profileTarget);
  const isMe = profileTarget === "me";
  const username = typeof profileTarget === "string" && profileTarget !== "me" ? profileTarget : null;

  const me = useMeev((s) => s.me);
  const setView = useMeev((s) => s.setView);
  const { L, lang } = useI18n();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [relationship, setRelationship] = useState<{ following: boolean; isFollowingMe: boolean; friendship: string } | null>(null);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  // v11: the Legend Cover Studio (level-999 custom cover unlock)
  const [coverStudioOpen, setCoverStudioOpen] = useState(false);
  // v11: support cinema when gifting from the profile
  const [cinema, setCinema] = useState<CinemaShow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (username) {
        const r = await api.getUser(username);
        setUser(r.user);
        setRelationship(r.relationship);
        const p = await api.getUserPosts(username);
        setPosts(p.posts);
      } else if (me) {
        setUser(me);
        const p = await api.getUserPosts(me.username);
        setPosts(p.posts);
      }
    } catch { /* not found */ } finally {
      setLoading(false);
    }
  }, [username, me]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !user) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24 md:pb-8">
          <div className="glass rounded-3xl h-56 animate-pulse" />
          <div className="glass rounded-3xl h-40 animate-pulse" />
        </div>
      </div>
    );
  }

  const prog = levelProgress(user.xp);
  const fx = effectOf(user.profileEffect);
  const heroFx = fx && (HERO_EFFECTS as readonly string[]).includes(fx) ? fx : null;
  const isLegend = user.level >= 999;

  // badge shelf: earned achievement badges + the equipped shop badge
  const earnedBadges = (user.badges || [])
    .map((b) => ({ row: b, def: BADGES.find((x) => x.key === b.key) }))
    .filter((x) => !!x.def);
  const shopBadgeDef = user.badgeShop ? SHOP_ITEMS.find((s) => s.key === user.badgeShop) : null;

  // equipped cosmetics showcase (all v2 + v3 slots)
  const equippedKeys = [
    user.nameGradient,
    user.frameKey,
    user.badgeShop,
    user.avatarAcc,
    user.coverKey,
    user.profileEffect,
    /^nc-/.test(user.nameColor || "") ? user.nameColor : null,
    user.avatarAnim ? "aa-legend" : null,
  ].filter((k): k is string => !!k);

  const presenceDef = PRESENCE[user.presence as PresenceKey];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24 md:pb-8">
        {/* ============ profile card ============ */}
        <article className="glass rounded-3xl overflow-hidden relative">
          {/* pe-rainbow: animated conic ring around the WHOLE card */}
          {fx === "rainbow" && (
            <ProfileEffect effectKey={user.profileEffect} className="absolute inset-0 rounded-3xl z-[6]" />
          )}

          {/* ---- cover band (v3: shop cover / seeded gradient) ----
               v9: the profile actions (status / edit / settings) moved ON TOP
               of the cover — Instagram-style floating glass circles. This
               frees the name row completely, so on phones a big name + the
               verified seal can never collide with those buttons (user
               report: "in phone mode the name and verification badge mix
               into the status & settings buttons"). ---- */}
          <div className={cn("h-36 sm:h-44 relative", isLegend && "meev-pulse-glow")}>
            <CoverArt coverKey={user.coverKey} coverPhoto={user.coverPhoto} seed={user.username} level={user.level} />
            {/* living profile effect (aurora / hearts / fire / snow) */}
            {heroFx && (
              <ProfileEffect effectKey={user.profileEffect} seed={user.username} className="absolute inset-0 z-[2]" />
            )}
            {/* level-999: one-time golden shimmer sweep over the hero */}
            {isLegend && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-[3]">
                <div className="absolute inset-y-0 w-1/3 bg-white/25 blur-md meev-hero-sweep" />
              </div>
            )}
            {/* a soft scrim so the floating actions stay readable on ANY cover */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent pointer-events-none z-[3]" aria-hidden="true" />
            {isMe && (
              <div className="absolute top-2.5 end-2.5 z-[5] flex items-center gap-1.5">
                <StatusPicker user={user} onCover />
                {/* v11: LEGEND COVER STUDIO — level-999s unlock a custom
                    cover PHOTO + the golden studio (user spec). The button
                    itself glows gold so the unlock is impossible to miss. */}
                {isLegend && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 rounded-full bg-amber-500/35 backdrop-blur-md border border-amber-300/60 text-amber-100 hover:bg-amber-500/55 active:scale-95 transition-all shadow-[0_0_14px_-2px_rgba(251,191,36,.8)]"
                    onClick={() => setCoverStudioOpen(true)}
                    aria-label={L("استوديو غلاف الأسطورة", "Legend Cover Studio")}
                    title={L("استوديو غلاف الأسطورة", "Legend Cover Studio")}
                  >
                    <ImagePlus className="size-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-full bg-black/35 backdrop-blur-md border border-white/25 text-white hover:bg-black/55 hover:text-white active:scale-95 transition-all"
                  onClick={() => setEditOpen(true)}
                  aria-label={L("تعديل الملف", "Edit profile")}
                  title={L("تعديل الملف", "Edit profile")}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-9 rounded-full bg-black/35 backdrop-blur-md border border-white/25 text-white hover:bg-black/55 hover:text-white active:scale-95 transition-all"
                  onClick={() => setView("settings")}
                  aria-label={L("الإعدادات", "Settings")}
                  title={L("الإعدادات", "Settings")}
                >
                  <Settings className="size-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="px-4 sm:px-6 pt-3 pb-5 relative">
            {/* ---- avatar + name (v9) — the actions now live on the cover
                 above, so this row is JUST identity: avatar + name block,
                 full width, nothing to collide with. The name auto-shrinks
                 with its length so even a huge name stays in its lane
                 (user report: "when the name grows it must stay put"). ---- */}
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="relative shrink-0 -mt-12 sm:-mt-14">
                {/* v5→v14: the note — the shared 💭 ThoughtBubble above the
                    profile avatar (SVG cloud + sinking tail, never a cat head) */}
                {user.note && (
                  <div className="absolute -top-[88px] -start-2 z-[5] w-28 pointer-events-none" title={user.note}>
                    <ThoughtBubble text={user.note.slice(0, 30)} />
                  </div>
                )}
                {/* pe-galaxy: stars & planets orbiting the avatar */}
                {fx === "galaxy" && (
                  <ProfileEffect effectKey={user.profileEffect} className="absolute -inset-4 z-[1] rounded-full" />
                )}
                <MeevCat
                  seed={user.avatarSeed}
                  fallback={user.id}
                  size={96}
                  level={user.level}
                  ring
                  presence={user.presence}
                  avatarPhoto={user.avatarPhoto}
                  frameKey={user.frameKey}
                  avatarAcc={user.avatarAcc}
                  avatarAnim={user.avatarAnim}
                  name={user.displayName}
                />
              </div>
              <div className="flex-1 min-w-0 pt-3 sm:pt-4 space-y-1.5">
                {/* row 1 — the display name + the circular verified seal.
                    v9: length-aware sizing — short names get big typography,
                    long names step down gracefully and ellipsize (MeevName
                    truncates internally, the seal stays glued to the text).
                    v10: the HONOR CONSTELLATION — every earned badge + the
                    equipped shop badge rides right here BESIDE the verified
                    seal (user spec: "put them next to the verification
                    badge"), as bare stroke-only rings with NO background and
                    NO name label. Smart placement:
                    • long name → MeevName keeps its own lane (ellipsis), and
                      when the row runs out of room the honors simply wrap to
                      the next line (flex-wrap) instead of colliding;
                    • language change → the honors are pure vector medals (no
                      text to re-measure); only their tooltips translate, and
                      RTL/LTR flow is automatic (flex + logical gaps);
                    • v13: each honor is a designed BadgeGlyph MEDAL (shield +
                      unique glyph, see badge-glyph.tsx) that pops in with a
                      stagger — pinned one after another like a ceremony. */}
                {(() => {
                  const n = user.displayName.length;
                  const nameSize =
                    n <= 10 ? "text-[27px] sm:text-[32px]"
                    : n <= 16 ? "text-2xl sm:text-3xl"
                    : n <= 22 ? "text-xl sm:text-2xl"
                    : "text-lg sm:text-xl";
                  const honors: { key: string; title: string }[] = [];
                  if (shopBadgeDef) {
                    const nm = lang === "ar" && shopBadgeDef.nameAr ? shopBadgeDef.nameAr : shopBadgeDef.name;
                    honors.push({ key: shopBadgeDef.key, title: `${nm} · ${L("شارة ميف المميزة من المتجر", "Signature Meev shop badge")}` });
                  }
                  earnedBadges.forEach(({ def }) => {
                    if (!def) return;
                    const ar = lang === "ar" && BADGE_AR[def.key];
                    const nm = ar ? BADGE_AR[def.key].name : def.name;
                    const desc = ar ? BADGE_AR[def.key].description : def.description;
                    honors.push({ key: def.key, title: `${nm} — ${desc}` });
                  });
                  return (
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 min-w-0">
                      <MeevName
                        displayName={user.displayName}
                        level={user.level}
                        nameColor={user.nameColor}
                        nameGradient={user.nameGradient}
                        nameFx={user.nameFx}
                        role={user.role}
                        verified={user.verified}
                        className={cn("font-black leading-tight", nameSize)}
                      />
                      {honors.map((h, i) => (
                        <span
                          key={h.key}
                          className="meev-pop inline-flex"
                          style={{ animationDelay: `${160 + i * 80}ms` }}
                        >
                          <BadgeGlyph badge={h.key} size={n <= 16 ? 22 : 19} title={h.title} />
                        </span>
                      ))}
                    </div>
                  );
                })()}
                {/* row 2 — handle + level + legend (its own line, never crowded) */}
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">@{user.username}</span>
                  <LevelPill level={user.level} />
                  {isLegend && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow meev-legend-shimmer"
                      title="Meev Legend — Level 999"
                    >
                      <Crown className="size-3" /> {L("أسطورة ميف", "Meev Legend")}
                    </span>
                  )}
                  {user.role === "moderator" && <RoleBadge role="moderator" size={16} />}
                </div>
                {/* row 3 — custom status (Discord-style) */}
                {user.customStatus && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-[11px] font-semibold text-primary max-w-full">
                    <Smile className="size-3 shrink-0" />
                    <span className="truncate">{user.customStatus}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ---- v10: the badge rail is GONE — every badge now lives in the
                 honor constellation right beside the verified seal (row 1
                 above). One home, one look: bare stroke-only rings, no
                 background, no labels (user spec). ---- */}

            {!isMe && (
              <div className="mt-4">
                <ProfileActions user={user} relationship={relationship} onRefresh={load} onGift={() => setGiftOpen(true)} />
              </div>
            )}

            {/* ---- bio & meta ---- */}
            {user.bio && <p className="mt-4 text-sm leading-relaxed">{user.bio}</p>}
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {user.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {user.city}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />{" "}
                {L("انضم", "joined")} {new Date(user.createdAt).toLocaleDateString(lang === "ar" ? "ar" : undefined, { month: "short", year: "numeric" })}
              </span>
              {presenceDef && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative inline-grid place-items-center size-3.5">
                    <span
                      className="rounded-full border-2 border-background"
                      style={{
                        width: 10,
                        height: 10,
                        background: user.presence === "offline" ? "transparent" : presenceDef.color,
                        boxShadow: user.presence === "offline" ? `inset 0 0 0 3px ${presenceDef.color}` : undefined,
                      }}
                      aria-hidden="true"
                    />
                  </span>
                  {lang === "ar" ? PRESENCE_AR[user.presence] || presenceDef.label : presenceDef.label}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <PawCoins amount={user.coins ?? 0} size={13} />
              </span>
            </div>

            {/* ---- equipped cosmetics showcase ---- */}
            {equippedKeys.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {L("الإكسسوارات المفعّلة", "Equipped cosmetics")}
                </span>
                {equippedKeys.map((k) => {
                  const def = SHOP_ITEMS.find((s) => s.key === k);
                  if (!def) return null;
                  return (
                    <span key={k} className="rounded-full border border-border/60 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold inline-flex items-center gap-1">
                      <span className="shrink-0">{SLOT_GLYPH[def.type] ?? <Sparkles className="size-3" aria-hidden="true" />}</span>
                      {lang === "ar" && def.nameAr ? def.nameAr : def.name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* ---- stats grid ---- */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              {(["followers", "following", "friends", "posts"] as const).map((key) => (
                <div key={key} className="rounded-2xl bg-white/[0.04] border border-border/50 py-2.5 text-center">
                  <div className="text-lg font-black tabular-nums">{user.stats?.[key] ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {lang === "ar" ? STAT_AR[key] : key}
                  </div>
                </div>
              ))}
            </div>

            {/* ---- v2/v3: open the shop ---- */}
            {isMe && (
              <Button
                size="sm"
                className="w-full rounded-2xl h-10 text-sm font-black meev-gradient-btn text-white gap-2 mt-4"
                onClick={() => setView("shop")}
              >
                <ShoppingBag className="size-4" /> {L("افتح المتجر", "Open Shop")}
              </Button>
            )}

            {/* ---- XP progress ---- */}
            <div className="mt-4 rounded-2xl border border-border/50 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-bold flex items-center gap-1.5">
                  <TrendingUp className="size-4 text-primary" /> {L("المستوى", "Level")} {prog.level}
                </span>
                <span className="text-muted-foreground text-xs inline-flex items-center gap-1">
                  {prog.isMax ? (
                    <>
                      <Crown className="size-3" aria-hidden="true" /> {L("أعلى مستوى", "MAX LEVEL")}
                    </>
                  ) : (
                    L(
                      `${toAr(prog.intoLevel)}/${toAr(prog.needed)} نقطة — التالي ${toAr(prog.level + 1)}`,
                      `${prog.intoLevel}/${prog.needed} XP → ${prog.level + 1}`
                    )
                  )}
                </span>
              </div>
              <div className="h-3 rounded-full bg-border overflow-hidden relative" role="progressbar" aria-valuenow={prog.percent} aria-valuemin={0} aria-valuemax={100}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${prog.percent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full relative overflow-hidden"
                  style={{ background: "linear-gradient(90deg,#ffc24d,#ff7e5f,#f04a6e)" }}
                >
                  <div className="absolute inset-0 bg-white/20" style={{ animation: "meev-pan 2.5s linear infinite", background: "linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent)", backgroundSize: "200% 100%" }} />
                </motion.div>
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">
                {L(
                  `${user.xp.toLocaleString()} نقطة إجمالية · ٢٤ نقطة = مستوى · نقطة لكل ساعة نشطة`,
                  `${user.xp.toLocaleString()} total XP · 24 XP = one level · 1 XP per active hour`
                )}
              </div>
            </div>

            {/* ---- interests ---- */}
            {user.interests.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  {L("الاهتمامات", "Interests")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {user.interests.map((key) => {
                    const i = INTERESTS.find((x) => x.key === key);
                    return (
                      <span key={key} className="rounded-full border border-border/60 bg-white/[0.03] px-2.5 py-1 text-xs">
                        {i?.emoji} {lang === "ar" ? INTEREST_AR[key] || i?.label || key : i?.label || key}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- perk unlocks (own profile) ---- */}
            {isMe && (
              <div className="mt-4">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Palette className="size-3.5" /> {L("مكافآت المستويات", "Perk unlocks")}
                </div>
                <div className="space-y-1.5">
                  {LEVEL_UNLOCKS.map((u) => {
                    const unlocked = user.level >= u.level;
                    return (
                      <div key={u.level} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2", unlocked ? "border-primary/25 bg-primary/[0.06]" : "border-border/50 bg-white/[0.02] opacity-60")}>
                        <span className={cn("size-8 grid place-items-center rounded-lg shrink-0", unlocked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                          {unlocked ? <Check className="size-4" /> : <Lock className="size-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold">
                            {L(`مستوى ${u.level}`, `Lv ${u.level}`)} — {lang === "ar" ? u.titleAr || u.title : u.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {lang === "ar" ? u.descAr || u.desc : u.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </article>

        {/* ============ posts grid ============ */}
        <section className="glass rounded-3xl p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            {L("المنشورات", "Posts")} — {posts.length}
          </div>
          {posts.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 flex items-center justify-center gap-1.5">
              <Sprout className="size-4 shrink-0" aria-hidden="true" /> {L("لا منشورات بعد", "No posts yet")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 group">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={L("منشور", "Post")} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full p-2 text-[10px] text-muted-foreground flex items-center overflow-hidden">{p.content.slice(0, 90)}</div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-xs font-bold text-white">
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="size-3 fill-current" aria-hidden="true" /> {p.likeCount}</span>
                    <span className="mx-1">·</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="size-3" aria-hidden="true" /> {p.commentCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* v5: footer text removed per user request — clean profile end */}
      </div>

      {isMe && me && user && (
        <EditProfileDialog open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} user={user} />
      )}

      {/* v11: the Legend Cover Studio — the level-999 custom cover unlock */}
      {isMe && me && user && (
        <LegendCoverStudio open={coverStudioOpen} onClose={() => setCoverStudioOpen(false)} user={user} onSaved={load} />
      )}

      {!isMe && user && (
        <GiftDialog
          open={giftOpen}
          onClose={() => setGiftOpen(false)}
          recipient={{ id: user.id, displayName: user.displayName, avatarSeed: user.avatarSeed }}
          contextType="dm"
          onSent={(g, note) =>
            setCinema({
              giftKey: g.key,
              viewer: "sender",
              partner: user.displayName,
              note: note || undefined,
              context: "dm",
            })
          }
        />
      )}

      {/* v11: the support cinema — gifting from the profile detonates too */}
      <GiftCinema show={cinema} onClose={() => setCinema(null)} />
    </div>
  );
}

// ---------------- v11: LEGEND COVER STUDIO ----------------
// The level-999 unlock (user spec: "when someone reaches 999 they can
// change their cover photo — and it must feel legendary"). A golden
// rays studio: upload a custom cover PHOTO, switch between the owned
// animated art covers, or clear the photo back to the art cover.
function LegendCoverStudio({ open, onClose, user, onSaved }: { open: boolean; onClose: () => void; user: PublicUser; onSaved: () => void }) {
  const { L, lang } = useI18n();
  const { toast } = useToast();
  const patchMe = useMeev((s) => s.patchMe);
  const [busy, setBusy] = useState(false);
  const [covers, setCovers] = useState<{ key: string; name: string; nameAr?: string; owned: boolean; levelRequired: number }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // load the owned art covers (owned flags come from the shop catalog)
  useEffect(() => {
    if (!open) return;
    setCovers(null);
    api.shopCatalog()
      .then((r) => {
        setCovers(
          r.items
            .filter((i) => i.type === "cover")
            .map((i) => ({ key: i.key, name: i.name, nameAr: (i.payload as { cover?: string })?.cover === "legend" ? (lang === "ar" ? "غلاف الأسطورة" : "Legend") : undefined, owned: i.owned, levelRequired: i.levelRequired }))
        );
      })
      .catch(() => setCovers([]));
  }, [open, lang]);

  const uploadAndApply = async (file: File) => {
    setBusy(true);
    try {
      const up = await api.upload(file);
      const r = await api.updateMe({ coverPhoto: up.url });
      patchMe({ coverPhoto: r.user.coverPhoto });
      setPreview(null);
      onSaved();
      toast({
        title: (
          <span className="flex items-center gap-2">
            <Crown className="size-4 text-amber-400" aria-hidden="true" />
            {L("غلاف الأسطورة خاصتك حيّ", "Your LEGEND cover is live")}
          </span>
        ),
      });
    } catch (e) {
      toast({ title: L("تعذّر تحديث الغلاف", "Couldn't update the cover"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const applyArt = async (key: string) => {
    setBusy(true);
    try {
      const r = await api.updateMe({ coverKey: key });
      patchMe({ coverKey: r.user.coverKey });
      onSaved();
      toast({
        title: (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
            {L("تم تبديل الغلاف الفني", "Art cover switched")}
          </span>
        ),
      });
    } catch (e) {
      toast({ title: L("تعذّر تبديل الغلاف", "Couldn't switch the cover"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const clearPhoto = async () => {
    setBusy(true);
    try {
      const r = await api.updateMe({ coverPhoto: "" });
      patchMe({ coverPhoto: null });
      onSaved();
      toast({
        title: (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
            {L("عاد الغلاف الفني", "Back to the art cover")}
          </span>
        ),
      });
    } catch (e) {
      toast({ title: L("تعذّر الإزالة", "Couldn't clear"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-3xl glass overflow-hidden">
        {/* the golden studio header with rotating rays */}
        <div className="relative -m-6 mb-4 h-28 overflow-hidden rounded-t-3xl bg-gradient-to-br from-amber-500/25 via-yellow-300/15 to-amber-600/30">
          <div className="meev-legend-rays absolute inset-[-40%]" aria-hidden="true" />
          <div className="absolute inset-0 grid place-items-center text-center px-6">
            <div>
              <Crown className="size-7 text-amber-300 mx-auto drop-shadow-[0_2px_8px_rgba(251,191,36,.9)]" />
              <DialogTitle className="mt-1.5 text-xl font-black meev-legend-gold-text">
                {L("استوديو غلاف الأسطورة", "Legend Cover Studio")}
              </DialogTitle>
              <p className="text-[11px] text-amber-100/80 mt-0.5">
                {L("فتحتَ المستوى ٩٩٩ — غلافك صار لك وحدك", "Level 999 unlocked — this cover is yours alone")}
              </p>
            </div>
          </div>
        </div>

        {/* current cover preview */}
        <div className="rounded-2xl overflow-hidden border border-amber-300/30 h-20 relative">
          <CoverArt coverKey={user.coverKey} coverPhoto={preview ?? user.coverPhoto} seed={user.username} level={user.level} />
        </div>

        {/* upload the custom photo */}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setPreview(URL.createObjectURL(f));
              void uploadAndApply(f);
            }
          }}
        />
        <Button
          className="w-full rounded-2xl h-11 font-bold gap-2 meev-gradient-btn text-white"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {L("ارفع صورة غلاف خاصّة بك", "Upload your own cover photo")}
        </Button>

        {user.coverPhoto && (
          <Button variant="outline" className="w-full rounded-2xl h-10 gap-2" disabled={busy} onClick={clearPhoto}>
            {L("إزالة الصورة والعودة للغلاف الفني", "Remove photo · back to the art cover")}
          </Button>
        )}

        {/* the owned animated art covers */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-amber-400" />
            {L("أغلفتك الفنية المملوكة", "Your owned art covers")}
          </div>
          <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
            {covers === null && (
              <div className="col-span-3 h-16 grid place-items-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {covers?.map((c) => (
              <button
                key={c.key}
                disabled={busy || !c.owned}
                onClick={() => applyArt(c.key)}
                className={cn(
                  "rounded-xl overflow-hidden border h-14 relative transition-all",
                  user.coverKey === c.key ? "border-amber-300 ring-2 ring-amber-300/60" : "border-border/60 hover:border-primary/50",
                  !c.owned && "opacity-40 cursor-not-allowed"
                )}
                aria-label={c.name}
                title={c.owned ? c.name : `${c.name} — ${L("غير مملوك", "not owned")}`}
              >
                <CoverArt coverKey={c.key} seed={user.username} level={999} />
                {!c.owned && (
                  <span className="absolute inset-0 grid place-items-center bg-black/50 text-[10px] font-bold text-white">
                    <Lock className="size-3.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- profile actions for other users ----------------
function ProfileActions({ user, relationship, onRefresh, onGift }: { user: PublicUser; relationship: { following: boolean; isFollowingMe: boolean; friendship: string } | null; onRefresh: () => void; onGift: () => void }) {
  const openDm = useMeev((s) => s.openDm);
  const { L } = useI18n();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const follow = async () => {
    setBusy(true);
    try {
      if (relationship?.following) await api.unfollow(user.id);
      else await api.follow(user.id);
      onRefresh();
    } catch (e) {
      toast({ title: L("فشل", "Failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const friend = async () => {
    setBusy(true);
    try {
      const r = await api.friendRequest(user.id);
      toast({
        title: r.status === "friends" ? (
          <span className="flex items-center gap-2">
            <PartyPopper className="size-4 text-amber-400" aria-hidden="true" />
            {L(`أنت و${user.displayName} أصدقاء الآن!`, `You and ${user.displayName} are friends!`)}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" aria-hidden="true" />
            {L("أُرسلت طلب الصداقة", "Friend request sent")}
          </span>
        ),
      });
      onRefresh();
    } catch (e) {
      toast({ title: L("فشل", "Failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const message = async () => {
    try {
      const r = await api.openDm(user.id);
      openDm(r.conversationId, user.id);
    } catch (e) {
      toast({ title: L("تعذر فتح المحادثة", "Couldn't open chat"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const block = async () => {
    try {
      await api.block(user.id);
      toast({ title: L(`حجبت @${user.username}`, `Blocked @${user.username}`) });
      onRefresh();
    } catch (e) {
      toast({ title: L("فشل", "Failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const friendship = relationship?.friendship || "none";

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" className="rounded-xl h-9 text-xs gap-1.5 meev-gradient-btn text-white" onClick={friend} disabled={busy || friendship === "friends" || friendship === "pending_out" || friendship === "blocked_out"}>
        {friendship === "friends" ? <><Check className="size-3.5" /> {L("أصدقاء", "Friends")}</> :
         friendship === "pending_in" ? <><Check className="size-3.5" /> {L("اقبل الطلب", "Accept request")}</> :
         friendship === "pending_out" ? <><Check className="size-3.5" /> {L("مُرسَل", "Requested")}</> :
         <><UserPlus className="size-3.5" /> {L("أضف صديقاً", "Add friend")}</>}
      </Button>
      <Button size="sm" variant={relationship?.following ? "outline" : "secondary"} className="rounded-xl h-9 text-xs gap-1.5" onClick={follow} disabled={busy}>
        {relationship?.following ? <><Check className="size-3.5" /> {L("يتابِعك", "Following")}</> : L("متابعة", "Follow")}
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl h-9 text-xs gap-1.5" onClick={message}>
        <MessageCircle className="size-3.5" /> {L("رسالة", "Message")}
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl h-9 text-xs gap-1.5 text-amber-300 hover:text-amber-200 border-amber-400/30" onClick={onGift}>
        <Gift className="size-3.5" /> {L("هدية", "Gift")}
      </Button>
      <div className="ms-auto flex gap-1">
        <Button size="icon" variant="ghost" className="rounded-full size-8 text-muted-foreground" onClick={block} title={L("حجب", "Block")} disabled={friendship === "blocked_out"}>
          <Ban className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full size-8 text-muted-foreground"
          title={L("إبلاغ", "Report")}
          onClick={() => {
            api.report({ targetType: "user", targetUserId: user.id, reason: "other" }).then(() => toast({ title: L("سُجّل البلاغ", "Report filed"), description: L("فريق الإشراف سيراجعه الآن.", "The moderation team will review it.") }));
          }}
        >
          <Flag className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------- edit profile ----------------
function EditProfileDialog({ open, onClose, onSaved, user }: { open: boolean; onClose: () => void; onSaved: () => void; user: PublicUser }) {
  const patchMe = useMeev((s) => s.patchMe);
  const { L, lang } = useI18n();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [city, setCity] = useState(user.city || "");
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [avatarSeed, setAvatarSeed] = useState(user.avatarSeed);
  const [nameColor, setNameColor] = useState(user.nameColor || "");
  const [photo, setPhoto] = useState<string | null>(user.avatarPhoto ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDisplayName(user.displayName);
      setBio(user.bio);
      setCity(user.city || "");
      setInterests(user.interests);
      setAvatarSeed(user.avatarSeed);
      setNameColor(user.nameColor || "");
      setPhoto(user.avatarPhoto ?? null);
    }
  }, [open, user]);

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      // v7: square mode — subject-aware 512×512 crop so the photo fills
      // the profile circle in balanced proportions, whatever its shape
      const up = await api.upload(file, { square: true });
      const r = await api.updateMe({ avatarPhoto: up.url });
      setPhoto(up.url); // optimistic preview (already persisted)
      patchMe(r.user);
      toast({
        title: (
          <span className="flex items-center gap-2">
            <XpSpark size={15} className="text-amber-400" />
            {L("تم تحديث الصورة!", "Photo updated!")}
          </span>
        ),
      });
    } catch (err) {
      toast({
        title: L("فشل رفع الصورة", "Photo upload failed"),
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setPhotoBusy(false);
    }
  };

  // v5 change locks — a friendly countdown shown beside the fields
  const daysLeft = (since: string | null | undefined, lockDays: number) =>
    since ? Math.max(1, Math.ceil((new Date(since).getTime() + lockDays * 86400_000 - Date.now()) / 86400_000)) : 0;
  const nameLockDays = daysLeft(user.nameChangedAt, 30);
  const interestsLockDays = daysLeft(user.interestsChangedAt, 90);
  const nameLocked = nameLockDays > 0 && displayName !== user.displayName;
  const interestsLocked = interestsLockDays > 0 && JSON.stringify([...interests].sort()) !== JSON.stringify([...user.interests].sort());

  const save = async () => {
    // v5: hard-block locked changes before hitting the API (clear message)
    if (nameLocked) {
      toast({
        title: L("الاسم مقفل", "Name locked"),
        description: L(`يُغيّر مرة كل شهر — بقيت ${nameLockDays} يوم`, `Once a month — ${nameLockDays} day(s) left`),
        variant: "destructive",
      });
      return;
    }
    if (interestsLocked) {
      toast({
        title: L("الاهتمامات مقفلة", "Interests locked"),
        description: L(`تُغيّر مرة كل ٣ أشهر — بقيت ${interestsLockDays} يوم`, `Once every 3 months — ${interestsLockDays} day(s) left`),
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { displayName, bio, city, interests, avatarSeed };
      // v3: the free palette writes raw hex / '' only — an equipped shop
      // color ("nc-*") round-trips untouched unless the user changes it.
      if (nameColor !== (user.nameColor || "")) body.nameColor = nameColor;
      if (photo !== (user.avatarPhoto ?? null)) body.avatarPhoto = photo;
      const r = await api.updateMe(body);
      patchMe(r.user);
      toast({
        title: (
          <span className="flex items-center gap-2">
            <XpSpark size={15} className="text-amber-400" />
            {L("تم تحديث الملف", "Profile updated")}
          </span>
        ),
      });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: L("فشل التحديث", "Update failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const canColor = user.level >= 1;
  const shopColorActive = /^nc-/.test(user.nameColor || "");

  /** progressive free-palette gates: first 4 colors L1 · next 3 L5 · last 3 L20 */
  const colorGate = (i: number) => (i <= 4 ? 1 : i <= 7 ? 5 : 20);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[88dvh] overflow-y-auto rounded-3xl glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" /> {L("تعديل الملف", "Edit profile")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* v4: profile photo — the primary avatar (normal picture, per user spec) */}
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
              <ImagePlus className="size-3.5 text-primary" /> {L("صورة البروفيل", "Profile photo")}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <MeevCat
                  seed={avatarSeed}
                  fallback={user.id}
                  size={76}
                  level={user.level}
                  presence="hidden"
                  avatarPhoto={photo}
                  frameKey={user.frameKey}
                  avatarAcc={user.avatarAcc}
                  name={displayName}
                />
                {photoBusy && (
                  <span className="absolute inset-0 z-[4] grid place-items-center rounded-full bg-black/50">
                    <Loader2 className="size-6 animate-spin text-white" />
                  </span>
                )}
                {/* camera hint */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                  className="absolute -bottom-1 -end-1 z-[5] size-8 rounded-full meev-gradient-btn text-white grid place-items-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
                  aria-label={L("تغيير الصورة", "Change photo")}
                  title={L("تغيير الصورة", "Change photo")}
                >
                  <ImagePlus className="size-4" />
                </button>
              </div>
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoSelected} aria-label={L("رفع صورة", "Upload photo")} />
                <Button size="sm" variant="outline" className="rounded-xl h-9 text-xs w-fit gap-1.5" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                  <ImagePlus className="size-3.5" /> {L("اختر صورة من جهازك", "Pick a photo")}
                </Button>
                <div className="text-[10px] text-muted-foreground leading-snug">
                  {L("صورتك الظاهرة لأصدقائك — PNG أو JPG (بدونها يظهر حرفك الأول).", "The picture your friends see — PNG or JPG (otherwise your initial shows).")}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                {L("الاسم الظاهر", "Display name")}
                {nameLockDays > 0 && (
                  <span
                    className={cn("inline-flex items-center gap-1 text-[9px] font-bold rounded-full px-1.5 py-px border", nameLocked ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-muted-foreground border-border/60 bg-white/[0.03]")}
                    title={L(`يُغيّر مرة كل شهر — بقيت ${nameLockDays} يوم`, `Changes once a month — ${nameLockDays} day(s) left`)}
                  >
                    {nameLocked ? <Lock className="size-3" aria-hidden="true" /> : <Hourglass className="size-3" aria-hidden="true" />}
                    {L(`${nameLockDays}ي`, `${nameLockDays}d`)}
                  </span>
                )}
              </div>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 32))} className="rounded-xl bg-background/50" disabled={nameLocked} />
              {nameLockDays > 0 && (
                <div className="text-[10px] text-muted-foreground leading-snug">
                  {L(`الاسم يُغيّر مرة كل شهر — التغيير القادم بعد ${nameLockDays} يوم`, `The name changes once a month — next change in ${nameLockDays} day(s)`)}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold">
                {L("المدينة", "City")} <span className="text-muted-foreground font-normal">({L("حسب الخصوصية", "shown per privacy")})</span>
              </div>
              <Input value={city} onChange={(e) => setCity(e.target.value.slice(0, 40))} placeholder="Riyadh, Dubai, Tokyo…" className="rounded-xl bg-background/50" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold">{L("نبذة", "Bio")}</div>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} className="rounded-xl bg-background/50 min-h-20 resize-none" placeholder={L("عرّف أصدقائك بشخصك…", "Tell your friends who you are…")} />
          </div>

          {/* name color unlock (v3: progressively level-gated) */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <Palette className="size-3.5" /> {L("لون الاسم", "Name color")}
              {shopColorActive && (
                <span className="text-[10px] font-bold text-amber-300 inline-flex items-center gap-1">
                  <Palette className="size-3" aria-hidden="true" /> {L("لون المتجر مفعّل", "shop color equipped")}
                </span>
              )}
              {!canColor && <span className="text-[10px] text-muted-foreground font-normal">(L1)</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setNameColor("")}
                className={cn("size-7 rounded-lg border-2 grid place-items-center text-xs", !nameColor ? "border-white" : "border-border")}
                title={L("اللون الافتراضي", "Default color")}
              >
                Aa
              </button>
              {NAME_COLORS.filter(Boolean).map((c) => {
                const idx = NAME_COLORS.indexOf(c); // 1-based after the '' slot
                const gate = colorGate(idx);
                const locked = user.level < gate;
                return (
                  <button
                    key={c}
                    disabled={locked || !canColor}
                    onClick={() => setNameColor(c)}
                    className={cn(
                      "size-7 rounded-lg border-2 grid place-items-center relative",
                      nameColor === c ? "border-white" : "border-transparent",
                      locked && "opacity-40 cursor-not-allowed"
                    )}
                    style={{ background: c }}
                    title={locked ? L(`يفتح في مستوى ${gate}`, `Unlocks at level ${gate}`) : c}
                    aria-label={locked ? L(`لون مقفل، مستوى ${gate}`, `Locked color, level ${gate}`) : `Color ${c}`}
                  >
                    {locked && <Lock className="size-3 text-white/90 drop-shadow" />}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {L("٤ ألوان من المستوى ١ · ٣ من ٥ · الباقي من ٢٠ — ألوان أجمل في المتجر", "4 colors at level 1 · 3 at 5 · the rest at 20 — fancier ones in the shop")}
            </div>
          </div>

          {/* interests (v5: locked to once every 3 months) */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold flex items-center gap-1.5 flex-wrap">
              {L("الاهتمامات", "Interests")} <span className="text-muted-foreground font-normal">({L("٨ كحد أقصى", "max 8")})</span>
              {interestsLockDays > 0 && (
                <span
                  className={cn("inline-flex items-center gap-1 text-[9px] font-bold rounded-full px-1.5 py-px border", interestsLocked ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-muted-foreground border-border/60 bg-white/[0.03]")}
                  title={L(`تُغيّر مرة كل ٣ أشهر — بقيت ${interestsLockDays} يوم`, `Once every 3 months — ${interestsLockDays} day(s) left`)}
                >
                  {interestsLocked ? <Lock className="size-3" aria-hidden="true" /> : <Hourglass className="size-3" aria-hidden="true" />}
                  {L(`${interestsLockDays}ي`, `${interestsLockDays}d`)}
                </span>
              )}
            </div>
            {interestsLockDays > 0 && (
              <div className="text-[10px] text-muted-foreground leading-snug">
                {L(`تُغيّر مرة واحدة كل ٣ أشهر — التغيير القادم بعد ${interestsLockDays} يوم`, `Changeable once every 3 months — next change in ${interestsLockDays} day(s)`)}
              </div>
            )}
            <div className={cn("flex flex-wrap gap-1.5 max-h-28 overflow-y-auto", interestsLocked && "opacity-50 pointer-events-none")}>
              {INTERESTS.map((i) => (
                <button
                  key={i.key}
                  onClick={() => setInterests((prev) => (prev.includes(i.key) ? prev.filter((k) => k !== i.key) : prev.length >= 8 ? prev : [...prev, i.key]))}
                  className={cn("rounded-full px-2.5 py-1 text-xs border transition-colors", interests.includes(i.key) ? "border-primary bg-primary/15 text-primary font-medium" : "border-border text-muted-foreground")}
                >
                  {i.emoji} {lang === "ar" ? INTEREST_AR[i.key] || i.label : i.label}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full rounded-xl meev-gradient-btn text-white font-bold" onClick={save} disabled={busy}>
            {busy ? L("جارٍ الحفظ…", "Saving…") : L("حفظ الملف", "Save profile")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
