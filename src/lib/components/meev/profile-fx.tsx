"use client";

// ============================================================
// MEEV v3 — shared profile cosmetics: animated covers (cv-*)
// + living profile effects (pe-*).
// ONE source of truth used by BOTH profile-view (full hero) and
// shop-view (mini previews), so the preview always matches the
// real profile. All particle positions are derived from a
// deterministic hash of the username — no hydration drift.
// prefers-reduced-motion: animations freeze (CSS) and the
// component skips the mood/interval parts.
// ============================================================

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { shopItem } from "@/lib/meev/constants";

// ------------------------- deterministic helpers -------------------------

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function rnd(seed: string, salt: string, mod: number): number {
  return hashStr(`${seed}:${salt}`) % mod;
}

// ------------------------- covers -------------------------

/** cv-* item key → cover art name ("aurora" | "nebula" | … | null). */
export function coverArtOf(coverKey?: string | null): string | null {
  if (!coverKey || !/^cv-/.test(coverKey)) return null;
  const item = shopItem(coverKey);
  return (item?.payload?.cover as string) || null;
}

const COVER_CLASS: Record<string, string> = {
  aurora: "meev-cover-aurora",
  nebula: "meev-cover-nebula",
  synthwave: "meev-cover-synthwave",
  lava: "meev-cover-lava",
  rainbow: "meev-cover-rainbow",
  legend: "meev-cover-legend",
};

/** Seed-based gradient fallback for profiles with no shop cover. */
const FALLBACK_COVERS = [
  "linear-gradient(120deg,#f04a6e,#ff7e5f)",
  "linear-gradient(120deg,#0ea5e9,#e8436b)",
  "linear-gradient(120deg,#ffc24d,#ff7e5f)",
  "linear-gradient(120deg,#14b8a6,#06b6d4)",
  "linear-gradient(120deg,#e8436b,#ff9d88)",
  "linear-gradient(120deg,#f43f5e,#f97316)",
];

/**
 * The cover band visual. Fills its parent (w-full h-full) — the caller
 * controls height/radius via the wrapper or className.
 * v11: a LEGEND coverPhoto (level-999 unlock) renders FIRST — the
 * uploaded image becomes the cover, with a golden legend edge.
 */
export function CoverArt({
  coverKey,
  seed = "",
  level = 0,
  className,
  coverPhoto,
}: {
  coverKey?: string | null;
  seed?: string;
  level?: number;
  className?: string;
  /** v11: level-999 custom uploaded cover image (wins over everything) */
  coverPhoto?: string | null;
}) {
  // v11: the Legend's own photo IS the cover
  if (coverPhoto) {
    return (
      <div className={cn("relative w-full h-full overflow-hidden", className)} aria-hidden="true">
        <img src={coverPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {/* the golden legend edge — only 999s wear this */}
        <div className="absolute inset-0 ring-1 ring-inset ring-amber-300/40" style={{ boxShadow: "inset 0 0 38px -8px rgba(251,191,36,.5)" }} />
      </div>
    );
  }
  const art = coverArtOf(coverKey);
  if (art) {
    return <div className={cn("relative w-full h-full overflow-hidden", COVER_CLASS[art], className)} aria-hidden="true" />;
  }
  // fallback: deterministic seed gradient (+ shimmer sweep at level 20+)
  const bg = FALLBACK_COVERS[hashStr(seed || "meev") % FALLBACK_COVERS.length];
  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)} style={{ background: bg }} aria-hidden="true">
      {level >= 20 && (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,.38) 50%, transparent 70%)",
            backgroundSize: "300% 100%",
            animation: "meev-pan 6s linear infinite",
          }}
        />
      )}
    </div>
  );
}

// ------------------------- profile effects -------------------------

/** pe-* item key (or bare effect name) → effect name, else null. */
export function effectOf(effectKey?: string | null): string | null {
  if (!effectKey) return null;
  if (/^pe-/.test(effectKey)) {
    const item = shopItem(effectKey);
    return (item?.payload?.effect as string) || null;
  }
  return /^(aurora|hearts|fire|snow|rainbow|galaxy)$/.test(effectKey) ? effectKey : null;
}

/** Effects that render as an overlay INSIDE the hero band. */
export const HERO_EFFECTS = ["aurora", "hearts", "fire", "snow"] as const;
/** Effects anchored elsewhere: galaxy orbits the avatar, rainbow rings the card. */
export const AVATAR_EFFECTS = ["galaxy"] as const;

type Piece = {
  emoji?: string;
  left: number; // %
  size?: number; // px (emojis) / px (dots)
  blur?: number;
  color?: string;
  delay: number; // s
  dur: number; // s
  sway?: number; // px (embers)
};

/** Deterministic particle set for an effect, seeded by the username. */
function buildPieces(fx: string, seed: string): Piece[] {
  const n = fx === "hearts" ? 8 : fx === "snow" ? 12 : fx === "fire" ? 12 : 0;
  const HEARTS = ["💗", "❤️", "💖", "💕"];
  const FLAKES = ["❄", "❅", "•"];
  return Array.from({ length: n }, (_, i) => {
    if (fx === "hearts") {
      return {
        emoji: HEARTS[rnd(seed, `e${i}`, HEARTS.length)],
        left: 3 + rnd(seed, `x${i}`, 93),
        size: 11 + rnd(seed, `s${i}`, 11),
        delay: rnd(seed, `d${i}`, 80) / 10,
        dur: 5.5 + rnd(seed, `t${i}`, 40) / 10,
      };
    }
    if (fx === "snow") {
      return {
        emoji: FLAKES[rnd(seed, `e${i}`, FLAKES.length)],
        left: 2 + rnd(seed, `x${i}`, 95),
        size: 7 + rnd(seed, `s${i}`, 10),
        delay: rnd(seed, `d${i}`, 100) / 10,
        dur: 6 + rnd(seed, `t${i}`, 60) / 10,
      };
    }
    if (fx === "fire") {
      // 2 flames + 10 rising embers
      const isFlame = i < 2;
      return {
        emoji: isFlame ? "🔥" : undefined,
        left: isFlame ? 12 + i * 74 : 4 + rnd(seed, `x${i}`, 92),
        size: isFlame ? 13 + rnd(seed, `s${i}`, 5) : 3 + rnd(seed, `s${i}`, 5),
        delay: rnd(seed, `d${i}`, 90) / 10,
        dur: isFlame ? 6.5 + rnd(seed, `t${i}`, 20) / 10 : 3.2 + rnd(seed, `t${i}`, 34) / 10,
        sway: isFlame ? 0 : rnd(seed, `w${i}`, 36) - 18,
        color: isFlame ? undefined : "#f97316",
        blur: isFlame ? 0 : 1,
      };
    }
    return { left: 0, delay: 0, dur: 0 };
  });
}

const AURORA_BLOBS = [
  { color: "rgba(52,211,153,.5)", w: "55%", h: "70%", left: "-8%", top: "18%" },
  { color: "rgba(56,189,248,.45)", w: "60%", h: "75%", left: "30%", top: "6%" },
  { color: "rgba(167,139,250,.5)", w: "50%", h: "65%", left: "62%", top: "22%" },
];

/**
 * Living profile-effect layer. Placement is up to the caller:
 *  - aurora/hearts/fire/snow → absolute inset-0 INSIDE the hero band
 *  - rainbow → absolute inset-0 + rounded-* on the WHOLE profile card
 *  - galaxy → absolute -inset-N rounded-full around the AVATAR wrapper
 * Never intercepts pointer events, always aria-hidden.
 */
export function ProfileEffect({
  effectKey,
  seed = "",
  className,
}: {
  effectKey?: string | null;
  seed?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const fx = effectOf(effectKey);
  const pieces = useMemo(() => (fx ? buildPieces(fx, seed) : []), [fx, seed]);

  if (!fx) return null;

  if (fx === "rainbow") {
    return (
      <div className={cn("pointer-events-none meev-fx-ring meev-fx-ring-mask", className)} aria-hidden="true" />
    );
  }

  if (fx === "galaxy") {
    return (
      <div className={cn("pointer-events-none", !reduced && "meev-orbit-spin", className)} aria-hidden="true">
        <span className="absolute left-1/2 top-0 -translate-x-1/2 text-sm leading-none">⭐</span>
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-base leading-none">🪐</span>
        <span className="absolute left-1/2 bottom-0 -translate-x-1/2 text-xs leading-none">✨</span>
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm leading-none">🌟</span>
        <span className="absolute left-[16%] top-[16%] text-xs leading-none">💫</span>
        <span className="absolute right-[14%] bottom-[14%] text-[10px] leading-none">⭐</span>
      </div>
    );
  }

  if (fx === "aurora") {
    return (
      <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)} aria-hidden="true">
        {AURORA_BLOBS.map((b, i) => (
          <span
            key={i}
            className={cn("absolute rounded-full pointer-events-none", !reduced && "meev-fx-blob")}
            style={{
              left: b.left,
              top: b.top,
              width: b.w,
              height: b.h,
              background: `radial-gradient(circle, ${b.color}, transparent 70%)`,
              filter: "blur(16px)",
              animationDelay: `${i * 1.6}s`,
              animationDuration: `${8 + i * 2}s`,
            }}
          />
        ))}
      </div>
    );
  }

  // hearts / fire / snow particle field
  const animClass = fx === "hearts" ? "meev-fx-rise" : fx === "snow" ? "meev-fx-fall" : "meev-fx-ember";
  // hearts + fire anchor at the BOTTOM (their pieces RISE — a top anchor
  // would clip them out of view before they ever enter the band);
  // snow anchors at the top (its pieces FALL).
  const anchor = fx === "hearts" || fx === "fire" ? { bottom: "-12%" } : { top: "-8%" };
  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={cn("absolute leading-none", !reduced && animClass)}
          style={{
            left: `${p.left}%`,
            ...anchor,
            fontSize: p.size ? `${p.size}px` : undefined,
            color: p.color,
            filter: p.blur ? `blur(${p.blur}px)` : undefined,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ...(p.sway !== undefined ? { ["--sway" as string]: `${p.sway}px` } : {}),
          }}
        >
          {p.emoji ?? ""}
        </span>
      ))}
    </div>
  );
}
