"use client";

// MEEV — Celebration overlay: confetti burst + level-up + gift takeover.
// v3: level 999 gets the full-screen LEGEND takeover — golden MeevLogo,
// confetti storm, and an "Open Shop" button that jumps straight to the
// newly unlocked animated avatar + legend cover (the 999 surprise).

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MeevLogo } from "./logo";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { queueLegendJump } from "./legend-jump";
import { Crown, ShoppingBag } from "lucide-react";
import { XpSpark, GiftMark, BoltMark } from "./symbols";

const COLORS = ["#ffc24d", "#ff7e5f", "#f04a6e", "#06b6d4", "#22c55e", "#f43f5e", "#eab308", "#fde047"];

export function Confetti({ count = 90, duration = 3200 }: { count?: number; duration?: number }) {
  const [pieces, setPieces] = useState<{ id: number; left: number; delay: number; color: string; size: number; radius: string }[]>([]);

  useEffect(() => {
    const arr = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      radius: Math.random() > 0.5 ? "50%" : "2px",
    }));
    setPieces(arr);
    const t = setTimeout(() => setPieces([]), duration);
    return () => clearTimeout(t);
  }, [count, duration]);

  if (pieces.length === 0) return null;
  return (
    <div className="fixed inset-0 z-[80] pointer-events-none overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="meev-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.radius === "50%" ? 1 : 0.5),
            background: p.color,
            borderRadius: p.radius,
            animationDuration: `${2.2 + Math.random() * 1.4}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export type Celebration =
  | { type: "level"; level: number }
  | { type: "gift"; giftKey: string; giftName: string; from: string; mood?: string; rare?: boolean }
  | null;

export function CelebrationOverlay({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  const setView = useMeev((s) => s.setView);
  const { L } = useI18n();
  const isLegend = celebration?.type === "level" && celebration.level >= 999;

  useEffect(() => {
    if (!celebration) return;
    if (isLegend) return; // the LEGEND takeover stays until dismissed (no auto-close)
    const t = setTimeout(onClose, celebration.type === "gift" && celebration.rare ? 5200 : 4200);
    return () => clearTimeout(t);
  }, [celebration, onClose, isLegend]);

  return (
    <AnimatePresence>
      {celebration && (
        isLegend ? (
          <motion.div
            key="legend"
            className="fixed inset-0 z-[90] grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            {/* confetti storm */}
            <Confetti count={240} duration={10000} />
            <motion.div
              initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative glass rounded-3xl px-6 sm:px-12 py-8 sm:py-10 flex flex-col items-center gap-4 max-w-md text-center pointer-events-auto meev-pulse-glow"
              style={{ borderColor: "rgba(251,191,36,.55)" }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Meev Legend"
            >
              <MeevLogo size={140} mood="legend" speed={1.8} glow />
              <div className="text-3xl sm:text-4xl font-black leading-tight meev-legend-shimmer meev-legend-text px-4 py-1.5 rounded-2xl flex items-center gap-2.5">
                <Crown className="size-7 sm:size-8" aria-hidden="true" />
                {L("أسطورة ميف!", "MEEV LEGEND!")}
              </div>
              <div className="text-5xl font-black text-amber-300 tabular-nums drop-shadow-[0_0_18px_rgba(251,191,36,.6)]">
                999
              </div>
              <p className="text-sm text-amber-100/90 leading-relaxed max-w-xs flex items-center justify-center gap-1.5">
                {L(
                  "المستوى ٩٩٩ — فُتحت لك الصورة المتحركة والغلاف الأسطوري في المتجر",
                  "Level 999 — the animated avatar + legend cover just unlocked in the shop"
                )}
                <BoltMark size={14} className="text-amber-300 shrink-0" />
              </p>
              <Button
                className="rounded-2xl h-11 px-6 text-sm font-black meev-gradient-btn text-white gap-2"
                onClick={() => {
                  queueLegendJump(); // land on the ⚡ legend tab, not the default one
                  setView("shop");
                  onClose();
                }}
              >
                <ShoppingBag className="size-4" aria-hidden="true" /> {L("افتح المتجر", "Open Shop")}
              </Button>
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                onClick={onClose}
              >
                {L("متابعة التصفح", "Keep browsing")}
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="regular"
            className="fixed inset-0 z-[90] grid place-items-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
            <Confetti count={celebration.type === "gift" && celebration.rare ? 140 : 80} duration={4500} />
            <motion.div
              initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="relative glass rounded-3xl px-10 py-8 flex flex-col items-center gap-3 max-w-sm text-center pointer-events-auto"
            >
              {celebration.type === "level" ? (
                <>
                  <MeevLogo size={92} mood="party" speed={1.6} />
                  <div className="text-sm uppercase tracking-widest text-muted-foreground">Level up!</div>
                  <div className="text-5xl font-black meev-aurora-text leading-none">{celebration.level}</div>
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">New perks may be waiting in your profile <XpSpark size={13} className="text-amber-400 shrink-0" /></div>
                </>
              ) : (
                <>
                  <MeevLogo size={120} mood={(celebration.mood as never) || "excited"} speed={1.8} glow />
                  <div className="text-sm uppercase tracking-widest text-muted-foreground">You received a gift!</div>
                  <div className="text-3xl font-black meev-aurora-text leading-tight">{celebration.giftName}</div>
                  <div className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">from <b>{celebration.from}</b> <GiftMark size={14} className="text-amber-400 shrink-0" /></div>
                </>
              )}
            </motion.div>
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
}

export function useCelebration() {
  const [celebration, setCelebration] = useState<Celebration>(null);
  const show = useCallback((c: Celebration) => setCelebration(c), []);
  const node = (
    <CelebrationOverlay celebration={celebration} onClose={() => setCelebration(null)} />
  );
  return { show, node };
}
