"use client";

// ============================================================
// MEEV v3 — ShopView: the PawCoins cosmetic store.
// v2 types (name gradients · frames · badges · accessories) +
// v3 types (name colors 🎨 · profile effects ✨ · covers 🌌 ·
// the level-999 LEGEND surprise ⚡) + the Power Path ladder.
// Bilingual (AR default) · dark violet glass · rarity styling.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { MeevCat } from "./cat-avatar";
import { MeevName, resolveNameStyle } from "./username";
import { ProfileEffect, CoverArt, effectOf } from "./profile-fx";
import { PawCoinIcon, PawCoins } from "./pawcoin";
import { RARITY_STYLES, SHOP_ITEMS, LEVEL_UNLOCKS, type ShopType } from "@/lib/meev/constants";
import type { ShopItemDTO } from "./types";
import { cn } from "@/lib/utils";
import { Lock, Check, Loader2, ShoppingBag, RefreshCcw, Sparkles, ChevronDown, TrendingUp, Zap, CircleDashed, Palette, Star, Wand2, Crown, Image as ImageIcon } from "lucide-react";
import { GemMark, XpSpark, BoltMark } from "./symbols";
import { BadgeGlyph } from "./badge-glyph";

type ItemPayload = {
  gradient?: string;
  animated?: boolean;
  ring?: string;
  colors?: string[];
  icon?: string;
  color?: string;
  acc?: string;
  effect?: string;
  cover?: string;
};

/** shop tabs — "legend" is a virtual tab showing the level-999 items.
 *  v12: the frames tab (now a 13-item premium catalog) uses the lucide
 *  CircleDashed ring glyph instead of an emoji — it reads as a frame. */
type TabKey = ShopType | "legend";

const TABS: { key: TabKey; emoji: ReactNode; ar: string; en: string }[] = [
  { key: "name_gradient", emoji: <GemMark size={15} className="text-amber-400" />, ar: "تدرجات الاسم", en: "Name Gradients" },
  { key: "name_color", emoji: <Palette className="size-4 text-rose-400" aria-hidden />, ar: "ألوان الاسم", en: "Name Colors" },
  { key: "name_effect", emoji: <Wand2 className="size-4 text-orange-400" aria-hidden />, ar: "حركات الاسم", en: "Name Effects" },
  { key: "frame", emoji: <CircleDashed className="size-4" aria-hidden />, ar: "إطارات الصورة", en: "Frames" },
  { key: "badge", emoji: <Star className="size-4 text-amber-300" aria-hidden />, ar: "الشارات", en: "Badges" },
  { key: "accessory", emoji: <Crown className="size-4 text-yellow-400" aria-hidden />, ar: "إكسسوارات الصورة", en: "Avatar accessories" },
  { key: "profile_effect", emoji: <XpSpark size={15} className="text-orange-400" />, ar: "تأثيرات البروفيل", en: "Effects" },
  { key: "cover", emoji: <ImageIcon className="size-4" aria-hidden />, ar: "الأغلفة", en: "Covers" },
  { key: "legend", emoji: <BoltMark size={15} className="text-amber-400" />, ar: "الأسطورة", en: "Legend" },
];

const LEGEND_LEVEL = 999;

const RARITY_AR: Record<string, string> = {
  common: "عادي",
  rare: "نادر",
  epic: "ملحمي",
  legendary: "أسطوري",
};

/** bilingual display strings for an item (AR names/descriptions live in SHOP_ITEMS) */
function itemText(item: ShopItemDTO, lang: string) {
  const def = SHOP_ITEMS.find((s) => s.key === item.key);
  const name = lang === "ar" && def?.nameAr ? def.nameAr : item.name;
  const description = lang === "ar" && def?.descriptionAr ? def.descriptionAr : item.description;
  return { name, description };
}

export function ShopView() {
  const me = useMeev((s) => s.me);
  const patchMe = useMeev((s) => s.patchMe);
  const { L, lang } = useI18n();
  const { toast } = useToast();

  const [items, setItems] = useState<ShopItemDTO[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<TabKey>("name_gradient");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [popKey, setPopKey] = useState<string | null>(null);
  const [legendFlash, setLegendFlash] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setItems(null);
    setLoadError(false);
    try {
      const r = await api.shopCatalog();
      setItems(r.items);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!popKey) return;
    const t = setTimeout(() => setPopKey(null), 1400);
    return () => clearTimeout(t);
  }, [popKey]);

  useEffect(() => {
    if (!legendFlash) return;
    const t = setTimeout(() => setLegendFlash(false), 4600);
    return () => clearTimeout(t);
  }, [legendFlash]);

  const matchTab = useCallback((i: ShopItemDTO, key: TabKey) => (key === "legend" ? i.levelRequired >= LEGEND_LEVEL : i.type === key), []);
  const filtered = useMemo(() => (items || []).filter((i) => matchTab(i, tab)), [items, tab, matchTab]);
  const myLevel = me?.level ?? 0;
  const previewName = me?.displayName || "Meev";
  const catSeed = me?.avatarSeed || "mochi|sunset|2";

  const buy = async (item: ShopItemDTO) => {
    if (busyKey) return;
    setBusyKey(item.key);
    try {
      const r = await api.purchase(item.key);
      setItems((prev) => (prev || []).map((i) => (i.key === item.key ? r.item : i)));
      patchMe({ coins: r.coinsLeft, level: r.level });
      setPopKey(item.key);
      const { name } = itemText(item, lang);
      toast({
        title: L("تم الشراء! 🎉", "Purchased! 🎉"),
        description: L(`${name} أصبح في خزانتك ✨`, `${name} is in your wardrobe ✨`),
      });
      if (r.leveledUp) {
        toast({ title: L(`وصلت للمستوى ${r.level}! ⬆️`, `Level ${r.level} reached! ⬆️`) });
      }
    } catch (e) {
      toast({
        title: L("فشل الشراء", "Purchase failed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const equip = async (item: ShopItemDTO, equipped: boolean) => {
    if (busyKey) return;
    setBusyKey(item.key);
    try {
      const r = await api.equip(item.key, equipped);
      setItems(r.items);
      // full user DTO — cosmetic columns (nameGradient/frameKey/badgeShop/
      // avatarAcc/nameColor/profileEffect/coverKey/avatarAnim) ride along
      // so the entire app updates instantly
      patchMe(r.user);
      const { name } = itemText(item, lang);
      toast({
        title: equipped ? L("تم التفعيل! ✨", "Equipped! ✨") : L("تم إلغاء التفعيل", "Unequipped"),
        description: equipped
          ? L(`${name} يظهر الآن في كل مكان`, `${name} now shows everywhere`)
          : L(`أزلت ${name}`, `Removed ${name}`),
      });
    } catch (e) {
      toast({
        title: L("فشل التفعيل", "Equip failed"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setBusyKey(null);
    }
  };

  /** level-999 banner → jump to the legend tab + gold pulse on the grid */
  const goLegend = () => {
    setTab("legend");
    setLegendFlash(true);
    requestAnimationFrame(() => {
      gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // ------------------------- loading / error -------------------------
  if (!items && loadError) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto glass rounded-3xl p-8 text-center space-y-4">
          <div className="text-5xl">😿</div>
          <p className="font-bold">{L("تعذر تحميل المتجر", "Couldn't load the shop")}</p>
          <Button onClick={load} className="rounded-xl meev-gradient-btn text-white">
            <RefreshCcw className="size-4" /> {L("إعادة المحاولة", "Try again")}
          </Button>
        </div>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4 pb-24 md:pb-8">
          <div className="glass rounded-3xl h-32 animate-pulse" />
          <div className="glass rounded-full h-12 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass rounded-3xl h-64 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const ownedInTab = filtered.filter((i) => i.owned).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24 md:pb-8">
        {/* ---------------- hero banner ---------------- */}
        <div className="glass rounded-3xl p-5 sm:p-6 relative overflow-hidden">
          <div
            className="absolute -top-16 -end-16 size-48 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(190,177,92,.22), transparent 70%)" }}
          />
          <div className="flex flex-wrap items-center gap-3 justify-between relative">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-black meev-aurora-text font-display leading-tight">
                {L("متجر ميف", "Meev Shop")} 🐾
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {L(
                  "اجعل من بروفايلك يلمع — تدرجات، ألوان، إطارات، تأثيرات وأغلفة",
                  "Make your profile shine — gradients, colors, frames, effects & covers"
                )}
              </p>
            </div>
            <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2 shrink-0">
              <PawCoins key={me?.coins ?? 0} amount={me?.coins ?? 0} size={18} animate />
              <span className="text-[10px] text-muted-foreground font-semibold">{L("رصيدك", "balance")}</span>
            </div>
          </div>

          {/* how to earn */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-muted-foreground font-semibold">
              {L("كيف تجمع ذهب ميف؟", "How to earn Gold Meev?")}
            </span>
            {[
              { emoji: "🎁", ar: "أرسل هدايا → مستويات", en: "Send gifts → level rewards" },
              { emoji: "🎡", ar: "العجولة الأسبوعية", en: "Weekly spin" },
              { emoji: "⬆️", ar: "ترتفع بالمستويات", en: "Level ups" },
            ].map((c) => (
              <span key={c.en} className="rounded-full border border-border/60 bg-white/[0.03] px-2.5 py-1 inline-flex items-center gap-1">
                <span>{c.emoji}</span> {L(c.ar, c.en)}
              </span>
            ))}
          </div>
        </div>

        {/* ---------------- level-999 surprise banner ---------------- */}
        <button
          type="button"
          onClick={goLegend}
          className="relative w-full rounded-3xl overflow-hidden text-start group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          aria-label={L("مفاجأة المستوى ٩٩٩ — افتح عناصر الأسطورة", "Level 999 surprise — open the legend items")}
        >
          <span className="absolute inset-0 meev-legend-shimmer" aria-hidden="true" />
          <span className="relative flex items-center gap-4 p-4 sm:p-5">
            {/* live animated preview (the real level-999 avatar behavior) */}
            <MeevCat seed={catSeed} fallback={me?.id || "shop"} size={64} level={LEGEND_LEVEL} avatarAnim />
            <span className="min-w-0 flex-1">
              <span className="block font-black text-white text-base sm:text-xl leading-tight drop-shadow">
                ⚡ {L("مفاجأة المستوى ٩٩٩", "THE LEVEL-999 SURPRISE")} ⚡
              </span>
              <span className="block text-white/85 text-xs sm:text-sm mt-0.5 drop-shadow">
                {L(
                  "صورة متحركة + غلاف أسطوري — سرّ لا يُكشف إلا عند القمة",
                  "Animated avatar + legend cover — the secret at the very top"
                )}
              </span>
            </span>
            {myLevel < LEGEND_LEVEL ? (
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-black/35 border border-amber-300/40 px-3 py-1.5 text-[10px] sm:text-xs font-black text-amber-200">
                <Lock className="size-3.5" /> {L("يُفتح عند المستوى ٩٩٩", "Unlocks at level 999")}
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-black/35 border border-amber-300/40 px-3 py-1.5 text-[10px] sm:text-xs font-black text-amber-200">
                <Zap className="size-3.5" /> {L("أنت أسطورة — مفتوح لك!", "You are a Legend — unlocked!")}
              </span>
            )}
          </span>
        </button>

        {/* ---------------- category tabs (scrollable on mobile) ---------------- */}
        <div
          className="glass rounded-full p-1.5 flex gap-1 overflow-x-auto no-scrollbar meev-drag-rail"
          role="tablist"
          aria-label={L("أقسام المتجر", "Shop categories")}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const total = items.filter((i) => matchTab(i, t.key)).length;
            const owned = items.filter((i) => matchTab(i, t.key) && i.owned).length;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all shrink-0",
                  active
                    ? "meev-gradient-btn text-white shadow-lg"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                )}
              >
                <span className="text-base leading-none grid place-items-center">{t.emoji}</span>
                <span>{L(t.ar, t.en)}</span>
                <span className={cn("text-[10px] tabular-nums rounded-full px-1.5 py-px", active ? "bg-white/20" : "bg-white/[0.06]")}>
                  {owned}/{total}
                </span>
              </button>
            );
          })}
        </div>

        {/* ---------------- grid ---------------- */}
        <div ref={gridRef} className={cn("scroll-mt-4", legendFlash && tab === "legend" && "meev-legend-flash rounded-3xl")}>
          {filtered.length === 0 ? (
            <div className="glass rounded-3xl p-10 text-center">
              <div className="text-4xl mb-2">🕳️</div>
              <p className="text-sm text-muted-foreground">
                {L("لا توجد عناصر في هذا القسم بعد", "No items in this category yet")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              <AnimatePresence mode="popLayout">
                {filtered.map((item) => (
                  <ShopCard
                    key={item.key}
                    item={item}
                    lang={lang}
                    L={L}
                    myLevel={myLevel}
                    myCoins={me?.coins ?? 0}
                    previewName={previewName}
                    catSeed={catSeed}
                    catFallback={me?.id || "shop"}
                    busy={busyKey === item.key}
                    anyBusy={!!busyKey}
                    pop={popKey === item.key}
                    onBuy={() => buy(item)}
                    onEquip={(v) => equip(item, v)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="text-center text-[11px] text-muted-foreground py-1">
          {L(
            `${ownedInTab} من عناصر هذا القسم في خزانتك · كل عنصر يمنحك XP عند شرائه`,
            `${ownedInTab} items in this category are yours · every purchase grants XP`
          )}
        </div>

        {/* ---------------- power path (level ladder) ---------------- */}
        <PowerPath myLevel={myLevel} L={L} lang={lang} onJumpLegend={goLegend} />
      </div>
    </div>
  );
}

// ------------------------- item card -------------------------

function ShopCard({
  item,
  lang,
  L,
  myLevel,
  myCoins,
  previewName,
  catSeed,
  catFallback,
  busy,
  anyBusy,
  pop,
  onBuy,
  onEquip,
}: {
  item: ShopItemDTO;
  lang: string;
  L: (ar: string, en: string) => string;
  myLevel: number;
  myCoins: number;
  previewName: string;
  catSeed: string;
  catFallback: string;
  busy: boolean;
  anyBusy: boolean;
  pop: boolean;
  onBuy: () => void;
  onEquip: (equipped: boolean) => void;
}) {
  const payload = item.payload as ItemPayload;
  const rs = RARITY_STYLES[item.rarity] || RARITY_STYLES.common;
  const { name, description } = itemText(item, lang);
  const locked = myLevel < item.levelRequired;
  const affordable = myCoins >= item.price;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className={cn(
        "glass rounded-3xl p-3 sm:p-4 flex flex-col gap-2.5 relative overflow-visible select-none",
        item.equipped && "border-2",
        pop && "meev-pop"
      )}
      style={item.equipped ? { borderColor: rs.ring, boxShadow: `0 0 20px -2px ${rs.glow}` } : undefined}
    >
      {/* equipped ribbon */}
      {item.equipped && (
        <span
          className="absolute -top-2 start-3 z-10 rounded-full px-2 py-0.5 text-[9px] font-black text-white shadow"
          style={{ background: rs.ring }}
        >
          {L("مفعّل", "EQUIPPED")}
        </span>
      )}

      {/* preview */}
      <div
        className="relative h-24 sm:h-28 rounded-2xl grid place-items-center overflow-hidden border border-border/40"
        style={{
          background: `radial-gradient(circle at 50% 35%, ${rs.glow.replace(/[\d.]+\)$/, "0.12)")}, rgba(255,255,255,0.02) 70%)`,
        }}
      >
        <ItemPreview item={item} payload={payload} previewName={previewName} catSeed={catSeed} catFallback={catFallback} L={L} />

        {locked && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/65 backdrop-blur-[2px] rounded-2xl">
            <div className="flex flex-col items-center gap-1 text-center px-2">
              <Lock className="size-5 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-200">
                {L(`يفتح في مستوى ${item.levelRequired}`, `Unlocks at level ${item.levelRequired}`)}
              </span>
            </div>
          </div>
        )}

        {/* purchase success pop */}
        <AnimatePresence>
          {pop && (
            <motion.div
              className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0.3, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 1.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-3xl">🎉</span>
                <span className="text-[10px] font-black text-white flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-300" /> {L("أصبح لك!", "Yours!")}
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* name + rarity */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold truncate">{name}</span>
          <span
            className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-black border"
            style={{ borderColor: rs.ring, color: rs.ring, background: "rgba(255,255,255,0.03)" }}
          >
            {L(RARITY_AR[item.rarity] || rs.label, rs.label)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5" title={description}>
          {description}
        </p>
      </div>

      {/* price (v16: coins only — shop items never award XP) */}
      <div className="flex items-center justify-between text-xs">
        {item.owned ? (
          <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
            <Check className="size-3.5" /> {L("تملكه", "Owned")}
          </span>
        ) : (
          <span className={cn("inline-flex items-center gap-1 font-bold tabular-nums", affordable ? "text-amber-400" : "text-rose-400")}>
            <PawCoinIcon size={14} /> {item.price.toLocaleString()}
          </span>
        )}
        {item.levelRequired > 1 && (
          <span className="text-[10px] text-muted-foreground font-semibold">{L(`مستوى ${item.levelRequired}+`, `Level ${item.levelRequired}+`)}</span>
        )}
      </div>

      {/* action */}
      <div className="mt-auto">
        {item.owned ? (
          item.equipped ? (
            <Button
              size="sm"
              variant="ghost"
              className="w-full rounded-xl h-9 text-xs font-bold"
              onClick={() => onEquip(false)}
              disabled={busy || anyBusy}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {L("إلغاء التفعيل", "Unequip")}
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full rounded-xl h-9 text-xs font-bold meev-gradient-btn text-white"
              onClick={() => onEquip(true)}
              disabled={busy || anyBusy}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {L("تفعيل", "Equip")}
            </Button>
          )
        ) : (
          <Button
            size="sm"
            className="w-full rounded-xl h-9 text-xs font-bold meev-gradient-btn text-white"
            onClick={onBuy}
            disabled={busy || anyBusy || locked}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShoppingBag className="size-3.5" />
            )}
            {L("شراء", "Buy")}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ------------------------- previews by type -------------------------

function ItemPreview({
  item,
  payload,
  previewName,
  catSeed,
  catFallback,
  L,
}: {
  item: ShopItemDTO;
  payload: ItemPayload;
  previewName: string;
  catSeed: string;
  catFallback: string;
  L: (ar: string, en: string) => string;
}) {
  if (item.type === "name_gradient") {
    return (
      <span
        className={cn("meev-name-gradient text-2xl sm:text-[1.7rem] font-black tracking-tight truncate max-w-full px-2", payload.animated && "meev-ng-animated")}
        style={{ ["--ng" as string]: payload.gradient || "linear-gradient(90deg,#ffc24d,#ff7e5f)" }}
        title={previewName}
      >
        {previewName}
      </span>
    );
  }

  // v3: premium name colors — render the EXACT effect the name will get
  if (item.type === "name_color") {
    const ns = resolveNameStyle(item.key);
    return (
      <span
        className={cn("text-2xl sm:text-[1.7rem] font-black tracking-tight truncate max-w-full px-2", ns.className)}
        style={ns.className ? ns.style : ns.color ? { color: ns.color } : undefined}
        title={previewName}
      >
        {previewName}
      </span>
    );
  }

  // v11: name EFFECTS — the live effect rendered through the REAL name
  // component (exactly what you'll wear everywhere)
  if (item.type === "name_effect") {
    return (
      <MeevName displayName={previewName} nameFx={item.key} className="text-2xl sm:text-[1.7rem] font-black tracking-tight px-2" />
    );
  }

  if (item.type === "frame") {
    return (
      <MeevCat seed={catSeed} fallback={catFallback} size={56} frameKey={item.key} />
    );
  }

  if (item.type === "badge") {
    // v13: the badge shop card shows the designed MEDAL (badge-glyph.tsx) —
    // shield frame + unique per-key glyph, keyed by the item key (never the
    // payload emoji — that stays DB data only).
    return <BadgeGlyph badge={item.key} size={48} title={L(item.name, item.name)} />;
  }

  if (item.type === "accessory") {
    return (
      <MeevCat seed={catSeed} fallback={catFallback} size={56} avatarAcc={item.key} />
    );
  }

  // v3: profile effects — mini hero with the real effect layer
  if (item.type === "profile_effect") {
    const fx = effectOf(item.key);
    return (
      <div
        className="relative w-[86%] h-[86%] rounded-xl overflow-hidden border border-border/40"
        style={{ background: "linear-gradient(125deg,#1e1b4b 0%,#4c1d95 55%,#c93157 100%)" }}
      >
        <div className="absolute bottom-1 start-1.5">
          <div className="relative">
            {fx === "galaxy" && <ProfileEffect effectKey={item.key} className="absolute -inset-2 rounded-full" />}
            <MeevCat seed={catSeed} fallback={catFallback} size={34} />
          </div>
        </div>
        {fx && fx !== "galaxy" && <ProfileEffect effectKey={item.key} seed={previewName} className={cn("absolute inset-0", fx === "rainbow" && "rounded-xl")} />}
      </div>
    );
  }

  // v3: covers — mini cover preview card
  if (item.type === "cover") {
    return (
      <div className="relative w-[86%] h-[86%] rounded-xl overflow-hidden border border-border/40">
        <CoverArt coverKey={item.key} seed={previewName} level={30} />
      </div>
    );
  }

  // v3: the level-999 animated avatar — live mood-cycling preview
  if (item.type === "animated_avatar") {
    return <MeevCat seed={catSeed} fallback={catFallback} size={56} level={999} avatarAnim />;
  }

  return null;
}

// ------------------------- power path (level ladder) -------------------------

function PowerPath({ myLevel, L, lang, onJumpLegend }: { myLevel: number; L: (ar: string, en: string) => string; lang: string; onJumpLegend: () => void }) {
  const [open, setOpen] = useState(false);
  const next = LEVEL_UNLOCKS.find((u) => u.level > myLevel);
  const currentTier = [...LEVEL_UNLOCKS].filter((u) => u.level <= myLevel).pop();

  return (
    <section className="glass rounded-3xl overflow-hidden" aria-label={L("مسار القوة", "Power Path")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-start hover:bg-white/[0.03] transition-colors"
        aria-expanded={open}
      >
        <span className="size-9 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
          <TrendingUp className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">{L("مسار القوة", "Power Path")}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">
            {L(
              `مستواك ${myLevel}${next ? ` — التالي: ${next.level}` : " — القمة!"}`,
              `Your level ${myLevel}${next ? ` — next: ${next.level}` : " — the top!"}`
            )}
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {/* current tier summary */}
              {currentTier && (
                <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-3.5 py-2.5 mb-3 flex items-center gap-2.5">
                  <Sparkles className="size-4 text-primary shrink-0" />
                  <p className="text-xs font-bold text-primary truncate">
                    {L(
                      `الآن: ${currentTier.titleAr || currentTier.title} (مستوى ${currentTier.level})`,
                      `Now: ${currentTier.title} (level ${currentTier.level})`
                    )}
                  </p>
                </div>
              )}

              {/* vertical timeline */}
              <div className="relative ps-7">
                <span
                  className="absolute start-[10px] top-3 bottom-3 w-1 rounded-full pointer-events-none"
                  style={{ background: "linear-gradient(180deg,#ffc24d,#ff7e5f,#f04a6e,#06b6d4,#fde047)" }}
                  aria-hidden="true"
                />
                {LEVEL_UNLOCKS.map((u) => {
                  const unlocked = myLevel >= u.level;
                  const isCurrent = currentTier?.level === u.level;
                  const is999 = u.level >= 999;
                  return (
                    <div key={u.level} className="relative flex items-start gap-3 py-2">
                      <span
                        className={cn(
                          "absolute -start-7 top-1/2 -translate-y-1/2 z-[1] size-[21px] rounded-full grid place-items-center text-[9px] font-black border-2 shrink-0",
                          is999
                            ? "meev-pulse-glow border-amber-300 text-[8px]"
                            : unlocked
                              ? "border-primary/40 bg-primary/20 text-primary"
                              : "border-border bg-muted text-muted-foreground"
                        )}
                        style={is999 ? { background: "linear-gradient(135deg,#ffc24d,#fde047)", color: "#422006" } : undefined}
                        aria-hidden="true"
                      >
                        {is999 ? "999" : unlocked ? "✓" : "🔒"}
                      </span>
                      <div className={cn("min-w-0 flex-1 rounded-xl px-3 py-2", isCurrent ? "border border-primary/25 bg-primary/[0.06]" : "bg-white/[0.02]", !unlocked && "opacity-55")}>
                        <div className="text-xs font-bold flex items-center gap-2 flex-wrap">
                          {L(`مستوى ${u.level}`, `Level ${u.level}`)} — {lang === "ar" ? u.titleAr || u.title : u.title}
                          {is999 && (
                            <button
                              type="button"
                              onClick={onJumpLegend}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-black/25 px-2 py-px text-[9px] font-black text-amber-200 hover:bg-black/40 transition-colors"
                            >
                              <Zap className="size-2.5" /> {L("اذهب للعناصر", "Jump to items")}
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {lang === "ar" ? u.descAr || u.desc : u.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
