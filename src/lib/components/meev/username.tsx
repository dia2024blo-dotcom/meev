"use client";

// MEEV — Display name with level-based visual perks:
// level 1+: color, level 5+: animated gradient username (spec §6).
// v2: shop cosmetics — purchasable name gradients (incl. animated)
// take priority, plus an equipped shop badge next to the name.
// v3: nameColor may ALSO be a premium shop item key ("nc-*") whose
// payload carries {color, shine?, neon?, rainbow?} — resolved here.
// v5: staff rank chips (owner 👑 / admin 🛡️ / support 🎧 / mod ⚙️) and
// the verified badge (✔ blue check) render next to the name everywhere.

import { useId, type CSSProperties } from "react";
import { Crown, Headphones, Settings, Shield, ShieldHalf } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHOP_ITEMS, shopItem } from "@/lib/meev/constants";
import type { MiniUser } from "./types";
import { BadgeGlyph } from "./badge-glyph";

// ------------------------- v5: identity badges -------------------------

// v13: rank icons are lucide vector glyphs (no emoji in badge chrome):
// owner 👑→crown · superadmin ⚡→zap-shield · admin 🛡️→shield · support 🎧→headphones · mod ⚙️→gear
const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  superadmin: ShieldHalf,
  admin: Shield,
  support: Headphones,
  moderator: Settings,
};

const ROLE_BADGES: Record<string, { titleAr: string; title: string; bg: string; color: string; glow: string }> = {
  owner: { titleAr: "مالك Meev", title: "Meev Owner", bg: "linear-gradient(135deg,#ffc24d,#fbbf24)", color: "#3b2a06", glow: "rgba(255,194,77,.65)" },
  superadmin: { titleAr: "سوبر أدمن", title: "Super Admin", bg: "linear-gradient(135deg,#be123c,#f59e0b)", color: "#fff", glow: "rgba(190,18,60,.6)" },
  admin: { titleAr: "مشرف عام", title: "Admin", bg: "linear-gradient(135deg,#f04a6e,#f9778f)", color: "#fff", glow: "rgba(240,74,110,.55)" },
  support: { titleAr: "فريق الدعم", title: "Support", bg: "linear-gradient(135deg,#06b6d4,#22d3ee)", color: "#fff", glow: "rgba(6,182,212,.55)" },
  moderator: { titleAr: "مراقب", title: "Moderator", bg: "linear-gradient(135deg,#10b981,#34d399)", color: "#fff", glow: "rgba(16,185,129,.5)" },
};

/** The staff rank chip — a tiny rounded badge with the rank icon. */
export function RoleBadge({ role, size = 15 }: { role?: string; size?: number }) {
  const def = role ? ROLE_BADGES[role] : null;
  if (!def) return null;
  return (
    <span
      className="inline-flex items-center justify-center rounded-md align-baseline select-none shrink-0"
      style={{
        width: size,
        height: size,
        background: def.bg,
        color: def.color,
        boxShadow: `0 0 6px ${def.glow}, inset 0 1px 2px rgba(255,255,255,.35)`,
      }}
      title={def.titleAr + " · " + def.title}
      aria-label={def.titleAr + " / " + def.title}
    >
      {(() => {
        const Icon = ROLE_ICONS[role as string] ?? Crown;
        return <Icon size={Math.round(size * 0.66)} strokeWidth={2.6} aria-hidden />;
      })()}
    </span>
  );
}

/** v9: the verified seal — perfectly CIRCULAR with NO background fill
 *  (user spec): a gradient certification ring + a gradient check, strokes
 *  only, so it sits crisply on any surface — light, dark or photo. It draws
 *  itself in once (meev-seal-draw) and breathes with a soft glow pulse.
 *  Awarded by the owner; the badge IS the verification UI. */
export function VerifiedBadge({ size = 17 }: { size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gid = `meev-vseal-${uid}`;
  return (
    <span
      className="meev-verified-seal inline-flex items-center justify-center align-baseline select-none shrink-0"
      style={{ width: size, height: size }}
      title="حساب موثّق ✔ / Verified account"
      aria-label="Verified account"
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbbf24" />
            <stop offset="0.5" stopColor="#ff9d88" />
            <stop offset="1" stopColor="#f9778f" />
          </linearGradient>
        </defs>
        {/* the certification ring — stroke only, nothing filled */}
        <circle cx="12" cy="12" r="10" fill="none" stroke={`url(#${gid})`} strokeWidth="2.1" />
        {/* a faint inner hairline for depth (still no fill) */}
        <circle cx="12" cy="12" r="7.6" fill="none" stroke={`url(#${gid})`} strokeWidth="0.9" opacity="0.45" />
        {/* the check — stroke only */}
        <path
          d="m7.6 12.4 3 3 5.8-6.6"
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** v10→v13: the HONOR badge — every earned achievement + the equipped shop
 *  badge rides BESIDE the verified seal (user spec: "badges next to the
 *  verification badge — no background, no name label"). v13: the emoji rings
 *  became the designed BadgeGlyph MEDALS (see badge-glyph.tsx) — the profile
 *  renders them with a staggered meev-pop medal-pinning ceremony; this
 *  component is retired (kept only as this note so the history survives). */

export type ResolvedNameStyle = {
  /** base color (raw hex, or the payload color / rainbow seed) */
  color: string;
  /** effect class to add (meev-name-shine / -neon / -rainbow) */
  className?: string;
  /** inline style (carries the --nc CSS var for effect classes) */
  style?: CSSProperties;
};

/**
 * v3: resolve a display-name color that is EITHER a raw hex from the free
 * palette (backward compatible) OR a shop item key ("nc-*"). Exported so
 * the shop previews render the exact same effect as the real name.
 */
export function resolveNameStyle(nameColor?: string | null): ResolvedNameStyle {
  if (!nameColor) return { color: "" };
  if (/^nc-/.test(nameColor)) {
    const item = SHOP_ITEMS.find((s) => s.key === nameColor);
    const p = (item?.payload || {}) as { color?: string; shine?: boolean; neon?: boolean; rainbow?: boolean };
    if (p.rainbow) return { color: "#f43f5e", className: "meev-name-rainbow" };
    if (p.neon) {
      const c = p.color || "#22d3ee";
      return { color: c, className: "meev-name-neon", style: { ["--nc" as string]: c } };
    }
    if (p.shine) {
      const c = p.color || "#fde047";
      return { color: c, className: "meev-name-shine", style: { ["--nc" as string]: c } };
    }
    return { color: p.color || "" };
  }
  return { color: nameColor };
}

/**
 * v11: resolve an equipped NAME-EFFECT item ("nf-*") to its fx kind.
 * Exported so the shop previews render the exact same effect.
 */
export function resolveNameFx(nameFx?: string | null): string | null {
  if (!nameFx || !/^nf-/.test(nameFx)) return null;
  const item = SHOP_ITEMS.find((s) => s.key === nameFx);
  return (item?.payload?.fx as string) || null;
}

/**
 * v11: EffectName — the equipped name effect rendered live:
 *   wave (per-WORD bounces so Arabic letter-joining stays intact),
 *   heartbeat, candle flicker, sparkle + live ✨, RGB glitch, fire
 *   text, hologram sweep, 3D chrome. fire/holo/chrome own the text
 *   style (background-clip); the others ride on top of the base color.
 */
function EffectName({ displayName, fx, baseColor, className }: { displayName: string; fx: string; baseColor?: string; className?: string }) {
  switch (fx) {
    case "wave":
      // words bounce in a wave (words — NOT letters — so Arabic
      // letter-joining is preserved)
      return (
        <span className={cn("inline-flex flex-wrap gap-x-1", className)} aria-label={displayName}>
          {displayName.split(" ").map((w, i) => (
            <span
              key={i}
              className="meev-nf-wave-l whitespace-nowrap"
              style={{ ["--wd" as string]: `${i * 0.14}s` }}
              aria-hidden="true"
            >
              {w}
            </span>
          ))}
        </span>
      );
    case "heartbeat":
      return (
        <span className={cn("meev-nf-heartbeat", className)}>{displayName}</span>
      );
    case "flicker":
      return (
        <span
          className={cn("meev-nf-flicker", className)}
          style={{ ["--nc" as string]: baseColor || "#fb923c", ...(baseColor ? { color: baseColor } : {}) }}
        >
          {displayName}
        </span>
      );
    case "sparkle":
      return (
        <span className={cn("inline-flex items-center", className)}>
          <span
            className="meev-nf-sparkle"
            style={{ ["--nc" as string]: baseColor || "#fde047", ...(baseColor ? { color: baseColor } : {}) }}
          >
            {displayName}
          </span>
          <span className="meev-nf-sparkle-emoji" aria-hidden="true">✨</span>
        </span>
      );
    case "glitch":
      return (
        <span className={cn("meev-nf-glitch relative inline-block", className)} data-name={displayName}>
          {displayName}
        </span>
      );
    case "fire":
      return <span className={cn("meev-nf-fire font-bold", className)}>{displayName}</span>;
    case "holo":
      return <span className={cn("meev-nf-holo font-bold", className)}>{displayName}</span>;
    case "chrome3d":
      return <span className={cn("meev-nf-chrome3d font-black", className)}>{displayName}</span>;
    default:
      return <span className={className}>{displayName}</span>;
  }
}

interface NameProps {
  displayName: string;
  level?: number;
  nameColor?: string;
  /** v2: equipped shop gradient item key (e.g. "ng-neon") */
  nameGradient?: string;
  /** v2: equipped shop badge item key (e.g. "bd-rose") */
  badgeShop?: string;
  /** v11: equipped shop NAME-EFFECT item key (e.g. "nf-wave") */
  nameFx?: string;
  className?: string;
  compact?: boolean;
  /** v5: staff role → rank chip next to the name */
  role?: string;
  /** v5: owner-verified account → blue check next to the name */
  verified?: boolean;
}

function GradientName({ displayName, gradientKey, className }: { displayName: string; gradientKey: string; className?: string }) {
  const item = shopItem(gradientKey);
  const gradient = (item?.payload?.gradient as string) || "linear-gradient(90deg,#ffc24d,#ff7e5f)";
  const animated = !!item?.payload?.animated;
  return (
    <span
      className={cn("meev-name-gradient", animated && "meev-ng-animated", className)}
      style={{ ["--ng" as string]: gradient }}
    >
      {displayName}
    </span>
  );
}

function ShopBadge({ badgeKey, size = 15 }: { badgeKey: string; size?: number }) {
  const item = shopItem(badgeKey);
  if (!item) return null;
  // v13: the shop badge next to a name is the designed MEDAL glyph
  // (badge-glyph.tsx) — keyed by the item key, never the payload emoji.
  return <BadgeGlyph badge={badgeKey} size={size} title={item.name} />;
}

export function MeevName({ displayName, level = 0, nameColor, nameGradient, badgeShop, nameFx, className, compact, role, verified }: NameProps) {
  // priority: v11 name effect > shop gradient > premium shop name color (nc-*) >
  // level-5 aurora > level-1 free nameColor > plain
  // (the equipped name-effect slot wins — a purchased effect is the newest
  //  flex; fire/holo/chrome own the text style, the rest ride the base color)
  const fx = resolveNameFx(nameFx);
  const hasShopGradient = !!nameGradient && !fx;
  const shopNameColor = /^nc-/.test(nameColor || "");
  const levelGradient = level >= 5 && !shopNameColor && !fx;
  const ns = resolveNameStyle(nameColor);
  const plainColored = !hasShopGradient && !levelGradient && level >= 1 && !!nameColor;
  return (
    // v9: min-w-0 + truncate on the name span — a long/large name now
    // ellipsizes inside its own box instead of shoving the verified seal,
    // role chip and neighbors into other UI (user report: "when the name
    // grows it must stay in a wonderful place"). The seal stays glued
    // right after the visible text.
    <span
      className={cn("font-semibold inline-flex items-center gap-1 min-w-0", compact ? "text-sm" : "", className)}
      title={`Level ${level}`}
    >
      <span className="inline-flex items-center gap-1 min-w-0 truncate">
        {fx ? (
          <EffectName displayName={displayName} fx={fx} baseColor={ns.color || undefined} className="truncate" />
        ) : hasShopGradient ? (
          <GradientName displayName={displayName} gradientKey={nameGradient} />
        ) : levelGradient ? (
          <span className="meev-aurora-text truncate">{displayName}</span>
        ) : plainColored ? (
          // v3: raw hex → plain color; nc-* key → shine / neon / rainbow effect
          <span className={cn("truncate", ns.className)} style={ns.className ? ns.style : ns.color ? { color: ns.color } : undefined}>
            {displayName}
          </span>
        ) : (
          <span className="truncate">{displayName}</span>
        )}
      </span>
      {verified && <VerifiedBadge size={compact ? 14 : 18} />}
      {role && role !== "user" && <RoleBadge role={role} size={compact ? 14 : 17} />}
      {badgeShop && <span className="ms-0.5 shrink-0"><ShopBadge badgeKey={badgeShop} /></span>}
      {/* v7: no extra 👑 here — the Legend chip on the profile + the owner
          role badge already crown level-999 users; a third crown was noise */}
    </span>
  );
}

/** v2 convenience: build the name straight from a MiniUser (uses all cosmetics). */
export function MeevNameUser({ user, compact, className }: { user: MiniUser; compact?: boolean; className?: string }) {
  return (
    <MeevName
      displayName={user.displayName}
      level={user.level}
      nameColor={user.nameColor}
      nameGradient={user.nameGradient}
      nameFx={user.nameFx}
      badgeShop={user.badgeShop}
      role={user.role}
      verified={user.verified}
      compact={compact}
      className={className}
    />
  );
}

// Small level pill used next to names in chat/lists.
export function LevelPill({ level, className }: { level: number; className?: string }) {
  if (level <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
        className
      )}
      style={{
        background: level >= 999 ? "linear-gradient(135deg,#ffc24d,#ff7e5f)" : "rgba(240,74,110,.16)",
        color: level >= 999 ? "#fff" : "#c4b5fd",
      }}
    >
      {level >= 999 ? "MAX" : level}
    </span>
  );
}
