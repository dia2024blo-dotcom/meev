"use client";

// ============================================================
// MEEV v3 — SpinWheelDialog: the weekly rewards wheel 🎡 (0–5 PawCoins, 7-day cooldown)
// 8 weighted segments (SPIN_PRIZES), CSS conic wheel, PawCoin
// hub, top pointer. Server-authoritative draw via /api/rewards/spin
// with a live countdown when the wheel is on cooldown.
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { PawCoinIcon, PawCoins } from "./pawcoin";
import { Confetti } from "./celebration";
import { SPIN_PRIZES, SPIN_COOLDOWN_HOURS, XP_PER_LEVEL } from "@/lib/meev/constants";
import type { SpinResult } from "./types";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, FerrisWheel } from "lucide-react";
import { GemMark, PawMark } from "./symbols";

const SEG = 360 / SPIN_PRIZES.length; // 45° per segment
const SPIN_MS = 3000;

// v15 segment palette — the ONE gold identity (alternating gold/cream/
// deep-gold rings so every prize slice stays distinguishable — the old
// rose/coral "violet night" mix broke the single-color site)
const SEG_COLORS = [
  "rgba(190,177,92,.55)",
  "rgba(143,124,53,.45)",
  "rgba(224,217,184,.4)",
  "rgba(201,193,137,.55)",
  "rgba(143,124,53,.62)",
  "rgba(190,177,92,.85)", // jackpot gold
];

function wheelBackground(): string {
  const colors = SEG_COLORS.slice(0, SPIN_PRIZES.length); // v3: 6 prizes
  const seg = 360 / colors.length;
  const stops = colors.map((c, i) => `${c} ${i * seg}deg ${(i + 1) * seg}deg`);
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

/** compact radial label — v12: brand symbols (gem/spark/paw) instead of emoji */
function shortLabel(i: number): ReactNode {
  const p = SPIN_PRIZES[i];
  if (i === SPIN_PRIZES.length - 1)
    return (
      <span className="inline-flex items-center gap-1">
        <GemMark size={12} /> {p.coins}
      </span>
    );
  // v16: the wheel pays coins only — the "0 coin" slice shows a paw (luck next week)
  if (p.coins === 0)
    return (
      <span className="inline-flex items-center gap-1">
        <PawMark size={12} />
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <PawMark size={12} /> {p.coins}
    </span>
  );
}

/** v3 weekly countdown: shows days when the wait spans them */
function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function SpinWheelDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { L, lang } = useI18n();
  const { toast } = useToast();
  const me = useMeev((s) => s.me);
  const patchMe = useMeev((s) => s.patchMe);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const resultRef = useRef<HTMLDivElement | null>(null);
  const wasOpen = useRef(false);

  // live countdown ticker
  useEffect(() => {
    if (!cooldownUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  // reset + adopt the profile cooldown once per dialog open
  useEffect(() => {
    if (open && !wasOpen.current) {
      wasOpen.current = true;
      setResult(null);
      setSpinning(false);
      setRotation(0);
      if (me?.lastSpinAt) {
        const until = new Date(me.lastSpinAt).getTime() + SPIN_COOLDOWN_HOURS * 3600 * 1000;
        setCooldownUntil(until > Date.now() ? until : null);
      } else {
        setCooldownUntil(null);
      }
    } else if (!open && wasOpen.current) {
      wasOpen.current = false;
    }
  }, [open, me?.lastSpinAt]);

  // cooldown expiry clears the lock
  useEffect(() => {
    if (cooldownUntil && now >= cooldownUntil) setCooldownUntil(null);
  }, [now, cooldownUntil]);

  const spin = async () => {
    if (spinning || result) return;
    setSpinning(true);
    try {
      const r = await api.spin();
      // Land segment `prizeIndex` under the top pointer: segment i spans
      // [i*45, i*45+45) clockwise from the top (center at i*45+22.5), so the
      // wheel rotates 5 full turns minus that offset.
      setRotation(5 * 360 - (r.prizeIndex * SEG + SEG / 2));
      window.setTimeout(() => {
        setResult(r);
        setConfettiKey((k) => k + 1);
        setCooldownUntil(new Date(r.nextSpinAt).getTime());
        patchMe({ coins: r.coinsLeft, lastSpinAt: r.nextSpinAt });
        toast({
          title: r.prizeIndex === SPIN_PRIZES.length - 1 ? (
            <span className="flex items-center gap-2">
              <GemMark size={16} className="text-amber-400" />
              {L(`جاكبوت!! ${r.prize.coins} ذهب ميف`, `JACKPOT!! ${r.prize.coins} Gold Meev`)}
            </span>
          ) : L(`ربحت ${r.prize.labelAr}!`, `You won ${r.prize.label}!`),
          description: L(`ذهب ميف في حسابك 🪙`, `Gold Meev in your account 🪙`),
        });
        resultRef.current?.focus();
      }, SPIN_MS + 60);
    } catch (e) {
      setSpinning(false);
      if (e instanceof ApiError && e.message === "SPIN_COOLDOWN") {
        // the client ApiError only carries the message — rebuild the countdown
        // from the profile, then re-sync the profile from the server
        const base = me?.lastSpinAt ? new Date(me.lastSpinAt).getTime() : Date.now();
        const until = base + SPIN_COOLDOWN_HOURS * 3600 * 1000;
        setCooldownUntil(until > Date.now() ? until : Date.now() + 60_000);
        api
          .me()
          .then((r) => patchMe(r.user))
          .catch(() => {});
        toast({
          title: L("العجلة بردّت بعد!", "The wheel is still cooling down!"),
          description: L("جرّب مرة أخرى بعد انتهاء العدّاد.", "Try again when the timer hits zero."),
        });
      } else {
        toast({
          title: L("تعذّر تدوير العجلة", "Couldn't spin the wheel"),
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        });
      }
    }
  };

  const labels = useMemo(
    () =>
      SPIN_PRIZES.map((p, i) => {
        const angle = i * SEG + SEG / 2;
        const isJackpot = i === SPIN_PRIZES.length - 1;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 w-0 h-0 grid place-items-center pointer-events-none select-none"
            style={{ transform: `rotate(${angle}deg) translateY(-97px)` }}
          >
            <span
              className={cn(
                "block text-[11px] font-black tracking-tight whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,.8)]",
                isJackpot && "text-amber-300 text-xs"
              )}
              style={{ transform: `rotate(${angle > 90 && angle < 270 ? 180 : 0}deg)` }}
            >
              {shortLabel(i)}
            </span>
            <span className="sr-only">{lang === "ar" ? p.labelAr : p.label}</span>
          </span>
        );
      }),
    [lang]
  );

  const cooldownLeft = cooldownUntil ? cooldownUntil - now : 0;
  const intoLevel = (me?.xp ?? 0) % XP_PER_LEVEL;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-3xl glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-center text-center">
            <FerrisWheel className="size-5 text-primary" aria-hidden="true" /> {L("عجلة مكافآت ميف الأسبوعية", "Meev Weekly Rewards Wheel")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* ---------- the wheel ---------- */}
          <div className="relative size-[280px] sm:size-[300px]" role="img" aria-label={L("عجلة الحظ بجوائز أسبوعية", "Weekly prize wheel")}>
            {/* pointer (top, pointing down into the wheel) */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-1.5 z-20">
              <div className="size-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-amber-400 drop-shadow-[0_2px_6px_rgba(255,194,77,.8)]" />
            </div>

            {/* ambient glow */}
            <div className="absolute -inset-2 rounded-full z-0 meev-pulse-glow" aria-hidden="true" />

            {/* rotating disc: segments + dividers + labels */}
            <motion.div
              className="absolute inset-0 rounded-full z-10 shadow-[inset_0_0_36px_rgba(0,0,0,.45)]"
              style={{ background: wheelBackground() }}
              animate={{ rotate: rotation }}
              transition={{ duration: spinning ? SPIN_MS / 1000 : 0.7, ease: spinning ? [0.12, 0.8, 0.16, 1] : "easeOut" }}
            >
              <span
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background:
                    "repeating-conic-gradient(from 0deg, rgba(255,255,255,.22) 0deg 1.6px, transparent 1.6px 45deg)",
                }}
                aria-hidden="true"
              />
              {labels}
            </motion.div>

            {/* PawCoin hub — click to spin */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
              <button
                type="button"
                onClick={spin}
                disabled={spinning || !!cooldownUntil || !!result}
                className="rounded-full bg-background border-4 border-amber-400/80 shadow-xl grid place-items-center p-2
                  hover:scale-105 active:scale-95 transition-transform disabled:cursor-default"
                aria-label={L("دوّر العجلة", "Spin the wheel")}
              >
                <PawCoinIcon size={44} spin={spinning} />
              </button>
            </div>

            {spinning && (
              <div className="absolute inset-0 z-40 grid place-items-center pointer-events-none">
                <Sparkles className="size-6 text-amber-300 animate-pulse" />
              </div>
            )}
          </div>

          {/* balance */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {L("رصيدك:", "Your balance:")} <PawCoins amount={result?.coinsLeft ?? me?.coins ?? 0} size={16} />
          </div>

          {/* result reveal */}
          <AnimatePresence>
            {result && (
              <motion.div
                ref={resultRef}
                tabIndex={-1}
                initial={{ scale: 0.5, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
                className="meev-pop w-full rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 flex items-center
                  justify-center gap-3 text-center outline-none"
              >
                <PawCoinIcon size={26} spin />
                <div className="font-black text-lg">
                  {lang === "ar" ? result.prize.labelAr : result.prize.label}
                  <span className="text-muted-foreground font-semibold text-sm">
                    {" "}
{result.leveledUp ? ` · ${L("مستوى جديد!", "Level up!")}` : ""}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* action */}
          {!result && (
            <Button
              className="w-full h-12 rounded-2xl meev-gradient-btn text-white font-black text-base gap-2"
              disabled={spinning || !!cooldownUntil}
              onClick={spin}
            >
              {spinning ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> {L("جارٍ الدوران…", "Spinning…")}
                </>
              ) : cooldownUntil ? (
                L(`العدّاد: ${fmtCountdown(cooldownLeft)}`, `Next spin in ${fmtCountdown(cooldownLeft)}`)
              ) : (
                <>
                  <FerrisWheel className="size-5" aria-hidden="true" /> {L("دوّر العجلة!", "SPIN THE WHEEL!")}
                </>
              )}
            </Button>
          )}
          {result && (
            <Button variant="outline" className="w-full h-11 rounded-2xl" onClick={onClose}>
              {L("متابعة الاستكشاف", "Back to exploring")}
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            {L(
              `لفة واحدة كل ${SPIN_COOLDOWN_HOURS} ساعة · ${intoLevel}/${XP_PER_LEVEL} نحو المستوى التالي`,
              `One spin every ${SPIN_COOLDOWN_HOURS}h · ${intoLevel}/${XP_PER_LEVEL} XP to next level`
            )}
          </p>
        </div>

        {confettiKey > 0 && <Confetti key={confettiKey} count={result?.prizeIndex === SPIN_PRIZES.length - 1 ? 160 : 90} />}
      </DialogContent>
    </Dialog>
  );
}
