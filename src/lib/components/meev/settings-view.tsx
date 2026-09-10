"use client";

// ============================================================
// MEEV v11 — SettingsView: reorganized two-nav settings hub.
// The old wall-of-cards bento became a clean modern layout:
// desktop = sticky left section nav + single active section pane,
// mobile = horizontal pill tab bar under the header. Same cards
// underneath (account, privacy, blocked, rules, support, about,
// danger) — only the shell changed. Appearance is now a slim card
// (language row → LanguageSheet, crescent theme toggle, live
// preview). Fully bilingual (AR default, RTL) via useI18n L().
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { LanguageSheet } from "./language-sheet";
import { MeevCat } from "./cat-avatar";
import { MeevSwitch } from "./meev-switch";
import { MeevName, MeevNameUser, LevelPill } from "./username";
import { BlockButton } from "./moderation";
import { MeevLogo } from "./logo";
import { PawCoinIcon } from "./pawcoin";
import { timeAgo } from "./chat-shared";
import { SUPPORT_CATEGORIES, CURRENCY } from "@/lib/meev/constants";
import { LANGUAGES } from "./i18n-dict";
import type { SessionInfo, SupportTicketDTO, MiniUser } from "./types";
import { cn } from "@/lib/utils";
import {
  Moon, Sun, UserRound, Mail, KeyRound, BadgeCheck, Lock, LifeBuoy, Info, LogOut,
  Loader2, Check, ShieldOff, Eye, EyeOff, MonitorSmartphone, Globe2, HeartHandshake, Sparkles,
  ScrollText, Trash2, TriangleAlert, Palette, Globe, ShieldCheck, ChevronRight,
  Ban, Siren, Bug, CheckCircle2, ClipboardList, LockKeyhole, MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PawMark } from "./symbols";

// ---------------- shared card shell ----------------
function CardShell({
  icon: Icon,
  title,
  sub,
  className,
  delay = 0,
  children,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn("glass rounded-3xl p-5 space-y-4", className)}
    >
      <header className="flex items-center gap-3">
        <span className="size-10 rounded-2xl grid place-items-center meev-gradient-btn text-white shrink-0 shadow-md">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-black text-base leading-tight">{title}</h2>
          {sub && <p className="text-xs text-muted-foreground leading-snug">{sub}</p>}
        </div>
      </header>
      {children}
    </motion.section>
  );
}

// ---------------- 1 · appearance (v11: slim — language row + crescent + preview) ----------------
function AppearanceCard({ delay = 0 }: { delay?: number }) {
  const { L, lang } = useI18n();
  const me = useMeev((s) => s.me);
  const { resolvedTheme, setTheme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeLang = LANGUAGES.find((l) => l.key === lang);

  // views are client-only (ssr: false), so resolvedTheme is safe to read
  // directly — undefined only for a tick before the provider resolves,
  // and dark is the default in that case
  const isDark = resolvedTheme !== "light";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <CardShell
      delay={delay}
      icon={Palette}
      title={L("المظهر", "Appearance")}
      sub={L("لغة التطبيق والاتجاه والسمة — ٦ لغات · تغيير اللغة يعمل رستارت خفيف", "App language, direction & theme — 6 languages · switching softly restarts")}
    >
      {/* v11: the language row — opens the login-style LanguageSheet.
          Everything (setLang + profile PATCH + light restart) lives inside
          the sheet, so this row stays dumb and safe pre-login too. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        className="w-full rounded-2xl border border-border/60 bg-white/5 hover:bg-primary/10 hover:border-primary/40
          transition-colors p-3.5 flex items-center gap-3 text-start"
      >
        <span className="grid place-items-center size-9 rounded-xl bg-primary/10 border border-primary/25 shrink-0">
          <Globe className="size-4 text-primary" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold truncate">
            {L("اللغة", "Language")} — {activeLang ? `${activeLang.flag} ${activeLang.native}` : "—"}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {L("اضغط لاختيار لغتك", "Tap to choose your language")}
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0 flip-rtl" aria-hidden="true" />
      </button>
      <LanguageSheet open={sheetOpen} onOpenChange={setSheetOpen} />

      {/* v4 theme switch — a clean crescent (no button chrome, per user spec) */}
      <div className="flex items-center justify-between px-1.5">
        <div className="min-w-0">
          <div className="text-sm font-semibold flex items-center gap-2">
            {isDark ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
            {L("سمة الموقع", "Site theme")}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isDark
              ? L("الليلية — ليل ميف الدافئ", "Night — Meev's warm cocoa night")
              : L("النهارية — نهار ميف الكريمي", "Day — Meev's warm cream day")}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={L("تغيير السمة — اضغط الهلال", "Switch theme — tap the crescent")}
          title={L("تغيير السمة — اضغط الهلال", "Switch theme — tap the crescent")}
          className="shrink-0 size-9 grid place-items-center text-foreground/85 hover:text-primary transition-all duration-300 hover:rotate-[18deg] active:scale-90"
        >
          {isDark ? <Moon className="size-6" /> : <Sun className="size-6" />}
        </button>
      </div>

      {/* live preview */}
      <div className="rounded-2xl bg-white/5 border border-border/50 p-3.5 text-sm leading-relaxed">
        <span className="text-muted-foreground text-xs block mb-1">
          {L("معاينة حية:", "Live preview:")}
        </span>
        <MeevName displayName={me?.displayName || "Mochi"} level={me?.level || 1} nameColor={me?.nameColor} nameFx={me?.nameFx} />
        {" "}
        {L("شارَك قصةً الآن مع أصدقائك!", "is sharing a story with your friends right now!")}
      </div>
    </CardShell>
  );
}

// ---------------- 1b · community rules (v4) ----------------
// v12: severity glyphs are lucide symbols, not emoji
const RULES_UI: { icon: LucideIcon; tint: string; titleAr: string; titleEn: string; descAr: string; descEn: string; ladderAr: string; ladderEn: string }[] = [
  {
    icon: Ban,
    tint: "text-rose-400 bg-rose-500/10",
    titleAr: "السبام والدعايا",
    titleEn: "Spam & ads",
    descAr: "التكرار السريع، روابط الدعاية، ودعوات القنوات الخارجية.",
    descEn: "Rapid repeats, promo links and outside-channel invites.",
    ladderAr: "تنبيه ← كتم ١٠ د ← كتم ساعة ← إيقاف ٢٤ ساعة",
    ladderEn: "Warning → 10-min mute → 1-hour mute → 24-hour suspension",
  },
  {
    icon: EyeOff,
    tint: "text-amber-400 bg-amber-500/10",
    titleAr: "السب والإساءة",
    titleEn: "Insults & abuse",
    descAr: "أي كلام بذيء أو مهين — يُحجب تلقائياً فوراً.",
    descEn: "Any foul or abusive language — blocked automatically.",
    ladderAr: "تنبيه ← كتم ٣٠ د ← كتم ٢٤ س ← إيقاف ٣ أيام",
    ladderEn: "Warning → 30-min mute → 24-hour mute → 3-day suspension",
  },
  {
    icon: HeartHandshake,
    tint: "text-primary bg-primary/10",
    titleAr: "تهديد إيذاء النفس",
    titleEn: "Self-harm threats",
    descAr: "نأخذها بجدية كاملة: تُحجب الرسالة ويصلك دعم فوري. التكرار كأسلوب ابتزاز عاطفي (انتحار كذبي) يؤدي للإيقاف.",
    descEn: "Taken extremely seriously: the message is blocked and support arrives instantly. Repeating it as emotional blackmail leads to suspension.",
    ladderAr: "حجب + دعم ← حجب + دعم ← إيقاف ٢٤ س + إحالة للدعم",
    ladderEn: "Blocked + support → blocked + support → 24-hour suspension + referral",
  },
];

function RulesCard({ delay = 0 }: { delay?: number }) {
  const { L, lang } = useI18n();
  return (
    <CardShell
      delay={delay}
      icon={ScrollText}
      title={L("قوانين المجتمع", "Community Rules")}
      sub={L("تُطبَّق تلقائياً على كل الرسائل والمنشورات — ولكل خرق عقوبة", "Enforced automatically on every message & post — each breach has a punishment")}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {RULES_UI.map((r) => (
          <div key={r.titleEn} className="rounded-2xl border border-border/60 bg-white/[0.03] p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn("size-7 grid place-items-center rounded-lg shrink-0", r.tint)} aria-hidden="true">
                <r.icon className="size-4" />
              </span>
              <span className="font-black text-sm leading-tight">{L(r.titleAr, r.titleEn)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {L(r.descAr, r.descEn)}
            </p>
            <div className="text-[10px] font-bold rounded-xl bg-primary/10 border border-primary/20 text-primary px-2.5 py-1.5 leading-relaxed">
              {lang === "ar" ? `العقوبة: ${r.ladderAr}` : `Punishment: ${r.ladderEn}`}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-2">
        <Sparkles className="size-3.5 text-amber-400 shrink-0" />
        {L(
          "الحماية تشتغل خلف الكواليس: مراقبة سبام + فلترة إساءة + دعم فوري لحالات الأزمة، مع إشعار ثنائي اللغة عند كل عقوبة",
          "Protection runs behind the scenes: spam watch + abuse filtering + instant crisis support, with a bilingual notification for every punishment"
        )}
      </p>
    </CardShell>
  );
}

// ---------------- 2 · account (tall) ----------------
function AccountCard({ delay = 0 }: { delay?: number }) {
  const { L } = useI18n();
  const me = useMeev((s) => s.me);
  const patchMe = useMeev((s) => s.patchMe);
  const setMe = useMeev((s) => s.setMe);
  const { toast } = useToast();

  const [name, setName] = useState(me?.displayName ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  // v4 fix: the 2FA switch now syncs with the REAL server state
  // (me.twoFactorEnabled) instead of always starting as off
  const [twoFa, setTwoFa] = useState(!!me?.twoFactorEnabled);
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);

  useEffect(() => {
    setTwoFa(!!me?.twoFactorEnabled);
  }, [me?.twoFactorEnabled]);

  // password reset dialog
  const [pwOpen, setPwOpen] = useState(false);
  const [pwStep, setPwStep] = useState<"request" | "code">("request");
  const [pwEmail, setPwEmail] = useState(me?.email ?? "");
  const [pwOtp, setPwOtp] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwShow, setPwShow] = useState(false);
  const [pwDevOtp, setPwDevOtp] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const loadSessions = useCallback(() => {
    api.sessions().then((r) => setSessions(r.sessions)).catch(() => setSessions([]));
  }, []);
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === me?.displayName) return;
    setNameBusy(true);
    try {
      const r = await api.updateMe({ displayName: trimmed });
      patchMe({ displayName: r.user.displayName });
      toast({
        title: (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
            {L("تم حفظ الاسم", "Name saved")}
          </span>
        ),
      });
    } catch (e) {
      toast({
        title: L("تعذّر الحفظ", "Couldn't save"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setNameBusy(false);
    }
  };

  const toggle2fa = async (v: boolean) => {
    setTwoFaBusy(true);
    setTwoFa(v);
    try {
      await api.set2fa(v);
      toast({
        title: v ? (
          <span className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-amber-400" aria-hidden="true" />
            {L("تم تفعيل التحقق بخطوتين", "2FA enabled")}
          </span>
        ) : L("تم إيقاف التحقق بخطوتين", "2FA disabled"),
        description: v
          ? L("سيصلك كود عبر البريد عند تسجيل الدخول (صندوق العرض التجريبي).", "You'll get an email code at sign-in (demo inbox).")
          : undefined,
      });
    } catch (e) {
      setTwoFa(!v);
      toast({
        title: L("تعذّر تحديث التحقق بخطوتين", "Couldn't update 2FA"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setTwoFaBusy(false);
    }
  };

  const sendResetCode = async () => {
    if (!pwEmail.trim()) return;
    setPwBusy(true);
    try {
      const r = await api.forgotPassword({ email: pwEmail.trim() });
      setPwDevOtp(r.devOtp?.code ?? null);
      setPwStep("code");
      toast({
        title: (
          <span className="flex items-center gap-2">
            <Mail className="size-4 text-primary" aria-hidden="true" />
            {L("تم إرسال كود الاستعادة", "Reset code sent")}
          </span>
        ),
      });
    } catch (e) {
      toast({
        title: L("تعذّر الإرسال", "Couldn't send"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPwBusy(false);
    }
  };

  const doReset = async () => {
    if (pwOtp.length !== 6 || !pwNew) return;
    setPwBusy(true);
    try {
      await api.resetPassword({ email: pwEmail.trim(), code: pwOtp, newPassword: pwNew });
      setPwOpen(false);
      toast({
        title: (
          <span className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-amber-400" aria-hidden="true" />
            {L("تم تحديث كلمة المرور", "Password updated")}
          </span>
        ),
        description: L("تم إنهاء جميع الجلسات للأمان — سجّل دخولك من جديد.", "All sessions were revoked for safety — sign in again."),
      });
      setMe(null); // every session (including this one) was revoked
    } catch (e) {
      toast({
        title: L("فشل التعيين", "Reset failed"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPwBusy(false);
    }
  };

  const revoke = async (id: string, current: boolean) => {
    try {
      await api.revokeSession(id);
      if (current) {
        toast({
          title: (
            <span className="flex items-center gap-2">
              <LogOut className="size-4 text-primary" aria-hidden="true" />
              {L("تم إنهاء جلستك الحالية", "Current session signed out")}
            </span>
          ),
        });
        setMe(null);
        return;
      }
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      toast({
        title: (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
            {L("تم إنهاء الجلسة", "Session revoked")}
          </span>
        ),
      });
    } catch (e) {
      toast({
        title: L("تعذّر الإنهاء", "Couldn't revoke"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  };

  const strength = (() => {
    let s = 0;
    if (pwNew.length >= 8) s++;
    if (/[a-z]/.test(pwNew) && /[A-Z]/.test(pwNew)) s++;
    if (/[0-9]/.test(pwNew)) s++;
    if (/[^A-Za-z0-9]/.test(pwNew)) s++;
    return s;
  })();

  return (
    <CardShell
      delay={delay}
      icon={UserRound}
      title={L("الحساب", "Account")}
      sub={L("بياناتك، الأمان، والجلسات النشطة", "Your identity, security & active sessions")}
    >
      {/* display name */}
      <div className="space-y-1.5">
        <Label htmlFor="display-name">{L("الاسم المعروض", "Display name")}</Label>
        <div className="flex gap-2">
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 32))}
            className="rounded-xl bg-background/60 flex-1"
            placeholder={me?.displayName}
          />
          <Button
            className="rounded-xl meev-gradient-btn text-white font-bold px-4"
            disabled={nameBusy || !name.trim() || name.trim() === me?.displayName}
            onClick={saveName}
          >
            {nameBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            <span className="hidden sm:inline">{L("حفظ", "Save")}</span>
          </Button>
        </div>
      </div>

      {/* email (read-only) */}
      <div className="space-y-1.5">
        <Label htmlFor="email-ro">{L("البريد الإلكتروني", "Email")}</Label>
        <div className="relative">
          <Input
            id="email-ro"
            readOnly
            value={me?.email || L("ضيف — بلا بريد", "guest — no email")}
            className="rounded-xl bg-background/40 pr-10 text-muted-foreground"
          />
          <span className="absolute end-3 top-1/2 -translate-y-1/2" title={me?.emailVerified ? L("موثّق", "Verified") : L("غير موثّق", "Not verified")}>
            {me?.emailVerified ? (
              <BadgeCheck className="size-4 text-emerald-400" />
            ) : (
              <Mail className="size-4 text-muted-foreground/50" />
            )}
          </span>
        </div>
      </div>

      {/* password reset */}
      <button
        type="button"
        onClick={() => {
          setPwStep("request");
          setPwOtp("");
          setPwNew("");
          setPwDevOtp(null);
          setPwEmail(me?.email ?? "");
          setPwOpen(true);
        }}
        className="w-full rounded-2xl border border-border/60 bg-white/5 hover:bg-primary/10 hover:border-primary/40
          transition-colors p-3.5 flex items-center gap-3 text-start"
      >
        <KeyRound className="size-4 text-primary shrink-0" />
        <span className="flex-1 text-sm font-semibold">{L("استعادة كلمة المرور", "Reset password")}</span>
        <span className="text-[10px] text-muted-foreground">{L("بكود بريدي", "via email code")}</span>
      </button>

      {/* 2FA — v6: the REAL toggle (MeevSwitch: big pill, spring thumb, glow) */}
      <div className="rounded-2xl border border-border/60 bg-white/5 p-3.5 flex items-center gap-3 flex-wrap">
        <span className="grid place-items-center size-9 rounded-xl bg-primary/10 border border-primary/25 shrink-0">
          <Lock className="size-4 text-primary" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{L("التحقق بخطوتين", "Two-factor auth")}</div>
          <div className="text-[11px] text-muted-foreground leading-snug">
            {L("كود بريدي عند كل دخول (صندوق تجريبي)", "Email code on every sign-in (demo inbox)")}
          </div>
        </div>
        <MeevSwitch checked={twoFa} onCheckedChange={toggle2fa} busy={twoFaBusy} label={L("التحقق بخطوتين", "Two-factor auth")} />
      </div>

      {/* sessions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <MonitorSmartphone className="size-3.5" /> {L("الجلسات النشطة", "Active sessions")}
          </Label>
          <Button variant="ghost" size="sm" className="h-7 rounded-lg text-xs" onClick={loadSessions}>
            {L("تحديث", "Refresh")}
          </Button>
        </div>
        <div className="rounded-2xl border border-border/50 bg-white/[0.03] divide-y divide-border/40 max-h-72 overflow-y-auto">
          {sessions === null && (
            <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {L("جارٍ التحميل…", "Loading…")}
            </div>
          )}
          {sessions?.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">{L("لا جلسات نشطة", "No active sessions")}</div>
          )}
          {sessions?.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center gap-1.5 truncate">
                  <Globe2 className="size-3.5 text-muted-foreground shrink-0" />
                  {s.device}
                  {s.current && (
                    <Badge className="rounded-full px-1.5 py-0 h-4 text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {L("هذا الجهاز", "this device")}
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {s.ip} · {timeAgo(s.lastSeenAt)} {L("آخر ظهور", "last seen")}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 h-8 shrink-0"
                onClick={() => revoke(s.id, s.current)}
              >
                <ShieldOff className="size-3.5" />
                <span className="hidden sm:inline">{s.current ? L("خروج", "Sign out") : L("إنهاء", "Revoke")}</span>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* ---- password reset dialog ---- */}
      <Dialog open={pwOpen} onOpenChange={(v) => !v && setPwOpen(false)}>
        <DialogContent className="max-w-sm rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" /> {L("استعادة كلمة المرور", "Reset password")}
            </DialogTitle>
          </DialogHeader>

          {pwStep === "request" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{L("البريد الإلكتروني", "Email")}</Label>
                <Input
                  type="email"
                  value={pwEmail}
                  onChange={(e) => setPwEmail(e.target.value)}
                  placeholder="you@catmail.com"
                  className="rounded-xl bg-background/60"
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {L(
                  "سنرسل كوداً من 6 أرقام. ملاحظة: بعد التعيين سيتم تسجيل الخروج من كل الأجهزة.",
                  "We'll send a 6-digit code. Note: every device gets signed out after the reset."
                )}
              </p>
              <Button
                className="w-full rounded-xl meev-gradient-btn text-white font-bold"
                disabled={pwBusy || !pwEmail.trim()}
                onClick={sendResetCode}
              >
                {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                {L("إرسال الكود", "Send code")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {pwDevOtp && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 flex items-center gap-2.5 text-sm">
                  <KeyRound className="size-4 text-amber-500 shrink-0" />
                  <span className="text-muted-foreground">{L("صندوق تجريبي — الكود:", "Demo inbox — code:")}</span>
                  <b className="font-mono text-base tracking-[0.25em] text-amber-400">{pwDevOtp}</b>
                </div>
              )}
              <Input
                value={pwOtp}
                onChange={(e) => setPwOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                inputMode="numeric"
                className="h-12 text-center text-xl font-mono tracking-[0.4em] rounded-xl bg-background/60"
              />
              <div className="relative">
                <Input
                  type={pwShow ? "text" : "password"}
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder={L("كلمة المرور الجديدة", "New password")}
                  className="h-11 rounded-xl bg-background/60 pe-10"
                />
                <button
                  type="button"
                  onClick={() => setPwShow(!pwShow)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={pwShow ? L("إخفاء", "Hide") : L("إظهار", "Show")}
                >
                  {pwShow ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      strength >= i
                        ? strength <= 1
                          ? "bg-destructive"
                          : strength <= 2
                            ? "bg-amber-500"
                            : strength <= 3
                              ? "bg-yellow-400"
                              : "bg-emerald-500"
                        : "bg-border"
                    )}
                  />
                ))}
              </div>
              <Button
                className="w-full rounded-xl meev-gradient-btn text-white font-bold"
                disabled={pwBusy || pwOtp.length !== 6 || pwNew.length < 8}
                onClick={doReset}
              >
                {pwBusy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                {L("تعيين كلمة المرور", "Set new password")}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setPwOpen(false)}>
              {L("إلغاء", "Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardShell>
  );
}

// ---------------- 3 · privacy ----------------
const PRIVACY_FIELDS: { key: string; ar: string; en: string; icon: LucideIcon; descAr: string; descEn: string }[] = [
  { key: "location", ar: "موقعي (المدينة)", en: "My location (city)", icon: Globe2, descAr: "من يرى مدينتك في ملفك", descEn: "Who sees your city on your profile" },
  { key: "interests", ar: "اهتماماتي", en: "My interests", icon: HeartHandshake, descAr: "من يرى اهتماماتك واقتراحات الأصدقاء", descEn: "Who sees your interests & friend suggestions" },
  { key: "presence", ar: "حالة الظهور", en: "My presence", icon: MonitorSmartphone, descAr: "من يرى حالتك (متصل/مشغول)", descEn: "Who sees your online/busy status" },
];

function PrivacyCard({ delay = 0 }: { delay?: number }) {
  const { L } = useI18n();
  const me = useMeev((s) => s.me);
  const patchMe = useMeev((s) => s.patchMe);
  const { toast } = useToast();
  const [privacy, setPrivacy] = useState<Record<string, string>>(
    me?.privacy ?? { location: "friends", interests: "everyone", presence: "everyone" }
  );

  const options: { value: string; ar: string; en: string }[] = [
    { value: "everyone", ar: "الجميع", en: "Everyone" },
    { value: "friends", ar: "الأصدقاء فقط", en: "Friends only" },
    { value: "nobody", ar: "لا أحد", en: "Nobody" },
  ];

  const setField = async (key: string, value: string) => {
    const next = { ...privacy, [key]: value };
    setPrivacy(next);
    try {
      await api.updateMe({ privacy: next });
      patchMe({ privacy: next });
    } catch {
      setPrivacy(privacy); // revert
      toast({ title: L("تعذّر حفظ الخصوصية", "Couldn't save privacy"), variant: "destructive" });
    }
  };

  return (
    <CardShell
      delay={delay}
      icon={Lock}
      title={L("الخصوصية", "Privacy")}
      sub={L("من يرى ماذا من ملفك", "Who sees what on your profile")}
    >
      <div className="space-y-3.5">
        {PRIVACY_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <f.icon className="size-3.5" /> {L(f.ar, f.en)}
            </Label>
            <Select value={privacy[f.key] || "everyone"} onValueChange={(v) => setField(f.key, v)}>
              <SelectTrigger className="w-full rounded-xl h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {L(o.ar, o.en)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-snug">{L(f.descAr, f.descEn)}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

// ---------------- 4 · blocked users ----------------
function BlockedCard({ delay = 0 }: { delay?: number }) {
  const { L } = useI18n();
  const [blocked, setBlocked] = useState<MiniUser[] | null>(null);

  const load = useCallback(() => {
    api.blocklist().then((r) => setBlocked(r.blocked)).catch(() => setBlocked([]));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <CardShell
      delay={delay}
      icon={ShieldOff}
      title={L("المحظورون", "Blocked users")}
      sub={L("من لا يستطيع مراسلتك أو مطابقتك", "Who can't message or match with you")}
    >
      {blocked === null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-1">
          <Loader2 className="size-4 animate-spin" /> {L("جارٍ التحميل…", "Loading…")}
        </div>
      )}

      {blocked !== null && blocked.length === 0 && (
        <div className="rounded-2xl border border-border/50 bg-white/[0.03] p-4 flex items-center gap-3">
          <MeevLogo size={44} mood="sleepy" speed={0.7} />
          <div className="text-sm leading-relaxed">
            {L(
              "لا أحد محظور — كل الأصدقاء ودودون",
              "Nobody blocked — all your friends are friendly"
            )}
          </div>
        </div>
      )}

      {blocked !== null && blocked.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-white/[0.03] divide-y divide-border/40 max-h-64 overflow-y-auto">
          {blocked.map((u) => (
            <div key={u.id} className="p-3 flex items-center gap-3">
              <MeevCat
                seed={u.avatarSeed}
                fallback={u.id}
                size={38}
                level={u.level}
                presence="hidden"
                avatarPhoto={u.avatarPhoto}
                name={u.displayName}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MeevNameUser user={u} compact />
                  <LevelPill level={u.level} />
                </div>
                <div className="text-[11px] text-muted-foreground truncate">@{u.username}</div>
              </div>
              <BlockButton
                userId={u.id}
                displayName={u.displayName}
                blocked
                variant="solid"
                onChange={() => load()}
              />
            </div>
          ))}
        </div>
      )}
    </CardShell>
  );
}

// ---------------- 5 · support (wide) ----------------
// v12: category glyphs rendered as symbols (constants keep the data shape)
const CAT_GLYPH: Record<string, React.ReactNode> = {
  account: <LockKeyhole className="size-3.5" aria-hidden="true" />,
  gifts_coins: <PawCoinIcon size={14} />,
  harassment: <Siren className="size-3.5" aria-hidden="true" />,
  bug: <Bug className="size-3.5" aria-hidden="true" />,
  other: <MessageCircle className="size-3.5" aria-hidden="true" />,
};

function SupportCard({ delay = 0 }: { delay?: number }) {
  const { L, lang } = useI18n();
  const { toast } = useToast();
  const [tab, setTab] = useState("new");
  const [category, setCategory] = useState<string>("account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<SupportTicketDTO[] | null>(null);

  const loadTickets = useCallback(() => {
    api.supportList().then((r) => setTickets(r.tickets)).catch(() => setTickets([]));
  }, []);

  useEffect(() => {
    if (tab === "history") loadTickets();
  }, [tab, loadTickets]);

  const submit = async () => {
    const s = subject.trim();
    const m = message.trim();
    if (!s || !m) return;
    setBusy(true);
    try {
      await api.supportCreate({ subject: s, category, message: m });
      toast({
        title: (
          <span className="flex items-center gap-2">
            <PawMark size={16} className="text-amber-500" />
            {L("وصلت تذكرتك!", "Your ticket landed!")}
          </span>
        ),
        description: L("وصلت فوراً إلى مكتب الدعم — الرد الآلي في «تذاكري» وسيرد عليك الفريق قريباً.", "Landed at the support desk — the auto-reply is in your tickets and the team will answer shortly."),
      });
      setSubject("");
      setMessage("");
      setTab("history");
      setTickets(null);
    } catch (e) {
      toast({
        title: L("تعذّر إرسال التذكرة", "Couldn't submit the ticket"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <CardShell
      delay={delay}
      icon={LifeBuoy}
      title={L("الدعم", "Support")}
      sub={L("فريق الدعم يرد خلال دقائق", "The support crew replies within minutes")}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="glass rounded-full h-10 p-1">
          <TabsTrigger value="new" className="rounded-full px-4 text-sm data-[state=active]:bg-primary/20 gap-1.5">
            <Sparkles className="size-3.5" aria-hidden="true" /> {L("تذكرة جديدة", "New ticket")}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-full px-4 text-sm data-[state=active]:bg-primary/20 gap-1.5">
            <ClipboardList className="size-3.5" aria-hidden="true" /> {L("تذاكري", "My tickets")}
          </TabsTrigger>
        </TabsList>

        {/* ---- new ticket ---- */}
        <TabsContent value="new" className="space-y-4 mt-3">
          <div className="space-y-2">
            <Label>{L("التصنيف", "Category")}</Label>
            <div className="flex flex-wrap gap-2">
              {SUPPORT_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  aria-pressed={category === c.key}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm border transition-all inline-flex items-center gap-1.5",
                    category === c.key
                      ? "border-primary bg-primary/15 text-primary font-bold"
                      : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {CAT_GLYPH[c.key] ?? <MessageCircle className="size-3.5" aria-hidden="true" />}
                  {L(c.labelAr, c.label)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ticket-subject">{L("الموضوع", "Subject")}</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{subject.length}/80</span>
            </div>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value.slice(0, 80))}
              placeholder={L("باختصار: ما المشكلة؟", "In short: what's the issue?")}
              className="rounded-xl bg-background/60"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="ticket-message">{L("التفاصيل", "Details")}</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{message.length}/1000</span>
            </div>
            <Textarea
              id="ticket-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              placeholder={L("اشرح كل شيء… كلما زادت التفاصيل أسرعنا بالمساعدة", "Tell us everything… the more detail, the faster we help")}
              className="rounded-2xl bg-background/50 min-h-28 resize-none"
            />
          </div>

          <Button
            className="rounded-xl meev-gradient-btn text-white font-bold px-6"
            disabled={busy || !subject.trim() || !message.trim()}
            onClick={submit}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {L("إرسال التذكرة", "Submit ticket")}
          </Button>
        </TabsContent>

        {/* ---- my tickets ---- */}
        <TabsContent value="history" className="mt-3">
          {tickets === null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
              <Loader2 className="size-4 animate-spin" /> {L("جارٍ التحميل…", "Loading…")}
            </div>
          )}
          {tickets?.length === 0 && (
            <div className="rounded-2xl border border-border/50 bg-white/[0.03] p-6 text-center space-y-2">
              <MeevLogo size={56} mood="happy" speed={0.8} />
              <div className="text-sm text-muted-foreground">
                {L("لا تذاكر بعد — نأمل ألا تحتاجنا!", "No tickets yet — hope you never need us!")}
              </div>
            </div>
          )}
          <div className="space-y-3 max-h-[22rem] overflow-y-auto pe-1">
            {tickets?.map((t) => {
              return (
                <div key={t.id} className="rounded-2xl border border-border/50 bg-white/[0.03] p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span aria-hidden="true" className="shrink-0">{CAT_GLYPH[t.category] ?? <MessageCircle className="size-3.5" />}</span>
                    <span className="font-bold text-sm">{t.subject}</span>
                    <Badge
                      className={cn(
                        "rounded-full px-2 py-0 h-5 text-[10px] font-bold border",
                        t.status === "answered"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      )}
                    >
                      {t.status === "answered" ? L("تم الرد", "Answered") : L("تنتظر الرد", "Awaiting reply")}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ms-auto">
                      {lang === "ar" ? timeAgo(t.createdAt) : `${timeAgo(t.createdAt)} ago`}
                    </span>
                  </div>

                  {/* my message bubble */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 min-w-0 rounded-2xl rounded-ee-md bg-primary/10 border border-primary/20 px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {t.message}
                    </div>
                  </div>

                  {/* instant auto-ack — replaced the moment a human replies */}
                  {!t.reply && t.autoReply && (
                    <div className="flex gap-2 items-end flex-row-reverse" aria-label={L("الرد الآلي الفوري", "Instant auto-reply")}>
                      <div className="min-w-0 rounded-2xl rounded-es-md bg-transparent border border-dashed border-border/70 px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground/90 mb-1">
                          <MeevLogo size={16} mood="sleepy" speed={0.4} />
                          {L("الرد الآلي · وصل فوراً", "Auto-reply · instant")}
                        </div>
                        {t.autoReply}
                      </div>
                      <MeevLogo size={26} mood="sleepy" speed={0.4} className="mb-0.5 shrink-0 opacity-70" />
                    </div>
                  )}

                  {/* human reply bubble — «فريق ميف» */}
                  {t.reply && (
                    <div className="flex gap-2 items-end flex-row-reverse">
                      <div className="min-w-0 rounded-2xl rounded-es-md bg-white/5 border border-primary/25 px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary mb-1 flex-wrap">
                          <MeevLogo size={18} mood="happy" speed={0.6} />
                          {L("فريق ميف / Meev Support", "Meev Support")}
                          {t.repliedAt && (
                            <span className="ms-auto text-[10px] font-normal text-muted-foreground">
                              {lang === "ar" ? timeAgo(t.repliedAt) : `${timeAgo(t.repliedAt)} ago`}
                            </span>
                          )}
                        </div>
                        {t.reply}
                      </div>
                      <MeevLogo size={30} mood="happy" speed={0.6} className="mb-0.5 shrink-0" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </CardShell>
  );
}

// ---------------- 6 · about ----------------
function AboutCard({ delay = 0 }: { delay?: number }) {
  const { L } = useI18n();
  return (
    <CardShell delay={delay} icon={Info} title={L("حول", "About")} sub="Meev">
      <div className="flex items-center gap-4">
        <MeevLogo size={58} mood="party" speed={1.1} glow />
        <div className="space-y-1">
          <div className="text-xl font-black tracking-tight meev-aurora-text">Meev</div>
          <div className="text-[11px] text-muted-foreground">
            {L("تطبيق التواصل الاجتماعي الشامل", "The social super-app")}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {L(
          "ميف: كل طرق التواصل في تطبيق واحد — مجتمعات، خلاصات، قصص، غرف 1v1، هدايا، مستويات، ومكافآت.",
          "Meev: every way to hang out in one app — communities, feeds, stories, 1v1 rooms, gifting, levels & rewards."
        )}
      </p>
      <div className="flex items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-xs">
        <PawCoinIcon size={18} spin />
        <span>
          {L(
            `${CURRENCY.nameAr} (${CURRENCY.name}) — عملة ميف الرسمية الذهبية`,
            `${CURRENCY.name} (${CURRENCY.nameAr}) — Meev's official golden currency`
          )}
        </span>
      </div>

      {/* (v16: the "download the site files" shortcut is REMOVED per user
          request — visitors must never be able to pull the site's source.) */}

      <p className="text-[11px] text-muted-foreground">
        {L("صُنع بعناية فائقة · Meev © 2027", "Crafted with care · Meev © 2027")}
      </p>
    </CardShell>
  );
}

// ---------------- 7 · danger zone ----------------
function DangerZone() {
  const { L } = useI18n();
  const me = useMeev((s) => s.me);
  const setMe = useMeev((s) => s.setMe);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  // v10: self-service account deletion — the flow the admin console's
  // `delete` command always pointed at ("use account deletion in the
  // settings"). Double-gated exactly like the server: password + typing
  // the username letter-for-letter. Owner accounts are refused (same rule
  // as the console).
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const isOwner = me?.role === "owner";
  const confirmOk = !!me && delConfirm.trim().toLowerCase() === me.username.toLowerCase();

  const signOut = async () => {
    setBusy(true);
    try {
      await api.logout();
    } catch {
      /* best effort — local sign-out regardless */
    }
    setMe(null);
    toast({
      title: (
        <span className="flex items-center gap-2">
          <PawMark size={16} className="text-amber-500" />
          {L("وداعاً! نلهف لعودتك", "Bye for now! Come back soon")}
        </span>
      ),
    });
    setBusy(false);
  };

  const deleteAccount = async () => {
    if (!me || !confirmOk || delBusy) return;
    setDelBusy(true);
    try {
      await api.deleteAccount({ password: delPw, confirm: delConfirm.trim() });
      setMe(null);
      toast({
        title: (
          <span className="flex items-center gap-2">
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            {L("حُذف الحساب نهائياً", "Account permanently deleted")}
          </span>
        ),
        description: L("كل البيانات مُحيت. نفتقدك بالفعل.", "All data erased. You will be missed."),
      });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      toast({
        title: L("تعذّر حذف الحساب", "Couldn't delete the account"),
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18, duration: 0.3 }}
      className="space-y-4"
    >
      {/* sign out — the soft exit */}
      <div
        className="rounded-3xl border border-destructive/30 bg-destructive/[0.05] p-5 flex flex-col sm:flex-row
        items-start sm:items-center gap-4"
      >
        <div className="flex-1">
          <h2 className="font-black text-base text-destructive">{L("تسجيل الخروج", "Sign out")}</h2>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            {L(
              "نهاية الجلسة على هذا الجهاز — بياناتك ومستواك وذهبك بانتظارك عند العودة.",
              "Ends the session on this device — your data, level & Gold will be waiting when you return."
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={signOut}
          className="rounded-2xl border border-destructive/40 text-destructive hover:text-destructive
          hover:bg-destructive/10 font-bold px-6 h-11 shrink-0"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          {L("تسجيل الخروج", "Sign out")}
        </Button>
      </div>

      {/* v10: delete account — the permanent exit (self-service) */}
      <div
        className="rounded-3xl border-2 border-destructive/40 bg-destructive/[0.07] p-5 flex flex-col sm:flex-row
        items-start sm:items-center gap-4"
      >
        <div className="flex-1">
          <h2 className="font-black text-base text-destructive flex items-center gap-1.5">
            <Trash2 className="size-4" /> {L("حذف الحساب نهائياً", "Delete account forever")}
          </h2>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            {L(
              "يمحو حسابك وكل منشوراتك ورسائلك وهداياك ومستواك وذهبك نهائياً — لا رجوع بعده. مخرجك الآمن الأول هو تسجيل الخروج.",
              "Erases your account and every post, message, gift, level and Gold — permanently, no way back. Sign out is the safe exit first."
            )}
          </p>
        </div>
        <Button
          variant="destructive"
          disabled={isOwner}
          onClick={() => { setDelOpen(true); setDelPw(""); setDelConfirm(""); }}
          className="rounded-2xl font-black px-6 h-11 shrink-0"
          title={isOwner ? L("حساب المالك لا يُحذف ذاتياً", "The owner account cannot self-delete") : undefined}
        >
          <Trash2 className="size-4" />
          {L("حذف الحساب", "Delete account")}
        </Button>
      </div>

      {/* the deletion dialog — password + exact username, like the server gate */}
      <Dialog open={delOpen} onOpenChange={(o) => !delBusy && setDelOpen(o)}>
        <DialogContent className="max-w-sm rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-5" />
              {L("تأكيد حذف الحساب", "Confirm account deletion")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {L(
              "هذا نهائي وغير قابل للتراجع. كل شيء يُمحى فوراً: منشورات، قصص، رسائل، هدايا، متابعون، ذهب، ومستوى.",
              "This is final and irreversible. Everything is erased instantly: posts, stories, messages, gifts, followers, Gold, and level."
            )}
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{L("كلمة المرور", "Password")}</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={delPw}
                  onChange={(e) => setDelPw(e.target.value)}
                  className="rounded-xl pe-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={L("إظهار كلمة المرور", "Show password")}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {L("اكتب اسم المستخدم", "Type your username")}{" "}
                <span className="font-black text-foreground">@{me?.username}</span>{" "}
                {L("للتأكيد", "to confirm")}
              </Label>
              <Input
                value={delConfirm}
                onChange={(e) => setDelConfirm(e.target.value)}
                placeholder={me?.username || ""}
                className="rounded-xl"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl flex-1" disabled={delBusy} onClick={() => setDelOpen(false)}>
              {L("تراجع — أبقِ حسابي", "Cancel — keep my account")}
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl flex-1 font-black"
              disabled={delBusy || !confirmOk || !delPw}
              onClick={deleteAccount}
            >
              {delBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {L("احذف نهائياً", "Delete forever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}

// ---------------- root (v11: two-nav — desktop side nav / mobile pill tabs) ----------------
type SectionKey = "appearance" | "account" | "privacy" | "support" | "about" | "danger";

const SECTIONS: { key: SectionKey; icon: LucideIcon; ar: string; en: string }[] = [
  { key: "appearance", icon: Palette, ar: "المظهر", en: "Appearance" },
  { key: "account", icon: UserRound, ar: "الحساب", en: "Account" },
  { key: "privacy", icon: ShieldCheck, ar: "الخصوصية والسلامة", en: "Privacy & Safety" },
  { key: "support", icon: LifeBuoy, ar: "الدعم", en: "Support" },
  { key: "about", icon: Info, ar: "حول", en: "About" },
  { key: "danger", icon: TriangleAlert, ar: "منطقة الخطر", en: "Danger Zone" },
];

function renderSection(key: SectionKey): React.ReactNode {
  switch (key) {
    case "appearance":
      return <AppearanceCard delay={0} />;
    case "account":
      return <AccountCard delay={0} />;
    case "privacy":
      return (
        <>
          <PrivacyCard delay={0} />
          <BlockedCard delay={0.06} />
          <RulesCard delay={0.12} />
        </>
      );
    case "support":
      return <SupportCard delay={0} />;
    case "about":
      return <AboutCard delay={0} />;
    case "danger":
      return <DangerZone />;
  }
}

export function SettingsView() {
  const { L, lang } = useI18n();
  const me = useMeev((s) => s.me);
  const [active, setActive] = useState<SectionKey>("appearance");
  const activeSection = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0];

  if (!me) {
    return (
      <div className="h-full grid place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  // roving-tabindex keyboard nav for both tablists: ↑/↓ always move
  // visually up/down the list; ←/→ are mirrored in Arabic (RTL)
  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const vertical = e.key === "ArrowUp" || e.key === "ArrowDown";
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const eff = !vertical && lang === "ar" ? -dir : dir;
    const idx = SECTIONS.findIndex((s) => s.key === active);
    const next = SECTIONS[(idx + eff + SECTIONS.length) % SECTIONS.length];
    setActive(next.key);
    const list = e.currentTarget.closest("[role=tablist]");
    (list?.querySelector(`[data-tab="${next.key}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24 md:pb-8">
        {/* header */}
        <header className="flex items-center gap-3">
          <span className="size-11 rounded-2xl grid place-items-center meev-gradient-btn text-white shadow-lg shrink-0">
            <MeevLogo size={30} mood="playful" speed={0.9} />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight meev-aurora-text font-display">
              {L("الإعدادات", "Settings")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {L(
                "كل ما تحتاجه، بعناية فائقة",
                "Everything you need, polished to perfection"
              )}
            </p>
          </div>
        </header>

        {/* v11 mobile — horizontal pill tabs, sticky under the header */}
        <div className="md:hidden sticky top-0 z-10 -mx-3 px-3 sm:-mx-4 sm:px-4 py-2 -mt-1 bg-background/80 backdrop-blur-md">
          <div
            role="tablist"
            aria-label={L("أقسام الإعدادات", "Settings sections")}
            className="flex overflow-x-auto no-scrollbar meev-drag-rail gap-2"
          >
            {SECTIONS.map((s) => {
              const isActive = active === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  data-tab={s.key}
                  id={`settings-mtab-${s.key}`}
                  aria-selected={isActive}
                  aria-controls="settings-pane"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActive(s.key)}
                  onKeyDown={onTabKeyDown}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 border transition-all",
                    isActive
                      ? "meev-gradient-btn text-white border-transparent shadow-md"
                      : "glass border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <s.icon className="size-3.5" aria-hidden="true" />
                  {L(s.ar, s.en)}
                </button>
              );
            })}
          </div>
        </div>

        {/* v11 desktop — sticky left nav + the active section pane */}
        <div className="md:flex md:gap-6 items-start">
          <nav
            aria-label={L("أقسام الإعدادات", "Settings sections")}
            className="hidden md:block w-56 shrink-0 sticky top-4"
          >
            <ul role="tablist" className="space-y-1">
              {SECTIONS.map((s) => {
                const isActive = active === s.key;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      role="tab"
                      data-tab={s.key}
                      id={`settings-dtab-${s.key}`}
                      aria-selected={isActive}
                      aria-controls="settings-pane"
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => setActive(s.key)}
                      onKeyDown={onTabKeyDown}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-start transition-all",
                        isActive
                          ? "meev-gradient-btn text-white font-bold shadow-lg"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                      )}
                    >
                      <s.icon className="size-4 shrink-0" aria-hidden="true" />
                      {L(s.ar, s.en)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div role="tabpanel" id="settings-pane" className="flex-1 min-w-0">
            <motion.div
              key={active}
              id={`settings-${active}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              aria-label={L(activeSection.ar, activeSection.en)}
              className="space-y-4"
            >
              {renderSection(active)}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
