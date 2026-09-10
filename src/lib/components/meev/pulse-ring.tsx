"use client";

// ============================================================
// MEEV v15 — PulseRing: the shared avatar pulse-ring (one place,
// every site). The Instagram contract, prettier:
//   • ONE thin gold gradient ring in the site's own brand colors
//     (theme-aware stops from globals.css — cream day / black night)
//   • a delicate double rim + a soft golden breath behind it while
//     the pulse is UNSEEN ("مثل انستغرام لاكن جميلة شوي")
//   • rest states:
//       "dim"   — others' pulses: once watched the ring rests at low
//                 opacity (still quietly readable — v14 calm spec)
//       "clear" — MY OWN pulse: the moment I watch my story the ring
//                 fades to fully transparent ("لما ترا سطوري ترجع
//                 شفاف") — the wrapper keeps the layout stable
// ============================================================

import { useState } from "react";

let PULSE_SEQ = 0;
function usePulseId() {
  // module-sequence ids are url(#...) safe (React's useId() emits ":r1:"
  // colons which some SVG url fragment parsers reject); useState pins
  // the id per mount so re-renders never reshuffle the gradient refs
  const [id] = useState(() => `pr${++PULSE_SEQ}`);
  return id;
}

export function PulseRing({
  unviewed,
  rest = "dim",
  size = 64,
  label,
  children,
}: {
  /** v14: false once every story in the group has been seen */
  unviewed: boolean;
  /** how the ring rests once seen — see the header comment */
  rest?: "dim" | "clear";
  /** outer wrapper size in px (the avatar inside sits at ~78%) */
  size?: number;
  /** accessible label for the ring group */
  label: string;
  children: React.ReactNode;
}) {
  const uid = usePulseId();
  const gid = `meev-pulse-ring-${uid}`;

  const restOpacity = rest === "clear" ? 0 : 0.5;

  return (
    <span
      className="relative inline-grid place-items-center rounded-full"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        viewBox="0 0 64 64"
        className="absolute inset-0"
        style={{
          width: "100%",
          height: "100%",
          // v15: the fade — watching the pulse lets the ring melt away
          transition: "opacity .45s ease",
          ...(unviewed
            ? {
                // the soft golden breath behind a live ring — subtle,
                // never neon ("جميلة شوي", still calm)
                filter: "drop-shadow(0 0 5px rgba(190,177,92,.38))",
              }
            : {}),
        }}
        aria-hidden="true"
      >
        <defs>
          {/* theme-aware gold stops (globals.css) so the ring reads on
              pure white AND true black — the brand gradient, never hues */}
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--pulse-ring-1, #BEB15C)" }} />
            <stop offset="1" style={{ stopColor: "var(--pulse-ring-2, #D5CFAB)" }} />
          </linearGradient>
        </defs>
        {/* the light gold ring — the pulse's only visual */}
        <circle
          cx="32"
          cy="32"
          r={29}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={2.6}
          opacity={unviewed ? 1 : restOpacity}
          style={{ transition: "opacity .45s ease" }}
        />
        {/* the delicate hairline that rides OUTSIDE a live ring —
            a designed double rim, only while the pulse is unseen */}
        {unviewed && (
          <circle
            cx="32"
            cy="32"
            r={31.5}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={0.8}
            opacity={0.4}
          />
        )}
      </svg>
      {children}
    </span>
  );
}
