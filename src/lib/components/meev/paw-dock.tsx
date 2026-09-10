"use client";

// ============================================================
// MEEV v4 — PawDock 🐾 (flat edition)
// The signature navigation, per the user's v4 spec:
//
//   (Live)(Shop)   🐱   (Explore)(Chats)   ← ONE flat bottom row
//
//   · messages + explore sit NEXT TO the cat at the bottom
//   · live 1v1 + shop on the LEFT of the cat
//   · the cat = the main menu (main pad), dead center
//   · NO background panels — pure floating icons with soft
//     drop-shadows, so the page art flows under the dock
//     instead of being covered by it.
// v8: inside an open chat thread the dock disappears COMPLETELY —
//     the old mini cat orb floated over the composer / send
//     button on phones AND desktop (user report). The chat header
//     back button (now with a live unread badge for the other
//     chats) is the strong replacement; on desktop the sidebar
//     conversation list is always visible anyway.
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { useMeev, type ViewId } from "./store";
import { MeevLogo } from "./logo";
import { useI18n } from "./i18n";
import { Compass, MessageCircle, Zap, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

type ToeId = "live" | "shop" | "explore" | "messages";

// PHYSICAL order (left → right): Live, Shop | 🐱 | Explore, Chats.
// The container is pinned dir="ltr" so RTL never mirrors the sides.
const TOES: { id: ToeId; icon: typeof Compass; ar: string; en: string }[] = [
  { id: "live", icon: Zap, ar: "مباشر ١v١", en: "Live 1v1" },
  { id: "shop", icon: ShoppingBag, ar: "المتجر", en: "Shop" },
  { id: "explore", icon: Compass, ar: "استكشاف", en: "Explore" },
  { id: "messages", icon: MessageCircle, ar: "الرسائل", en: "Chats" },
];

export function PawDock() {
  const { view, me, unread } = useMeev();
  const setView = useMeev((s) => s.setView);
  const dmConversation = useMeev((s) => s.dmConversation);
  const { L } = useI18n();

  // v8: inside an open chat thread the dock vanishes entirely —
  // no floating orb over the composer anymore.
  const hidden = view === "messages" && !!dmConversation;

  const go = (id: ViewId) => setView(id);

  return (
    <AnimatePresence mode="wait">
      {!hidden && (
        /* ---- THE FLAT PAW — one bottom row, zero backgrounds ---- */
        <motion.nav
          key="paw-dock"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          dir="ltr"
          className="fixed z-40 bottom-[calc(env(safe-area-inset-bottom)+0.55rem)] left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-1.5 select-none"
          aria-label={L("التنقل الرئيسي", "Main navigation")}
        >
          {/* ---- LEFT cluster: Live 1v1 + Shop ---- */}
          <ToeButton toe={TOES[0]} active={view === "live"} onClick={() => go("live")} />

          <ToeButton toe={TOES[1]} active={view === "shop"} onClick={() => go("shop")} />

          {/* breathing gap around the main pad */}
          <span className="w-2 sm:w-3 shrink-0" aria-hidden="true" />

          {/* ---- MAIN PAD: the cat IS the home button (main menu) ---- */}
          <motion.button
            onClick={() => go("home")}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.88, rotate: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            initial={{ opacity: 0, y: 22, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="group relative grid place-items-center size-[76px] md:size-[86px] shrink-0"
            aria-label={L("القائمة الرئيسية", "Main menu")}
            aria-current={view === "home" ? "page" : undefined}
          >
            {/* soft halo behind the cat — a gold glow, NOT a background panel
                (v15: the old sunset coral halo was the "برتقالي قديم" the user
                saw behind the cat — now the ONE brand gold, like the logo) */}
            {view === "home" && (
              <span
                className="absolute inset-2 rounded-full blur-xl pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(190,177,92,.5), rgba(201,193,137,.22) 60%, transparent 75%)" }}
                aria-hidden="true"
              />
            )}
            <MeevLogo
              size={62}
              mood={view === "home" ? "happy" : "default"}
              speed={1}
              glow={view === "home"}
              className="[filter:var(--dock-logo-shadow)]"
            />
            {/* level chip on the main pad */}
            {me && me.level > 0 && (
              <span className="absolute top-0.5 right-0.5 rounded-full bg-card border border-border px-1.5 py-px text-[9px] font-bold text-amber-500 tabular-nums shadow-sm">
                {me.level}
              </span>
            )}
            {/* tooltip */}
            <span className="pointer-events-none absolute bottom-full mb-3 whitespace-nowrap rounded-lg bg-popover border border-border px-2.5 py-1 text-[11px] font-semibold opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
              {L("القائمة الرئيسية", "Main menu")}
            </span>
          </motion.button>

          <span className="w-2 sm:w-3 shrink-0" aria-hidden="true" />

          {/* ---- RIGHT cluster: Explore + Chats ---- */}
          <ToeButton toe={TOES[2]} active={view === "explore"} onClick={() => go("explore")} />

          <ToeButton
            toe={TOES[3]}
            active={view === "messages"}
            onClick={() => go("messages")}
            unread={unread}
          />
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

// ------------------------- a floating toe (no background) -------------------------

function ToeButton({
  toe,
  active,
  onClick,
  unread = 0,
}: {
  toe: { id: ToeId; icon: typeof Compass; ar: string; en: string };
  active: boolean;
  onClick: () => void;
  unread?: number;
}) {
  const { L } = useI18n();
  const Icon = toe.icon;
  return (
    <motion.button
      key={toe.id}
      onClick={onClick}
      whileHover={{ scale: 1.16, y: -3 }}
      whileTap={{ scale: 0.85 }}
      transition={{ type: "spring", stiffness: 420, damping: 16 }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative grid place-items-center size-[54px] md:size-[58px] shrink-0 transition-colors duration-200",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
      aria-label={L(toe.ar, toe.en)}
      aria-current={active ? "page" : undefined}
    >
      {/* active glow ring — pure brand gold light, no solid background */}
      {active && (
        <span
          className="absolute inset-[30%] rounded-full blur-lg pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(190,177,92,.6), transparent 75%)" }}
          aria-hidden="true"
        />
      )}
      <Icon
        className="size-[26px] md:size-7 [filter:var(--dock-icon-shadow)]"
        strokeWidth={active ? 2.5 : 2.1}
      />

      {/* the glowing paw dot under the active toe */}
      <span
        className={cn(
          "absolute -bottom-0.5 h-1.5 rounded-full transition-all duration-300",
          active ? "w-5 opacity-100 meev-gradient-btn shadow-[0_0_10px_rgba(190,177,92,.6)]" : "w-0 opacity-0"
        )}
        aria-hidden="true"
      />

      {/* unread badge on chats */}
      {toe.id === "messages" && unread > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 text-[10px] font-bold text-white border-2 border-background shadow"
        >
          {unread > 9 ? "9+" : unread}
        </motion.span>
      )}

      {/* tooltip */}
      <span className="pointer-events-none absolute bottom-full mb-2.5 whitespace-nowrap rounded-lg bg-popover border border-border px-2.5 py-1 text-[11px] font-semibold opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
        {L(toe.ar, toe.en)}
      </span>
    </motion.button>
  );
}
