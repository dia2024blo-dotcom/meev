"use client";

// ============================================================
// MEEV v11 — SUPPORT CINEMA 🕊️💥
// The TikTok/Hala-style support takeover (user spec):
//   When someone supports you in a DM or a live 1v1 room, the
//   gift must NOT arrive as a message — it arrives as a SCENE:
//     1. a wrapped gift box drops onto the screen and SHAKES,
//     2. it DETONATES — flash + shockwaves + confetti,
//     3. CREATURES burst out and fly away: doves 🕊️ (the user's
//        exact example), butterflies 🦋, kittens 🐱, rose petals,
//        coins, fireworks, meteors, a rainbow arc, dragons…
//   Every gift's `burst` kind (constants.ts) picks the creature
//   cast; unknown kinds fall back to the classic radial burst.
//   Exports keep the v8 names (GiftCinema / CinemaShow) so every
//   existing consumer keeps working — this IS the same cinema,
//   reborn. Driven by the .sc-* keyframes in globals.css.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GIFTS, RARITY_STYLES, type GiftDef } from "@/lib/meev/constants";
import { makeBurstPieces, BurstLayer, type BurstPiece } from "./gift-box";
import { PawCoinIcon } from "./pawcoin";
import { useI18n } from "./i18n";
import { Check, HeartHandshake } from "lucide-react";

export type CinemaShow = {
  giftKey: string;
  /** "sender" — I just sent it; "receiver" — it's landing on MY screen */
  viewer: "sender" | "receiver";
  /** partner display name (the other side of the support) */
  partner: string;
  /** optional gift note */
  note?: string;
  /** v11: where the support happened — tweaks the banner copy */
  context?: "dm" | "live";
};

// ------------------------- the creature cast -------------------------

type Creature = {
  id: number;
  char: string;
  mode: "fly" | "fall" | "meteor";
  tx: string;
  ty: string;
  rot: string;
  dur: number;
  delay: number;
  size: number;
  wing: boolean;
  sway: boolean;
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

/** flight arcs — creatures fan out to both sides and upward */
const flightArc = (i: number, n: number) => {
  const side = i % 2 === 0 ? -1 : 1;
  const strength = 0.35 + (i / Math.max(1, n)) * 0.55;
  return {
    tx: `${side * rand(18, 46) * (0.5 + strength)}vw`.replace("--", "-"),
    ty: `${-rand(16, 52) * (0.5 + strength)}vh`,
    rot: `${side * rand(4, 38)}deg`,
  };
};

function buildCreatures(kind: string, gift: GiftDef): Creature[] {
  const out: Creature[] = [];
  const add = (c: Omit<Creature, "id">) => out.push({ id: out.length, ...c });

  const flyOut = (char: string, count: number, size: [number, number], wing: boolean, speed: [number, number]) => {
    for (let i = 0; i < count; i++) {
      const arc = flightArc(i, count);
      add({
        char, mode: "fly", ...arc,
        rot: wing ? arc.rot : `${rand(-20, 20)}deg`,
        dur: rand(speed[0], speed[1]),
        delay: rand(0, 0.45),
        size: rand(size[0], size[1]),
        wing, sway: false,
      });
    }
  };
  const rain = (chars: string[], count: number, size: [number, number], speed: [number, number], sway: boolean) => {
    for (let i = 0; i < count; i++) {
      add({
        char: pick(chars), mode: "fall",
        tx: "0px", ty: "0px",
        rot: `${rand(-40, 40) * 10}deg`,
        dur: rand(speed[0], speed[1]),
        delay: rand(0, 1.4),
        size: rand(size[0], size[1]),
        wing: false, sway,
      });
    }
  };

  switch (kind) {
    case "doves":
      flyOut("🕊️", 7, [30, 46], true, [1.9, 2.6]);
      rain(["✨", "🤍"], 8, [10, 15], [2.2, 3.2], true);
      break;
    case "doveflock":
      flyOut("🕊️", 15, [28, 52], true, [2.1, 3.2]);
      flyOut("🕊️", 6, [20, 30], true, [1.6, 2.2]);
      rain(["✨", "🤍", "💫"], 14, [10, 16], [2.4, 3.6], true);
      break;
    case "butterflies":
      flyOut("🦋", 12, [26, 40], false, [2.4, 3.4]);
      flyOut("🦋", 5, [18, 26], false, [1.8, 2.6]);
      break;
    case "cats":
      // kittens hop out low and bounce away
      for (let i = 0; i < 9; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        add({
          char: pick(["🐱", "😺", "😸", "🐈"]), mode: "fly",
          tx: `${side * rand(20, 44)}vw`, ty: `${-rand(4, 26)}vh`,
          rot: `${side * rand(6, 30)}deg`,
          dur: rand(1.6, 2.4), delay: rand(0, 0.5),
          size: rand(26, 44), wing: false, sway: false,
        });
      }
      rain(["🐾", "✨"], 10, [12, 20], [2, 3], true);
      break;
    case "petals":
      rain(["🌹", "🌸", "🌷", "❤️‍🔥"], 22, [18, 30], [2.6, 3.8], true);
      flyOut("💐", 1, [42, 50], false, [2, 2.6]);
      break;
    case "hearts":
      rain(["💖", "❤️", "💗", "💕"], 20, [20, 34], [2.4, 3.6], true);
      flyOut("💘", 4, [30, 40], false, [1.8, 2.4]);
      break;
    case "coins":
      rain(["🪙", "💰", "💵"], 26, [20, 36], [1.6, 2.6], false);
      flyOut("💸", 3, [34, 44], false, [1.7, 2.2]);
      break;
    case "stars":
      flyOut("⭐", 12, [22, 38], false, [1.8, 2.8]);
      rain(["✨", "💫"], 10, [12, 20], [2.2, 3.2], true);
      break;
    case "crown":
      // the crown rises at center — handled as a special extra; here: beams + sparkles
      rain(["✨", "👑", "💫"], 16, [14, 26], [2.4, 3.4], true);
      flyOut("👑", 3, [22, 30], false, [2, 2.8]);
      break;
    case "fireworks":
      for (let i = 0; i < 5; i++) {
        flyOut("🎆", 1, [38, 44], false, [1.5, 1.9]);
      }
      rain(["✨", "🎇", "💫"], 18, [12, 22], [2, 3.2], true);
      break;
    case "meteors":
      for (let i = 0; i < 7; i++) {
        add({
          char: "🌠", mode: "meteor",
          tx: `${rand(50, 90)}vw`, ty: `${rand(40, 90)}vh`,
          rot: "38deg", dur: rand(1.2, 1.8), delay: rand(0, 1),
          size: rand(22, 34), wing: false, sway: false,
        });
      }
      rain(["✨", "⭐"], 12, [12, 20], [2, 3.2], true);
      break;
    case "rainbow":
      rain(["🌈", "✨", "💖"], 14, [14, 24], [2.4, 3.4], true);
      flyOut("🌈", 2, [30, 40], false, [2.2, 2.8]);
      break;
    case "dragon":
      // one big dragon sweeps the sky + a fire trail
      add({
        char: "🐉", mode: "fly", tx: "86vw", ty: "-14vh", rot: "-6deg",
        dur: 2.8, delay: 0.15, size: 74, wing: false, sway: false,
      });
      rain(["🔥", "✨"], 14, [16, 26], [1.8, 3], false);
      break;
    case "phoenix":
      add({
        char: "🔥", mode: "fly", tx: "-8vw", ty: "-52vh", rot: "4deg",
        dur: 2.6, delay: 0.1, size: 84, wing: true, sway: false,
      });
      add({
        char: "🔥", mode: "fly", tx: "10vw", ty: "-46vh", rot: "-8deg",
        dur: 2.3, delay: 0.3, size: 44, wing: false, sway: false,
      });
      rain(["🔥", "✨", "💫"], 16, [14, 26], [1.8, 3], false);
      break;
    case "rocket":
      add({
        char: "🚀", mode: "fly", tx: "4vw", ty: "-58vh", rot: "-12deg",
        dur: 2.4, delay: 0.1, size: 66, wing: false, sway: false,
      });
      rain(["✨", "💫", "⭐"], 16, [12, 22], [2, 3.2], false);
      flyOut("⭐", 6, [18, 28], false, [1.8, 2.6]);
      break;
    case "galaxy":
      flyOut("⭐", 10, [16, 30], false, [1.8, 3]);
      flyOut("🪐", 2, [30, 40], false, [2.2, 2.8]);
      rain(["✨", "💫", "💜"], 12, [12, 20], [2.2, 3.4], true);
      break;
    case "fish":
      flyOut("🐟", 10, [24, 38], false, [1.8, 2.8]);
      flyOut("🐠", 4, [22, 34], false, [1.6, 2.4]);
      rain(["🫧", "✨"], 10, [10, 18], [2.2, 3.2], true);
      break;
    case "megameev":
      flyOut("🐱", 8, [30, 52], false, [1.8, 2.6]);
      rain(["✨", "💛", "🐾"], 18, [14, 24], [2.2, 3.4], true);
      break;
    case "confetti":
    default:
      rain(["🎉", "🎊", "✨", "💫", gift.emoji || "🎁"], 20, [18, 30], [2.2, 3.4], true);
      flyOut(gift.emoji || "🎁", 5, [30, 44], false, [1.8, 2.6]);
      break;
  }
  return out;
}

/** fireworks + crown + rainbow get their own special layers */
type Firework = { left: number; top: number; delay: number; hue: string };

function buildFireworks(): Firework[] {
  const hues = ["#ffc24d", "#ff7e5f", "#f04a6e", "#22d3ee", "#22c55e"];
  return Array.from({ length: 5 }, (_, i) => ({
    left: rand(12, 86),
    top: rand(12, 46),
    delay: i * 0.28,
    hue: hues[i % hues.length],
  }));
}

// ------------------------- the cinema -------------------------

export function GiftCinema({ show, onClose }: { show: CinemaShow | null; onClose: () => void }) {
  const { L } = useI18n();
  const gift = useMemo(() => GIFTS.find((g) => g.key === show?.giftKey) ?? GIFTS[0], [show?.giftKey]);
  const rar = RARITY_STYLES[gift.rarity] ?? RARITY_STYLES.common;
  const legendary = gift.rarity === "legendary" || gift.rarity === "epic";

  // the 3-act play: DROP → BOOM → (banner rides until close)
  const [phase, setPhase] = useState<"drop" | "boom">("drop");
  const timers = useRef<number[]>([]);
  // v11 fix: the parent's onClose identity changes on every re-render (the
  // live room re-renders every second for the room timer) — if it sat in
  // the effect deps, each tick RESET the cinema to the drop phase and the
  // box never detonated. A ref keeps the effect keyed to `show` only.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    if (!show) return;
    clearTimers();
    timers.current.push(window.setTimeout(() => setPhase("drop"), 0));
    timers.current.push(window.setTimeout(() => setPhase("boom"), 950));
    timers.current.push(
      window.setTimeout(() => onCloseRef.current(), show.viewer === "receiver" ? 5000 : 4200)
    );
    return clearTimers;
  }, [show]);

  // stable casts per show (re-mounts via key → plays exactly once)
  const creatures = useMemo(
    () => (show ? buildCreatures(gift.burst || "confetti", gift) : []),
    [show, gift]
  );
  const pieces: BurstPiece[] = useMemo(
    () => (show ? makeBurstPieces(legendary ? 40 : 24, gift, 1.6) : []),
    [show, gift, legendary]
  );
  const fireworks = useMemo(() => buildFireworks(), [show]);
  const showRainbow = gift.burst === "rainbow";
  const showCrown = gift.burst === "crown";
  const showRays = gift.burst === "megameev" || showCrown || legendary;

  if (!show) return null;

  const uid = `sc-${gift.key}-${show.viewer}`;

  return (
    <AnimatePresence>
      <motion.div
        key={uid}
        className="fixed inset-0 z-[85] grid place-items-center overflow-hidden cursor-pointer select-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        onClick={onClose}
        role="alertdialog"
        aria-live="assertive"
        aria-label={
          show.viewer === "receiver"
            ? L(`${show.partner} دعمك بـ ${gift.name}`, `${show.partner} supported you with ${gift.name}`)
            : L(`أرسلت ${gift.name} إلى ${show.partner}`, `You sent ${gift.name} to ${show.partner}`)
        }
      >
        {/* the stage */}
        <div className="absolute inset-0 bg-black/72 backdrop-blur-md" />

        {/* ============ ACT 1 — the box drops in and shakes ============ */}
        {phase === "drop" && (
          <div className="relative z-10 flex flex-col items-center gap-6 pointer-events-none">
            <div className="relative size-44 sm:size-52 grid place-items-center">
              <span className="meev-cinema-halo" style={{ ["--ci" as string]: `${rar.ring}55` }} aria-hidden="true" />
              <div className="sc-box relative">
                <span
                  className="block text-[96px] sm:text-[116px] leading-none meev-gift-shaking select-none"
                  style={{ filter: `drop-shadow(0 14px 34px ${rar.ring}aa)` }}
                  role="img"
                  aria-label={L("صندوق هدية يهتز… على وشك الانفجار!", "A gift box, shaking… about to blow!")}
                >
                  🎁
                </span>
                {/* rising sparkles = the box charging up */}
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 text-xl animate-bounce" aria-hidden="true">✨</span>
              </div>
              <div className="absolute -bottom-7 text-[11px] font-bold text-white/80 animate-pulse">
                {L("…على وشك الانفجار 💥", "…about to blow 💥")}
              </div>
            </div>
          </div>
        )}

        {/* ============ ACT 2 — DETONATION ============ */}
        {phase === "boom" && (
          <>
            {/* the flash */}
            <div
              className="sc-flash absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-64 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, #ffffff 0%, ${rar.ring}88 35%, transparent 70%)` }}
              aria-hidden="true"
            />

            {/* shockwaves */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
              <span className="meev-cinema-shock absolute" />
              <span className="meev-cinema-shock absolute" style={{ animationDelay: "0.26s" }} />
              <span className="meev-cinema-shock absolute" style={{ animationDelay: "0.52s" }} />
            </div>

            {/* golden rays for the royal tiers */}
            {showRays && (
              <div
                className="meev-legend-rays absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -mt-20 size-[560px] rounded-full pointer-events-none opacity-80"
                aria-hidden="true"
              />
            )}

            {/* the crown that RISES (its own moment) */}
            {showCrown && (
              <motion.span
                className="absolute left-1/2 top-[42%] -translate-x-1/2 text-[104px] z-20 pointer-events-none"
                initial={{ scale: 0.3, y: 60, opacity: 0 }}
                animate={{ scale: 1, y: -60, opacity: 1 }}
                transition={{ type: "spring", stiffness: 120, damping: 12 }}
                style={{ filter: "drop-shadow(0 10px 30px rgba(255,194,77,.85))" }}
                role="img"
                aria-label={gift.name}
              >
                👑
              </motion.span>
            )}

            {/* the rainbow arc drawing itself across the sky */}
            {showRainbow && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 62"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="sc-rainbow-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#f43f5e" />
                    <stop offset="0.25" stopColor="#f97316" />
                    <stop offset="0.5" stopColor="#eab308" />
                    <stop offset="0.7" stopColor="#22c55e" />
                    <stop offset="1" stopColor="#f04a6e" />
                  </linearGradient>
                </defs>
                <path
                  className="sc-rainbow-arc"
                  d="M 4 56 Q 50 -14 96 56"
                  fill="none"
                  stroke="url(#sc-rainbow-grad)"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              </svg>
            )}

            {/* the fireworks points */}
            {gift.burst === "fireworks" &&
              fireworks.map((f, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{ left: `${f.left}%`, top: `${f.top}%` }}
                  aria-hidden="true"
                >
                  <span
                    className="sc-fw-pop absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: 90,
                      height: 90,
                      background: `radial-gradient(circle, ${f.hue}66 0%, transparent 62%)`,
                      border: `2px solid ${f.hue}`,
                      animationDelay: `${f.delay}s`,
                    }}
                  />
                  <span
                    className="sc-fw-pop absolute -translate-x-1/2 -translate-y-1/2 text-3xl"
                    style={{ animationDelay: `${f.delay}s` }}
                  >
                    🎆
                  </span>
                  {Array.from({ length: 6 }).map((_, s) => {
                    const ang = (s / 6) * Math.PI * 2;
                    return (
                      <span
                        key={s}
                        className="sc-fly absolute text-sm"
                        style={{
                          ["--tx" as string]: `${Math.cos(ang) * 70}px`,
                          ["--ty" as string]: `${Math.sin(ang) * 70}px`,
                          ["--rot" as string]: "0deg",
                          ["--fd" as string]: "1.1s",
                          ["--fdelay" as string]: `${f.delay}s`,
                        }}
                      >
                        ✨
                      </span>
                    );
                  })}
                </div>
              ))}

            {/* the confetti base burst */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
              <BurstLayer pieces={pieces} />
            </div>

            {/* THE CREATURES — doves, butterflies, cats, petals, coins… */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-20" aria-hidden="true">
              {creatures.map((c) => (
                <span
                  key={c.id}
                  className={cn2(c.mode === "fall" ? "sc-fall absolute" : c.mode === "meteor" ? "sc-meteor absolute" : "sc-fly absolute")}
                  style={{
                    left: c.mode === "fall" ? `${rand(4, 92)}%` : "50%",
                    top: c.mode === "fall" ? "0" : c.mode === "meteor" ? `${rand(-5, 18)}%` : "50%",
                    ["--tx" as string]: c.tx,
                    ["--ty" as string]: c.ty,
                    ["--rot" as string]: c.rot,
                    ["--fr" as string]: c.rot,
                    ["--fd" as string]: `${c.dur}s`,
                    ["--fdelay" as string]: `${c.delay}s`,
                    fontSize: c.size,
                    filter: "drop-shadow(0 4px 10px rgba(0,0,0,.35))",
                  }}
                >
                  {c.wing ? (
                    <span className="sc-wing" style={{ ["--wd" as string]: `${0.3 + (c.id % 4) * 0.06}s` }}>{c.char}</span>
                  ) : c.sway ? (
                    <span className="sc-sway">{c.char}</span>
                  ) : (
                    c.char
                  )}
                </span>
              ))}
            </div>

            {/* the gift emoji itself pops from the epicenter then fades */}
            <motion.span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[92px] sm:text-[110px] z-10 pointer-events-none"
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: [0.2, 1.35, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 1.15, times: [0, 0.25, 1] }}
              style={{ filter: `drop-shadow(0 14px 34px ${rar.ring}cc)` }}
              role="img"
              aria-label={gift.name}
            >
              {gift.emoji || "🎁"}
            </motion.span>
          </>
        )}

        {/* ============ the banner (rides above both acts after boom) ============ */}
        {phase === "boom" && (
          <div className="sc-banner absolute bottom-[calc(env(safe-area-inset-bottom,0px)+26px)] inset-x-4 z-30 flex flex-col items-center gap-2.5 text-center pointer-events-none">
            <div className="text-3xl sm:text-4xl font-black meev-aurora-text leading-tight">{gift.name}</div>

            {show.viewer === "sender" ? (
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-300">
                <span className="size-5 grid place-items-center rounded-full bg-emerald-400/20">
                  <Check className="size-3.5" />
                </span>
                {show.context === "live"
                  ? L(`أرسلت دعمك إلى ${show.partner} في البث!`, `You supported ${show.partner} live!`)
                  : L(`أرسلت دعمك إلى ${show.partner}`, `Your support flew to ${show.partner}`)}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-amber-200">
                <HeartHandshake className="size-4 shrink-0" aria-hidden="true" />
                {show.context === "live"
                  ? L(`${show.partner} يدعمك مباشرة الآن!`, `${show.partner} is supporting you live!`)
                  : L(`${show.partner} دعمك!`, `${show.partner} supported you!`)}
              </div>
            )}

            {show.note && (
              <div className="text-xs text-white/70 italic max-w-xs leading-relaxed">“{show.note}”</div>
            )}

            <div className="flex items-center gap-2.5 flex-wrap justify-center pt-0.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-3 py-1 text-sm font-bold text-amber-300">
                <PawCoinIcon size={14} spin={legendary} /> {gift.price.toLocaleString()}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1"
                style={{ background: `${rar.ring}26`, color: rar.ring, border: `1px solid ${rar.ring}55` }}
              >
                {rar.label}
              </span>
            </div>

            <div className="text-[10px] text-white/40 pt-1">{L("اضغط في أي مكان للمتابعة", "Tap anywhere to continue")}</div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// tiny local cn (avoids importing the utils into a leaf that styles raw spans)
function cn2(...cls: (string | false | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}
