"use client";

// ============================================================
// MEEV v4 — Gold Meev 🪙: the official currency icon.
// The brand cat (upload/meev2027.png) embossed on a gold coin.
// Used everywhere the balance is shown (topbar, shop, gifts, spin).
// ============================================================

import { cn } from "@/lib/utils";
import { useI18n } from "./i18n";

export const MEEV_COIN_CAT = "/meev-coin-cat.png";

export function PawCoinIcon({ size = 16, className, spin = false }: { size?: number; className?: string; spin?: boolean }) {
  return (
    <span
      className={cn("relative inline-grid place-items-center shrink-0", spin && "meev-coin-shine", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" width={size} height={size} className="absolute inset-0">
        <defs>
          <radialGradient id="pawcoin-g" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        {/* coin body + emboss rings */}
        <circle cx="24" cy="24" r="23" fill="url(#pawcoin-g)" stroke="#b45309" strokeWidth="1.6" />
        <circle cx="24" cy="24" r="20.5" fill="none" stroke="#fde68a" strokeWidth="1" opacity="0.75" />
        <circle cx="24" cy="24" r="10" fill="#fde68a" opacity="0.14" />
      </svg>
      {/* the actual Meev brand cat on the coin face */}
      <img
        src={MEEV_COIN_CAT}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="relative z-[1] select-none"
        style={{ width: size * 0.94, height: size * 0.94, filter: "drop-shadow(0 0.5px 0.5px rgba(120,53,15,.55))" }}
      />
    </span>
  );
}

/** Icon + formatted amount, e.g. 🐾 1,250 */
export function PawCoins({ amount, className, size = 14, animate }: { amount: number; className?: string; size?: number; animate?: boolean }) {
  const { L } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold tabular-nums text-amber-400",
        animate && "meev-pop",
        className
      )}
      title={L("ذهب ميف", "Gold Meev")}
    >
      <PawCoinIcon size={size} spin={animate} />
      {amount.toLocaleString()}
    </span>
  );
}
