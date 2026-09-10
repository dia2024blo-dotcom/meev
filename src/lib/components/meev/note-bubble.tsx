"use client";

// ============================================================
// v14 — THE THOUGHT BUBBLE (فقاعة تفكير 💭)
// User spec: "جرب تخلي فقاعة الملاحظة بشكل انو شخص يفكر مش راس قطة
// لا اعطيك مثال هكذا 💭 لاكن بشكل رائع ومطور" — the old CSS cloud's
// two symmetric top bumps read as a CAT HEAD with ears. This is a real
// thought cloud like the 💭 emoji, developed & refined:
//   • three soft puffs crown a rounded body, drawn as ONE silhouette
//     (SVG shapes sharing a fill + one drop-shadow — no internal seams)
//   • two small circles sink from the bottom toward the thinker's
//     head — the classic thought tail
//   • theme-aware fill (popover; gold-tinted for your OWN thought),
//     gently bobbing, mirrored automatically in RTL
//   • the text lives in the cloud's body (max 2 lines — a note is one
//     tiny 30-char thought), full text rides the title tooltip
// ============================================================

import { useI18n } from "./i18n";
import { cn } from "@/lib/utils";

export function ThoughtBubble({
  text,
  mine = false,
  className,
  title,
}: {
  text: string;
  mine?: boolean;
  className?: string;
  /** tooltip override (defaults to the text itself) */
  title?: string;
}) {
  const { dir } = useI18n();
  const fill = mine
    ? "color-mix(in oklab, var(--primary) 16%, var(--popover))"
    : "var(--popover)";
  return (
    <div
      className={cn("relative block w-full select-none meev-thought-bob", className)}
      title={title ?? text}
    >
      <svg
        viewBox="0 0 96 72"
        className="block w-full h-auto"
        style={{
          transform: dir === "rtl" ? "scaleX(-1)" : undefined,
          filter: "drop-shadow(0 3px 8px rgba(0,0,0,.14))",
        }}
        aria-hidden="true"
      >
        {/* the cloud — body + three crown puffs as one silhouette */}
        <g fill={fill}>
          <rect x="7" y="21" width="82" height="36" rx="13" />
          <circle cx="27" cy="22" r="10.5" />
          <circle cx="48" cy="15" r="12.5" />
          <circle cx="69" cy="22" r="9.5" />
        </g>
        {/* the thought tail — two circles sinking toward the head */}
        <g fill={fill}>
          <circle cx="26" cy="62" r="4" />
          <circle cx="16" cy="68" r="2.4" />
        </g>
      </svg>
      <span className="pointer-events-none absolute inset-x-2.5 top-[33%] bottom-[19%] grid place-items-center text-center text-[10px] font-bold leading-[1.25] line-clamp-2 break-words overflow-hidden">
        {text}
      </span>
    </div>
  );
}
