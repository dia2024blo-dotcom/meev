"use client";

// ============================================================
// MEEV v14 — BADGE SYMBOLS (شارات رمزية فقط)
// The user spec (round 14): "خلي اشارات فقط بدون اي خلفية او اضافات
// علشان تجي حقيقية ورائعة" — every shop badge (bd-*) and achievement
// badge (founder, lvl-999…) is now the PURE GLYPH SYMBOL alone:
// no shield frame, no ring, no tint, no hairline, no shimmer, no glow.
// Nothing behind it, nothing around it — the symbol IS the badge.
//
// ONE shared component, keyed by the badge KEY:
//   <BadgeGlyph badge="bd-rose" size={16} title="وردة" />
//
// Design language ("the symbol"):
//   • the unique hand-drawn GLYPH per key, stroke-based width 2 with
//     round caps/joins (the lucide aesthetic), alone in the 32×32
//     viewBox — scaled ~1.12 about the center so it owns the full box
//     now that the medal frame is gone
//   • it draws in the badge's identity INK color: strokes AND the little
//     dot/eye fills are the same ink (currentColor ← span color).
//     Every ink is tuned to read on BOTH warm-cream light and warm-cocoa
//     dark surfaces — pale yellows deepened to goldenrod territory,
//     cool payload colors remapped to warm inks (no blue/indigo/violet)
//   • unknown keys gracefully fall back to the generic paw symbol
//
// viewBox 0 0 32 32 — scales crisply via `size` (14px inline next to
// usernames … 48px on shop cards). Tooltips/titles pass through.
// ============================================================

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BadgeGlyphProps {
  /** badge KEY — an achievement key ("founder") or a shop key ("bd-rose") */
  badge: string;
  /** rendered size in px (inline 14-18 · shelf/shop 40-56) */
  size?: number;
  className?: string;
  /** tooltip / aria-label */
  title?: string;
}

// ---------------- per-key identity inks ----------------
// the badge's identity color — the ONLY color on the badge now. Remapped
// where the raw payload color was cool (cyan/violet/indigo → warm tokens,
// never blue/indigo/violet) and DEEPENED where too pale to survive the
// warm-cream light surface (pale yellows/limes → goldenrod & olive-gold
// family), so every ink reads on BOTH warm-cream light and warm-cocoa dark.
const INK: Record<string, string> = {
  // achievement badges
  founder: "#f59e0b",
  "social-butterfly": "#ff7e5f",
  "night-owl": "#f04a6e",
  gifted: "#f43f5e",
  "lvl-10": "#b8860b",
  "lvl-50": "#16a34a",
  "lvl-100": "#e11d48",
  "lvl-999": "#f59e0b",
  // shop badges
  "bd-rose": "#f43f5e",
  "bd-rock": "#f97316",
  "bd-ghost": "#e2635a",
  "bd-star": "#b8860b",
  "bd-diamond": "#e11d48",
  "bd-crown": "#f59e0b",
  "bd-activity": "#b98a00",
  "bd-passion": "#f97316",
  "bd-support": "#059669",
  "bd-serious": "#a16207",
  "bd-talk": "#ec4899",
  "bd-impact": "#b98a00",
  "bd-owner": "#f59e0b",
  "bd-phoenix": "#dd6b20",
  "bd-titan": "#65a30d",
  "bd-cosmos": "#f04a6e",
  "bd-meevgod": "#b45309",
};

// ---------------- glyph stroke/fill presets ----------------
const G = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
const G_THIN = { ...G, strokeWidth: 1.6 } as const;
const F = { fill: "currentColor", stroke: "none" } as const;

// ---------------- the unique glyphs ----------------
// one hand-drawn concept per badge key, centered ~ (16, 16)
const GLYPHS: Record<string, ReactNode> = {
  /* founder — rocket fin (joined during the founding era) */
  founder: (
    <g>
      <path d="M16 8.6 C18.3 10.4 19.5 13.2 19.5 16.4 V19.6 H12.5 V16.4 C12.5 13.2 13.7 10.4 16 8.6 Z" {...G} />
      <circle cx="16" cy="13.4" r="1.8" {...G_THIN} />
      <path d="M12.5 16.8 L10.2 19.6 L12.5 20.2 M19.5 16.8 L21.8 19.6 L19.5 20.2" {...G} />
      <path d="M16 20.4 C17.1 21.5 16.6 22.7 16 23.6 C15.4 22.7 14.9 21.5 16 20.4 Z" {...G_THIN} />
    </g>
  ),

  /* social-butterfly — butterfly wings */
  "social-butterfly": (
    <g>
      <path d="M16 11.2 V20.4" {...G} />
      <path d="M15.4 10.8 C14.7 9.8 13.9 9.3 13 9.1 M16.6 10.8 C17.3 9.8 18.1 9.3 19 9.1" {...G_THIN} />
      <path d="M15.4 13.4 C12.8 10.4 9.3 10 8.6 12.8 C8.1 15.1 10.9 17.1 15.4 16.6" {...G} />
      <path d="M16.6 13.4 C19.2 10.4 22.7 10 23.4 12.8 C23.9 15.1 21.1 17.1 16.6 16.6" {...G} />
      <path d="M15.4 17.5 C12.6 18.3 10.6 20.3 11.6 22 C12.6 23.4 15 22.1 15.7 19.7" {...G} />
      <path d="M16.6 17.5 C19.4 18.3 21.4 20.3 20.4 22 C19.4 23.4 17 22.1 16.3 19.7" {...G} />
    </g>
  ),

  /* night-owl — crescent + watching eye */
  "night-owl": (
    <g>
      <path d="M16 9 a8.49 8.49 0 0 0 -4 15.83 13.2 13.2 0 1 1 4 -15.83 Z" {...G} />
      <path d="M18.6 16.2 C19.6 14.9 21.7 14.9 22.7 16.2 C21.7 17.5 19.6 17.5 18.6 16.2 Z" {...G_THIN} />
      <circle cx="20.6" cy="16.2" r="1" {...F} />
    </g>
  ),

  /* gifted — gift box with ribbon bow */
  gifted: (
    <g>
      <rect x="8.6" y="9.9" width="14.8" height="4.4" rx="1.5" {...G} />
      <path d="M10.2 14.3 V22.2 C10.2 23.3 11.1 24.2 12.2 24.2 H19.8 C20.9 24.2 21.8 23.3 21.8 22.2 V14.3" {...G} />
      <path d="M16 9.9 V24.2" {...G} />
      <path d="M16 9.9 C14.6 7.5 11.8 7.2 11.4 8.8 C11.1 10.2 13.4 10.7 16 9.9 M16 9.9 C17.4 7.5 20.2 7.2 20.6 8.8 C20.9 10.2 18.6 10.7 16 9.9" {...G_THIN} />
    </g>
  ),

  /* lvl-10 — single rising star */
  "lvl-10": (
    <path
      d="M16 8.8 L17.82 13.69 L23.04 13.91 L18.95 17.16 L20.35 22.19 L16 19.3 L11.65 22.19 L13.05 17.16 L8.96 13.91 L14.18 13.69 Z"
      {...G}
    />
  ),

  /* lvl-50 — laurel wreath */
  "lvl-50": (
    <g>
      <path d="M10.8 23 C8.6 19.4 8.4 14.2 10.6 10.4" {...G} />
      <path d="M9.7 21.3 L7.9 20.8 M9.3 18.9 L7.4 18.8 M9.3 16.3 L7.5 15.8 M10 14 L8.3 13.1 M11.2 11.9 L9.9 10.7" {...G_THIN} />
      <path d="M21.2 23 C23.4 19.4 23.6 14.2 21.4 10.4" {...G} />
      <path d="M22.3 21.3 L24.1 20.8 M22.7 18.9 L24.6 18.8 M22.7 16.3 L24.5 15.8 M22 14 L23.7 13.1 M20.8 11.9 L22.1 10.7" {...G_THIN} />
      <path d="M16 10.4 C16.35 11.9 17.1 12.65 18.7 13 C17.1 13.35 16.35 14.1 16 15.6 C15.65 14.1 14.9 13.35 13.3 13 C14.9 12.65 15.65 11.9 16 10.4 Z" {...G} />
    </g>
  ),

  /* lvl-100 — diamond trio */
  "lvl-100": (
    <g>
      <path d="M12.8 10.6 H19.2 L21.6 13.8 L16 20.4 L10.4 13.8 Z" {...G} />
      <path d="M12.8 10.6 L16 20.4 M19.2 10.6 L16 20.4" {...G_THIN} />
      <path d="M8.8 17 H11.4 L12.7 18.7 L10.1 21.4 L7.5 18.7 Z" {...G} />
      <path d="M23.2 17 H20.6 L19.3 18.7 L21.9 21.4 L24.5 18.7 Z" {...G} />
    </g>
  ),

  /* lvl-999 — crown over the paw (the prestige) */
  "lvl-999": (
    <g>
      <path d="M11.6 11.4 L10.9 6.6 L13.9 8.8 L16 5.8 L18.1 8.8 L21.1 6.6 L20.4 11.4 Z" {...G} />
      <ellipse cx="16" cy="17.8" rx="2.7" ry="2.1" {...G} />
      <circle cx="13.5" cy="15" r="0.95" {...F} />
      <circle cx="16" cy="14.2" r="0.95" {...F} />
      <circle cx="18.5" cy="15" r="0.95" {...F} />
    </g>
  ),

  /* bd-rose — 5-petal rosette */
  "bd-rose": (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <path
          key={a}
          transform={`rotate(${a} 16 16.5)`}
          d="M16 14.3 C14.6 13.1 14.2 11.2 15.2 10 C15.7 9.4 16.3 9.4 16.8 10 C17.8 11.2 17.4 13.1 16 14.3 Z"
          {...G}
        />
      ))}
      <circle cx="16" cy="16.5" r="1.6" {...F} />
    </g>
  ),

  /* bd-rock — guitar pick with a bolt */
  "bd-rock": (
    <g>
      <path d="M16 24.3 C12.9 21.4 10.8 18.2 10.8 14.9 C10.8 11.7 13.1 9.6 16 9.6 C18.9 9.6 21.2 11.7 21.2 14.9 C21.2 18.2 19.1 21.4 16 24.3 Z" {...G} />
      <path d="M17.3 12.4 L14.4 16.2 H16.4 L15.4 19.3 L18.4 15.4 H16.4 Z" {...F} />
    </g>
  ),

  /* bd-ghost — friendly rounded ghost */
  "bd-ghost": (
    <g>
      <path d="M11 23.2 V14.6 C11 11.5 13.2 9 16 9 C18.8 9 21 11.5 21 14.6 V23.2 L19.2 21.7 L17.4 23.2 L16 22.2 L14.6 23.2 L12.8 21.7 Z" {...G} />
      <circle cx="14" cy="14.2" r="1.15" {...F} />
      <circle cx="18" cy="14.2" r="1.15" {...F} />
    </g>
  ),

  /* bd-star — 4-point sparkle star */
  "bd-star": (
    <g>
      <path d="M16 8.6 C16.8 12.4 18.6 14.2 22.4 15 C18.6 15.8 16.8 17.6 16 21.4 C15.2 17.6 13.4 15.8 9.6 15 C13.4 14.2 15.2 12.4 16 8.6 Z" {...G} />
      <circle cx="22.2" cy="10.2" r="1.05" {...F} />
    </g>
  ),

  /* bd-diamond — faceted gem */
  "bd-diamond": (
    <g>
      <path d="M11.2 10.4 H20.8 L23.6 14.6 L16 24.2 L8.4 14.6 Z" {...G} />
      <path d="M11.2 10.4 L13.4 14.6 L16 24.2 M20.8 10.4 L18.6 14.6 L16 24.2 M8.4 14.6 H23.6" {...G_THIN} />
    </g>
  ),

  /* bd-crown — 3-point crown */
  "bd-crown": (
    <g>
      <path d="M10.2 20.6 L9.4 11.2 L13 14.8 L16 9 L19 14.8 L22.6 11.2 L21.8 20.6 Z" {...G} />
      <circle cx="9.4" cy="9.2" r="1.05" {...F} />
      <circle cx="16" cy="7" r="1.05" {...F} />
      <circle cx="22.6" cy="9.2" r="1.05" {...F} />
    </g>
  ),

  /* bd-activity — double lightning bolt */
  "bd-activity": (
    <g>
      <path d="M12.8 9.4 L9.4 14.8 H12 L11 20" {...G} />
      <path d="M19.6 9.4 L16.2 14.8 H18.8 L17.8 20" {...G} />
    </g>
  ),

  /* bd-passion — the living flame */
  "bd-passion": (
    <path
      d="M16 8.8 C18.6 11.4 20.8 13.9 20.8 17 C20.8 20.4 18.6 22.8 16 22.8 C13.4 22.8 11.2 20.4 11.2 17 C11.2 15.2 12 13.5 13.1 12.1 C13.4 13.2 14 14 15 14.4 C14.4 12.2 15 10.3 16 8.8 Z"
      {...G}
    />
  ),

  /* bd-support — shield with a check */
  "bd-support": (
    <g>
      <path d="M16 9.4 L21.2 11.4 V16.3 C21.2 19.9 19 22.3 16 23.3 C13 22.3 10.8 19.9 10.8 16.3 V11.4 Z" {...G} />
      <path d="M13.5 16.5 L15.3 18.3 L18.5 14.6" {...G} />
    </g>
  ),

  /* bd-serious — triple chevron insignia */
  "bd-serious": (
    <path d="M11.8 10.8 L16 13.9 L20.2 10.8 M11.8 14.8 L16 17.9 L20.2 14.8 M11.8 18.8 L16 21.9 L20.2 18.8" {...G} />
  ),

  /* bd-talk — two speech bubbles */
  "bd-talk": (
    <g>
      <rect x="7.9" y="11.6" width="12.6" height="9.2" rx="2.4" {...G} />
      <path d="M10.9 20.8 V23.2 L13.9 20.8" {...G} />
      <rect x="16.6" y="7.8" width="7.6" height="5.9" rx="2" {...G} />
      <circle cx="12" cy="16.2" r="0.9" {...F} />
      <circle cx="15" cy="16.2" r="0.9" {...F} />
    </g>
  ),

  /* bd-impact — radiating burst */
  "bd-impact": (
    <g>
      <circle cx="16" cy="16.5" r="2.3" {...G} />
      <path
        d="M16 12.4 V9.8 M16 20.6 V23.2 M11.9 16.5 H9.3 M20.1 16.5 H22.7 M13.1 13.6 L11.3 11.8 M18.9 13.6 L20.7 11.8 M13.1 19.4 L11.3 21.2 M18.9 19.4 L20.7 21.2"
        {...G}
      />
    </g>
  ),

  /* bd-owner — crown riding an orbit */
  "bd-owner": (
    <g>
      <path d="M11.4 15.4 L10.7 9.6 L13.7 11.8 L16 8.4 L18.3 11.8 L21.3 9.6 L20.6 15.4 Z" {...G} />
      <ellipse cx="16" cy="18.4" rx="8.4" ry="3" transform="rotate(-12 16 18.4)" {...G_THIN} />
      <circle cx="21.9" cy="15.1" r="1.45" {...F} />
    </g>
  ),

  /* bd-phoenix — flame between upswept wings */
  "bd-phoenix": (
    <g>
      <path d="M16 12 C17.5 13.8 18.3 15.2 18.3 16.8 C18.3 19 17.3 20.6 16 20.6 C14.7 20.6 13.7 19 13.7 16.8 C13.7 15.9 14 15.1 14.5 14.4 C14.7 15.1 15.1 15.6 15.7 15.9 C15.4 14.5 15.6 13.2 16 12 Z" {...G} />
      <path d="M14.2 17.5 C10.6 17 8.2 14.6 8 11 C10 11.4 11.7 12.5 12.9 14.2" {...G} />
      <path d="M17.8 17.5 C21.4 17 23.8 14.6 24 11 C22 11.4 20.3 12.5 19.1 14.2" {...G} />
    </g>
  ),

  /* bd-titan — the mountain monolith */
  "bd-titan": (
    <g>
      <path d="M7.8 23.4 L13.6 11.6 L16.2 16.4 L18.8 12.2 L24.2 23.4 Z" {...G} />
      <circle cx="21.8" cy="10.2" r="1.3" {...G_THIN} />
    </g>
  ),

  /* bd-cosmos — ringed planet with a moon */
  "bd-cosmos": (
    <g>
      <circle cx="16" cy="16.5" r="5.1" {...G} />
      <ellipse cx="16" cy="16.5" rx="8.8" ry="3.1" transform="rotate(-16 16 16.5)" {...G_THIN} />
      <circle cx="20.8" cy="12.6" r="1.35" {...F} />
    </g>
  ),

  /* bd-meevgod — the Meev cat head with sun rays */
  "bd-meevgod": (
    <g>
      <path
        d="M11.1 11.7 L10.3 7.8 L13.5 9.9 C14.3 9.7 15.1 9.6 16 9.6 C16.9 9.6 17.7 9.7 18.5 9.9 L21.7 7.8 L20.9 11.7 C22 12.8 22.6 14.2 22.6 15.8 C22.6 19.4 19.8 21.7 16 21.7 C12.2 21.7 9.4 19.4 9.4 15.8 C9.4 14.2 10 12.8 11.1 11.7 Z"
        {...G}
      />
      <circle cx="13.4" cy="14.6" r="1.1" {...F} />
      <circle cx="18.6" cy="14.6" r="1.1" {...F} />
      <path d="M8.6 8.8 L7 7.2 M16 6.9 V4.9 M23.4 8.8 L25 7.2" {...G_THIN} />
    </g>
  ),

  /* fallback — the generic Meev paw symbol */
  __fallback: (
    <g>
      <ellipse cx="16" cy="18.2" rx="4.3" ry="3.5" {...G} />
      <ellipse cx="9.9" cy="12.8" rx="1.9" ry="2.5" transform="rotate(-18 9.9 12.8)" {...G} />
      <ellipse cx="13.9" cy="9.6" rx="1.9" ry="2.7" transform="rotate(-6 13.9 9.6)" {...G} />
      <ellipse cx="18.1" cy="9.6" rx="1.9" ry="2.7" transform="rotate(6 18.1 9.6)" {...G} />
      <ellipse cx="22.1" cy="12.8" rx="1.9" ry="2.5" transform="rotate(18 22.1 12.8)" {...G} />
    </g>
  ),
};

export function BadgeGlyph({ badge, size = 24, className, title }: BadgeGlyphProps) {
  const ink = INK[badge] ?? "#ff7e5f";
  const glyph = GLYPHS[badge] ?? GLYPHS.__fallback;
  return (
    <span
      className={cn("inline-flex items-center justify-center align-baseline select-none shrink-0", className)}
      style={{
        width: size,
        height: size,
        // the symbol's identity ink — strokes (currentColor) and the dot
        // fills (currentColor) all inherit it. NO filter, NO glow.
        color: ink,
      }}
      title={title}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        {/* the pure symbol: the frame is gone, so the drawing is scaled
            ~1.12 about the center to own the full 32×32 box (the scale
            also keeps the ~2.2 effective stroke of the old medal era) */}
        <g transform="translate(16 16) scale(1.12) translate(-16 -16)">{glyph}</g>
      </svg>
    </span>
  );
}
