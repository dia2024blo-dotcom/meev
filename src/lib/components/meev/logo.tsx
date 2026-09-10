"use client";

// ============================================================
// MEEV — The living logo. An animated geometric cat face
// (recreation of the uploaded brand mark: asymmetric ears,
// big round eyes, 3 whiskers/side, jagged chin spikes).
// Props: mood | speed | color | size | glow | interactive.
// Eyes blink randomly, pupils track the cursor, ears twitch.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MeevMood =
  | "default" | "happy" | "sleepy" | "love" | "shocked" | "angry"
  | "blep" | "party" | "sad" | "nyan" | "playful" | "royal" | "excited" | "legend";


// Theme-aware cutout paint (eyes / nose / mouth): SVG presentation
// attributes do NOT support var(), so the page-background-matching color
// is applied through inline STYLE instead — this is what makes the cat's
// face read perfectly in BOTH light and dark themes.
const CUT_FILL = { fill: "var(--meev-cutout, #000000)" } as const;
const CUT_STROKE = { stroke: "var(--meev-cutout, #000000)" } as const;

const MOOD_LABEL: Record<MeevMood, string> = {
  default: "Meev", happy: "Happy", sleepy: "Sleepy", love: "In love", shocked: "Shook",
  angry: "Grumpy", blep: "Blep", party: "Party time", sad: "Sad", nyan: "Nyan!",
  playful: "Playful", royal: "Royal", excited: "Hyped", legend: "LEGENDARY",
};

interface LogoProps {
  size?: number;
  mood?: MeevMood;
  speed?: number; // 0.25 (slow) .. 3 (fast)
  color?: string; // ink color (defaults to currentColor)
  bg?: string; // cutout color for eyes (defaults to page bg)
  className?: string;
  glow?: boolean;
  interactive?: boolean; // pupil tracking + hover wiggle
  title?: string;
}

let globalMouse = { x: 0, y: 0 };
let listening = false;
function ensureMouseListener() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(
    "mousemove",
    (e) => { globalMouse.x = e.clientX; globalMouse.y = e.clientY; },
    { passive: true }
  );
}

export function MeevLogo({
  size = 40,
  mood = "default",
  speed = 1,
  color,
  bg,
  className,
  glow = false,
  interactive = true,
  title,
}: LogoProps) {
  const gRef = useRef<SVGGElement | null>(null);
  const pupilsRef = useRef<SVGGElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const ink = color ?? "currentColor";

  useEffect(() => {
    if (!interactive) return;
    ensureMouseListener();
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 80) return;
      last = t;
      const el = pupilsRef.current;
      if (!el) return;
      const rect = (gRef.current ?? el).getBoundingClientRect();
      if (rect.width === 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = globalMouse.x - cx;
      const dy = globalMouse.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const mag = Math.min(3.4, dist / 60);
      el.setAttribute("transform", `translate(${(dx / dist) * mag * 1.6} ${(dy / dist) * mag * 0.9})`);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [interactive]);

  const dur = `${2.6 / Math.max(0.25, speed)}s`;
  const blinkDelay = `${(Math.random() * 3 + 0.6).toFixed(2)}s`;

  return (
    <span
      className={cn("relative inline-flex items-center justify-center select-none", className)}
      style={{ width: size, height: size }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={title ?? MOOD_LABEL[mood]}
      role="img"
    >
      {glow && (
        <span
          className="absolute inset-0 rounded-full blur-md -z-10"
          style={{ background: "radial-gradient(circle, rgba(190,177,92,.45), transparent 70%)" }}
        />
      )}
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className={cn(interactive && "cursor-pointer transition-transform duration-200", hovered && "meev-wiggle")}
      >
        <defs>
          <linearGradient id={`lg-${mood}-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#B5A452" />
            <stop offset="55%" stopColor="#CDC494" />
            <stop offset="100%" stopColor="#E4DDC0" />
          </linearGradient>
        </defs>

        <g ref={gRef}>
          {/* ---- ears: left solid spike, right negative-space cutout ---- */}
          <path d="M30 46 L20 8 L52 30 Z" fill={ink} />
          <path d="M90 46 L100 8 L68 30 Z" fill={ink} />
          <path d="M90 44 L95 20 L74 34 Z" fill={bg || undefined} opacity={bg ? 1 : 0.999} style={bg ? undefined : CUT_FILL} />
          <path d="M30 44 L25 20 L46 34 Z" fill={bg || undefined} opacity={bg ? 1 : 0.999} style={bg ? undefined : CUT_FILL} />

          {/* ---- head with jagged chin ---- */}
          <path
            d="M22 44 C14 66 18 86 30 95 L38 100 L44 93 L60 104 L76 93 L82 100 L90 95 C102 86 106 66 98 44 C92 30 76 22 60 22 C44 22 28 30 22 44 Z"
            fill={ink}
          />

          {/* ---- eyes ---- */}
          <g style={{ animation: `meev-blink ${dur} ease-in-out infinite`, animationDelay: blinkDelay }}>
            {mood === "sleepy" && (
              <>
                <path d="M36 58 q8 7 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M68 58 q8 7 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="5" fill="none" strokeLinecap="round" />
              </>
            )}
            {(mood === "default" || mood === "blep" || mood === "party" || mood === "royal" || mood === "playful" || mood === "sad") && (
              <g ref={pupilsRef}>
                {/* left eye — always a full eye (pupil included) */}
                <circle cx="42" cy="58" r={10} fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <circle cx="44" cy="56" r="2.6" fill={ink} opacity="0.85" />
                {/* right eye — circle for everyone except playful (a wink instead) */}
                {mood !== "playful" && (
                  <>
                    <circle cx="78" cy={58} r={10} fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                    <circle cx="80" cy="56" r="2.6" fill={ink} opacity="0.85" />
                  </>
                )}
                {mood === "playful" && <path d="M70 54 q8 8 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="4" fill="none" strokeLinecap="round" />}
              </g>
            )}
            {mood === "shocked" && (
              <g ref={pupilsRef}>
                <circle cx="42" cy="58" r="13" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <circle cx="78" cy="58" r="13" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <circle cx="42" cy="59" r="4" fill={ink} />
                <circle cx="78" cy="59" r="4" fill={ink} />
              </g>
            )}
            {mood === "happy" && (
              <>
                <path d="M34 60 q8 -10 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="6" fill="none" strokeLinecap="round" />
                <path d="M70 60 q8 -10 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="6" fill="none" strokeLinecap="round" />
              </>
            )}
            {mood === "love" && (
              <>
                <path d="M42 50 c-3-6-12-3-10 3 c1.5 4 10 9 10 9 c0 0 8.5-5 10-9 c2-6-7-9-10-3z" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <path d="M78 50 c-3-6-12-3-10 3 c1.5 4 10 9 10 9 c0 0 8.5-5 10-9 c2-6-7-9-10-3z" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
              </>
            )}
            {mood === "angry" && (
              <g ref={pupilsRef}>
                <circle cx="42" cy="60" r="9" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <circle cx="78" cy="60" r="9" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <rect x="30" y="46" width="26" height="8" fill={ink} transform="rotate(14 43 50)" />
                <rect x="64" y="46" width="26" height="8" fill={ink} transform="rotate(-14 77 50)" />
              </g>
            )}
            {mood === "nyan" && (
              <>
                <path d="M34 58 q8 -10 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M70 58 q8 -10 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="5" fill="none" strokeLinecap="round" />
              </>
            )}
            {mood === "excited" && (
              <g ref={pupilsRef}>
                <circle cx="42" cy="58" r="10" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <circle cx="78" cy="58" r="10" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <circle cx="42" cy="57" r="3" fill={ink} />
                <circle cx="78" cy="57" r="3" fill={ink} />
              </g>
            )}
            {mood === "legend" && (
              <>
                <rect x="30" y="52" width="22" height="10" rx="4" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <rect x="68" y="52" width="22" height="10" rx="4" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
                <rect x="50" y="54" width="20" height="6" rx="3" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
              </>
            )}
          </g>

          {/* ---- nose + mouth ---- */}
          <path d="M56 76 L64 76 L60 82 Z" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />
          {mood === "sad" ? (
            <path d="M52 90 q8 -6 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="3" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M52 86 q8 6 16 0" stroke={bg || undefined} style={bg ? undefined : CUT_STROKE} strokeWidth="3" fill="none" strokeLinecap="round" />
          )}
          {mood === "blep" && <rect x="57" y="86" width="7" height="12" rx="3.5" fill="#ff9d88" />}
          {mood === "shocked" && <ellipse cx="60" cy="88" rx="5" ry="7" fill={bg || undefined} style={bg ? undefined : CUT_FILL} />}

          {/* ---- whiskers ---- */}
          <g stroke={ink} strokeWidth="4" strokeLinecap="round">
            <line x1="2" y1="58" x2="20" y2="62" />
            <line x1="0" y1="72" x2="20" y2="72" />
            <line x1="2" y1="86" x2="20" y2="82" />
            <line x1="118" y1="58" x2="100" y2="62" />
            <line x1="120" y1="72" x2="100" y2="72" />
            <line x1="118" y1="86" x2="100" y2="82" />
          </g>

          {/* ---- mood accessories ---- */}
          {mood === "party" && (
            <g>
              <path d="M60 2 L74 24 L46 24 Z" fill="#B5A452" />
              <circle cx="60" cy="10" r="3" fill="#D9CD82" />
              <circle cx="66" cy="18" r="2.5" fill="#8F7C35" />
              <circle cx="54" cy="18" r="2.5" fill="#E4DDC0" />
            </g>
          )}
          {mood === "royal" && (
            <g>
              <path d="M44 6 L52 18 L60 4 L68 18 L76 6 L78 24 L42 24 Z" fill="#B5A452" />
              <circle cx="60" cy="14" r="3" fill="#D9CD82" />
            </g>
          )}
          {mood === "legend" && (
            <g fill="url(#lg-legend-40)" opacity="0.95">
              <path d="M60 -6 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" />
            </g>
          )}
          {mood === "sad" && (
            <g fill="#38bdf8">
              <path d="M84 68 q6 10 0 14 q-6 -4 0 -14" />
            </g>
          )}
          {mood === "excited" && (
            <g fill="#B5A452">
              <path d="M18 24 l2.5 7 7 2.5 -7 2.5 -2.5 7 -2.5 -7 -7 -2.5 7 -2.5z" />
              <path d="M100 30 l2.5 7 7 2.5 -7 2.5 -2.5 7 -2.5 -7 -7 -2.5 7 -2.5z" />
            </g>
          )}
          {mood === "nyan" && (
            <g>
              <rect x="-14" y="64" width="16" height="8" fill="#ef4444" />
              <rect x="-14" y="72" width="16" height="8" fill="#ffc24d" />
              <rect x="-14" y="80" width="16" height="8" fill="#22c55e" />
              <rect x="-14" y="88" width="16" height="8" fill="#38bdf8" />
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}

// Variant that cycles moods — used on auth/loading screens.
export function MeevLogoCycle({ size = 84, className }: { size?: number; className?: string }) {
  const moods: MeevMood[] = ["default", "happy", "shocked", "love", "sleepy", "party", "excited", "nyan"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % moods.length), 2200);
    return () => clearInterval(t);
     
  }, []);
  return <MeevLogo size={size} mood={moods[i]} className={className} speed={1.2} glow />;
}

// Full-screen splash (first paint while the app chunk loads).
export function MeevSplash() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background">
      <div className="meev-bg-aurora" />
      <div className="flex flex-col items-center gap-6">
        <MeevLogoCycle size={110} />
        <div className="text-2xl font-bold tracking-tight">
          <span className="meev-aurora-text">Meev</span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary/60 meev-typing-dot" />
          <span className="h-2 w-2 rounded-full bg-primary/60 meev-typing-dot" />
          <span className="h-2 w-2 rounded-full bg-primary/60 meev-typing-dot" />
        </div>
      </div>
    </div>
  );
}
