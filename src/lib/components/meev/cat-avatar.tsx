"use client";

// ============================================================
// MEEV — MeevCat: deterministic avatars generated from a seed
// string "<paletteKey>|<gradientKey>|<variant>" (fallback: hash
// of user id). Level ring + glow unlocks included.
// v2 shop cosmetics: avatar frames (ring styles) + cat
// accessories (SVG hats/halo/flower drawn on top).
// v3: avatarAnim (level-999 surprise) — the drawn cat cycles
// moods (happy/playful/excited/party/love) with a pop on each
// change plus a spinning rainbow halo; photo avatars get a
// crisp rainbow ring + floating sparkles. Deterministic for
// everything else; prefers-reduced-motion freezes the cycle.
// v12: 7 PREMIUM frame ring types (phoenix/prism/orbit/diamond/
// legend-gold/eclipse/meev999) — thousands of coins, gated at
// levels 25→999, MEEV DAWN warm tokens only.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CAT_PALETTE, AVATAR_GRADIENTS, PRESENCE, shopItem, type PresenceKey } from "@/lib/meev/constants";

// ------------------------- v3: animated avatar moods -------------------------

const ANIM_MOODS = ["happy", "playful", "excited", "party", "love"] as const;
type AnimMood = (typeof ANIM_MOODS)[number];

const ANIM_MOOD_INTERVAL = 2500; // ms between mood switches

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function parseAvatarSeed(seed: string, fallback = "x") {
  const parts = (seed || fallback).split("|");
  const palettes = Object.keys(CAT_PALETTE);
  const gradients = Object.keys(AVATAR_GRADIENTS);
  const paletteKey = parts[0] && CAT_PALETTE[parts[0]] ? parts[0] : palettes[hashSeed(fallback) % palettes.length];
  const gradientKey = parts[1] && AVATAR_GRADIENTS[parts[1]] ? parts[1] : gradients[hashSeed(fallback + "g") % gradients.length];
  const variant = Number(parts[2]) >= 0 && Number(parts[2]) <= 3 ? Number(parts[2]) : hashSeed(fallback + "v") % 4;
  return { paletteKey, gradientKey, variant, pal: CAT_PALETTE[paletteKey], grad: AVATAR_GRADIENTS[gradientKey] };
}

// ------------------------- v2: shop frames -------------------------

const RING_MASK = {
  mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))",
} as const;

// v12: thin crisp band (~2px) for the outer dual-rings
const THIN_MASK = {
  mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 1.5px))",
  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 1.5px))",
} as const;

type FramePayload = { ring?: string; colors?: string[] };

/** v12: small glowing "planet" dot orbiting the avatar — lives in a full-size
 *  rotating span (meev-frame-spin). Rendered at z-[2] so it never hides
 *  behind the disc on close passes. squashY < 1 makes the path slightly
 *  elliptical (moon-like), transform/rotation only = GPU-cheap. */
function OrbitDot({
  color, offset, duration, reverse, size, delay, squashY = 1,
}: { color: string; offset: number; duration: string; reverse?: boolean; size: number; delay?: string; squashY?: number }) {
  return (
    <span
      className="absolute rounded-full z-[2] pointer-events-none"
      style={{
        inset: -offset,
        transform: squashY !== 1 ? `scaleY(${squashY})` : undefined,
        transformOrigin: "center",
      }}
    >
      <span
        className="absolute inset-0 meev-frame-spin"
        style={{ animationDuration: duration, animationDirection: reverse ? "reverse" : undefined, animationDelay: delay }}
      >
        <span
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[1px] rounded-full"
          style={{
            width: size,
            height: size,
            background: color,
            boxShadow: `0 0 4px ${color}, 0 0 8px ${color}66`,
          }}
        />
      </span>
    </span>
  );
}


/** Equipped shop frame — replaces the level glow when present. */
function ShopFrame({ frameKey }: { frameKey: string }) {
  const item = shopItem(frameKey);
  if (!item) return null;
  const payload = item.payload as FramePayload;
  const ring = payload.ring;
  const colors = payload.colors && payload.colors.length >= 2 ? payload.colors : ["#ff7e5f", "#f04a6e"];

  if (ring === "aura") {
    // soft blurred static aura
    return (
      <span
        className="absolute -inset-1 rounded-full z-[0] pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
          filter: "blur(6px)",
          opacity: 0.8,
        }}
      />
    );
  }

  if (ring === "spin") {
    // crisp spinning conic ring + blurred glow duplicate behind
    const conic = `conic-gradient(from 0deg, ${colors.join(", ")})`;
    return (
      <>
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none"
          style={{ background: conic, filter: "blur(7px)", opacity: 0.55 }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: conic, ...RING_MASK }}
        />
      </>
    );
  }

  if (ring === "pulse") {
    // gradient ring breathing with a heartbeat
    return (
      <span
        className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-pulse"
        style={{ background: `linear-gradient(135deg, ${colors.join(", ")})`, ...RING_MASK }}
      />
    );
  }

  if (ring === "galaxy") {
    // legendary: two stacked conic rings, counter-rotating
    const conic = `conic-gradient(from 0deg, ${colors.join(", ")})`;
    return (
      <>
        <span
          className="absolute -inset-[4px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: conic, filter: "blur(6px)", opacity: 0.75 }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: conic, animationDirection: "reverse", animationDuration: "6s", filter: "blur(1.5px)", ...RING_MASK }}
        />
      </>
    );
  }

  // ---- v12 premium frames (MEEV DAWN tokens: honey/coral/rose + deep golds) ----

  if (ring === "phoenix") {
    // fr-phoenix: animated flame ring — warm conic base + a fast "flame
    // tongue" comet (bright conic head with a fiery tail) + soft ember glow
    const base = `conic-gradient(from 0deg, ${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[1]}, ${colors[0]})`;
    const tongue = `conic-gradient(from 0deg, transparent 0deg 210deg, ${colors[2]} 260deg, ${colors[1]} 310deg, #fff3d0 344deg, ${colors[0]} 360deg)`;
    return (
      <>
        <span
          className="absolute -inset-1 rounded-full z-[0] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors[0]}55, transparent 72%)`, filter: "blur(4px)" }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: base, animationDuration: "7s", filter: "blur(1px)", ...RING_MASK }}
        />
        <span
          className="absolute -inset-[4px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: tongue, animationDuration: "2.4s", filter: "drop-shadow(0 0 3px #ffc24d)", ...RING_MASK }}
        />
      </>
    );
  }

  if (ring === "prism") {
    // fr-prism: slowly hue-rotating conic (light through glass) + a crisp
    // thin outer ring counter-rotating — the dual-ring prism split
    const inner = `conic-gradient(from 0deg, ${colors.join(", ")}, ${colors[0]})`;
    const outer = `conic-gradient(from 120deg, ${colors[2]}, ${colors[0]}, ${colors[1]}, ${colors[2]})`;
    return (
      <>
        <span
          className="absolute -inset-1 rounded-full z-[0] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors[1]}33, transparent 70%)`, filter: "blur(4px)" }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-prism"
          style={{ background: inner, ...RING_MASK }}
        />
        <span
          className="absolute -inset-[5px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: outer, animationDirection: "reverse", animationDuration: "10s", ...THIN_MASK }}
        />
      </>
    );
  }

  if (ring === "orbit") {
    // fr-orbit: soft coral aura + faint path ring + three glowing planets
    // on slightly elliptical paths at different speeds (6s/9s/13s)
    const [gold, rose, honey] = colors;
    return (
      <>
        <span
          className="absolute -inset-[5px] rounded-full z-[0] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${rose}44, transparent 70%)`, filter: "blur(4px)" }}
        />
        <span
          className="absolute -inset-[4px] rounded-full z-[0] pointer-events-none"
          style={{ background: `${rose}2e`, ...RING_MASK }}
        />
        <OrbitDot color={gold} offset={5} duration="6s" size={5} />
        <OrbitDot color={rose} offset={7} duration="9s" reverse size={4} squashY={0.9} delay="-3s" />
        <OrbitDot color={honey} offset={6} duration="13s" size={6} squashY={0.94} delay="-7s" />
      </>
    );
  }

  if (ring === "diamond") {
    // fr-diamond: 8 faceted conic segments (light/dark honey) spinning
    // slowly + a white sparkle dot travelling the ring
    const facets = `repeating-conic-gradient(from 0deg, ${colors[0]} 0deg 22.5deg, ${colors[1]} 22.5deg 45deg)`;
    return (
      <>
        <span
          className="absolute -inset-1 rounded-full z-[0] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${colors[0]}40, transparent 72%)`, filter: "blur(4px)" }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: facets, animationDuration: "8s", ...RING_MASK }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[2] pointer-events-none meev-frame-spin"
          style={{ animationDuration: "3.5s" }}
        >
          <span
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[1px] rounded-full bg-white"
            style={{ width: 4, height: 4, boxShadow: "0 0 5px #fff, 0 0 10px #ffe4a8" }}
          />
        </span>
      </>
    );
  }

  if (ring === "legend-gold" || ring === "meev999") {
    // fr-aurum (legend-gold): pure 24k gold — inner crisp gold conic ring
    // (two light→dark sweeps per turn) + outer soft gold glow + faint thin
    // outer ring + a shimmer-sweep highlight orbiting the band.
    // fr-meev999: the same gold stack + three golden paw-dots orbiting +
    // a very slow hue-shift shimmer on the glow. THE 999 flex.
    const [light, mid, deep] = colors;
    const goldConic = `conic-gradient(from 0deg, ${light}, ${mid}, ${deep}, ${mid}, ${light})`;
    const shimmer = `conic-gradient(from 0deg, transparent 0deg 290deg, ${light}cc 330deg, transparent 360deg)`;
    const is999 = ring === "meev999";
    return (
      <>
        <span
          className={`absolute -inset-[6px] rounded-full z-[0] pointer-events-none${is999 ? " meev-frame-hue-slow" : ""}`}
          style={{ background: `radial-gradient(circle, ${mid}55, transparent 72%)`, filter: "blur(5px)" }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: goldConic, animationDuration: "7s", ...RING_MASK }}
        />
        <span
          className="absolute -inset-[5px] rounded-full z-[0] pointer-events-none"
          style={{ background: `${mid}38`, ...THIN_MASK }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: shimmer, animationDuration: "3.6s", ...RING_MASK }}
        />
        {is999 && (
          <>
            <OrbitDot color={light} offset={6} duration="7s" size={5} />
            <OrbitDot color={mid} offset={8} duration="11s" reverse size={4} squashY={0.9} delay="-4s" />
            <OrbitDot color="#ffe4a8" offset={7} duration="16s" size={6} squashY={0.94} delay="-9s" />
          </>
        )}
      </>
    );
  }

  if (ring === "eclipse") {
    // fr-eclipse: dark-eclipse look — near-black halo, thin warm-rose ring,
    // a slowly rotating bright corona arc + twinkling star dots
    const [rose, warm] = colors;
    const corona = `conic-gradient(from 0deg, transparent 0deg 190deg, ${rose} 250deg, ${warm} 292deg, #fff 305deg, ${warm} 318deg, ${rose} 340deg, transparent 360deg)`;
    return (
      <>
        <span
          className="absolute -inset-[5px] rounded-full z-[0] pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(8,4,2,.5), transparent 72%)", filter: "blur(3px)" }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none"
          style={{ background: `${rose}b3`, ...THIN_MASK }}
        />
        <span
          className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-frame-spin"
          style={{ background: corona, animationDuration: "9s", filter: `drop-shadow(0 0 3px ${rose})`, ...RING_MASK }}
        />
        <span className="absolute left-1/2 -top-[7px] -translate-x-1/2 z-[2] size-[3px] rounded-full bg-white meev-frame-star pointer-events-none" style={{ boxShadow: "0 0 4px #fff" }} />
        <span className="absolute -left-[3px] top-1/3 z-[2] size-[2px] rounded-full bg-white meev-frame-star pointer-events-none" style={{ animationDelay: "-1s", boxShadow: "0 0 3px #ffd9a0" }} />
        <span className="absolute -right-[4px] bottom-1/4 z-[2] size-[2.5px] rounded-full bg-white meev-frame-star pointer-events-none" style={{ animationDelay: "-1.9s", boxShadow: "0 0 4px #ffd9a0" }} />
      </>
    );
  }

  return null;
}

// ------------------------- v2: cat accessories -------------------------

const ACC_SHADOW = "drop-shadow(0 2px 3px rgba(0,0,0,.5))";

/** One accessory drawn in the top ~55% of the 100x100 viewBox, on top of cat or photo. */
function AccessoryArt({ acc }: { acc: string }) {
  switch (acc) {
    case "party":
      return (
        <g transform="rotate(14 50 24)">
          <path d="M50 1 L36 34 L64 34 Z" fill="#ff7e5f" />
          <path d="M45.3 12 L54.7 12 L57.7 19 L42.3 19 Z" fill="#f04a6e" />
          <path d="M39.8 25 L60.2 25 L64 34 L36 34 Z" fill="#ffc24d" />
          <circle cx="50" cy="4" r="4.8" fill="#fde68a" />
        </g>
      );
    case "crown":
      return (
        <g transform="rotate(-4 50 30)">
          <path d="M32 32 L36 14 L44 24 L50 12 L56 24 L64 14 L68 32 Z" fill="#fbbf24" />
          <circle cx="36" cy="12.5" r="1.6" fill="#fde68a" />
          <circle cx="50" cy="10.5" r="1.9" fill="#fde68a" />
          <circle cx="64" cy="12.5" r="1.6" fill="#fde68a" />
          <rect x="31" y="31" width="38" height="8" rx="3" fill="#eab308" />
          <circle cx="40" cy="35" r="2.1" fill="#f43f5e" />
          <circle cx="50" cy="35" r="2.5" fill="#ff7e5f" />
          <circle cx="60" cy="35" r="2.1" fill="#f04a6e" />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M17 42 Q50 2 83 42" stroke="#f04a6e" strokeWidth="5.5" fill="none" strokeLinecap="round" />
          <rect x="9.5" y="37" width="15" height="22" rx="6" fill="#f04a6e" />
          <rect x="13" y="41" width="8" height="14" rx="4" fill="#c4b5fd" />
          <rect x="75.5" y="37" width="15" height="22" rx="6" fill="#f04a6e" />
          <rect x="79" y="41" width="8" height="14" rx="4" fill="#c4b5fd" />
        </g>
      );
    case "wizard":
      return (
        <g>
          <path d="M52 2 Q46 17 38 32 L62 32 Q57 15 52 2 Z" fill="#f04a6e" />
          <ellipse cx="50" cy="32" rx="23" ry="5.5" fill="#d63962" />
          <path d="M52 13.8 L53.3 17.2 L56.9 17.4 L54.1 19.7 L55.1 23.2 L52 21.2 L48.9 23.2 L49.9 19.7 L47.1 17.4 L50.7 17.2 Z" fill="#fde68a" />
          <circle cx="42" cy="27" r="1.5" fill="#fde68a" opacity="0.9" />
          <circle cx="61" cy="29" r="1.2" fill="#fde68a" opacity="0.9" />
        </g>
      );
    case "halo":
      return (
        <g>
          <ellipse cx="50" cy="8" rx="19" ry="5.5" fill="none" stroke="#fde68a" strokeWidth="7" opacity="0.35" />
          <ellipse cx="50" cy="8" rx="19" ry="5.5" fill="none" stroke="#fbbf24" strokeWidth="4" />
        </g>
      );
    case "flower":
      return (
        <g transform="translate(25 19)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-7.5"
              rx="4.2"
              ry="6.5"
              fill={a % 144 === 0 ? "#ff9d88" : "#ff7e5f"}
              transform={`rotate(${a})`}
            />
          ))}
          <circle r="5" fill="#fbbf24" />
        </g>
      );
    default:
      return null;
  }
}

/** Overlay wrapper: SVG on top (z-[2]) of the cat or photo; halo floats. */
function ShopAccessory({ accKey, size }: { accKey: string; size: number }) {
  const item = shopItem(accKey);
  if (!item) return null;
  const acc = (item.payload as { acc?: string }).acc || "";
  if (!acc) return null;
  const isHalo = acc === "halo";
  const art = (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="block"
      style={{ filter: isHalo ? "drop-shadow(0 0 6px rgba(251,191,36,.65))" : ACC_SHADOW }}
      aria-hidden="true"
    >
      <AccessoryArt acc={acc} />
    </svg>
  );
  return (
    <div className={cn("absolute inset-0 z-[2] grid place-items-center pointer-events-none", isHalo && "meev-float")}>
      {art}
    </div>
  );
}

// ------------------------- MeevCat -------------------------

interface CatAvatarProps {
  seed: string;
  fallback?: string; // user id
  size?: number;
  level?: number;
  presence?: string | null;
  className?: string;
  ring?: boolean; // level progress ring
  onClick?: () => void;
  /** v2: uploaded photo — replaces the drawn cat (frame/presence/ring still render) */
  avatarPhoto?: string | null;
  /** v2: equipped shop frame item key (e.g. "fr-galaxy") */
  frameKey?: string | null;
  /** v2: equipped shop accessory item key (e.g. "ac-crown") */
  avatarAcc?: string | null;
  /** v3: level-999 animated avatar (mood-cycling cat / rainbow ring + sparkles on photos) */
  avatarAnim?: boolean;
  /** v5: display name — photo-less USER avatars render as a monogram
   *  (gradient disc + initial) instead of a cat, per the user's spec.
   *  Brand contexts (logo, stickers, gifts, shop previews, AI stranger)
   *  simply omit it and keep the drawn cat. */
  name?: string;
}

export function MeevCat({ seed, fallback = "x", size = 44, level = 0, presence, className, ring = false, onClick, avatarPhoto, frameKey, avatarAcc, avatarAnim, name }: CatAvatarProps) {
  const { pal, grad, variant } = useMemo(() => parseAvatarSeed(seed, fallback), [seed, fallback]);

  // v5: user avatars without a photo are monograms (gradient + initial)
  const monogram = !avatarPhoto && !!name && name.trim().length > 0;
  const initial = monogram ? (name!.trim().match(/[\p{L}\p{N}]/u)?.[0] || "?").toUpperCase() : "?";

  // v3: mood cycler (time-based animation only — rendering stays deterministic)
  const reducedMotion = useReducedMotion();
  const [moodIdx, setMoodIdx] = useState(0);
  useEffect(() => {
    if (!avatarAnim || reducedMotion) return;
    const t = setInterval(() => setMoodIdx((i) => (i + 1) % ANIM_MOODS.length), ANIM_MOOD_INTERVAL);
    return () => clearInterval(t);
  }, [avatarAnim, reducedMotion]);
  const catMood: AnimMood | null = avatarAnim && !avatarPhoto ? ANIM_MOODS[moodIdx % ANIM_MOODS.length] : null;

  const eyeY = 46;
  const eyeR = variant === 3 ? 8 : 6.5;
  const stripes = variant === 0 || variant === 2;
  const patches = variant === 1;
  const roundEars = variant >= 2;
  const hasFrame = !!(frameKey && shopItem(frameKey));

  return (
    <span
      className={cn("relative inline-grid place-items-center shrink-0", onClick && "cursor-pointer", className)}
      style={{ width: size, height: size }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      {/* gradient disc background */}
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: grad }}
      />
      {/* v3: level-999 legend halo — spinning rainbow glow (drawn cat) or
          crisp rainbow ring + floating sparkles (photo) */}
      {avatarAnim && avatarPhoto && (
        <>
          <span className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-avatar-anim" />
          <span className="absolute -inset-[3px] rounded-full z-[0] pointer-events-none meev-avatar-anim-ring" style={{ ...RING_MASK }} />
          <span className="absolute -top-1.5 -end-1 z-[3] text-[11px] leading-none meev-sparkle pointer-events-none" aria-hidden="true">✨</span>
          <span className="absolute -bottom-1 -start-1.5 z-[3] text-[9px] leading-none meev-sparkle pointer-events-none" style={{ animationDelay: "0.9s" }} aria-hidden="true">✨</span>
          <span className="absolute top-1/2 -start-2 z-[3] text-[8px] leading-none meev-sparkle pointer-events-none" style={{ animationDelay: "1.6s" }} aria-hidden="true">✨</span>
        </>
      )}
      {avatarAnim && !avatarPhoto && (
        <span className="absolute -inset-1 rounded-full z-[0] pointer-events-none meev-avatar-anim" />
      )}

      {/* v2: shop frame (replaces the level glow when present) */}
      {hasFrame ? (
        <ShopFrame frameKey={frameKey!} />
      ) : (
        level >= 10 && !avatarAnim && (
          <span
            className={cn("absolute -inset-0.5 rounded-full z-[0] pointer-events-none", level >= 100 ? "meev-pulse-glow" : "")}
            style={{
              /* v14: the ONE gold identity — level glows are brand golds,
                  never the old neon sunset/rainbow conics */
              background: level >= 100
                ? "conic-gradient(from 0deg,#BEB15C,#D9CD82,#A08B3D,#C5B767,#BEB15C)"
                : "conic-gradient(from 0deg,#C5B767,#BEB15C,#C5B767)",
              filter: "blur(5px)",
              opacity: 0.75,
            }}
          />
        )
      )}
      {/* v2: uploaded photo replaces the drawn cat · v5: user avatars
          without a photo are monograms (initial on the seeded gradient) */}
      {avatarPhoto ? (
        <img
          src={avatarPhoto}
          alt=""
          width={size}
          height={size}
          className="absolute inset-0 rounded-full object-cover z-[1]"
          referrerPolicy="no-referrer"
        />
      ) : monogram ? (
        <span
          className="absolute inset-0 rounded-full z-[1] grid place-items-center select-none"
          style={{ background: grad }}
          aria-hidden="true"
        >
          <span
            className="font-black text-white leading-none"
            style={{
              fontSize: Math.max(11, size * 0.42),
              textShadow: "0 1px 3px rgba(0,0,0,.35)",
            }}
          >
            {initial}
          </span>
        </span>
      ) : (
      <svg
        key={catMood ?? "cat"}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={cn("relative z-[1] drop-shadow-sm", catMood && "meev-avatar-pop")}
      >
        {/* ears */}
        {roundEars ? (
          <>
            <circle cx="26" cy="22" r="13" fill={pal.ear} />
            <circle cx="74" cy="22" r="13" fill={pal.ear} />
          </>
        ) : (
          <>
            <path d="M22 34 L16 6 L44 20 Z" fill={pal.ear} />
            <path d="M78 34 L84 6 L56 20 Z" fill={pal.ear} />
          </>
        )}
        {/* inner ears */}
        <path d={roundEars ? "M22 28 a7 7 0 0 1 8 -7 l1 10 z" : "M25 30 L21 13 L38 21 Z"} fill={pal.nose} opacity="0.85" />
        <path d={roundEars ? "M78 28 a7 7 0 0 0 -8 -7 l-1 10 z" : "M75 30 L79 13 L62 21 Z"} fill={pal.nose} opacity="0.85" />
        {/* head */}
        <ellipse cx="50" cy="56" rx="34" ry="33" fill={pal.fur} />
        {/* muzzle / lower face */}
        <ellipse cx="50" cy="68" rx="22" ry="17" fill={pal.fur2} opacity="0.65" />
        {stripes && (
          <g stroke={pal.fur2} strokeWidth="5" strokeLinecap="round" opacity="0.8">
            <line x1="50" y1="26" x2="50" y2="34" />
            <line x1="38" y1="30" x2="40" y2="38" />
            <line x1="62" y1="30" x2="60" y2="38" />
          </g>
        )}
        {patches && <ellipse cx="76" cy="46" rx="12" ry="10" fill={pal.fur2} opacity="0.7" />}
        {/* eyes — v3: mood-driven when the animated avatar is on */}
        {catMood === "happy" ? (
          <g>
            <path d={`M29 ${eyeY + 1} q7 -9 14 0`} stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d={`M57 ${eyeY + 1} q7 -9 14 0`} stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          </g>
        ) : catMood === "love" ? (
          <g>
            <path d="M36 39.5 c-3.5-6-13-3-11 3.5 c1.7 4.5 11 10 11 10 c0 0 9.3-5.5 11-10 c2-6.5-7.5-9.5-11-3.5z" fill={pal.eye} stroke="#fff" strokeWidth="1.3" />
            <path d="M64 39.5 c-3.5-6-13-3-11 3.5 c1.7 4.5 11 10 11 10 c0 0 9.3-5.5 11-10 c2-6.5-7.5-9.5-11-3.5z" fill={pal.eye} stroke="#fff" strokeWidth="1.3" />
          </g>
        ) : catMood === "playful" ? (
          <g>
            <ellipse cx="36" cy={eyeY} rx={eyeR} ry={eyeR + 1} fill="#fff" />
            <circle cx="37.5" cy={eyeY + 0.5} r={eyeR * 0.45} fill={pal.eye} />
            <circle cx="34.5" cy={eyeY - 2} r="1.3" fill="#fff" />
            <path d={`M58 ${eyeY + 1} q6 -8 12 0`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        ) : catMood === "excited" ? (
          <g>
            <ellipse cx="36" cy={eyeY} rx={eyeR + 1.5} ry={eyeR + 2.5} fill="#fff" />
            <ellipse cx="64" cy={eyeY} rx={eyeR + 1.5} ry={eyeR + 2.5} fill="#fff" />
            <circle cx="37.5" cy={eyeY} r={eyeR * 0.62} fill={pal.eye} />
            <circle cx="65.5" cy={eyeY} r={eyeR * 0.62} fill={pal.eye} />
            <circle cx="34" cy={eyeY - 3} r="1.9" fill="#fff" />
            <circle cx="62" cy={eyeY - 3} r="1.9" fill="#fff" />
          </g>
        ) : catMood === "party" ? (
          <g>
            <ellipse cx="36" cy={eyeY} rx={eyeR} ry={eyeR + 1} fill="#fff" />
            <ellipse cx="64" cy={eyeY} rx={eyeR} ry={eyeR + 1} fill="#fff" />
            <circle cx="37.5" cy={eyeY + 0.5} r={eyeR * 0.45} fill={pal.eye} />
            <circle cx="65.5" cy={eyeY + 0.5} r={eyeR * 0.45} fill={pal.eye} />
            <circle cx="34.5" cy={eyeY - 2} r="1.3" fill="#fff" />
            <circle cx="62.5" cy={eyeY - 2} r="1.3" fill="#fff" />
            {/* party hat (drawn inside the cat svg, under accessories) */}
            <AccessoryArt acc="party" />
          </g>
        ) : (
          <g>
            <ellipse cx="36" cy={eyeY} rx={eyeR} ry={eyeR + 1} fill="#fff" />
            <ellipse cx="64" cy={eyeY} rx={eyeR} ry={eyeR + 1} fill="#fff" />
            <circle cx="37.5" cy={eyeY + 0.5} r={eyeR * 0.45} fill={pal.eye} />
            <circle cx="65.5" cy={eyeY + 0.5} r={eyeR * 0.45} fill={pal.eye} />
            <circle cx="34.5" cy={eyeY - 2} r="1.3" fill="#fff" />
            <circle cx="62.5" cy={eyeY - 2} r="1.3" fill="#fff" />
          </g>
        )}
        {/* nose */}
        <path d="M46 62 L54 62 L50 68 Z" fill={pal.nose} />
        {/* mouth — bigger grin while partying */}
        <path
          d={catMood ? "M42 71 q8 8 16 0" : "M43 72 q7 5 14 0"}
          stroke={pal.nose}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        {/* whiskers */}
        <g stroke={pal.fur} strokeWidth="1.8" strokeLinecap="round" opacity="0.9">
          <line x1="10" y1="58" x2="24" y2="60" />
          <line x1="8" y1="66" x2="24" y2="66" />
          <line x1="90" y1="58" x2="76" y2="60" />
          <line x1="92" y1="66" x2="76" y2="66" />
        </g>
        {/* blush */}
        <circle cx="28" cy="62" r="4" fill={pal.nose} opacity="0.35" />
        <circle cx="72" cy="62" r="4" fill={pal.nose} opacity="0.35" />
      </svg>
      )}
      {/* v2: shop accessory drawn on top (hat / halo / flower) */}
      <ShopAccessory accKey={avatarAcc || ""} size={size} />

      {/* level ring */}
      {ring && level > 0 && (
        <span
          className="absolute -inset-1 rounded-full z-[2] pointer-events-none"
          style={{
            background: `conic-gradient(#ffc24d ${Math.min(100, (level % 24) * (100 / 24))}%, transparent 0)`,
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
          }}
        />
      )}

      {/* presence dot — v5 Discord-style, shared component */}
      {presence && presence !== "hidden" && (
        <PresenceDot presence={presence} size={size} />
      )}
    </span>
  );
}

// ------------------------- v5: Discord-style presence dot -------------------------

/**
 * online  — solid emerald dot with a specular highlight
 * busy    — red dot with a white dash (Discord DND style)
 * dnd     — amber dot with a real white crescent (drawn, no emoji)
 * offline — hollow grey ring
 */
export function PresenceDot({ presence, size = 44, className }: { presence: string; size?: number; className?: string }) {
  const p = PRESENCE[presence as PresenceKey] || PRESENCE.offline;
  const dim = Math.max(11, Math.round(size * 0.3));
  if (presence === "offline") {
    return (
      <span
        className={cn("absolute -bottom-0.5 -right-0.5 z-[3] rounded-full border-2 border-background", className)}
        style={{ width: dim, height: dim, background: "transparent", boxShadow: `inset 0 0 0 ${Math.max(2, dim * 0.22)}px ${p.color}` }}
        title={p.label}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={cn("absolute -bottom-0.5 -right-0.5 z-[3] rounded-full grid place-items-center border-2 border-background shadow-[0_1px_4px_rgba(0,0,0,.35)]", className)}
      style={{ width: dim, height: dim, background: p.color }}
      title={p.label}
      aria-hidden="true"
    >
      {presence === "busy" && <span style={{ width: "58%", height: 2, borderRadius: 1, background: "#fff" }} />}
      {presence === "dnd" && (
        <svg viewBox="0 0 12 12" width="100%" height="100%">
          <path d="M8.3 1.5 A 4.6 4.6 0 1 0 10.5 7.4 A 3.6 3.6 0 0 1 8.3 1.5 Z" fill="#fff" opacity="0.95" transform="scale(0.82) translate(1.2 1.2)" />
        </svg>
      )}
      {presence === "online" && <span className="rounded-full bg-white/45" style={{ width: dim * 0.26, height: dim * 0.26, transform: "translate(-10%, -14%)" }} />}
    </span>
  );
}
