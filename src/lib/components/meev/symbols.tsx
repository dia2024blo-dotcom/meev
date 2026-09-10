"use client";

// ============================================================
// MEEV v12 — SYMBOL SYSTEM (رموز)
// The user spec: "اشارات بدي رموز وليس ايموجي" — UI chrome must
// speak in crisp vector SYMBOLS, never emoji. These branded glyphs
// cover the Meev-specific concepts lucide doesn't have; everything
// else uses lucide-react icons. All glyphs are stroke/fill
// currentColor so they inherit text color, sized via `size`.
// ============================================================

import { cn } from "@/lib/utils";

interface GlyphProps {
  size?: number;
  className?: string;
  /** decorative glyphs are aria-hidden; pass title for meaningful ones */
  title?: string;
}

/* XP spark — the 4-point "experience star" used next to XP numbers.
   A diamond-cut sparkle: crisper than an emoji ✨, reads at 12px. */
export function XpSpark({ size = 14, className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M12 2.4c.7 3.4 2.2 5.5 4.3 6.6 1.5.8 3.4 1.2 6.1 1.3-2.7.1-4.6.5-6.1 1.3-2.1 1.1-3.6 3.2-4.3 6.6-.7-3.4-2.2-5.5-4.3-6.6C6.2 10.8 4.3 10.4 1.6 10.3c2.7-.1 4.6-.5 6.1-1.3C9.8 7.9 11.3 5.8 12 2.4Z"
        fill="currentColor"
      />
      <circle cx="19.2" cy="4.6" r="1.6" fill="currentColor" opacity=".85" />
      <circle cx="4.4" cy="18.6" r="1.2" fill="currentColor" opacity=".7" />
    </svg>
  );
}

/* Level crest — the small shield-with-chevron that marks LEVEL
   everywhere (level chips, level-up toasts, progress cards). */
export function LevelCrest({ size = 14, className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M12 2.2 4.2 4.6v6.1c0 4.9 3.2 9.1 7.8 11.1 4.6-2 7.8-6.2 7.8-11.1V4.6L12 2.2Z"
        fill="currentColor"
        opacity=".22"
      />
      <path
        d="M12 2.2 4.2 4.6v6.1c0 4.9 3.2 9.1 7.8 11.1 4.6-2 7.8-6.2 7.8-11.1V4.6L12 2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="m8.4 12.1 2.5-3.4 1.6 2 1.4-1.6 2.1 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Paw mark — the Meev paw used where a 🐾 used to sit (playful
   sign-offs, helper copy, empty states). One big pad + three toes. */
export function PawMark({ size = 14, className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <ellipse cx="12" cy="15.4" rx="5.1" ry="4.2" fill="currentColor" />
      <ellipse cx="5.2" cy="10.2" rx="2.1" ry="2.7" fill="currentColor" transform="rotate(-18 5.2 10.2)" />
      <ellipse cx="9.6" cy="6.9" rx="2.1" ry="2.9" fill="currentColor" transform="rotate(-6 9.6 6.9)" />
      <ellipse cx="14.4" cy="6.9" rx="2.1" ry="2.9" fill="currentColor" transform="rotate(6 14.4 6.9)" />
      <ellipse cx="18.8" cy="10.2" rx="2.1" ry="2.7" fill="currentColor" transform="rotate(18 18.8 10.2)" />
    </svg>
  );
}

/* Cat face mark — the Meev cat silhouette for 🐱 spots. */
export function CatMark({ size = 14, className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M4.6 9.4 3.8 3.9c-.1-.6.6-1 1.1-.7l3.6 2.3c.4.2.8.3 1.2.2 1.4-.3 4.2-.3 5.6 0 .4.1.8 0 1.2-.2l3.6-2.3c.5-.3 1.2.1 1.1.7l-.8 5.5c.5 1 .8 2.1.8 3.2 0 4.5-3.7 7.4-8.2 7.4S3.8 17.1 3.8 12.6c0-1.1.3-2.2.8-3.2Z"
        fill="currentColor"
      />
      <ellipse cx="9.3" cy="12.4" rx="1.2" ry="1.7" fill="var(--background, #17110b)" />
      <ellipse cx="14.7" cy="12.4" rx="1.2" ry="1.7" fill="var(--background, #17110b)" />
      <path d="M11 15.6l1 .9 1-.9" fill="none" stroke="var(--background, #17110b)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Gift box mark — clean vector for 🎁 (gift tabs, support rows). */
export function GiftMark({ size = 14, className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <rect x="3.6" y="8.2" width="16.8" height="12.2" rx="2.2" fill="currentColor" opacity=".9" />
      <rect x="2.2" y="5" width="19.6" height="3.6" rx="1.6" fill="currentColor" />
      <rect x="10.4" y="5" width="3.2" height="15.4" fill="var(--background, #17110b)" opacity=".55" />
      <path d="M12 5c-2.6 0-5.2-1-5.2-2.6C6.8 1.2 8.2.9 9.3 1.4c1.6.7 2.4 2.2 2.7 3.6Z" fill="currentColor" stroke="var(--background, #17110b)" strokeWidth=".6" />
      <path d="M12 5c2.6 0 5.2-1 5.2-2.6 0-1.2-1.4-1.5-2.5-1-1.6.7-2.4 2.2-2.7 3.6Z" fill="currentColor" stroke="var(--background, #17110b)" strokeWidth=".6" />
    </svg>
  );
}

/* Gem mark — the faceted diamond for 💎 (premium, rarity, VIP). */
export function GemMark({ size = 14, className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path d="M7.2 3.4h9.6l4.6 6-9.4 11.2L2.6 9.4l4.6-6Z" fill="currentColor" />
      <path d="M7.2 3.4 12 20.6 2.6 9.4l4.6-6Z" fill="#000" opacity=".14" />
      <path d="M9.5 3.4 7 9.4l5 11.2 5-11.2-2.5-6" fill="none" stroke="var(--background, #17110b)" strokeWidth=".9" opacity=".5" />
    </svg>
  );
}

/* Bolt mark — the live-energy ⚡ (hype, live, streak power). */
export function BoltMark({ size = 14, className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path d="M13.7 1.8 4.9 13.2c-.4.5 0 1.2.6 1.2h4.5l-1.7 7.2c-.2.7.7 1.1 1.2.6l8.8-11.4c.4-.5 0-1.2-.6-1.2h-4.5l1.7-7.2c.2-.7-.7-1.1-1.2-.6Z" fill="currentColor" />
    </svg>
  );
}

/* Globe live mark — the MEEV WORLD LIVE ticker's orbiting planet:
   globe + orbit ring + a live satellite dot. */
export function GlobeLive({ size = 16, className, title }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.7 9.4c2-1.3 4.3-1.9 6.3-1.9s4.3.6 6.3 1.9M5.7 14.6c2 1.3 4.3 1.9 6.3 1.9s4.3-.6 6.3-1.9M12 5.6c-2 1.7-3.1 4-3.1 6.4s1.1 4.7 3.1 6.4c2-1.7 3.1-4 3.1-6.4S14 7.3 12 5.6Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="12" cy="12" rx="10.2" ry="4.2" fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".55" transform="rotate(-18 12 12)" />
      <circle cx="20.6" cy="8.4" r="1.7" fill="currentColor" />
    </svg>
  );
}
