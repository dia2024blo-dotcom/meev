"use client";

// ============================================================
// MEEV v16 — the gift sticker (chat upgrades).
// kind:"gift" messages render as THE GIFT ITSELF: the real emoji,
// big and clean, with no card and no background plate. Tapping it
// EXPLODES into a radial burst of the gift's emoji + confetti
// (CSS vars drive .meev-explode-piece in globals.css). Legendary
// gifts get a much bigger burst. The coin credit chip rides along
// — a sent gift IS the coin transfer to the recipient's account.
// ============================================================

import { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PawCoinIcon } from "./pawcoin";
import { useI18n } from "./i18n";
import { GIFTS, RARITY_STYLES, type GiftDef } from "@/lib/meev/constants";
import type { CSSProperties } from "react";
import type { MessageDTO } from "./types";
import { cn } from "@/lib/utils";

const FALLBACK_GIFT: GiftDef = {
  key: "mystery",
  name: "Mystery Gift",
  description: "A surprise from the Meev vault.",
  price: 0,
  rarity: "common",
  mood: "excited",
  xpReward: 0,
  emoji: "🎁",
};

const CONFETTI_CHARS = ["🎉", "✨", "💫"];
const CONFETTI_COLORS = ["#ffc24d", "#ff7e5f", "#f04a6e", "#06b6d4", "#22c55e", "#fde68a"];

export type BurstPiece = {
  id: number;
  /** null → confetti square, string → emoji particle */
  char: string | null;
  color: string;
  size: number;
  ex: number;
  ey: number;
  es: number;
  er: number;
  dur: number;
  delay: number;
};

/** Radial burst particles: mix of the gift's emoji + confetti, driven by --ex/--ey/--es/--er. `spread` scales the radius (mini bursts inside dialogs use ~0.6). */
export function makeBurstPieces(count: number, gift: GiftDef, spread = 1): BurstPiece[] {
  const emojiChars = [gift.emoji || "🎁", ...CONFETTI_CHARS];
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = (70 + Math.random() * 70) * spread; // 70–140px × spread
    const confetti = Math.random() < 0.42;
    return {
      id: i,
      char: confetti ? null : emojiChars[Math.floor(Math.random() * emojiChars.length)],
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 14 + Math.floor(Math.random() * 21), // 14–34px
      ex: Math.round(Math.cos(angle) * dist),
      ey: Math.round(Math.sin(angle) * dist),
      es: 0.6 + Math.random(), // scale 0.6–1.6
      er: 360 + Math.random() * 540, // rotate 360–900deg
      dur: 0.7 + Math.random() * 0.4, // 0.7–1.1s
      delay: Math.random() * 0.12,
    };
  });
}

function pieceStyle(p: BurstPiece): CSSProperties {
  const vars = {
    "--ex": `${p.ex}px`,
    "--ey": `${p.ey}px`,
    "--es": String(Number(p.es.toFixed(2))),
    "--er": `${Math.round(p.er)}deg`,
  } as CSSProperties;
  return {
    ...vars,
    animationDuration: `${p.dur}s`,
    animationDelay: `${p.delay}s`,
    fontSize: p.size,
  };
}

/** v8: exported — the gift cinema reuses the same particle layer full-screen. */
export function BurstLayer({ pieces }: { pieces: BurstPiece[] }) {
  return (
    <div className="absolute left-1/2 top-1/2 z-30 pointer-events-none" aria-hidden="true">
      {pieces.map((p) =>
        p.char ? (
          <span key={p.id} className="meev-explode-piece select-none leading-none" style={pieceStyle(p)}>
            {p.char}
          </span>
        ) : (
          <span
            key={p.id}
            className="meev-explode-piece rounded-[2px]"
            style={{
              ...pieceStyle(p),
              fontSize: undefined,
              width: Math.max(6, p.size * 0.55),
              height: Math.max(4, p.size * 0.38),
              background: p.color,
              boxShadow: `0 0 8px ${p.color}66`,
            }}
          />
        )
      )}
    </div>
  );
}

/** Small celebration burst used inside the gift dialog success state. */
export function MiniExplosion({ giftKey, count = 8 }: { giftKey?: string; count?: number }) {
  const gift = useMemo(() => GIFTS.find((g) => g.key === giftKey) ?? FALLBACK_GIFT, [giftKey]);
  // useMemo keeps the particles stable across re-renders → the animation
  // plays exactly once when the component mounts (on send success).
  const pieces = useMemo(() => makeBurstPieces(count, gift, 0.6), [gift, count]);
  return <BurstLayer pieces={pieces} />;
}

// ------------------------- the gift sticker -------------------------
// v16 (user spec): a DM gift arrives as THE GIFT ITSELF — the real emoji,
// big and beautiful, no card, no image, no background plate. Tap = the
// explosion burst (kept — it's the joy), and the coin value rides along
// because a sent gift IS the coin transfer to the recipient's account.

type Phase = "idle" | "bursting";

export function GiftBox({ message }: { message: MessageDTO }) {
  const { L } = useI18n();
  const meta = (message.meta ?? {}) as { giftKey?: string; note?: string; coins?: number };
  const gift = useMemo(() => GIFTS.find((g) => g.key === meta.giftKey) ?? FALLBACK_GIFT, [meta.giftKey]);
  const rar = RARITY_STYLES[gift.rarity] ?? RARITY_STYLES.common;
  const legendary = gift.rarity === "legendary";
  const note = typeof meta.note === "string" && meta.note.trim() ? meta.note.trim() : "";
  const coins = typeof meta.coins === "number" && meta.coins > 0 ? meta.coins : gift.price;

  const [burst, setBurst] = useState<{ pieces: BurstPiece[]; n: number } | null>(null);
  const timer = useRef<number>(0);

  const trigger = useCallback(() => {
    const count = legendary ? 40 : 18 + Math.floor(Math.random() * 9);
    setBurst({ pieces: makeBurstPieces(count, gift), n: (burst?.n ?? 0) + 1 });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBurst(null), 1200);
  }, [gift, legendary, burst?.n]);

  const from = message.author.displayName;

  return (
    <div className="relative py-1.5 select-none">
      {burst && <BurstLayer key={burst.n} pieces={burst.pieces} />}

      {/* the gift itself — a clean sticker, no card behind it */}
      <motion.button
        type="button"
        onClick={trigger}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex flex-col items-center gap-1.5 px-2 pt-1"
        aria-label={L(`هدية ${gift.name} من ${from} — اضغط للانفجار`, `A ${gift.name} gift from ${from} — tap for the burst`)}
      >
        <span
          className={cn(
            "text-[64px] leading-none select-none drop-shadow-[0_8px_22px_rgba(0,0,0,.35)]",
            "transition-transform hover:scale-105",
          )}
          role="img"
          aria-label={gift.name}
        >
          {gift.emoji || "🎁"}
        </span>
        <span className="flex items-center gap-1.5 flex-wrap justify-center">
          <span className="text-xs font-black">{gift.name}</span>
          <span
            className="text-[9px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5"
            style={{ background: `${rar.ring}22`, color: rar.ring }}
          >
            {rar.label}
          </span>
        </span>
        {note && (
          <span className="text-xs text-muted-foreground italic text-center leading-snug max-w-[240px]">“{note}”</span>
        )}
        {/* the credit line — the gift IS the transfer */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-3 py-1 text-xs font-bold text-amber-400">
          <PawCoinIcon size={14} spin={legendary} aria-hidden="true" />
          +{coins.toLocaleString()} {L("إلى حسابه", "to their account")}
        </span>
        <span className="text-[10px] text-muted-foreground/70">{L("اضغط للانفجار 💥", "Tap for the burst 💥")}</span>
      </motion.button>
    </div>
  );
}
