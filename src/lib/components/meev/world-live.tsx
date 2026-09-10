"use client";

// ============================================================
// MEEV v12 — WORLD LIVE (نبض العالم)
// The always-alive intelligence ticker for the home feed.
//
// The spec: "معلومات تتغير بشكل ثانية" — information that
// literally changes EVERY SECOND. Everything here is computed
// client-side from epoch math + deterministic day-seeded
// pseudo-randomness: ZERO network, zero APIs, zero flicker.
//
//   • 1s heartbeat  — live world stats (population / births
//     today / heartbeats since you arrived) via ONE interval.
//   • 7s rotator    — one AnimatePresence slot cycling through
//     30 "هل تعلم؟" facts, 10 MEEV app-world news lines and a
//     6-city deterministic weather snapshot (stable all day,
//     reshuffled daily by local day-of-year).
//
// SSR-safe: nothing time-derived is computed during render
// (stats start null, dayKey starts 0) — real values land in
// the mount effects, so server HTML always matches hydration.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "./i18n";
import { GlobeLive } from "./symbols";
import {
  Users,
  Baby,
  Clock3,
  Lightbulb,
  Newspaper,
  Thermometer,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  WifiOff,
  X,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

// ---------------- deterministic day-seeded randomness ----------------
// One round of mulberry32's finalizer: a stable 0..1 float for an
// integer seed. Same seed → same value on every device, all day.
function unit(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** deterministic Fisher-Yates so the day's line-up is fixed */
function shuffled<T>(arr: readonly T[], seed: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(unit(seed * 1009 + i) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** local day-of-year 1..366 — the weather/facts "edition" key */
function localDayOfYear(): number {
  const n = new Date();
  const start = new Date(n.getFullYear(), 0, 1);
  return Math.max(1, Math.floor((n.getTime() - start.getTime()) / 86400000) + 1);
}

// ---------------- the 1-second heartbeat math ----------------
const POP_EPOCH = Date.UTC(2025, 0, 1); // 2025-01-01
const POP_BASE = 8_246_000_000;
const POP_PER_SEC = 2.31;
const BIRTHS_PER_SEC = 4.3; // since local midnight
// v14: the heartbeat counter is RETIRED (user: "غير فكرة نبضك منذ وصولك").
// The third live chip is now YOUR LOCAL CLOCK — a number that changes
// every single second, fits the panel, and stays personal without any
// heartbeat math to explode.

type LiveStats = { pop: number; births: number; clock: string };

function computeStats(): LiveStats {
  const now = Date.now();
  const pop = POP_BASE + ((now - POP_EPOCH) / 1000) * POP_PER_SEC;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const births = Math.max(0, (now - midnight.getTime()) / 1000) * BIRTHS_PER_SEC;
  const d = new Date();
  const clock = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  return { pop, births, clock };
}

const fmtInt = (n: number) => Math.floor(n).toLocaleString("en-US");

// ---------------- datasets (bilingual, family-friendly) ----------------
type Bi = { ar: string; en: string };

/** هل تعلم؟ — 30 real, delightful world facts */
const FACTS: readonly Bi[] = [
  { ar: "يوم كامل على كوكب الزهرة أطول من سنته!", en: "A full day on Venus lasts longer than its entire year!" },
  { ar: "الأخطبوط لديه ثلاثة قلوب.", en: "An octopus has three hearts." },
  { ar: "دم الأخطبوط أزرق لأنه يعتمد على النحاس.", en: "Octopus blood runs blue — it is copper-based." },
  { ar: "عسل عمره ٣٠٠٠ عام وُجد في مقابر مصرية وما زال صالحاً!", en: "3,000-year-old honey found in Egyptian tombs is still edible!" },
  { ar: "الموز فاكهة توت حقيقية… والفراولة ليست كذلك!", en: "Bananas are true berries — but strawberries are not!" },
  { ar: "برج إيفل يزداد طولاً ١٥ سنتيمتراً في الصيف.", en: "The Eiffel Tower grows about 15 cm taller every summer." },
  { ar: "أسماك القرش وُجدت قبل الأشجار بمئة مليون عام!", en: "Sharks existed 100 million years before trees!" },
  { ar: "دماغك يستهلك خُمس طاقة جسمك كاملاً.", en: "Your brain burns 20% of your whole body's energy." },
  { ar: "ضوء الشمس يصل إلى الأرض في ٨ دقائق و٢٠ ثانية.", en: "Sunlight takes 8 minutes and 20 seconds to reach Earth." },
  { ar: "النجوم في الكون أكثر من حبات الرمل في كل شواطئ الأرض.", en: "There are more stars in the universe than grains of sand on every beach on Earth." },
  { ar: "القارة القطبية الجنوبية أكبر صحراء في العالم!", en: "Antarctica is the largest desert on Earth!" },
  { ar: "حيوان الكسلان يحبس أنفاسه أطول من الدلفين.", en: "A sloth can hold its breath longer than a dolphin can." },
  { ar: "أصغر عظمة في جسمك داخل أذنك وطولها ٣ مليمتر فقط.", en: "The tiniest bone in your body sits in your ear — just 3 mm." },
  { ar: "الماء الساخن قد يتجمد أسرع من الماء البارد أحياناً!", en: "Hot water can sometimes freeze faster than cold water!" },
  { ar: "الفراشات تتذوق طعامها بأقدامها.", en: "Butterflies taste their food with their feet." },
  { ar: "قلب الحوت الأزرق بحجم سيارة صغيرة.", en: "A blue whale's heart is the size of a small car." },
  { ar: "المحيطات تغطي ٧٠٪ من كوكبنا وما زال معظمها مجهولاً.", en: "Oceans cover 70% of our planet — and most remain unexplored." },
  { ar: "الصوت ينتقل في الماء أربع مرات أسرع من الهواء.", en: "Sound travels 4 times faster in water than in air." },
  { ar: "بطانة معدتك تتجدد بالكامل كل بضعة أيام.", en: "Your stomach lining fully renews itself every few days." },
  { ar: "عاصفة على المشتري أكبر من الأرض كلها وتدور منذ قرون.", en: "A storm on Jupiter, bigger than all of Earth, has raged for centuries." },
  { ar: "حيوان الومبت يترك آثاره على شكل مكعبات!", en: "Wombats leave cube-shaped droppings!" },
  { ar: "حديد جسمك يكفي لصنع مسمار صغير.", en: "Your body holds enough iron to forge a small nail." },
  { ar: "الصحراء الكبرى كانت مروجًا خضراء قبل آلاف السنين.", en: "The Sahara was a green savanna a few thousand years ago." },
  { ar: "الأشجار على الأرض أكثر من نجوم مجرة درب التبانة!", en: "Earth has more trees than the Milky Way has stars!" },
  { ar: "سنام الجمل يخزن الدهون… لا الماء!", en: "A camel's hump stores fat — not water!" },
  { ar: "القمر يبتعد عن الأرض ٣.٨ سنتيمتر كل عام.", en: "The Moon drifts 3.8 cm away from Earth every year." },
  { ar: "ثعالب الماء البحرية تتشابك بأيديها أثناء النوم.", en: "Sea otters hold hands while sleeping so they don't drift apart." },
  { ar: "روسيا وحدها تمتد عبر ١١ منطقة زمنية.", en: "Russia alone spans 11 time zones." },
  { ar: "نشارك الموز نحو ٦٠٪ من جيناتنا!", en: "We share about 60% of our genes with a banana!" },
  { ar: "الفلامينغو ورديّ بسبب طعامه فقط.", en: "Flamingos are pink purely because of what they eat." },
];

/** أخبار ميف — 10 playful app-world lines (clearly Meev-flavored) */
const MEEV_NEWS: readonly Bi[] = [
  { ar: "مستخدم جديد من طوكيو انضم إلى ميف قبل قليل.", en: "A new user from Tokyo just joined Meev." },
  { ar: "حمامة دعم انفجرت في غرفة بث مباشر منذ لحظات.", en: "A support dove just burst open in a live room." },
  { ar: "قطة ميف اصطادت سمكة ذهبية في بحيرة ميف الهادئة.", en: "A Meev cat just landed a goldfish in the quiet lake." },
  { ar: "صديقان من قارتين تقابلا في الدردشة العشوائية.", en: "Two strangers from two continents just matched in random chat." },
  { ar: "نبضة بروحٍ غامضة حلّت فوق حلقة النبض الآن.", en: "A mystery-vibe pulse just landed on the ring." },
  { ar: "أسطورة جديدة رفعت غلافها في الاستوديو الذهبي.", en: "A legend just uploaded a new cover in the golden studio." },
  { ar: "رقم قياسي جديد في نبض اليوم — جملة واحدة حصدت آلاف التفاعلات.", en: "A new one-line pulse just harvested thousands of reactions." },
  { ar: "مستخدم من القاهرة فتح متجر تأثيرات الأسماء لأول مرة.", en: "A first-timer from Cairo just opened the name-effects shop." },
  { ar: "قطتان تقاسمتا بثاً مباشراً لساعة كاملة.", en: "Two cats shared one live session for a whole hour." },
  { ar: "لاعبون من كل العالم يتدفقون نحو عجلة الأسبوع.", en: "Players from around the world are flocking to the weekly spin." },
];

/** 6 cities with plausible temp ranges + rain/cloud tendencies */
type City = Bi & { lo: number; hi: number; rainP: number; cloudP: number };
const CITIES: readonly City[] = [
  { ar: "مكة", en: "Makkah", lo: 20, hi: 42, rainP: 0.04, cloudP: 0.1 },
  { ar: "الرياض", en: "Riyadh", lo: 16, hi: 42, rainP: 0.05, cloudP: 0.12 },
  { ar: "القاهرة", en: "Cairo", lo: 14, hi: 36, rainP: 0.08, cloudP: 0.2 },
  { ar: "دبي", en: "Dubai", lo: 22, hi: 42, rainP: 0.06, cloudP: 0.14 },
  { ar: "الدار البيضاء", en: "Casablanca", lo: 12, hi: 26, rainP: 0.18, cloudP: 0.3 },
  { ar: "لندن", en: "London", lo: 4, hi: 24, rainP: 0.34, cloudP: 0.3 },
];

type Cond = "sun" | "cloudsun" | "cloud" | "rain";
type CityWeather = City & { temp: number; cond: Cond };

/** the day's weather edition — same numbers all day, new tomorrow */
function weatherFor(day: number): CityWeather[] {
  return CITIES.map((c, i) => {
    const temp = Math.round(c.lo + unit(day * 131 + i * 17 + 5) * (c.hi - c.lo));
    const r = unit(day * 131 + i * 17 + 91);
    const cond: Cond =
      r < c.rainP ? "rain" : r < c.rainP + c.cloudP ? "cloud" : r < c.rainP + c.cloudP + 0.24 ? "cloudsun" : "sun";
    return { ...c, temp, cond };
  });
}

function CondIcon({ cond }: { cond: Cond }) {
  if (cond === "rain") return <CloudRain className="size-4 text-primary" />;
  if (cond === "cloud") return <Cloud className="size-4 text-muted-foreground" />;
  if (cond === "cloudsun") return <CloudSun className="size-4 text-amber-400" />;
  return <Sun className="size-4 text-amber-400" />;
}

// ---------------- the 7s knowledge rotation ----------------
type Slot = { kind: "fact" | "news"; item: Bi } | { kind: "weather" };

/** 48 slots: all 30 facts + all 10 news, weather sprinkled every ~5th */
function buildRotation(day: number): Slot[] {
  const facts = day > 0 ? shuffled(FACTS, day) : FACTS;
  const news = day > 0 ? shuffled(MEEV_NEWS, day + 77) : MEEV_NEWS;
  const out: Slot[] = [];
  let n = 0;
  for (let i = 0; i < FACTS.length + MEEV_NEWS.length; i++) {
    if (i % 4 === 3 && n < news.length) out.push({ kind: "news", item: news[n++] });
    else out.push({ kind: "fact", item: facts[i - n] });
    if (i % 5 === 4) out.push({ kind: "weather" });
  }
  return out;
}

// ---------------- the component ----------------
function StatChip({ icon: Icon, tone, label, value }: { icon: LucideIcon; tone: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/5 px-3 py-2 flex items-center gap-2.5 min-w-0">
      <span className={`shrink-0 size-8 grid place-items-center rounded-xl bg-white/5 ${tone}`}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[10px] font-bold text-muted-foreground truncate">{label}</div>
        <div className="text-sm font-black tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export default function WorldLive() {
  const { L } = useI18n();
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [dayKey, setDayKey] = useState(0); // 0 = pre-mount deterministic edition
  const [slotIdx, setSlotIdx] = useState(0);
  // v14: closable like the rewards bento (user: "خليها تغلق نبض العالم مثل
  // مكافاات اسبوعية") — a slim strip keeps it one tap away.
  const [dismissed, setDismissed] = useState(false);

  // THE 1-second heartbeat: one interval drives every live number.
  useEffect(() => {
    const beat = () => setStats(computeStats());
    const kick = setTimeout(beat, 0); // first numbers land instantly (post-hydration)
    const t = setInterval(beat, 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
    };
  }, []);

  // the day's edition (facts order + weather) — set once after mount
  useEffect(() => {
    const d = setTimeout(() => setDayKey(localDayOfYear()), 0);
    return () => clearTimeout(d);
  }, []);

  // the 7-second knowledge rotator
  useEffect(() => {
    const t = setInterval(() => setSlotIdx((i) => i + 1), 7000);
    return () => clearInterval(t);
  }, []);

  const rotation = useMemo(() => buildRotation(dayKey), [dayKey]);
  const weather = useMemo(() => weatherFor(dayKey), [dayKey]);
  const slot: Slot = rotation.length ? rotation[slotIdx % rotation.length] : { kind: "weather" };

  // v14: the collapsed state — one slim strip, one tap back
  if (dismissed) {
    return (
      <section aria-label={L("نبض العالم", "Meev World Live")}>
        <button
          onClick={() => setDismissed(false)}
          className="w-full glass rounded-2xl px-4 h-11 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          <GlobeLive size={16} className="text-primary shrink-0" />
          {L("نبض العالم — اضغط للعرض", "Meev World Live — tap to view")}
          <ChevronDown className="size-4 ms-auto" />
        </button>
      </section>
    );
  }

  return (
    <section
      className="relative glass rounded-3xl p-4 sm:p-3.5 overflow-hidden shadow-[0_10px_35px_-16px_rgba(190,177,92,.4)]"
      aria-label={L("نبض العالم — شريط معلومات حي يتحدث كل ثانية", "Meev World Live — an info ticker that updates every second")}
    >
      {/* warm ambient wash (decorative) — v14: the brand gold, calmer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background:
            "radial-gradient(120% 80% at 85% -20%, rgba(190,177,92,.10), transparent 55%), radial-gradient(120% 80% at 0% 120%, rgba(166,146,66,.07), transparent 55%)",
        }}
      />

      <div className="relative flex flex-col gap-2.5">
        {/* header */}
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 size-9 grid place-items-center rounded-2xl meev-gradient-btn text-white">
            <GlobeLive size={18} />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="font-black text-sm sm:text-base">{L("نبض العالم", "Meev World Live")}</div>
            <div className="text-[10px] font-bold tracking-wider text-muted-foreground truncate">
              {L("MEEV WORLD LIVE", "نبض العالم")}
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="ms-auto shrink-0 size-7 grid place-items-center rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label={L("إغلاق نبض العالم ومتابعة التصفح", "Close World Live & keep browsing")}
            title={L("إغلاق", "Close")}
          >
            <X className="size-4" />
          </button>
          <span className="shrink-0 flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/25 px-2 py-1">
            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <span className="text-[10px] font-black tracking-wide text-red-500">{L("مباشر", "LIVE")}</span>
          </span>
        </div>

        {/* the 1-second counter strip — visibly ticks every single second */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="group" aria-label={L("إحصاءات حية", "Live world stats")}>
          <StatChip icon={Users} tone="text-amber-400" label={L("سكان الأرض الآن", "World population")} value={stats ? fmtInt(stats.pop) : "—"} />
          <StatChip icon={Baby} tone="text-primary" label={L("ولادات اليوم", "Births today")} value={stats ? fmtInt(stats.births) : "—"} />
          <StatChip
            icon={Clock3}
            tone="text-primary"
            label={L("توقيتك الآن", "Your local time")}
            value={stats ? stats.clock : "—"}
          />
        </div>

        {/* the rotating knowledge line — a new piece of info every 7s */}
        <div className="min-h-[76px] sm:min-h-[64px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={slotIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {slot.kind === "weather" ? (
                <div className="rounded-2xl border border-border/60 bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Thermometer className="size-3.5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{L("طقس", "Weather")}</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar meev-drag-rail" role="list">
                    {weather.map((c) => (
                      <span
                        key={c.en}
                        role="listitem"
                        className="shrink-0 flex items-center gap-1.5 rounded-xl border border-border/60 bg-white/5 px-2.5 py-1"
                        title={L(`الطقس المتوقع في ${c.ar}`, `Today's weather in ${c.en}`)}
                      >
                        <CondIcon cond={c.cond} />
                        <span className="text-xs font-bold whitespace-nowrap">{L(c.ar, c.en)}</span>
                        <span className="text-xs font-black tabular-nums whitespace-nowrap">{c.temp}°</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-white/5 px-3 py-2.5 h-full">
                  {slot.kind === "fact" ? (
                    <>
                      <span className="shrink-0 size-8 grid place-items-center rounded-xl bg-amber-400/10 text-amber-400">
                        <Lightbulb className="size-4" />
                      </span>
                      <p className="text-sm leading-snug min-w-0">
                        <span className="font-black text-amber-400 me-1.5">{L("هل تعلم؟", "Did you know?")}</span>
                        {L(slot.item.ar, slot.item.en)}
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="shrink-0 size-8 grid place-items-center rounded-xl bg-primary/10 text-primary">
                        <Newspaper className="size-4" />
                      </span>
                      <p className="text-sm leading-snug min-w-0">
                        <span className="font-black text-primary me-1.5">{L("أخبار ميف", "MEEV NEWS")}</span>
                        {L(slot.item.ar, slot.item.en)}
                      </p>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* footer hint */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <WifiOff className="size-3 shrink-0" />
          {L("تتحدث كل ثانية — بلا انترنت", "Ticks every second — fully offline")}
        </div>
      </div>
    </section>
  );
}
